import path from 'path';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { startClockTicker }  from './license/clockService';
import { licenseMiddleware } from './license/licenseMiddleware';
import ocrRouter       from './routes/ocr';
import licenseRouter   from './routes/license';
import authRouter      from './routes/auth';
import usersRouter     from './routes/users';
import branchesRouter  from './routes/branches';
import documentsRouter from './routes/documents';
import statsRouter     from './routes/stats';

const app        = express();
const PORT       = process.env.PORT || 3001;
const IS_PROD    = process.env.NODE_ENV === 'production';

// ── Static frontend (production only) ────────────────────────────────────────
// server/dist/index.js → __dirname = <deploy>/server/dist
// frontend dist         → <deploy>/dist
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'dist');

if (IS_PROD) {
  app.use(express.static(FRONTEND_DIST));
}

// ── Middleware ────────────────────────────────────────────────────────────────
if (!IS_PROD) {
  // Dev: chấp nhận request từ Vite dev server
  app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
}

app.use(express.json({ limit: '100mb' }));
app.use(licenseMiddleware);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',           authRouter);
app.use('/api/license',        licenseRouter);
app.use('/api/ocr',            ocrRouter);
app.use('/api/admin/users',    usersRouter);
app.use('/api/admin/branches', branchesRouter);
app.use('/api/documents',      documentsRouter);
app.use('/api/stats',          statsRouter);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', env: IS_PROD ? 'production' : 'development', timestamp: new Date().toISOString() })
);

// ── SPA fallback (production) — phải đặt CUỐI CÙNG ──────────────────────────
// Mọi route không phải /api/* đều trả về index.html để react-router xử lý
if (IS_PROD) {
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    }
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server: http://localhost:${PORT}  [${IS_PROD ? 'PRODUCTION' : 'development'}]`);

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'PASTE_YOUR_REAL_API_KEY_HERE') {
    console.warn('⚠  GEMINI_API_KEY chưa cấu hình trong server/.env');
  } else {
    console.log('✓  Gemini API key loaded');
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('CHANGE_THIS')) {
    console.warn('⚠  JWT_SECRET đang dùng giá trị mặc định — đổi ngay trong production!');
  }

  if (IS_PROD) {
    console.log(`✓  Serving frontend from: ${FRONTEND_DIST}`);
  }

  startClockTicker();
});
