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
  origin: [
    process.env.FRONTEND_URL || 'https://scriptlyst.emyj888.com',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  credentials: true,
}));

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`Scriptlyst API running on port ${PORT}`));
