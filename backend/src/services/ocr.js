const axios = require('axios');
const pdfParse = require('pdf-parse');

function getOCRKeys() {
  return (process.env.OCR_SPACE_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
}

async function ocrSpace(fileBuffer, lang = 'eng') {
  const keys = getOCRKeys();
  if (keys.length === 0) throw new Error('No OCR.space keys');

  const FormData = require('form-data');

  for (const key of keys) {
    try {
      const form = new FormData();
      form.append('file', fileBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
      form.append('language', lang.includes('ben') ? 'ben' : 'eng');
      form.append('apikey', key);
      form.append('isOverlayRequired', 'false');

      const res = await axios.post('https://api.ocr.space/parse/image', form, {
        headers: form.getHeaders(),
        timeout: 30000,
      });

      const text = res.data?.ParsedResults?.[0]?.ParsedText;
      if (text && text.trim()) return text.trim();
    } catch (err) {
      if (err.response?.status === 429) continue;
      throw err;
    }
  }
  throw new Error('All OCR keys exhausted');
}

async function performOCR(fileBuffer, mimeType = 'image/jpeg') {
  // If PDF with selectable text, use pdf-parse (much faster)
  if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
    try {
      const data = await pdfParse(fileBuffer);
      if (data.text && data.text.trim().length > 50) {
        return data.text.trim();
      }
    } catch (e) {
      // Fall through to OCR
    }
  }

  // Use OCR.space for images and scanned PDFs
  return await ocrSpace(fileBuffer, 'eng+ben');
}

module.exports = { performOCR };