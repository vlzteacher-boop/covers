const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/classroomSwaps?day=&date=
router.get('/', async (req, res) => {
    const { day, date } = req.query;
    if (!day || !date) return res.status(400).json({ error: 'day and date required' });
    try {
        const result = await pool.query(
            `SELECT cs.*,
                    (SELECT array_agg(class_id) FROM swap_classes WHERE swap_id = cs.id) as class_ids
             FROM classroom_swaps cs
             WHERE cs.day = $1 AND cs.date = $2`,
            [day, date]
        );
        const swaps = result.rows;
        for (let swap of swaps) {
            const orig = await pool.query('SELECT name FROM rooms WHERE id = $1', [swap.original_room_id]);
            swap.original_room_name = orig.rows[0]?.name;
            const newr = await pool.query('SELECT name FROM rooms WHERE id = $1', [swap.new_room_id]);
            swap.new_room_name = newr.rows[0]?.name;
            if (swap.teacher_id) {
                const t = await pool.query('SELECT name FROM teachers WHERE id = $1', [swap.teacher_id]);
                swap.teacher_name = t.rows[0]?.name;
            }
        }
        res.json(swaps);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/classroomSwaps
router.post('/', async (req, res) => {
    const { day, date, lessonFrom, lessonTo, originalRoomId, newRoomId, teacherId, comment, classIds } = req.body;
    if (!day || !date || !lessonFrom || !lessonTo || !originalRoomId || !newRoomId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const ins = await client.query(
            `INSERT INTO classroom_swaps (day, date, lesson_from, lesson_to, original_room_id, new_room_id, teacher_id, comment)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [day, date, lessonFrom, lessonTo, originalRoomId, newRoomId, teacherId, comment || '']
        );
        const swapId = ins.rows[0].id;
        if (classIds && classIds.length) {
            for (const cid of classIds) {
                await client.query(
                    'INSERT INTO swap_classes (swap_id, class_id) VALUES ($1, $2)',
                    [swapId, cid]
                );
            }
        }
        await client.query('COMMIT');
        res.json({ success: true, id: swapId });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// DELETE /api/classroomSwaps?id=
router.delete('/', async (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
        await pool.query('DELETE FROM classroom_swaps WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;