const { google } = require('googleapis');

const CDN_BASE = process.env.CLOUDFLARE_CDN_URL || '';

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BACKEND_URL}/auth/callback/google`
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getOAuthClient() });
}

// Get or create a subfolder inside the root Drive folder
async function getOrCreateFolder(folderName, parentId) {
  const drive = getDrive();
  const rootParent = parentId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  // Check if folder exists
  const q = `name='${folderName}' and '${rootParent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({ q, fields: 'files(id, name)', pageSize: 1 });

  if (res.data.files.length > 0) return res.data.files[0].id;

  // Create folder
  const folder = await drive.files.create({
    requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [rootParent] },
    fields: 'id',
  });
  return folder.data.id;
}

// Build CDN URL from Drive file ID
function buildCdnUrl(fileId, fileName) {
  if (!CDN_BASE) return `https://drive.google.com/uc?id=${fileId}`;
  // Cloudflare worker CDN format: /0:/path/to/file
  // We use file ID as path since we don't know nested path
  return `${CDN_BASE}/${fileId}/${encodeURIComponent(fileName)}`;
}

async function uploadFileToDrive(fileBuffer, fileName, mimeType, subFolder = null) {
  const drive = getDrive();
  const { Readable } = require('stream');

  // Determine parent folder
  let parentId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (subFolder) {
    // subFolder can be 'upload/question', 'upload/resource', 'user/profile'
    const parts = subFolder.split('/');
    let currentParent = parentId;
    for (const part of parts) {
      currentParent = await getOrCreateFolder(part, currentParent);
    }
    parentId = currentParent;
  }

  const fileStream = new Readable();
  fileStream.push(fileBuffer);
  fileStream.push(null);

  const response = await drive.files.create({
    requestBody: { name: fileName, parents: [parentId] },
    media: { mimeType, body: fileStream },
    fields: 'id, webViewLink, webContentLink, name',
  });

  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  const fileId = response.data.id;
  const cdnUrl = buildCdnUrl(fileId, fileName);

  return {
    fileId,
    viewUrl: `https://drive.google.com/uc?id=${fileId}`,
    cdnUrl,
    downloadUrl: response.data.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`,
  };
}

async function downloadFileFromDrive(fileId) {
  const drive = getDrive();
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(response.data);
}

module.exports = { uploadFileToDrive, downloadFileFromDrive, buildCdnUrl };