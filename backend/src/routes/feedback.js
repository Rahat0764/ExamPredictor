const express = require('express');
const { sendLog } = require('../services/telegram');
const router = express.Router();

router.post('/', async (req, res) => {
  const { predictionIndex, questionText, vote, subject, targetYear } = req.body;

  // FIX: validate vote
  if (!['up', 'down'].includes(vote)) {
    return res.status(400).json({ error: 'Invalid vote value' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  const emoji = vote === 'up' ? '👍' : '👎';
  void sendLog(
    `📝 Feedback ${emoji}\nSubject: ${subject || '?'}\nYear: ${targetYear || '?'}\n#${(predictionIndex || 0) + 1}: ${(questionText || '').slice(0, 80)}…\nIP: ${ip}`,
    vote === 'up' ? 'success' : 'warning'
  );
  res.json({ ok: true });
});

module.exports = router;