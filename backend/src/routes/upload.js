const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { sql } = require('../db');
const { uploadFileToDrive } = require('../services/drive');
const { sendLog } = require('../services/telegram');
const router = express.Router();

// Store in memory (stream to Drive)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 600 * 1024 * 1024 }, // 600MB
});

// POST /api/upload/questions
router.post('/questions', upload.array('files', 20), async (req, res) => {
  try {
    const { year, subject } = req.body;
    const files = req.files;
    if (!year || !subject || !files?.length) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const subjectRes = await sql`
      INSERT INTO subjects (name) VALUES (${subject})
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    const subjectId = subjectRes[0].id;
    const results = [];

    for (const file of files) {
      const fileName = `${uuidv4()}-${file.originalname}`;
      const driveResult = await uploadFileToDrive(file.buffer, fileName, file.mimetype);

      await sql`
        INSERT INTO questions (subject_id, year, text, image_url, drive_file_id, mime_type)
        VALUES (${subjectId}, ${parseInt(year)}, '', ${driveResult.viewUrl}, ${driveResult.fileId}, ${file.mimetype})
      `;
      results.push({ url: driveResult.viewUrl, name: file.originalname });
    }

    void sendLog(`📝 Questions uploaded\nSubject: ${subject}\nYear: ${year}\nFiles: ${files.length}`, 'success');
    res.json({ success: true, results });
  } catch (err) {
    void sendLog(`📝 Question upload failed\nError: ${err.message}`, 'error');
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload/resources
router.post('/resources', upload.array('files', 20), async (req, res) => {
  try {
    const { subject, name } = req.body;
    const files = req.files;
    if (!name || !files?.length) {
      return res.status(400).json({ error: 'Name and files required' });
    }

    const results = [];
    for (const file of files) {
      const fileName = `${uuidv4()}-${file.originalname}`;
      const driveResult = await uploadFileToDrive(file.buffer, fileName, file.mimetype);
      const isPdf = file.mimetype.includes('pdf') || file.originalname.endsWith('.pdf');

      await sql`
        INSERT INTO resources (subject_name, name, text, file_url, drive_file_id, mime_type, type)
        VALUES (${subject || null}, ${name}, '', ${driveResult.viewUrl}, ${driveResult.fileId}, ${file.mimetype}, ${isPdf ? 'pdf' : 'image'})
      `;
      results.push({ url: driveResult.viewUrl, name: file.originalname });
    }

    void sendLog(`📚 Resources uploaded\nSubject: ${subject || 'N/A'}\nName: ${name}\nFiles: ${files.length}`, 'success');
    res.json({ success: true, results });
  } catch (err) {
    void sendLog(`📚 Resource upload failed\nError: ${err.message}`, 'error');
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;