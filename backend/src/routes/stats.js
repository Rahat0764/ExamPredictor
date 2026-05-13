const express = require('express');
const { sql } = require('../db');
const router = express.Router();

// GET /api/stats
router.get('/', async (req, res) => {
  try {
    const [s] = await sql`SELECT COUNT(*)::int as count FROM subjects`;
    const [q] = await sql`SELECT COUNT(*)::int as count FROM questions`;
    res.json({ subjects: s.count, questions: q.count });
  } catch (e) {
    res.json({ subjects: 0, questions: 0 });
  }
});

module.exports = router;