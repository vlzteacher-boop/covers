const express = require('express');
const router = express.Router();

// POST /api/login
router.post('/login', (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (!password) {
        return res.status(400).json({ error: 'Пароль не указан' });
    }
    if (password === adminPassword) {
        req.session.user = { authenticated: true };
        // Принудительно сохраняем сессию перед ответом
        req.session.save((err) => {
            if (err) {
                console.error('❌ Ошибка сохранения сессии:', err);
                return res.status(500).json({ error: 'Ошибка сохранения сессии' });
            }
            console.log('✅ Сессия сохранена для ID:', req.sessionID);
            res.json({ success: true });
        });
    } else {
        res.status(401).json({ error: 'Неверный пароль' });
    }
});

// POST /api/logout
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// GET /api/me – проверка авторизации
router.get('/me', (req, res) => {
    if (req.session.user && req.session.user.authenticated) {
        res.json({ authenticated: true });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

module.exports = router;