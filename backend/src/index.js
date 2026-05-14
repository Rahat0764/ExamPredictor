const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initDB } = require('./db');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const predictRoutes = require('./routes/predict');
const statsRoutes = require('./routes/stats');
const subjectsRoutes = require('./routes/subjects');
const feedbackRoutes = require('./routes/feedback');
const telegramService = require('./services/telegram');

const app = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', 1);

app.use(cors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please wait.' },
});

const predictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many prediction requests. Please wait a minute.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts. Please wait.' },
});

app.use(generalLimiter);

app.get('/ping', (req, res) => res.json({ status: 'alive', time: new Date().toISOString() }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authLimiter, authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/predict', predictLimiter, predictRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/feedback', feedbackRoutes);

app.post('/telegram/webhook', express.json(), (req, res) => {
  telegramService.handleWebhook(req.body);
  res.sendStatus(200);
});

async function start() {
  await initDB();
  telegramService.init();
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}

start().catch(console.error);