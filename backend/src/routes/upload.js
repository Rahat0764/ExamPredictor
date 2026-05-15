const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { sql } = require('../db');
const { uploadFileToDrive } = require('../services/drive');
const { sendLog } = require('../services/telegram');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const router = express.Router();

const ALLOWED_MIMES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/pdf',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 600 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// POST /api/upload/questions — requires auth
router.post('/questions', requireAuth, upload.array('files', 20), async (req, res) => {
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
      // Store in upload/question/ subfolder
      const driveResult = await uploadFileToDrive(file.buffer, fileName, file.mimetype, 'upload/question');

      await sql`
        INSERT INTO questions (subject_id, year, text, image_url, drive_file_id, mime_type)
        VALUES (${subjectId}, ${parseInt(year)}, '', ${driveResult.cdnUrl}, ${driveResult.fileId}, ${file.mimetype})
      `;
      results.push({ url: driveResult.cdnUrl, name: file.originalname });
    }

    void sendLog(`📝 Questions uploaded\nUser: ${req.user.email}\nSubject: ${subject}\nYear: ${year}\nFiles: ${files.length}`, 'success');
    res.json({ success: true, results });
  } catch (err) {
    void sendLog(`📝 Question upload failed\nError: ${err.message}`, 'error');
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload/resources — requires auth
router.post('/resources', requireAuth, upload.array('files', 20), async (req, res) => {
  try {
    const { subject, name } = req.body;
    const files = req.files;
    if (!name || !files?.length) {
      return res.status(400).json({ error: 'Name and files required' });
    }

    const results = [];
    for (const file of files) {
      const fileName = `${uuidv4()}-${file.originalname}`;
      // Store in upload/resource/ subfolder
      const driveResult = await uploadFileToDrive(file.buffer, fileName, file.mimetype, 'upload/resource');
      const isPdf = file.mimetype.includes('pdf') || file.originalname.endsWith('.pdf');

      await sql`
        INSERT INTO resources (subject_name, name, text, file_url, drive_file_id, mime_type, type)
        VALUES (${subject || null}, ${name}, '', ${driveResult.cdnUrl}, ${driveResult.fileId}, ${file.mimetype}, ${isPdf ? 'pdf' : 'image'})
      `;
      results.push({ url: driveResult.cdnUrl, name: file.originalname });
    }

    void sendLog(`📚 Resources uploaded\nUser: ${req.user.email}\nSubject: ${subject || 'N/A'}\nName: ${name}\nFiles: ${files.length}`, 'success');
    res.json({ success: true, results });
  } catch (err) {
    void sendLog(`📚 Resource upload failed\nError: ${err.message}`, 'error');
    res.status(500).json({ error: err.message });
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Max 600MB.' });
  }
  if (err.message?.startsWith('File type not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;