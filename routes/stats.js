const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/stats?month=7&year=2026
router.get('/', async (req, res) => {
    const { month, year } = req.query;
    if (!month || !year) {
        return res.status(400).json({ error: 'month and year required' });
    }

    try {
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

        const result = await pool.query(
            `SELECT 
                t.name AS teacher_name,
                TO_CHAR(a.date, 'YYYY-MM-DD') AS absence_date,
                r.period,
                at_absent.name AS absent_teacher_name,
                r.comment,
                (SELECT string_agg(DISTINCT c.name, ', ') 
                 FROM lessons l 
                 JOIN classes c ON l.class_id = c.id 
                 WHERE l.teacher_id = a.teacher_id AND l.day = a.day AND l.period = r.period) AS classes,
                (SELECT string_agg(DISTINCT s.name, ', ') 
                 FROM lessons l 
                 JOIN subjects s ON l.subject_id = s.id 
                 WHERE l.teacher_id = a.teacher_id AND l.day = a.day AND l.period = r.period) AS subjects
             FROM replacements r
             JOIN absences a ON r.absence_id = a.id
             JOIN teachers t ON r.replacement_teacher_id = t.id
             JOIN teachers at_absent ON a.teacher_id = at_absent.id
             WHERE TO_CHAR(a.date, 'YYYY-MM') = $1
             ORDER BY a.date, r.period, t.name`,
            [yearMonth]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('❌ Ошибка в /api/stats:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;