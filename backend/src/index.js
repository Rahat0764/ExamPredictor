const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const predictRoutes = require('./routes/predict');
const telegramService = require('./services/telegram');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check (UptimeRobot ping করবে এখানে)
app.get('/ping', (req, res) => res.json({ status: 'alive', time: new Date().toISOString() }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/predict', predictRoutes);

// Telegram webhook
app.post('/telegram/webhook', express.json(), (req, res) => {
  telegramService.handleWebhook(req.body);
  res.sendStatus(200);
});

async function start() {
  await initDB();
  telegramService.init();
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

start().catch(console.error);
