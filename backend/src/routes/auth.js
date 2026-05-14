const express = require('express');
const { google } = require('googleapis');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { sql } = require('../db');
const { generateToken } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// =================== GOOGLE OAUTH ===================

router.get('/google', (req, res) => {
  const mode = req.query.mode || 'login'; // 'login' or 'drive'
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BACKEND_URL}/auth/callback/google`
  );

  const scopes = mode === 'drive'
    ? ['https://www.googleapis.com/auth/drive.file', 'profile', 'email']
    : ['profile', 'email'];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: mode,
  });
  res.redirect(url);
});

router.get('/callback/google', async (req, res) => {
  const { code, state } = req.query;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BACKEND_URL}/auth/callback/google`
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // If drive setup mode, save refresh token and redirect
    if (state === 'drive') {
      console.log('GOOGLE_REFRESH_TOKEN =', tokens.refresh_token);
      return res.send(`
        <h2>✅ Drive Connected!</h2>
        <p>Refresh Token:</p>
        <code style="word-break:break-all">${tokens.refresh_token}</code>
        <p>Add to Render as GOOGLE_REFRESH_TOKEN</p>
      `);
    }

    // User login mode — get profile
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    // Upsert user
    const existing = await sql`SELECT * FROM users WHERE email = ${profile.email}`;
    let user;
    if (existing.length) {
      user = await sql`
        UPDATE users SET name=${profile.name}, avatar_url=${profile.picture},
        provider='google', provider_id=${profile.id}, email_verified=true, updated_at=NOW()
        WHERE email=${profile.email} RETURNING *
      `;
      user = user[0];
    } else {
      user = await sql`
        INSERT INTO users (email, name, avatar_url, provider, provider_id, email_verified)
        VALUES (${profile.email}, ${profile.name}, ${profile.picture}, 'google', ${profile.id}, true)
        RETURNING *
      `;
      user = user[0];
    }

    const token = generateToken(user.id);
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&name=${encodeURIComponent(user.name || '')}&email=${encodeURIComponent(user.email)}&avatar=${encodeURIComponent(user.avatar_url || '')}`);
  } catch (e) {
    console.error('Google auth error:', e.message);
    return res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
  }
});

// =================== GITHUB OAUTH ===================

router.get('/github', (req, res) => {
  const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user:email&redirect_uri=${process.env.BACKEND_URL}/auth/callback/github`;
  res.redirect(url);
});

router.get('/callback/github', async (req, res) => {
  const { code } = req.query;
  try {
    // Get access token
    const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }, { headers: { Accept: 'application/json' } });
    const accessToken = tokenRes.data.access_token;

    // Get profile
    const profileRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = profileRes.data;

    // Get emails
    const emailsRes = await axios.get('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const primaryEmail = emailsRes.data.find(e => e.primary)?.email || profile.email;

    if (!primaryEmail) throw new Error('No email from GitHub');

    const existing = await sql`SELECT * FROM users WHERE email = ${primaryEmail}`;
    let user;
    if (existing.length) {
      user = await sql`
        UPDATE users SET name=${profile.name || profile.login}, avatar_url=${profile.avatar_url},
        provider='github', provider_id=${String(profile.id)}, email_verified=true, updated_at=NOW()
        WHERE email=${primaryEmail} RETURNING *
      `;
      user = user[0];
    } else {
      user = await sql`
        INSERT INTO users (email, name, avatar_url, provider, provider_id, email_verified)
        VALUES (${primaryEmail}, ${profile.name || profile.login}, ${profile.avatar_url}, 'github', ${String(profile.id)}, true)
        RETURNING *
      `;
      user = user[0];
    }

    const token = generateToken(user.id);
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&name=${encodeURIComponent(user.name || '')}&email=${encodeURIComponent(user.email)}&avatar=${encodeURIComponent(user.avatar_url || '')}`);
  } catch (e) {
    console.error('GitHub auth error:', e.message);
    return res.redirect(`${FRONTEND_URL}/login?error=github_failed`);
  }
});

// =================== EMAIL/PASSWORD ===================

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
    if (existing.length) return res.status(400).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const token = uuidv4();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await sql`
      INSERT INTO users (email, name, password_hash, provider, verification_token, verification_expires)
      VALUES (${email.toLowerCase()}, ${name.trim()}, ${hash}, 'email', ${token}, ${expires})
      RETURNING id, email, name
    `;

    await sendVerificationEmail(email.toLowerCase(), name.trim(), token);
    res.json({ ok: true, message: 'Check your email to verify your account' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const users = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()} AND provider = 'email'`;
    if (!users.length) return res.status(401).json({ error: 'Invalid email or password' });

    const user = users[0];
    if (!user.email_verified) return res.status(401).json({ error: 'Please verify your email first', needsVerification: true });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  try {
    const users = await sql`
      SELECT * FROM users WHERE verification_token = ${token} AND verification_expires > NOW()
    `;
    if (!users.length) {
      return res.redirect(`${FRONTEND_URL}/login?error=invalid_token`);
    }
    await sql`
      UPDATE users SET email_verified=true, verification_token=NULL, verification_expires=NULL
      WHERE id=${users[0].id}
    `;
    const jwtToken = generateToken(users[0].id);
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${jwtToken}&name=${encodeURIComponent(users[0].name || '')}&email=${encodeURIComponent(users[0].email)}&avatar=`);
  } catch (e) {
    return res.redirect(`${FRONTEND_URL}/login?error=verify_failed`);
  }
});

router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  try {
    const users = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
    if (!users.length || users[0].email_verified) return res.json({ ok: true });
    const token = uuidv4();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await sql`UPDATE users SET verification_token=${token}, verification_expires=${expires} WHERE id=${users[0].id}`;
    await sendVerificationEmail(email, users[0].name, token);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const users = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()} AND provider = 'email'`;
    if (!users.length) return res.json({ ok: true }); // Don't reveal
    const token = uuidv4();
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await sql`UPDATE users SET reset_token=${token}, reset_expires=${expires} WHERE id=${users[0].id}`;
    await sendPasswordResetEmail(email, users[0].name, token);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 8) return res.status(400).json({ error: 'Invalid request' });
  try {
    const users = await sql`SELECT * FROM users WHERE reset_token = ${token} AND reset_expires > NOW()`;
    if (!users.length) return res.status(400).json({ error: 'Invalid or expired token' });
    const hash = await bcrypt.hash(password, 12);
    await sql`UPDATE users SET password_hash=${hash}, reset_token=NULL, reset_expires=NULL WHERE id=${users[0].id}`;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =================== PROFILE ===================

const { requireAuth } = require('../middleware/auth');

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.patch('/profile', requireAuth, async (req, res) => {
  const { name, avatar_url } = req.body;
  try {
    const updated = await sql`
      UPDATE users SET name=${name || req.user.name}, avatar_url=${avatar_url || req.user.avatar_url}, updated_at=NOW()
      WHERE id=${req.user.id} RETURNING id, email, name, avatar_url, provider, email_verified
    `;
    res.json({ user: updated[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Old drive setup route (keep for compatibility)
router.get('/google/drive-setup', (req, res) => {
  res.redirect('/auth/google?mode=drive');
});

module.exports = router;