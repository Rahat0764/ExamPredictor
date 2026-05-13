const TelegramBot = require('node-telegram-bot-api');

let bot = null;
// jobId -> { message_id, chat_id } map for inline button updates
const jobMessageMap = new Map();
// jobId -> cancelCallback
const cancelCallbacks = new Map();
// Waiting for feedback text: chatId -> jobId
const pendingFeedback = new Map();

function init() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

  // Set webhook
  const backendUrl = process.env.BACKEND_URL || '';
  if (backendUrl) {
    bot.setWebHook(`${backendUrl}/telegram/webhook`).catch(console.error);
  }
}

function handleWebhook(body) {
  if (!bot) return;
  bot.processUpdate(body);
}

async function sendLog(message, type = 'info', jobId = null, opts = {}) {
  if (!bot || !process.env.TELEGRAM_CHAT_ID) return;

  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️', progress: '⏳' };
  const icon = icons[type] || 'ℹ️';
  const text = `<b>${icon} ExamPredictor</b>\n\n${message}`;

  const chatId = process.env.TELEGRAM_CHAT_ID;

  const sendOpts = {
    parse_mode: 'HTML',
    ...opts,
  };

  if (jobId) {
    sendOpts.reply_markup = {
      inline_keyboard: [[
        { text: '💬 Cancel + Feedback', callback_data: `cancel_feedback:${jobId}` },
        { text: '❌ Cancel Now', callback_data: `cancel_now:${jobId}` },
      ]]
    };
  }

  try {
    const msg = await bot.sendMessage(chatId, text, sendOpts);
    if (jobId) {
      jobMessageMap.set(jobId, { message_id: msg.message_id, chat_id: chatId });
    }
    return msg;
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}

async function updateLog(jobId, message, type = 'progress') {
  if (!bot) return;
  const info = jobMessageMap.get(jobId);
  if (!info) return sendLog(message, type, jobId);

  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️', progress: '⏳' };
  const icon = icons[type] || '⏳';
  const text = `<b>${icon} ExamPredictor</b>\n\n${message}`;

  try {
    await bot.editMessageText(text, {
      chat_id: info.chat_id,
      message_id: info.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '💬 Cancel + Feedback', callback_data: `cancel_feedback:${jobId}` },
          { text: '❌ Cancel Now', callback_data: `cancel_now:${jobId}` },
        ]]
      }
    });
  } catch (e) { /* ignore edit errors */ }
}

function registerCancelCallback(jobId, cb) {
  cancelCallbacks.set(jobId, cb);
}

// Handle button presses and feedback text
if (typeof TelegramBot !== 'undefined') {
  // This runs after init()
}

function setupCallbacks() {
  if (!bot) return;

  bot.on('callback_query', async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;

    if (data.startsWith('cancel_feedback:')) {
      const jobId = data.split(':')[1];
      pendingFeedback.set(String(chatId), jobId);
      await bot.answerCallbackQuery(query.id, { text: 'Please type your feedback reason.' });
      await bot.sendMessage(chatId, '💬 Please type the cancellation reason/feedback:');
    } else if (data.startsWith('cancel_now:')) {
      const jobId = data.split(':')[1];
      const cb = cancelCallbacks.get(jobId);
      if (cb) cb(jobId, null);
      await bot.answerCallbackQuery(query.id, { text: '❌ Cancellation requested!' });
      await bot.sendMessage(chatId, `✅ Job <b>${jobId}</b> cancel requested.`, { parse_mode: 'HTML' });
    }
  });

  bot.on('message', async (msg) => {
    const chatId = String(msg.chat.id);
    if (!pendingFeedback.has(chatId)) return;
    const jobId = pendingFeedback.get(chatId);
    pendingFeedback.delete(chatId);
    const feedback = msg.text;
    const cb = cancelCallbacks.get(jobId);
    if (cb) cb(jobId, feedback);
    await bot.sendMessage(msg.chat.id, `✅ Job <b>${jobId}</b> cancelled with feedback:\n"${feedback}"`, { parse_mode: 'HTML' });
  });
}

module.exports = { init: () => { init(); setupCallbacks(); }, handleWebhook, sendLog, updateLog, registerCancelCallback };