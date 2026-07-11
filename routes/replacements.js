const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/replacements?day=&date=
// Возвращает объект вида { teacher_id: { period: [{ teacherId, comment }] } }
router.get('/', async (req, res) => {
    const { day, date } = req.query;
    if (!day || !date) {
        return res.status(400).json({ error: 'day and date required' });
    }

    try {
        // Получаем все отсутствия за этот день
        const absRes = await pool.query(
            'SELECT id, teacher_id FROM absences WHERE day = $1 AND date = $2',
            [day, date]
        );
        const result = {};

        for (const abs of absRes.rows) {
            const replRes = await pool.query(
                'SELECT period, replacement_teacher_id, comment FROM replacements WHERE absence_id = $1',
                [abs.id]
            );
            const periods = {};
            for (const r of replRes.rows) {
                if (!periods[r.period]) periods[r.period] = [];
                periods[r.period].push({
                    teacherId: r.replacement_teacher_id,
                    comment: r.comment
                });
            }
            result[abs.teacher_id] = periods;
        }
        res.json(result);
    } catch (err) {
        console.error('GET /api/replacements error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/replacements
// Тело: { day, date, replacements } где replacements – объект
// Если replacements = {} – удаляем все замены за указанный день
router.post('/', async (req, res) => {
    const { day, date, replacements } = req.body;
    if (!day || !date) {
        return res.status(400).json({ error: 'Missing day or date' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Если replacements - пустой объект, удаляем все замены за этот день
        if (!replacements || Object.keys(replacements).length === 0) {
            // Находим все absence_id для этой даты
            const absRes = await client.query(
                'SELECT id FROM absences WHERE day = $1 AND date = $2',
                [day, date]
            );
            const absenceIds = absRes.rows.map(row => row.id);
            if (absenceIds.length > 0) {
                await client.query(
                    'DELETE FROM replacements WHERE absence_id = ANY($1)',
                    [absenceIds]
                );
            }
            await client.query('COMMIT');
            return res.json({ success: true });
        }

        // Иначе обрабатываем замены как обычно
        for (const [absentTeacherId, periods] of Object.entries(replacements)) {
            // Найти или создать absence
            let absenceId;
            const absRes = await client.query(
                'SELECT id FROM absences WHERE teacher_id = $1 AND day = $2 AND date = $3',
                [absentTeacherId, day, date]
            );
            if (absRes.rows.length === 0) {
                const ins = await client.query(
                    'INSERT INTO absences (teacher_id, day, date) VALUES ($1, $2, $3) RETURNING id',
                    [absentTeacherId, day, date]
                );
                absenceId = ins.rows[0].id;
            } else {
                absenceId = absRes.rows[0].id;
            }

            // Удаляем старые замены для этого absence
            await client.query('DELETE FROM replacements WHERE absence_id = $1', [absenceId]);

            // Вставляем новые замены
            for (const [period, replList] of Object.entries(periods)) {
                for (const repl of replList) {
                    if (repl.teacherId) {
                        await client.query(
                            'INSERT INTO replacements (absence_id, period, replacement_teacher_id, comment) VALUES ($1, $2, $3, $4)',
                            [absenceId, period, repl.teacherId, repl.comment || '']
                        );
                    }
                }
            }
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('POST /api/replacements error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;