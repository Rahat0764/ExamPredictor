const jwt = require('jsonwebtoken');
const { sql } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-this';

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const token = header.slice(7);
  try {
    const { userId } = jwt.verify(token, JWT_SECRET);
    const users = await sql`SELECT id, email, name, avatar_url, provider, email_verified FROM users WHERE id = ${userId}`;
    if (!users.length) return res.status(401).json({ error: 'User not found' });
    req.user = users[0];
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  const token = header.slice(7);
  try {
    const { userId } = jwt.verify(token, JWT_SECRET);
    const users = await sql`SELECT id, email, name, avatar_url FROM users WHERE id = ${userId}`;
    if (users.length) req.user = users[0];
  } catch (e) {}
  next();
}

module.exports = { generateToken, requireAuth, optionalAuth };