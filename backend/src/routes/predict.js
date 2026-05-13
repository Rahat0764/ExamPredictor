const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { sql } = require('../db');
const { performOCR } = require('../services/ocr');
const { getPrediction } = require('../services/groq');
const { downloadFileFromDrive } = require('../services/drive');
const { sendLog, updateLog, registerCancelCallback } = require('../services/telegram');
const router = express.Router();

// SSE clients map: jobId -> res
const sseClients = new Map();

// In-memory job cancel flags
const cancelledJobs = new Set();

function sendSSE(jobId, data) {
  const client = sseClients.get(jobId);
  if (client) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// POST /api/predict/start
router.post('/start', async (req, res) => {
  const { subject, targetYear } = req.body;
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;

  if (!subject || !targetYear) return res.status(400).json({ error: 'Missing fields' });

  const jobId = uuidv4().slice(0, 8).toUpperCase();

  await sql`
    INSERT INTO prediction_jobs (id, subject, target_year, status, ip)
    VALUES (${jobId}, ${subject}, ${parseInt(targetYear)}, 'pending', ${ip})
  `;

  // Start background processing (don't await)
  processJob(jobId, subject, parseInt(targetYear), ip).catch(async (err) => {
    await sql`UPDATE prediction_jobs SET status = 'failed' WHERE id = ${jobId}`;
    sendSSE(jobId, { type: 'error', message: err.message });
  });

  res.json({ jobId });
});

// GET /api/predict/progress/:jobId  (SSE stream)
router.get('/progress/:jobId', async (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.flushHeaders();

  sseClients.set(jobId, res);

  // If job already done, send result immediately
  const jobs = await sql`SELECT * FROM prediction_jobs WHERE id = ${jobId}`;
  if (jobs.length > 0) {
    const job = jobs[0];
    if (job.status === 'completed') {
      sendSSE(jobId, { type: 'complete', predictions: job.result.predictions });
      res.end();
      sseClients.delete(jobId);
      return;
    }
    if (job.status === 'cancelled') {
      sendSSE(jobId, { type: 'cancelled', reason: job.cancel_reason });
      res.end();
      sseClients.delete(jobId);
      return;
    }
    if (job.status === 'failed') {
      sendSSE(jobId, { type: 'error', message: 'Job failed' });
      res.end();
      sseClients.delete(jobId);
      return;
    }
  }

  req.on('close', () => {
    sseClients.delete(jobId);
  });
});

// GET /api/predict/status/:jobId (polling fallback)
router.get('/status/:jobId', async (req, res) => {
  const jobs = await sql`SELECT * FROM prediction_jobs WHERE id = ${req.params.jobId}`;
  if (!jobs.length) return res.status(404).json({ error: 'Job not found' });
  const job = jobs[0];
  res.json({
    status: job.status,
    stage: job.progress_stage,
    current: job.progress_current,
    total: job.progress_total,
    message: job.progress_message,
    result: job.status === 'completed' ? job.result : null,
    cancelReason: job.cancel_reason,
  });
});

async function processJob(jobId, subject, targetYear, ip) {
  function isCancelled() {
    return cancelledJobs.has(jobId);
  }

  function progress(stage, current, total, message) {
    const eta = estimateETA(stage, current, total);
    const data = { type: 'progress', stage, current, total, message, eta };
    sendSSE(jobId, data);
    void updateLog(jobId, `📊 Job #${jobId}\n📘 Subject: ${subject}\n🗓️ Year: ${targetYear}\n⏳ Stage: ${message}\n📈 Progress: ${current}/${total}${eta ? `\n⏱️ ETA: ~${eta}s` : ''}`, 'progress');
    return sql`
      UPDATE prediction_jobs
      SET progress_stage=${stage}, progress_current=${current}, progress_total=${total}, progress_message=${message}, updated_at=NOW()
      WHERE id=${jobId}
    `;
  }

  // Register Telegram cancel callback
  registerCancelCallback(jobId, async (jId, feedback) => {
    cancelledJobs.add(jId);
    const reason = feedback || 'Cancelled by admin';
    await sql`UPDATE prediction_jobs SET status='cancelled', cancel_reason=${reason} WHERE id=${jId}`;
    sendSSE(jId, { type: 'cancelled', reason });
    void sendLog(`❌ Job #${jId} cancelled\nReason: ${reason}`, 'warning');
  });

  await sendLog(`🚀 Prediction started\n📘 Subject: ${subject}\n🗓️ Target: ${targetYear}\n🆔 Job: #${jobId}\n🌐 IP: ${ip}`, 'info', jobId);
  await sql`UPDATE prediction_jobs SET status='processing' WHERE id=${jobId}`;

  // Fetch questions
  const questions = await sql`
    SELECT id, year, text, drive_file_id, mime_type, ocr_done, ocr_failed
    FROM questions q
    JOIN subjects s ON q.subject_id = s.id
    WHERE s.name = ${subject} AND q.year < ${targetYear}
    ORDER BY q.year DESC
    LIMIT 60
  `;

  const needOCR = questions.filter(q => !q.ocr_done && !q.ocr_failed && q.drive_file_id);
  await progress('ocr', 0, needOCR.length, `Starting OCR for ${needOCR.length} files...`);

  // Parallel OCR (max 4 at a time)
  const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
  let ocrDone = 0;

  for (const batch of chunk(needOCR, 4)) {
    if (isCancelled()) return;

    await Promise.all(batch.map(async (q) => {
      try {
        const buf = await downloadFileFromDrive(q.drive_file_id);
        const text = await performOCR(buf, q.mime_type);
        await sql`UPDATE questions SET text=${text}, ocr_done=true WHERE id=${q.id}`;
        q.text = text;
      } catch (e) {
        await sql`UPDATE questions SET ocr_failed=true WHERE id=${q.id}`;
      }
      ocrDone++;
      await progress('ocr', ocrDone, needOCR.length, `OCR: ${ocrDone}/${needOCR.length} files processed`);
    }));
  }

  // Fetch resources
  const resources = await sql`
    SELECT id, text, drive_file_id, mime_type, ocr_done, type
    FROM resources
    WHERE (subject_name = ${subject} OR subject_name IS NULL)
    AND NOT ocr_done
    LIMIT 10
  `;

  if (resources.length > 0) {
    await progress('ocr_resources', 0, resources.length, 'Processing study resources...');
    let resDone = 0;
    for (const batch of chunk(resources, 2)) {
      if (isCancelled()) return;
      await Promise.all(batch.map(async (r) => {
        try {
          const buf = await downloadFileFromDrive(r.drive_file_id);
          const text = await performOCR(buf, r.mime_type);
          await sql`UPDATE resources SET text=${text.slice(0, 10000)}, ocr_done=true WHERE id=${r.id}`;
          r.text = text;
        } catch (e) { /* skip */ }
        resDone++;
        await progress('ocr_resources', resDone, resources.length, `Resources: ${resDone}/${resources.length} processed`);
      }));
    }
  }

  if (isCancelled()) return;

  await progress('ai', 0, 1, 'AI analyzing patterns and generating predictions...');

  // Re-fetch updated questions
  const allQuestions = await sql`
    SELECT q.year, q.text FROM questions q
    JOIN subjects s ON q.subject_id = s.id
    WHERE s.name = ${subject} AND q.year < ${targetYear} AND q.text != ''
    ORDER BY q.year DESC LIMIT 50
  `;

  const allResources = await sql`
    SELECT text FROM resources
    WHERE (subject_name = ${subject} OR subject_name IS NULL) AND text != ''
    LIMIT 5
  `;

  const questionsList = allQuestions
    .map(r => `Year ${r.year}: ${r.text.slice(0, 800)}`)
    .join('\n\n');

  const resourcesText = allResources
    .map(r => r.text.slice(0, 2000))
    .join('\n\n');

  const prompt = `You are an expert exam question predictor for Bangladesh education system.
Analyze previous years' questions for "${subject}" and predict the most likely questions for ${targetYear}.

Output ONLY a JSON object: { "predictions": [ { "question_text": string, "probability": number (0-100), "explanation": string, "historical_years": number[], "similar_questions": string[] } ] }

Previous Questions:
${questionsList || 'None uploaded yet'}

Study Resources:
${resourcesText || 'None'}`;

  const result = await getPrediction([
    { role: 'system', content: 'You output only valid JSON.' },
    { role: 'user', content: prompt },
  ]);

  if (!result?.predictions?.length) throw new Error('AI returned invalid response');

  await sql`
    UPDATE prediction_jobs
    SET status='completed', result=${JSON.stringify(result)}, updated_at=NOW()
    WHERE id=${jobId}
  `;

  sendSSE(jobId, { type: 'complete', predictions: result.predictions });
  void sendLog(`✅ Job #${jobId} complete\n📘 ${subject} ${targetYear}\n🔮 ${result.predictions.length} predictions`, 'success');
  cancelledJobs.delete(jobId);
}

function estimateETA(stage, current, total) {
  const remaining = total - current;
  if (stage === 'ocr') return remaining * 3;
  if (stage === 'ocr_resources') return remaining * 5;
  if (stage === 'ai') return 15;
  return null;
}

module.exports = router;