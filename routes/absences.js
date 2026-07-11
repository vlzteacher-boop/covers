const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/absences?day=&date=
router.get('/', async (req, res) => {
    const { day, date } = req.query;
    if (!day || !date) {
        return res.status(400).json({ error: 'day and date required' });
    }
    try {
        const result = await pool.query(
            `SELECT a.id, a.teacher_id, t.name as teacher_name
             FROM absences a
             JOIN teachers t ON a.teacher_id = t.id
             WHERE a.day = $1 AND a.date = $2`,
            [day, date]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/absences
router.post('/', async (req, res) => {
    const { teacher_id, day, date, action } = req.body;
    if (!teacher_id || !day || !date) {
        return res.status(400).json({ error: 'Missing teacher_id, day or date' });
    }
    try {
        if (action === 'add') {
            await pool.query(
                'INSERT INTO absences (teacher_id, day, date) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [teacher_id, day, date]
            );
        } else if (action === 'remove') {
            await pool.query(
                'DELETE FROM absences WHERE teacher_id = $1 AND day = $2 AND date = $3',
                [teacher_id, day, date]
            );
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;