const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGIN || '').split(','),
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
  ]
    .map((origin) => String(origin || '').trim())
    .filter(Boolean),
);

const apiLimiter = rateLimit({
  limit: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
});

const authLimiter = rateLimit({
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  message: {
    ok: false,
    error: 'Too many authentication attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
});

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    allowedHeaders: ['Content-Type', 'Authorization', 'x-guest-id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(apiLimiter);

app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'ResumeForge MySQL API is online.',
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'ResumeForge backend is running.',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/voice-assistant', voiceRoutes);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Route not found.',
  });
});

app.use(errorHandler);

module.exports = app;
