require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/auth');
const apiRoutes = require('./src/routes/api');
const webhookRoutes = require('./src/routes/webhooks');

const app = express();
const PORT = process.env.PORT || 10000;

// Webhooks need raw body — register before express.json()
app.use('/api/webhooks', webhookRoutes);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.FRONTEND_URL || 'https://scriptlyst.emyj888.com',
      'https://scriptlyst-frontend.vercel.app',
    ];
    if (
      allowed.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

const healthPayload = () => ({ status: 'ok', timestamp: new Date().toISOString() });
app.get('/health', (_req, res) => res.json(healthPayload()));
app.get('/api/health', (_req, res) => res.json(healthPayload()));

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`Scriptlyst API running on port ${PORT}`));
