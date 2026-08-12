const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (!password) {
        return res.status(400).json({ error: 'Пароль не указан' });
    }
    if (password === adminPassword) {
        req.session.user = { authenticated: true };
        req.session.save((err) => {
            if (err) {
                console.error('❌ Ошибка сохранения сессии:', err);
                return res.status(500).json({ error: 'Ошибка сохранения сессии' });
            }
            console.log('✅ Сессия сохранена (ID):', req.sessionID);
            res.json({ success: true });
        });
    } else {
        res.status(401).json({ error: 'Неверный пароль' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

router.get('/me', (req, res) => {
    if (req.session.user && req.session.user.authenticated) {
        res.json({ authenticated: true });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

module.exports = router;