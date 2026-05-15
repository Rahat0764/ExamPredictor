const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { sql } = require('../db');
const { performOCR } = require('../services/ocr');
const { getPrediction } = require('../services/groq');
const { downloadFileFromDrive } = require('../services/drive');
const { sendLog, updateLog, registerCancelCallback, unregisterCancelCallback } = require('../services/telegram');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const sseClients = new Map();
const cancelledJobs = new Set();

function sendSSE(jobId, data) {
  const client = sseClients.get(jobId);
  if (client && !client.writableEnded) {
    try { client.write(`data: ${JSON.stringify(data)}\n\n`); } catch (e) {}
  }
}

function cleanupJob(jobId) {
  cancelledJobs.delete(jobId);
  unregisterCancelCallback(jobId);
  const client = sseClients.get(jobId);
  if (client) {
    try { if (!client.writableEnded) client.end(); } catch (e) {}
    sseClients.delete(jobId);
  }
}

// POST /api/predict/start — requires auth
router.post('/start', requireAuth, async (req, res) => {
  const { subject, targetYear } = req.body;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  if (!subject || !targetYear) return res.status(400).json({ error: 'Missing fields' });
  if (typeof subject !== 'string' || subject.length > 100) return res.status(400).json({ error: 'Invalid subject' });

  const jobId = uuidv4().slice(0, 8).toUpperCase();
  await sql`
    INSERT INTO prediction_jobs (id, subject, target_year, status, ip, user_id)
    VALUES (${jobId}, ${subject.trim()}, ${parseInt(targetYear)}, 'pending', ${ip}, ${req.user.id})
  `;

  processJob(jobId, subject.trim(), parseInt(targetYear), ip, req.user.email).catch(async (err) => {
    console.error('Job failed:', err);
    try {
      await sql`UPDATE prediction_jobs SET status='failed', cancel_reason=${err.message} WHERE id=${jobId}`;
    } catch (e) {}
    sendSSE(jobId, { type: 'error', message: err.message });
    cleanupJob(jobId);
    void sendLog(
      `❌ Job #${jobId} FAILED\n📘 ${subject}\n🗓️ ${targetYear}\n👤 ${req.user.email}\n\nError: ${err.message}\n\nStack:\n${(err.stack || '').slice(0, 1500)}`,
      'error'
    );
  });

  res.json({ jobId });
});

router.get('/progress/:jobId', async (req, res) => {
  const { jobId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.flushHeaders();

  sseClients.set(jobId, res);

  const heartbeat = setInterval(() => {
    if (res.writableEnded) { clearInterval(heartbeat); return; }
    try { res.write(': heartbeat\n\n'); } catch (e) { clearInterval(heartbeat); }
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    sseClients.delete(jobId);
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('error', cleanup);

  try {
    const jobs = await sql`SELECT * FROM prediction_jobs WHERE id = ${jobId}`;
    if (jobs.length > 0) {
      const job = jobs[0];
      if (job.status === 'completed') {
        sendSSE(jobId, { type: 'complete', predictions: job.result.predictions });
        cleanup(); res.end(); return;
      }
      if (job.status === 'cancelled') {
        sendSSE(jobId, { type: 'cancelled', reason: job.cancel_reason });
        cleanup(); res.end(); return;
      }
      if (job.status === 'failed') {
        sendSSE(jobId, { type: 'error', message: job.cancel_reason || 'Job failed' });
        cleanup(); res.end(); return;
      }
    }
  } catch (e) {}
});

router.get('/status/:jobId', async (req, res) => {
  try {
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function processJob(jobId, subject, targetYear, ip, userEmail) {
  function isCancelled() { return cancelledJobs.has(jobId); }

  async function progress(stage, current, total, message) {
    if (isCancelled()) return;
    const eta = estimateETA(stage, current, total);
    sendSSE(jobId, { type: 'progress', stage, current, total, message, eta });
    void updateLog(jobId,
      `📊 #${jobId}\n📘 ${subject} → ${targetYear}\n👤 ${userEmail}\n⏳ ${message}\n📈 ${current}/${total}${eta ? `\n⏱️ ~${eta}s` : ''}`,
      'progress'
    );
    try {
      await sql`
        UPDATE prediction_jobs
        SET progress_stage=${stage}, progress_current=${current}, progress_total=${total},
            progress_message=${message}, updated_at=NOW()
        WHERE id=${jobId}
      `;
    } catch (e) {}
  }

  registerCancelCallback(jobId, async (jId, feedback) => {
    cancelledJobs.add(jId);
    const reason = feedback || 'Cancelled by admin';
    try {
      await sql`UPDATE prediction_jobs SET status='cancelled', cancel_reason=${reason} WHERE id=${jId}`;
    } catch (e) {}
    sendSSE(jId, { type: 'cancelled', reason });
    void sendLog(`❌ Job #${jId} cancelled\nReason: ${reason}`, 'warning');
    setTimeout(() => cleanupJob(jId), 2000);
  });

  await sendLog(
    `🚀 Prediction started\n📘 ${subject}\n🗓️ ${targetYear}\n🆔 #${jobId}\n👤 ${userEmail}\n🌐 ${ip}`,
    'info', jobId
  );
  await sql`UPDATE prediction_jobs SET status='processing' WHERE id=${jobId}`;

  // FIX: explicit columns to avoid ambiguous id
  const questions = await sql`
    SELECT q.id, q.year, q.text, q.drive_file_id, q.mime_type, q.ocr_done, q.ocr_failed
    FROM questions q
    JOIN subjects s ON q.subject_id = s.id
    WHERE s.name = ${subject} AND q.year < ${targetYear}
    ORDER BY q.year DESC
    LIMIT 60
  `;

  const needOCR = questions.filter(q => !q.ocr_done && !q.ocr_failed && q.drive_file_id);
  await progress('ocr', 0, needOCR.length, `Starting OCR for ${needOCR.length} question files...`);

  const chunk = (arr, size) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
  let ocrDone = 0;

  for (const batch of chunk(needOCR, 2)) {
    if (isCancelled()) return;
    await Promise.all(batch.map(async (q) => {
      try {
        const buf = await downloadFileFromDrive(q.drive_file_id);
        const text = await performOCR(buf, q.mime_type);
        await sql`UPDATE questions SET text=${text}, ocr_done=true WHERE id=${q.id}`;
        q.text = text;
        void sendLog(`🔤 OCR ✓ Q#${q.id} Year ${q.year} (${text.length} chars)`, 'info');
      } catch (e) {
        await sql`UPDATE questions SET ocr_failed=true WHERE id=${q.id}`;
        void sendLog(`⚠️ OCR ✗ Q#${q.id}: ${e.message}`, 'warning');
      }
      ocrDone++;
      await progress('ocr', ocrDone, needOCR.length, `Questions OCR: ${ocrDone}/${needOCR.length} done`);
    }));
  }

  if (isCancelled()) return;

  const resources = await sql`
    SELECT r.id, r.text, r.drive_file_id, r.mime_type, r.ocr_done, r.type, r.total_pages, r.pages_processed
    FROM resources r
    WHERE r.subject_name = ${subject} AND NOT r.ocr_done
    LIMIT 5
  `;

  if (resources.length > 0) {
    await progress('ocr_resources', 0, resources.length, 'Processing study resources...');
    let resDone = 0;
    for (const r of resources) {
      if (isCancelled()) return;
      try {
        const buf = await downloadFileFromDrive(r.drive_file_id);
        const text = await performOCR(buf, r.mime_type, async (pagesProcessed, totalPages) => {
          await progress('ocr_resources', resDone, resources.length,
            `Resource ${resDone + 1}/${resources.length}: page ${pagesProcessed}/${totalPages}`);
          try {
            await sql`UPDATE resources SET pages_processed=${pagesProcessed}, total_pages=${totalPages} WHERE id=${r.id}`;
          } catch (e) {}
        });
        await sql`UPDATE resources SET text=${text.slice(0, 15000)}, ocr_done=true WHERE id=${r.id}`;
        void sendLog(`📚 Resource OCR ✓ R#${r.id} (${text.length} chars)`, 'info');
      } catch (e) {
        void sendLog(`⚠️ Resource OCR ✗ R#${r.id}: ${e.message}`, 'warning');
      }
      resDone++;
      await progress('ocr_resources', resDone, resources.length, `Resources: ${resDone}/${resources.length} processed`);
    }
  }

  if (isCancelled()) return;
  await progress('ai', 0, 1, 'AI analyzing patterns and generating predictions...');

  const allQuestions = await sql`
    SELECT q.year, q.text FROM questions q
    JOIN subjects s ON q.subject_id = s.id
    WHERE s.name = ${subject} AND q.year < ${targetYear} AND q.text != ''
    ORDER BY q.year DESC LIMIT 40
  `;

  const allResources = await sql`
    SELECT r.text FROM resources r
    WHERE r.subject_name = ${subject} AND r.text != ''
    LIMIT 3
  `;

  const questionsList = allQuestions.map(r => `Year ${r.year}: ${r.text.slice(0, 500)}`).join('\n\n');
  const resourcesText = allResources.map(r => r.text.slice(0, 1500)).join('\n\n');

  void sendLog(`🧠 Sending to AI\n📘 ${subject} ${targetYear}\nQ: ${allQuestions.length} Res: ${allResources.length}`, 'info');

  const result = await getPrediction([
    { role: 'system', content: 'You output only valid JSON. Always return at least 5 predictions.' },
    { role: 'user', content: `You are an expert exam question predictor for Bangladesh education system.
Analyze previous years' questions for "${subject}" and predict the most likely questions for ${targetYear}.

Output ONLY a JSON object:
{ "predictions": [ { "question_text": string, "probability": number (0-100), "explanation": string, "historical_years": number[], "similar_questions": string[] } ] }

Rules:
- Return 5-8 predictions minimum
- Higher probability = more likely to appear
- Base probability on frequency across years
- Explanation must mention specific years

Previous Questions:
${questionsList || 'None uploaded yet'}

Study Resources:
${resourcesText || 'None'}` },
  ]);

  if (!result?.predictions?.length) throw new Error('AI returned invalid or empty predictions');

  // Validate and sanitize predictions
  const predictions = result.predictions.map(p => ({
    question_text: String(p.question_text || '').slice(0, 1000),
    probability: Math.min(100, Math.max(0, Number(p.probability) || 50)),
    explanation: String(p.explanation || '').slice(0, 500),
    historical_years: Array.isArray(p.historical_years) ? p.historical_years.filter(y => typeof y === 'number') : [],
    similar_questions: Array.isArray(p.similar_questions) ? p.similar_questions.slice(0, 5) : [],
  }));

  await sql`
    UPDATE prediction_jobs
    SET status='completed', result=${JSON.stringify({ predictions })}, updated_at=NOW()
    WHERE id=${jobId}
  `;

  sendSSE(jobId, { type: 'complete', predictions });
  void sendLog(`✅ Job #${jobId} complete\n📘 ${subject} ${targetYear}\n🔮 ${predictions.length} predictions`, 'success');
  cleanupJob(jobId);
}

function estimateETA(stage, current, total) {
  const remaining = total - current;
  if (stage === 'ocr') return remaining * 4;
  if (stage === 'ocr_resources') return remaining * 15;
  if (stage === 'ai') return 20;
  return null;
}

module.exports = router;