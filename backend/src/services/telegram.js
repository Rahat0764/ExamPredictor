const TelegramBot = require('node-telegram-bot-api');

let bot = null;
const jobMessageMap = new Map();
const cancelCallbacks = new Map();
const pendingFeedback = new Map();

function init() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  const backendUrl = process.env.BACKEND_URL || '';
  if (backendUrl) {
    bot.setWebHook(`${backendUrl}/telegram/webhook`).catch(console.error);
  }
}

function handleWebhook(body) {
  if (!bot) return;
  bot.processUpdate(body);
}

async function sendLog(message, type = 'info', jobId = null) {
  if (!bot || !process.env.TELEGRAM_CHAT_ID) return;
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️', progress: '⏳' };
  const text = `<b>${icons[type] || 'ℹ️'} ExamPredictor</b>\n\n${message}`;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const opts = { parse_mode: 'HTML' };

  if (jobId) {
    opts.reply_markup = {
      inline_keyboard: [[
        { text: '💬 Cancel + Feedback', callback_data: `cancel_feedback:${jobId}` },
        { text: '❌ Cancel Now', callback_data: `cancel_now:${jobId}` },
      ]]
    };
  }

  try {
    const msg = await bot.sendMessage(chatId, text, opts);
    if (jobId) jobMessageMap.set(jobId, { message_id: msg.message_id, chat_id: chatId });
    return msg;
  } catch (e) {
    console.error('Telegram sendLog error:', e.message);
  }
}

async function updateLog(jobId, message, type = 'progress') {
  if (!bot) return;
  const info = jobMessageMap.get(jobId);
  if (!info) return sendLog(message, type, jobId);

  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️', progress: '⏳' };
  const text = `<b>${icons[type] || '⏳'} ExamPredictor</b>\n\n${message}`;

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
  } catch (e) { /* ignore */ }
}

function registerCancelCallback(jobId, cb) {
  cancelCallbacks.set(jobId, cb);
}

// FIX: unregister to prevent stale callbacks
function unregisterCancelCallback(jobId) {
  cancelCallbacks.delete(jobId);
  jobMessageMap.delete(jobId);
}

function setupCallbacks() {
  if (!bot) return;

  bot.on('callback_query', async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;

    if (data.startsWith('cancel_feedback:')) {
      const jobId = data.split(':')[1];
      // FIX: check if callback still exists
      if (!cancelCallbacks.has(jobId)) {
        await bot.answerCallbackQuery(query.id, { text: 'Job already finished.' });
        return;
      }
      pendingFeedback.set(String(chatId), jobId);
      await bot.answerCallbackQuery(query.id, { text: 'Type your reason below.' });
      await bot.sendMessage(chatId, '💬 Type the cancellation reason:');
    } else if (data.startsWith('cancel_now:')) {
      const jobId = data.split(':')[1];
      const cb = cancelCallbacks.get(jobId);
      if (!cb) {
        await bot.answerCallbackQuery(query.id, { text: 'Job already finished.' });
        return;
      }
      cb(jobId, null);
      await bot.answerCallbackQuery(query.id, { text: '❌ Cancelled!' });
      await bot.sendMessage(chatId, `✅ Job <b>${jobId}</b> cancel requested.`, { parse_mode: 'HTML' });
    }
  });

  bot.on('message', async (msg) => {
    const chatId = String(msg.chat.id);
    if (!msg.text || !pendingFeedback.has(chatId)) return;
    const jobId = pendingFeedback.get(chatId);
    pendingFeedback.delete(chatId);
    const cb = cancelCallbacks.get(jobId);
    if (!cb) {
      await bot.sendMessage(msg.chat.id, `ℹ️ Job #${jobId} already finished.`);
      return;
    }
    cb(jobId, msg.text);
    await bot.sendMessage(msg.chat.id, `✅ Job <b>${jobId}</b> cancelled.\nReason: "${msg.text}"`, { parse_mode: 'HTML' });
  });
}

module.exports = {
  init: () => { init(); setupCallbacks(); },
  handleWebhook,
  sendLog,
  updateLog,
  registerCancelCallback,
  unregisterCancelCallback,
};