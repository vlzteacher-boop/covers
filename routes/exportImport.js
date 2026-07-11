const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/export – выгрузить все данные в JSON
router.get('/export', async (req, res) => {
    try {
        const teachers = await pool.query('SELECT * FROM teachers');
        const classes = await pool.query('SELECT * FROM classes');
        const rooms = await pool.query('SELECT * FROM rooms');
        const subjects = await pool.query('SELECT * FROM subjects');
        const lessons = await pool.query('SELECT * FROM lessons');
        const absences = await pool.query('SELECT * FROM absences');
        const replacements = await pool.query('SELECT * FROM replacements');
        const classroomSwaps = await pool.query('SELECT * FROM classroom_swaps');
        const swapClasses = await pool.query('SELECT * FROM swap_classes');

        const data = {
            teachers: teachers.rows,
            classes: classes.rows,
            rooms: rooms.rows,
            subjects: subjects.rows,
            lessons: lessons.rows,
            absences: absences.rows,
            replacements: replacements.rows,
            classroomSwaps: classroomSwaps.rows,
            swapClasses: swapClasses.rows
        };
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/import – загрузить данные из JSON (очищает существующие)
router.post('/import', async (req, res) => {
    const data = req.body;
    if (!data) return res.status(400).json({ error: 'No data' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Очищаем таблицы с зависимостями (сначала дочерние)
        await client.query('DELETE FROM swap_classes');
        await client.query('DELETE FROM classroom_swaps');
        await client.query('DELETE FROM replacements');
        await client.query('DELETE FROM absences');
        await client.query('DELETE FROM lessons');
        // Справочники можно перезаписать (удаляем и вставляем заново)
        await client.query('DELETE FROM subjects');
        await client.query('DELETE FROM rooms');
        await client.query('DELETE FROM classes');
        await client.query('DELETE FROM teachers');

        // Вставляем справочники
        for (const t of data.teachers || []) {
            await client.query('INSERT INTO teachers (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name', [t.id, t.name]);
        }
        for (const c of data.classes || []) {
            await client.query('INSERT INTO classes (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name', [c.id, c.name]);
        }
        for (const r of data.rooms || []) {
            await client.query('INSERT INTO rooms (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name', [r.id, r.name]);
        }
        for (const s of data.subjects || []) {
            await client.query('INSERT INTO subjects (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name', [s.id, s.name]);
        }
        // Вставляем уроки
        for (const l of data.lessons || []) {
            await client.query('INSERT INTO lessons (id, teacher_id, day, period, subject_id, class_id, room_id) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET teacher_id = EXCLUDED.teacher_id, day = EXCLUDED.day, period = EXCLUDED.period, subject_id = EXCLUDED.subject_id, class_id = EXCLUDED.class_id, room_id = EXCLUDED.room_id', [l.id, l.teacher_id, l.day, l.period, l.subject_id, l.class_id, l.room_id]);
        }
        // Вставляем отсутствия
        for (const a of data.absences || []) {
            await client.query('INSERT INTO absences (id, teacher_id, day, date) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET teacher_id = EXCLUDED.teacher_id, day = EXCLUDED.day, date = EXCLUDED.date', [a.id, a.teacher_id, a.day, a.date]);
        }
        // Вставляем замены
        for (const r of data.replacements || []) {
            await client.query('INSERT INTO replacements (id, absence_id, period, replacement_teacher_id, comment) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET absence_id = EXCLUDED.absence_id, period = EXCLUDED.period, replacement_teacher_id = EXCLUDED.replacement_teacher_id, comment = EXCLUDED.comment', [r.id, r.absence_id, r.period, r.replacement_teacher_id, r.comment]);
        }
        // Вставляем замены кабинетов
        for (const cs of data.classroomSwaps || []) {
            await client.query('INSERT INTO classroom_swaps (id, day, lesson_from, lesson_to, original_room_id, new_room_id, teacher_id, comment) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET day = EXCLUDED.day, lesson_from = EXCLUDED.lesson_from, lesson_to = EXCLUDED.lesson_to, original_room_id = EXCLUDED.original_room_id, new_room_id = EXCLUDED.new_room_id, teacher_id = EXCLUDED.teacher_id, comment = EXCLUDED.comment', [cs.id, cs.day, cs.lesson_from, cs.lesson_to, cs.original_room_id, cs.new_room_id, cs.teacher_id, cs.comment]);
        }
        // Вставляем связи swap_classes
        for (const sc of data.swapClasses || []) {
            await client.query('INSERT INTO swap_classes (swap_id, class_id) VALUES ($1, $2) ON CONFLICT (swap_id, class_id) DO NOTHING', [sc.swap_id, sc.class_id]);
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// POST /api/reset – удалить все данные (справочники остаются)
router.post('/reset', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM swap_classes');
        await client.query('DELETE FROM classroom_swaps');
        await client.query('DELETE FROM replacements');
        await client.query('DELETE FROM absences');
        await client.query('DELETE FROM lessons');
        // Справочники не удаляем
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;