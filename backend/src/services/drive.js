const { google } = require('googleapis');

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BACKEND_URL || 'https://your-render-backend.onrender.com'}/auth/google/callback`
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
  return oauth2Client;
}

async function uploadFileToDrive(fileBuffer, fileName, mimeType) {
  const auth = getOAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const { Readable } = require('stream');

  const fileStream = new Readable();
  fileStream.push(fileBuffer);
  fileStream.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    },
    media: {
      mimeType,
      body: fileStream,
    },
    fields: 'id, webViewLink, webContentLink',
  });

  // Make file publicly readable
  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return {
    fileId: response.data.id,
    viewUrl: `https://drive.google.com/uc?id=${response.data.id}`,
    downloadUrl: response.data.webContentLink,
  };
}

async function downloadFileFromDrive(fileId) {
  const auth = getOAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(response.data);
}

module.exports = { uploadFileToDrive, downloadFileFromDrive };