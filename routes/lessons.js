const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/lessons?teacher_id=&day=&period=
router.get('/', async (req, res) => {
    try {
        let query = `
            SELECT l.id, l.teacher_id, l.day, l.period, 
                   s.id as subject_id, s.name as subject,
                   c.id as class_id, c.name as class,
                   r.id as room_id, r.name as room
            FROM lessons l
            JOIN subjects s ON l.subject_id = s.id
            JOIN classes c ON l.class_id = c.id
            JOIN rooms r ON l.room_id = r.id
            WHERE 1=1
        `;
        const params = [];
        if (req.query.teacher_id) {
            params.push(req.query.teacher_id);
            query += ` AND l.teacher_id = $${params.length}`;
        }
        if (req.query.day) {
            params.push(req.query.day);
            query += ` AND l.day = $${params.length}`;
        }
        if (req.query.period) {
            params.push(req.query.period);
            query += ` AND l.period = $${params.length}`;
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/lessons
router.post('/', async (req, res) => {
    const lessons = req.body; // массив объектов
    if (!Array.isArray(lessons)) {
        return res.status(400).json({ error: 'Expected array of lessons' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertQuery = `
            INSERT INTO lessons (teacher_id, day, period, subject_id, class_id, room_id)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        for (const lesson of lessons) {
            await client.query(insertQuery, [
                lesson.teacher_id,
                lesson.day,
                lesson.period,
                lesson.subject_id,
                lesson.class_id,
                lesson.room_id
            ]);
        }
        await client.query('COMMIT');
        res.json({ success: true, count: lessons.length });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// DELETE /api/lessons?teacher_id=&day=&period=
router.delete('/', async (req, res) => {
    const { teacher_id, day, period } = req.query;
    if (!teacher_id || !day || !period) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    try {
        const result = await pool.query(
            'DELETE FROM lessons WHERE teacher_id = $1 AND day = $2 AND period = $3',
            [teacher_id, day, period]
        );
        res.json({ success: true, deleted: result.rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;