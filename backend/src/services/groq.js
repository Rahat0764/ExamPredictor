const Groq = require('groq-sdk');

function getKeys() {
  return (process.env.GROQ_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
}

async function getPrediction(messages) {
  const keys = getKeys();
  if (!keys.length) throw new Error('No Groq API keys');

  for (const key of keys) {
    try {
      const groq = new Groq({ apiKey: key });
      const completion = await groq.chat.completions.create({
        messages,
        model: 'llama-3.1-70b-versatile',
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      });
      const content = completion.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch (err) {
      if (err.status === 429 || err.status === 503) continue;
      throw err;
    }
  }
  throw new Error('All Groq keys exhausted');
}

module.exports = { getPrediction };