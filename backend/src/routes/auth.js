const express = require('express');
const { google } = require('googleapis');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { sql } = require('../db');
const { generateToken } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');
const { uploadFileToDrive } = require('../services/drive');

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Avatar upload multer — memory, 5MB max, images only
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed for avatar'));
    }
  },
});

// =================== TEMP MAIL BLOCK ===================
// Known disposable/temp mail domains
const BLOCKED_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net',
  'guerrillamail.org', 'spam4.me', 'trashmail.com', 'trashmail.me', 'trashmail.at',
  'trashmail.io', 'trashmail.net', 'dispostable.com', 'mailnull.com', 'spamgourmet.com',
  'spamgourmet.net', 'spamgourmet.org', 'spamgourmet.com', 'fakeinbox.com', 'maildrop.cc',
  'spamfree24.org', 'discard.email', 'mailsac.com', 'mailbucket.org', 'mailscrap.com',
  'tempr.email', 'tempinbox.com', 'tempemail.net', 'emailondeck.com', 'tempemails.net',
  'throwam.com', 'temp-mail.org', 'temp-mail.ru', 'email-fake.com', 'fakemail.net',
  'getairmail.com', 'inboxbear.com', 'inboxkitten.com', 'moakt.com', 'mt2015.com',
  'spambox.us', 'spambox.info', 'spambox.org', 'spambox.me', 'mailnew.com',
  'mytemp.email', 'nwytg.net', 'owlpic.com', 'pfui.ru', 'sendspamhere.com',
  'sharedmailbox.org', 'throam.com', 'throwam.com', 'tmailinator.com',
  'trash-mail.at', 'trashmail.at', 'trashmail.me', 'trashmail.net', 'trashmail.xyz',
  'trbvm.com', 'uggsrock.com', 'zero.zeromail.org', 'zippymail.info', 'r4nd0m.de',
  'fastacura.com', 'fast-email.com', 'fast-mail.org', 'easymail.top', 'getmails.eu',
]);

function isBlockedEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return true;
  if (BLOCKED_DOMAINS.has(domain)) return true;
  // Also block common temp mail patterns
  if (domain.includes('temp') && !['temple.edu', 'templar.com'].includes(domain)) return true;
  if (domain.includes('trash') && !['trashbin.com'].includes(domain)) return true;
  if (domain.includes('fake') && !['fake.org'].includes(domain)) return true;
  if (domain.includes('spam') && !['spam.org'].includes(domain)) return true;
  return false;
}

// Trusted TLDs and domains — basic check
const TRUSTED_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.es', 'yahoo.it', 'yahoo.ca',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'outlook.com', 'outlook.co.uk',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
  'tutanota.com', 'tutamail.com', 'fastmail.com', 'fastmail.fm', 'zoho.com', 'aol.com',
  'rediffmail.com', 'yandex.com', 'yandex.ru', 'mail.ru', 'rambler.ru',
  // Bangladesh common
  'anorr.com', 'grameenphone.com', 'robi.com.bd', 'banglalink.net',
  // Educational
  'edu', // TLD
  // Company emails (allow by TLD)
]);

// Allow educational (.edu, .ac) and company emails, only block known disposable
function isEmailAllowed(email) {
  const lower = email.toLowerCase();
  const domain = lower.split('@')[1];
  if (!domain) return false;

  if (isBlockedEmail(lower)) return false;

  // Allow everything except known blocked domains
  // This is more permissive — blocks temp mail but allows company emails
  return true;
}

// =================== GOOGLE OAUTH ===================

router.get('/google', (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BACKEND_URL}/auth/callback/google`
  );
  const url = oauth2Client.generateAuthFormat({
    access_type: 'offline',
    scope: ['profile', 'email'],
    prompt: 'consent',
  });
  res.redirect(url);
});

// Fix: use generateAuthUrl not generateAuthFormat
router.get('/google', (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BACKEND_URL}/auth/callback/google`
  );
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    prompt: 'consent',
  });
  res.redirect(url);
});

router.get('/callback/google', async (req, res) => {
  const { code } = req.query;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BACKEND_URL}/auth/callback/google`
  );
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

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
    const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }, { headers: { Accept: 'application/json' } });
    const accessToken = tokenRes.data.access_token;

    const profileRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = profileRes.data;

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
  if (name.trim().length < 2) return res.status(400).json({ error: 'Name too short' });

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (!isEmailAllowed(email)) return res.status(400).json({ error: 'Disposable/temporary email addresses are not allowed. Please use a real email.' });

  try {
    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
    if (existing.length) return res.status(400).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const token = uuidv4();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await sql`
      INSERT INTO users (email, name, password_hash, provider, verification_token, verification_expires)
      VALUES (${email.toLowerCase()}, ${name.trim()}, ${hash}, 'email', ${token}, ${expires})
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
    const users = await sql`SELECT * FROM users WHERE verification_token = ${token} AND verification_expires > NOW()`;
    if (!users.length) return res.redirect(`${FRONTEND_URL}/login?error=invalid_token`);
    await sql`UPDATE users SET email_verified=true, verification_token=NULL, verification_expires=NULL WHERE id=${users[0].id}`;
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
    if (!users.length) return res.json({ ok: true });
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

// Upload avatar to Drive user/profile/ folder
router.post('/profile/avatar', requireAuth, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const fileName = `user-${req.user.id}-avatar-${Date.now()}.${ext}`;

    const driveResult = await uploadFileToDrive(
      req.file.buffer,
      fileName,
      req.file.mimetype,
      'user/profile'
    );

    // Update user avatar_url
    const updated = await sql`
      UPDATE users SET avatar_url=${driveResult.cdnUrl}, updated_at=NOW()
      WHERE id=${req.user.id}
      RETURNING id, email, name, avatar_url, provider, email_verified
    `;

    res.json({ user: updated[0], avatarUrl: driveResult.cdnUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/profile', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Name too short' });
  try {
    const updated = await sql`
      UPDATE users SET name=${name.trim()}, updated_at=NOW()
      WHERE id=${req.user.id}
      RETURNING id, email, name, avatar_url, provider, email_verified
    `;
    res.json({ user: updated[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Drive setup — keep for admin use
router.get('/google/drive-setup', (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BACKEND_URL}/auth/callback/google-drive`
  );
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'consent',
  });
  res.redirect(url);
});

router.get('/callback/google-drive', async (req, res) => {
  const { code } = req.query;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BACKEND_URL}/auth/callback/google-drive`
  );
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('GOOGLE_REFRESH_TOKEN =', tokens.refresh_token);
    res.send(`<h2>✅ Drive Token</h2><code>${tokens.refresh_token}</code><p>Add to Render as GOOGLE_REFRESH_TOKEN</p>`);
  } catch (e) {
    res.send(`Error: ${e.message}`);
  }
});

module.exports = router;