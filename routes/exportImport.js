const express = require('express');
const router = express.Router();
const pool = require('../db');
const ExcelJS = require('exceljs');

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

// GET /api/export-schedule-xlsx – Excel для сверки расписания по учителям
router.get('/export-schedule-xlsx', async (req, res) => {
    try {
        const lang = req.query.lang === 'en' ? 'en' : 'ru';
        const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const dayLabels = lang === 'en'
            ? { Monday: 'Monday', Tuesday: 'Tuesday', Wednesday: 'Wednesday', Thursday: 'Thursday', Friday: 'Friday' }
            : { Monday: 'Понедельник', Tuesday: 'Вторник', Wednesday: 'Среда', Thursday: 'Четверг', Friday: 'Пятница' };

        const result = await pool.query(`
            SELECT
                l.teacher_id,
                t.name AS teacher_name,
                l.day,
                l.period,
                s.name AS subject_name,
                c.name AS class_name,
                r.name AS room_name
            FROM lessons l
            JOIN teachers t ON t.id = l.teacher_id
            JOIN subjects s ON s.id = l.subject_id
            JOIN classes c ON c.id = l.class_id
            LEFT JOIN rooms r ON r.id = l.room_id
            WHERE l.day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
              AND l.period BETWEEN 1 AND 9
            ORDER BY
                LOWER(t.name),
                CASE l.day
                    WHEN 'Monday' THEN 1
                    WHEN 'Tuesday' THEN 2
                    WHEN 'Wednesday' THEN 3
                    WHEN 'Thursday' THEN 4
                    WHEN 'Friday' THEN 5
                    ELSE 99
                END,
                l.period,
                LOWER(s.name),
                LOWER(COALESCE(r.name, '')),
                LOWER(c.name)
        `);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Covers · Russian International School';
        workbook.created = new Date();
        workbook.modified = new Date();

        const naturalCompare = (a, b) => String(a).localeCompare(String(b), undefined, {
            numeric: true,
            sensitivity: 'base'
        });

        const rowsByTeacher = new Map();
        for (const row of result.rows) {
            if (!rowsByTeacher.has(row.teacher_id)) {
                rowsByTeacher.set(row.teacher_id, {
                    id: row.teacher_id,
                    name: row.teacher_name,
                    slots: new Map()
                });
            }
            const teacher = rowsByTeacher.get(row.teacher_id);
            const slotKey = `${row.day}|${row.period}`;
            if (!teacher.slots.has(slotKey)) teacher.slots.set(slotKey, new Map());

            const roomName = row.room_name || (lang === 'en' ? 'NO ROOM / TBD' : 'БЕЗ КАБИНЕТА');
            const groupKey = `${row.subject_name}\u0000${roomName}`;
            const slot = teacher.slots.get(slotKey);
            if (!slot.has(groupKey)) {
                slot.set(groupKey, {
                    subject: row.subject_name,
                    room: roomName,
                    classes: new Set()
                });
            }
            slot.get(groupKey).classes.add(row.class_name);
        }

        const teachers = [...rowsByTeacher.values()].sort((a, b) => naturalCompare(a.name, b.name));

        const usedSheetNames = new Set();
        function makeSheetName(name) {
            const cleaned = String(name || 'Teacher')
                .replace(/[\\/*?:\[\]]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim() || 'Teacher';
            const base = cleaned.slice(0, 31);
            let candidate = base;
            let n = 2;
            while (usedSheetNames.has(candidate.toLowerCase())) {
                const suffix = ` ${n++}`;
                candidate = base.slice(0, 31 - suffix.length) + suffix;
            }
            usedSheetNames.add(candidate.toLowerCase());
            return candidate;
        }

        const indexSheet = workbook.addWorksheet(lang === 'en' ? 'Teachers' : 'Учителя', {
            views: [{ state: 'frozen', ySplit: 2 }]
        });
        indexSheet.getCell('A1').value = lang === 'en' ? 'Schedule verification by teacher' : 'Сверка расписания по учителям';
        indexSheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF17365D' } };
        indexSheet.getCell('A2').value = lang === 'en'
            ? 'Each teacher has a separate sheet: periods 1–9 × Monday–Friday.'
            : 'Для каждого учителя создан отдельный лист: уроки 1–9 × понедельник–пятница.';
        indexSheet.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
        indexSheet.getColumn(1).width = 42;
        indexSheet.getColumn(2).width = 18;

        const teacherSheetInfo = [];

        for (const teacher of teachers) {
            const sheetName = makeSheetName(teacher.name);
            const sheet = workbook.addWorksheet(sheetName, {
                views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }],
                pageSetup: {
                    orientation: 'landscape',
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
                }
            });

            teacherSheetInfo.push({ teacher, sheetName });

            sheet.mergeCells('A1:F1');
            const title = sheet.getCell('A1');
            title.value = teacher.name;
            title.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
            title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
            title.alignment = { vertical: 'middle', horizontal: 'left' };
            sheet.getRow(1).height = 25;

            const headers = [lang === 'en' ? 'Period' : 'Урок', ...dayOrder.map(d => dayLabels[d])];
            headers.forEach((value, index) => {
                const cell = sheet.getCell(2, index + 1);
                cell.value = value;
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD0D7DE' } },
                    left: { style: 'thin', color: { argb: 'FFD0D7DE' } },
                    bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } },
                    right: { style: 'thin', color: { argb: 'FFD0D7DE' } }
                };
            });
            sheet.getRow(2).height = 22;

            sheet.getColumn(1).width = 9;
            for (let col = 2; col <= 6; col++) sheet.getColumn(col).width = 31;

            for (let period = 1; period <= 9; period++) {
                const rowNumber = period + 2;
                const periodCell = sheet.getCell(rowNumber, 1);
                periodCell.value = period;
                periodCell.font = { bold: true, color: { argb: 'FF334155' } };
                periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                periodCell.alignment = { vertical: 'middle', horizontal: 'center' };

                let maxLines = 1;
                for (let dayIndex = 0; dayIndex < dayOrder.length; dayIndex++) {
                    const day = dayOrder[dayIndex];
                    const cell = sheet.getCell(rowNumber, dayIndex + 2);
                    const groups = teacher.slots.get(`${day}|${period}`);

                    if (groups && groups.size) {
                        const blocks = [...groups.values()]
                            .sort((a, b) => naturalCompare(a.subject, b.subject) || naturalCompare(a.room, b.room))
                            .map(group => {
                                const classLines = [...group.classes].sort(naturalCompare);
                                return [...classLines, group.room, group.subject].join('\n');
                            });
                        cell.value = blocks.join('\n\n');
                        const lines = String(cell.value).split('\n').length;
                        maxLines = Math.max(maxLines, lines);
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7DF' } };
                    } else {
                        cell.value = '';
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                    }

                    cell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
                }

                for (let col = 1; col <= 6; col++) {
                    sheet.getCell(rowNumber, col).border = {
                        top: { style: 'thin', color: { argb: 'FFD8DEE9' } },
                        left: { style: 'thin', color: { argb: 'FFD8DEE9' } },
                        bottom: { style: 'thin', color: { argb: 'FFD8DEE9' } },
                        right: { style: 'thin', color: { argb: 'FFD8DEE9' } }
                    };
                }
                sheet.getRow(rowNumber).height = Math.min(180, Math.max(42, 14 * maxLines + 12));
            }

            sheet.autoFilter = { from: 'A2', to: 'F11' };
            sheet.properties.defaultRowHeight = 18;
        }

        indexSheet.getCell('A4').value = lang === 'en' ? 'Teacher' : 'Учитель';
        indexSheet.getCell('B4').value = lang === 'en' ? 'Sheet' : 'Лист';
        for (const cell of indexSheet.getRow(4).values.slice(1).map((_, i) => indexSheet.getCell(4, i + 1))) {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        }

        teacherSheetInfo.forEach(({ teacher, sheetName }, index) => {
            const row = 5 + index;
            indexSheet.getCell(row, 1).value = teacher.name;
            indexSheet.getCell(row, 2).value = {
                text: lang === 'en' ? 'Open' : 'Открыть',
                hyperlink: `#'${sheetName.replace(/'/g, "''")}'!A1`
            };
            indexSheet.getCell(row, 2).font = { color: { argb: 'FF0563C1' }, underline: true };
        });

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="schedule_verification.xlsx"');
        res.setHeader('Content-Length', buffer.length);
        res.end(Buffer.from(buffer));
    } catch (err) {
        console.error('Excel schedule export error:', err);
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