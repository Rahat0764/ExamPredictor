const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

// Step 1: Visit /auth/google to get the refresh token (do this once)
router.get('/google', (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BACKEND_URL}/auth/google/callback`
  );
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'consent',
  });
  res.redirect(url);
});

// Step 2: Google redirects here — print the refresh token
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BACKEND_URL}/auth/google/callback`
  );
  const { tokens } = await oauth2Client.getToken(code);
  console.log('=== SAVE THIS REFRESH TOKEN IN RENDER ENV ===');
  console.log('GOOGLE_REFRESH_TOKEN =', tokens.refresh_token);
  res.send(`
    <h2>✅ Success!</h2>
    <p>Refresh Token:</p>
    <code style="word-break:break-all">${tokens.refresh_token}</code>
    <p>Copy this and add to Render environment variables as GOOGLE_REFRESH_TOKEN</p>
  `);
});

module.exports = router;