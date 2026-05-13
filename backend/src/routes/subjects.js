const express = require('express');
const { sql } = require('../db');
const router = express.Router();

// GET /api/subjects
router.get('/', async (req, res) => {
  try {
    const rows = await sql`
      SELECT s.id, s.name,
        COUNT(DISTINCT q.year)::int AS years_count,
        COUNT(q.id)::int AS questions_count,
        MIN(q.year) AS earliest_year,
        MAX(q.year) AS latest_year
      FROM subjects s
      LEFT JOIN questions q ON q.subject_id = s.id
      GROUP BY s.id, s.name
      ORDER BY questions_count DESC
    `;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;