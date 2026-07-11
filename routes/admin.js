const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/export - экспорт всех данных
router.get('/export', async (req, res) => {
    try {
        const teachers = await pool.query('SELECT * FROM teachers');
        const classes = await pool.query('SELECT * FROM classes');
        const rooms = await pool.query('SELECT * FROM rooms');
        const subjects = await pool.query('SELECT * FROM subjects');
        const lessons = await pool.query('SELECT * FROM lessons');
        const absences = await pool.query('SELECT * FROM absences');
        const replacements = await pool.query('SELECT * FROM replacements');
        const swaps = await pool.query('SELECT * FROM classroom_swaps');
        const swapClasses = await pool.query('SELECT * FROM swap_classes');

        res.json({
            teachers: teachers.rows,
            classes: classes.rows,
            rooms: rooms.rows,
            subjects: subjects.rows,
            lessons: lessons.rows,
            absences: absences.rows,
            replacements: replacements.rows,
            classroom_swaps: swaps.rows,
            swap_classes: swapClasses.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/import - импорт (перезапись всех данных)
router.post('/import', async (req, res) => {
    const data = req.body;
    if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Invalid data format' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Очищаем все таблицы (с каскадным удалением)
        await client.query('DELETE FROM swap_classes');
        await client.query('DELETE FROM classroom_swaps');
        await client.query('DELETE FROM replacements');
        await client.query('DELETE FROM absences');
        await client.query('DELETE FROM lessons');
        // Справочники (teachers, classes, rooms, subjects) не очищаем, только обновляем или добавляем новые
        // Но можно и очистить, но тогда потеряем существующие ID, что может сломать связи.
        // Безопаснее будет просто вставлять новые записи, игнорируя существующие, либо обновлять.
        // Для простоты оставим справочники без изменений, а рабочие данные перезапишем.

        // Вставляем уроки, отсутствия, замены, замены кабинетов и связи.
        // Но при импорте нужно сохранять целостность внешних ключей. Поэтому проще удалить всё и заново создать.
        // Однако справочники нужно тоже обновить, т.к. в JSON могут быть новые учителя, классы и т.д.

        // Удаляем все рабочие данные
        await client.query('DELETE FROM swap_classes');
        await client.query('DELETE FROM classroom_swaps');
        await client.query('DELETE FROM replacements');
        await client.query('DELETE FROM absences');
        await client.query('DELETE FROM lessons');

        // Теперь вставляем справочники (если есть) - можно сделать UPSERT
        if (data.teachers) {
            for (const t of data.teachers) {
                await client.query(
                    'INSERT INTO teachers (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
                    [t.id, t.name]
                );
            }
        }
        if (data.classes) {
            for (const c of data.classes) {
                await client.query(
                    'INSERT INTO classes (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
                    [c.id, c.name]
                );
            }
        }
        if (data.rooms) {
            for (const r of data.rooms) {
                await client.query(
                    'INSERT INTO rooms (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
                    [r.id, r.name]
                );
            }
        }
        if (data.subjects) {
            for (const s of data.subjects) {
                await client.query(
                    'INSERT INTO subjects (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
                    [s.id, s.name]
                );
            }
        }

        // Вставляем рабочие данные
        if (data.lessons) {
            for (const l of data.lessons) {
                // ID может конфликтовать, поэтому лучше использовать INSERT без ID, чтобы сгенерировались новые.
                // Но для простоты используем INSERT с ID, но в случае конфликта пропускаем.
                await client.query(
                    `INSERT INTO lessons (id, teacher_id, day, period, subject_id, class_id, room_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (id) DO NOTHING`,
                    [l.id, l.teacher_id, l.day, l.period, l.subject_id, l.class_id, l.room_id]
                );
            }
        }
        if (data.absences) {
            for (const a of data.absences) {
                await client.query(
                    `INSERT INTO absences (id, teacher_id, day, date)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (id) DO NOTHING`,
                    [a.id, a.teacher_id, a.day, a.date]
                );
            }
        }
        if (data.replacements) {
            for (const r of data.replacements) {
                await client.query(
                    `INSERT INTO replacements (id, absence_id, period, replacement_teacher_id, comment)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (id) DO NOTHING`,
                    [r.id, r.absence_id, r.period, r.replacement_teacher_id, r.comment]
                );
            }
        }
        if (data.classroom_swaps) {
            for (const s of data.classroom_swaps) {
                await client.query(
                    `INSERT INTO classroom_swaps (id, day,date, lesson_from, lesson_to, original_room_id, new_room_id, teacher_id, comment)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     ON CONFLICT (id) DO NOTHING`,
                    [s.id, s.day, s.lesson_from, s.lesson_to, s.original_room_id, s.new_room_id, s.teacher_id, s.comment]
                );
            }
        }
        if (data.swap_classes) {
            for (const sc of data.swap_classes) {
                await client.query(
                    `INSERT INTO swap_classes (swap_id, class_id)
                     VALUES ($1, $2)
                     ON CONFLICT (swap_id, class_id) DO NOTHING`,
                    [sc.swap_id, sc.class_id]
                );
            }
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

// DELETE /api/reset - сброс всех рабочих данных (оставляем справочники)
router.delete('/reset', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM swap_classes');
        await client.query('DELETE FROM classroom_swaps');
        await client.query('DELETE FROM replacements');
        await client.query('DELETE FROM absences');
        await client.query('DELETE FROM lessons');
        // Также можно сбросить последовательности ID, чтобы новые записи шли с 1
        await client.query('ALTER SEQUENCE lessons_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE absences_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE replacements_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE classroom_swaps_id_seq RESTART WITH 1');
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