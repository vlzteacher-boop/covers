const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const pool = require('./db');
require('dotenv').config();

const app = express();

// Доверие к прокси (для onreza)
app.set('trust proxy', 1);

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());

// ============================================================
// Сессии — MemoryStore с явным сохранением
// ============================================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'my-secret-key-123',
    resave: false,
    saveUninitialized: true,   // временно для теста
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
        httpOnly: true,
        secure: false,          // пока без HTTPS (для теста)
        sameSite: 'lax',
        path: '/'
    }
}));

// Логирование состояния сессии
app.use((req, res, next) => {
    console.log('🔍 Session ID:', req.sessionID);
    console.log('🔍 Session user:', req.session.user);
    console.log('🔍 Cookie header:', req.headers.cookie || 'нет');
    next();
});

// ============================================================
// Маршруты
// ============================================================
const authRoutes = require('./routes/auth');
const teachersRoutes = require('./routes/teachers');
const classesRoutes = require('./routes/classes');
const roomsRoutes = require('./routes/rooms');
const subjectsRoutes = require('./routes/subjects');
const lessonsRoutes = require('./routes/lessons');
const absencesRoutes = require('./routes/absences');
const replacementsRoutes = require('./routes/replacements');
const classroomSwapsRoutes = require('./routes/classroomSwaps');
const exportImportRoutes = require('./routes/exportImport');
const reportRoutes = require('./routes/report');
const statsRoutes = require('./routes/stats');

app.use('/api', authRoutes);
app.use('/api/report', reportRoutes);

const requireAuth = (req, res, next) => {
    if (req.session.user && req.session.user.authenticated) {
        next();
    } else {
        res.status(401).json({ error: 'Не авторизован' });
    }
};

app.use('/api/teachers', requireAuth, teachersRoutes);
app.use('/api/classes', requireAuth, classesRoutes);
app.use('/api/rooms', requireAuth, roomsRoutes);
app.use('/api/subjects', requireAuth, subjectsRoutes);
app.use('/api/lessons', requireAuth, lessonsRoutes);
app.use('/api/absences', requireAuth, absencesRoutes);
app.use('/api/replacements', requireAuth, replacementsRoutes);
app.use('/api/classroomSwaps', requireAuth, classroomSwapsRoutes);
app.use('/api', requireAuth, exportImportRoutes);
app.use('/api/stats', requireAuth, statsRoutes);

app.use((req, res, next) => {
    const isHtml = req.path.endsWith('.html') || req.path === '/';
    const isLoginPage = req.path === '/login.html' || req.path === '/';
    if (isHtml && !isLoginPage) {
        if (!req.session.user || !req.session.user.authenticated) {
            return res.redirect('/login.html');
        }
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Откройте http://localhost:${PORT}/login.html`);
});