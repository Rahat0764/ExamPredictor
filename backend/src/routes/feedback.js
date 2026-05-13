const express = require('express');
const { sendLog } = require('../services/telegram');
const router = express.Router();

// POST /api/feedback
router.post('/', async (req, res) => {
  const { predictionIndex, questionText, vote, subject, targetYear } = req.body;
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  const emoji = vote === 'up' ? '👍' : '👎';
  void sendLog(
    `📝 Feedback\n${emoji} ${vote}\nSubject: ${subject}\nYear: ${targetYear}\n#${predictionIndex + 1}: ${questionText?.slice(0, 80)}…\nIP: ${ip}`,
    vote === 'up' ? 'success' : 'warning'
  );
  res.json({ ok: true });
});

module.exports = router;