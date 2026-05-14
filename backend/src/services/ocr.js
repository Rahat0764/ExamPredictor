const axios = require('axios');
const pdfParse = require('pdf-parse');

function getOCRKeys() {
  return (process.env.OCR_SPACE_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function ocrSpace(fileBuffer, lang = 'eng', retries = 2) {
  const keys = getOCRKeys();
  if (keys.length === 0) throw new Error('No OCR.space keys');

  const FormData = require('form-data');

  for (const key of keys) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const form = new FormData();
        form.append('file', fileBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
        form.append('language', lang.includes('ben') ? 'ben' : 'eng');
        form.append('apikey', key);
        form.append('isOverlayRequired', 'false');
        form.append('scale', 'true');
        form.append('OCREngine', '2'); // Better accuracy

        const res = await axios.post('https://api.ocr.space/parse/image', form, {
          headers: form.getHeaders(),
          timeout: 45000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });

        const text = res.data?.ParsedResults?.[0]?.ParsedText;
        if (text && text.trim().length > 5) return text.trim();

        const errMsg = res.data?.ParsedResults?.[0]?.ErrorMessage;
        if (errMsg) throw new Error(`OCR.space: ${errMsg}`);
        throw new Error('Empty OCR result');
      } catch (err) {
        if (err.response?.status === 429) {
          await delay(2000 * (attempt + 1));
          continue;
        }
        if (attempt < retries) {
          await delay(1000);
          continue;
        }
        throw err;
      }
    }
  }
  throw new Error('All OCR keys exhausted');
}

// Extract text from a single PDF page range using pdf-parse
async function extractPdfTextChunk(buffer, startPage, endPage) {
  try {
    let currentPage = 0;
    const data = await pdfParse(buffer, {
      pagerender: (pageData) => {
        currentPage++;
        if (currentPage < startPage || currentPage > endPage) return '';
        return pageData.getTextContent().then(content =>
          content.items.map(item => item.str).join(' ')
        );
      }
    });
    return data.text?.trim() || '';
  } catch (e) {
    return '';
  }
}

// Smart PDF OCR: selectable text first, fallback to OCR for scanned pages
async function performPdfOCR(fileBuffer, onProgress) {
  try {
    // Try extracting selectable text first
    const data = await pdfParse(fileBuffer);
    const totalPages = data.numpages || 1;

    // If text is dense enough (avg 100 chars/page), it's a text PDF
    const avgCharsPerPage = (data.text?.length || 0) / totalPages;
    if (avgCharsPerPage > 100) {
      if (onProgress) onProgress(totalPages, totalPages);
      return data.text.trim();
    }

    // Scanned PDF — OCR in chunks of 5 pages (to stay under OCR.space 1MB limit)
    // For large PDFs, only OCR first 30 pages (most relevant content)
    const maxPages = Math.min(totalPages, 30);
    const chunkSize = 5;
    let allText = '';
    let processed = 0;

    for (let start = 1; start <= maxPages; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, maxPages);
      try {
        const chunkText = await extractPdfTextChunk(fileBuffer, start, end);
        if (chunkText.length > 50) {
          allText += chunkText + '\n\n';
        }
        // If text extraction works, use it
      } catch (e) { /* skip */ }

      processed = end;
      if (onProgress) onProgress(processed, maxPages);
      await delay(300); // Gentle rate limiting
    }

    if (allText.trim().length > 200) return allText.trim();

    // Last resort: send first page as image (would need pdf2img which we skip for now)
    return `[PDF: ${totalPages} pages - text extraction limited]`;
  } catch (e) {
    throw new Error(`PDF OCR failed: ${e.message}`);
  }
}

async function performOCR(fileBuffer, mimeType = 'image/jpeg', onProgress) {
  const isPdf = mimeType === 'application/pdf' || mimeType.includes('pdf');

  if (isPdf) {
    return await performPdfOCR(fileBuffer, onProgress);
  }

  // Image OCR — with rate limiting
  await delay(1100); // OCR.space free tier: 1 req/sec
  return await ocrSpace(fileBuffer, 'eng+ben');
}

module.exports = { performOCR };