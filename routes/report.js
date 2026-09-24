const express = require('express');
const router = express.Router();
const pool = require('../db');

function getReportLanguage(req) {
    return req.query.lang === 'en' ? 'en' : 'ru';
}

// Постоянная ссылка /today должна открывать отчёт за текущую дату школы,
// независимо от UTC-часового пояса сервера. При необходимости часовой пояс
// можно переопределить через REPORT_TIME_ZONE в .env.
function getTodayReportDate() {
    const timeZone = process.env.REPORT_TIME_ZONE || 'Europe/Moscow';
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());

    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function getReportLabels(lang) {
    const ru = {
        invalidDate: 'Неверная дата',
        invalidWeekday: 'День недели не подходит (должен быть понедельник–пятница)',
        serverError: 'Ошибка сервера',
        title: 'Отчёт о заменах',
        curatorTitle: 'Отчёт куратора',
        absentTeachers: 'Отсутствующие учителя:',
        none: 'нет',
        teacher: 'Учитель',
        all: 'Все',
        onlyMine: 'Только мои замены',
        copyLink: 'Копировать ссылку',
        print: 'Печать',
        linkCopied: 'Ссылка скопирована!',
        teacherReplacements: 'Замены учителей',
        classroomReplacements: 'Замены кабинетов',
        noTeacherReplacements: 'Нет замен учителей на выбранную дату.',
        noClassroomReplacements: 'Нет замен кабинетов на выбранную дату.',
        periods: 'Урок(и)',
        time: 'Время',
        classes: 'Класс(ы)',
        subject: 'Предмет',
        room: 'Кабинет',
        absentTeacher: 'Кого заменяем',
        replacementTeacher: 'Кто заменяет',
        comment: 'Комментарий',
        originalRoom: 'Исходный кабинет',
        newRoom: 'Новый кабинет',
        footerNote: '* Жёлтая подсветка в таблицах — строки, где вы указаны как заменяющий (для кабинетов — указан как учитель).',
        footer: '© Covers — система замен учителей и кабинетов',
        curatorFooter: '© Covers — система замен',
        classesParallel: 'классы'
    };
    const en = {
        invalidDate: 'Invalid date',
        invalidWeekday: 'The selected date must be Monday to Friday',
        serverError: 'Server error',
        title: 'Cover report',
        curatorTitle: 'Tutor report',
        absentTeachers: 'Absent teachers:',
        none: 'none',
        teacher: 'Teacher',
        all: 'All',
        onlyMine: 'Only my covers',
        copyLink: 'Copy link',
        print: 'Print',
        linkCopied: 'Link copied!',
        teacherReplacements: 'Teacher covers',
        classroomReplacements: 'Classroom changes',
        noTeacherReplacements: 'No teacher covers for the selected date.',
        noClassroomReplacements: 'No classroom changes for the selected date.',
        periods: 'Period(s)',
        time: 'Time',
        classes: 'Class(es)',
        subject: 'Subject',
        room: 'Room',
        absentTeacher: 'Absent teacher',
        replacementTeacher: 'Cover teacher',
        comment: 'Comment',
        originalRoom: 'Original room',
        newRoom: 'New room',
        footerNote: '* Yellow rows show entries where you are selected as the cover teacher (or as the teacher for a classroom change).',
        footer: '© Covers — teacher and classroom cover system',
        curatorFooter: '© Covers — cover system',
        classesParallel: 'classes'
    };
    return lang === 'en' ? en : ru;
}

function formatDate(dateStr, lang = 'ru') {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDate();
    const monthsRu = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = (lang === 'en' ? monthsEn : monthsRu)[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}
// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function getTimeRangeForPeriods(startPeriod, endPeriod) {
    const lessonTimes = {
        1: { start: '8:40', end: '9:20' },
        2: { start: '9:20', end: '10:00' },
        3: { start: '10:20', end: '11:00' },
        4: { start: '11:00', end: '11:40' },
        5: { start: '11:50', end: '12:30' },
        6: { start: '13:30', end: '14:10' },
        7: { start: '14:10', end: '14:50' },
        8: { start: '15:00', end: '15:40' },
        9: { start: '15:40', end: '16:20' }
    };
    if (startPeriod === endPeriod) {
        return `${lessonTimes[startPeriod].start}–${lessonTimes[startPeriod].end}`;
    }
    return `${lessonTimes[startPeriod].start}–${lessonTimes[endPeriod].end}`;
}

function getClassFamily(className) {
    const match = className.match(/^(\d+[A-Z]+\d+)/);
    return match ? match[1] : className.substring(0, 4);
}

// Для отображения отчёта: если выбраны все индивидуальные ученики параллели,
// показываем привычное общее название класса. Сами class_id не меняются.
function formatClassesForDisplay(classNames, allClasses) {
    const names = (classNames || []).filter(Boolean);
    if (!names.length) return '';

    const selected = new Set(names);
    const allClassNames = (allClasses || []).map(c => c.name).filter(Boolean);

    const cohorts = [
        { pattern: /^12\s+/i, label: '10Y12' },
        { pattern: /^13\s+/i, label: '11Y13' }
    ];

    for (const cohort of cohorts) {
        const allMembers = allClassNames.filter(name => cohort.pattern.test(name));
        if (!allMembers.length) continue;

        const hasAllMembers = allMembers.every(name => selected.has(name));
        if (!hasAllMembers) continue;

        allMembers.forEach(name => selected.delete(name));
        selected.add(cohort.label);
    }

    return Array.from(selected).sort((a, b) => a.localeCompare(b, 'ru')).join(', ');
}

// Структурированное отображение длинных списков индивидуальных классов в отчётах.
function formatClassCell(classNames, allClasses, lang = 'ru') {
    const names = [...new Set((classNames || []).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'ru'));
    if (!names.length) return { text: '', html: '' };

    const allClassNames = (allClasses || []).map(c => c.name).filter(Boolean);
    const remaining = new Set(names);
    const blocks = [];
    const textParts = [];
    const cohorts = [
        { pattern: /^12\s+/i, label: '10Y12' },
        { pattern: /^13\s+/i, label: '11Y13' }
    ];

    for (const cohort of cohorts) {
        const allMembers = allClassNames.filter(name => cohort.pattern.test(name));
        const selectedMembers = names.filter(name => cohort.pattern.test(name));
        if (!selectedMembers.length) continue;

        selectedMembers.forEach(name => remaining.delete(name));

        if (allMembers.length && selectedMembers.length === allMembers.length) {
            blocks.push(`<div style="font-weight:700; white-space:nowrap;">${escapeHtml(cohort.label)}</div>`);
            textParts.push(cohort.label);
            continue;
        }

        if (selectedMembers.length === 1) {
            const only = selectedMembers[0];
            const singleMatch = only.match(/^(\d+)\s+(.+)$/);
            if (singleMatch) {
                blocks.push(`<div><span style="font-weight:700;">${escapeHtml(singleMatch[1])}</span> ${escapeHtml(singleMatch[2])}</div>`);
            } else {
                blocks.push(`<div style="font-weight:700;">${escapeHtml(only)}</div>`);
            }
            textParts.push(only);
            continue;
        }

        const shortNames = selectedMembers
            .map(name => name.replace(cohort.pattern, '').trim())
            .filter(Boolean);
        const title = cohort.label;
        const nameRows = [];
        for (let i = 0; i < shortNames.length; i += 3) {
            nameRows.push(shortNames.slice(i, i + 3));
        }
        const namesHtml = nameRows
            .map(row => `<div style="display:block; white-space:nowrap; margin-top:2px;">${row.map(escapeHtml).join(' · ')}</div>`)
            .join('');

        blocks.push(`
            <div style="max-width:280px; line-height:1.4;">
                <div style="display:block; font-weight:700; margin-bottom:3px;">${escapeHtml(title)}</div>
                <div style="display:block; font-size:0.84em; color:#475569;">${namesHtml}</div>
            </div>
        `);
        textParts.push(`${title}
${nameRows.map(row => row.join(' · ')).join('\n')}`);
    }

    const ordinary = [...remaining].sort((a, b) => a.localeCompare(b, 'ru'));
    if (ordinary.length) {
        blocks.push(`<div style="white-space:normal;">${ordinary.map(name => `<span style="font-weight:700; white-space:nowrap;">${escapeHtml(name)}</span>`).join(', ')}</div>`);
        textParts.push(ordinary.join(', '));
    }

    return {
        text: textParts.join('\n'),
        html: `<div style="display:flex; flex-direction:column; gap:5px;">${blocks.join('')}</div>`
    };
}


// Собирает строки замен по фактическому уроку, а не по отдельным class_id.
// Сначала объединяем все классы/индивидуальные траектории одного урока,
// затем при полном составе показываем 10Y12 / 11Y13.
function buildTeacherReportRows(rawItems, classes, teacherMap, lang = 'ru') {
    const lessonGroups = new Map();

    for (const item of rawItems) {
        const assignedTeacherIds = [...new Set(item.assignedTeacherIds || [])]
            .sort((a, b) => String(a).localeCompare(String(b)));
        const comments = [...new Set((item.commentsArray || [])
            .map(c => String(c || '').trim())
            .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));

        // period обязательно входит в ключ: один фактический урок = одна группа.
        const key = JSON.stringify([
            item.absentId,
            Number(item.period),
            item.subject || '',
            item.roomInfo || '',
            assignedTeacherIds,
            comments
        ]);

        if (!lessonGroups.has(key)) {
            lessonGroups.set(key, {
                absentId: item.absentId,
                absentName: item.absentName,
                period: Number(item.period),
                subject: item.subject,
                roomInfo: item.roomInfo,
                assignedTeacherIds,
                comments,
                classIds: new Set(),
                classNames: new Set()
            });
        }

        const group = lessonGroups.get(key);
        if (item.classId !== null && item.classId !== undefined) {
            group.classIds.add(item.classId);
        }
        if (item.className) group.classNames.add(item.className);
    }

    const periodRows = [...lessonGroups.values()].map(group => {
        const classNames = [...group.classNames].sort((a, b) => a.localeCompare(b, 'ru'));
        const classIds = [...group.classIds].sort((a, b) => Number(a) - Number(b));
        const assignedNames = group.assignedTeacherIds
            .map(id => teacherMap[id] || '?')
            .filter(Boolean);

        const classDisplay = formatClassCell(classNames, classes, lang);
        const displayClassName = classDisplay.text;
        const comment = group.comments.join('; ') || '—';

        // Для объединения соседних периодов набор классов должен совпадать полностью.
        const mergeKey = JSON.stringify([
            group.absentId,
            group.subject || '',
            group.roomInfo || '',
            group.assignedTeacherIds,
            group.comments,
            classIds,
            classNames
        ]);

        return {
            period: group.period,
            mergeKey,
            className: displayClassName,
            classHtml: classDisplay.html,
            classIds,
            subject: group.subject,
            roomInfo: group.roomInfo,
            absentName: group.absentName,
            assignedName: assignedNames.length ? assignedNames.join(', ') : '—',
            comment,
            replacementIds: group.assignedTeacherIds.join(',')
        };
    }).sort((a, b) => a.period - b.period);

    // Сохраняем компактные диапазоны 5–6 только если это действительно
    // один и тот же состав классов и одна и та же замена на соседних уроках.
    const merged = [];
    for (const row of periodRows) {
        const prev = merged[merged.length - 1];
        if (prev && prev.mergeKey === row.mergeKey && row.period === prev.endPeriod + 1) {
            prev.endPeriod = row.period;
        } else {
            merged.push({ ...row, startPeriod: row.period, endPeriod: row.period });
        }
    }

    return merged.map(row => ({
        lessonDisplay: row.startPeriod === row.endPeriod
            ? `${row.startPeriod}`
            : `${row.startPeriod}–${row.endPeriod}`,
        timeRange: getTimeRangeForPeriods(row.startPeriod, row.endPeriod),
        className: row.className,
        classHtml: row.classHtml,
        classIds: row.classIds,
        subject: row.subject,
        roomInfo: row.roomInfo,
        absentName: row.absentName,
        assignedName: row.assignedName,
        comment: row.comment,
        replacementIds: row.replacementIds
    }));
}

// ===== ОСНОВНОЙ ОТЧЁТ (без кураторов) =====
router.get('/:date', async (req, res) => {
    const date = req.params.date === 'today' ? getTodayReportDate() : req.params.date;
    const lang = getReportLanguage(req);
    const L = getReportLabels(lang);

    if (isNaN(new Date(date).getTime())) {
        return res.status(400).send(L.invalidDate);
    }

    const day = new Date(date + 'T00:00:00').toLocaleString('en-US', { weekday: 'long' });
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (!validDays.includes(day)) {
        return res.status(400).send(L.invalidWeekday);
    }

    try {
        // ---- Справочники ----
        const teachersRes = await pool.query('SELECT id, name FROM teachers ORDER BY name');
        const teachers = teachersRes.rows;
        const classesRes = await pool.query('SELECT id, name FROM classes ORDER BY name');
        const classes = classesRes.rows;
        const roomsRes = await pool.query('SELECT id, name FROM rooms ORDER BY name');
        const rooms = roomsRes.rows;
        const subjectsRes = await pool.query('SELECT id, name FROM subjects ORDER BY name');
        const subjects = subjectsRes.rows;

        const teacherMap = {};
        teachers.forEach(t => teacherMap[t.id] = t.name);
        const classMap = {};
        classes.forEach(c => classMap[c.id] = c.name);
        const roomMap = {};
        rooms.forEach(r => roomMap[r.id] = r.name);
        const subjectMap = {};
        subjects.forEach(s => subjectMap[s.id] = s.name);

        // ---- 1. Замены учителей ----
        const lessonsRes = await pool.query(`
            SELECT l.*, 
                   s.name as subject_name, c.name as class_name, r.name as room_name
            FROM lessons l
            JOIN subjects s ON l.subject_id = s.id
            JOIN classes c ON l.class_id = c.id
            JOIN rooms r ON l.room_id = r.id
            WHERE l.day = $1
        `, [day]);
        const lessons = lessonsRes.rows;

        const absencesRes = await pool.query(`
            SELECT a.*, t.name as teacher_name
            FROM absences a
            JOIN teachers t ON a.teacher_id = t.id
            WHERE a.day = $1 AND a.date = $2
        `, [day, date]);
        const absences = absencesRes.rows;

        const absenceIds = absences.map(a => a.id);
        let replacements = [];
        if (absenceIds.length > 0) {
            const replRes = await pool.query(`
                SELECT r.*, t.name as replacement_name
                FROM replacements r
                JOIN teachers t ON r.replacement_teacher_id = t.id
                WHERE r.absence_id = ANY($1)
            `, [absenceIds]);
            replacements = replRes.rows;
        }

        const replByAbsence = {};
        replacements.forEach(r => {
            if (!replByAbsence[r.absence_id]) replByAbsence[r.absence_id] = {};
            if (!replByAbsence[r.absence_id][r.period]) replByAbsence[r.absence_id][r.period] = [];
            replByAbsence[r.absence_id][r.period].push({
                teacherId: r.replacement_teacher_id,
                teacherName: r.replacement_name,
                comment: r.comment
            });
        });

        const rawItems = [];
        for (const lesson of lessons) {
            const absent = absences.find(a => a.teacher_id === lesson.teacher_id);
            if (!absent) continue;
            const replList = (replByAbsence[absent.id] && replByAbsence[absent.id][lesson.period]) || [];
            // Не показываем урок в отчёте, если на этот период фактически не назначена замена.
            if (!replList.length) continue;
            const assignedTeacherIds = replList.map(r => r.teacherId).filter(id => id !== null && id !== undefined);
            const commentsArray = replList.map(r => r.comment).filter(c => c && c.trim() !== '');
            rawItems.push({
                absentId: lesson.teacher_id,
                absentName: teacherMap[lesson.teacher_id] || '?',
                period: lesson.period,
                classId: lesson.class_id,
                className: lesson.class_name,
                subject: lesson.subject_name,
                roomInfo: lesson.room_name,
                assignedTeacherIds,
                commentsArray
            });
        }

        const teacherRows = buildTeacherReportRows(rawItems, classes, teacherMap, lang);

        const absentTeachers = [...new Set(teacherRows.map(row => row.absentName).filter(name => name && name !== '?'))];

        // ---- 2. Замены кабинетов ----
        const swapsRes = await pool.query(`
            SELECT cs.*, 
                   (SELECT array_agg(class_id) FROM swap_classes WHERE swap_id = cs.id) as class_ids
            FROM classroom_swaps cs
            WHERE cs.day = $1 AND cs.date = $2
        `, [day, date]);
        const swaps = swapsRes.rows;

        const swapRows = [];
        for (const swap of swaps) {
            const originalRoomName = roomMap[swap.original_room_id] || '?';
            const newRoomName = roomMap[swap.new_room_id] || '?';
            const teacherId = swap.teacher_id || null;
            const teacherName = teacherId ? (teacherMap[teacherId] || '?') : L.all;
            const classIds = swap.class_ids || [];
            const classDisplay = classIds.length
                ? formatClassCell(classIds.map(id => classMap[id] || '?'), classes, lang)
                : { text: L.all, html: escapeHtml(L.all) };
            const classNames = classDisplay.text;
            const timeRange = getTimeRangeForPeriods(swap.lesson_from, swap.lesson_to);
            swapRows.push({
                lessonFrom: swap.lesson_from,
                lessonTo: swap.lesson_to,
                timeRange: timeRange,
                originalRoom: originalRoomName,
                newRoom: newRoomName,
                teacherId: teacherId,
                teacherName: teacherName,
                classNames: classNames,
                classHtml: classDisplay.html,
                classIds: classIds,
                comment: swap.comment || '—'
            });
        }
        swapRows.sort((a, b) => a.lessonFrom - b.lessonFrom);

        // ---- Формируем HTML (без кураторов) ----
        let html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, viewport-fit=cover">
    <title>${L.title} - ${date}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #f1f5f9; font-family: 'Inter', system-ui, sans-serif; padding: 28px 20px; color: #0f172a; }
        .container { max-width: 1600px; margin: 0 auto; }
        h1 { font-size: 2rem; font-weight: 700; color: #0f172a; margin-bottom: 1.5rem; border-bottom: 3px solid #0f172a; padding-bottom: 0.3rem; }
        .section-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin: 2rem 0 1rem 0;
            color: #0f172a;
            border-bottom: 2px solid #cbd5e1;
            padding-bottom: 0.3rem;
        }
        .controls {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 16px 24px;
            background: #ffffff;
            padding: 1rem 1.5rem;
            border: 1px solid #cbd5e1;
            margin-bottom: 2rem;
        }
        .controls .control-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .controls label {
            font-weight: 600;
            font-size: 0.9rem;
            color: #0f172a;
            white-space: nowrap;
        }
        .controls select,
        .controls button {
            padding: 6px 12px;
            border: 1px solid #94a3b8;
            background: #ffffff;
            color: #0f172a;
            font-size: 0.9rem;
            font-weight: 500;
            outline: none;
            cursor: pointer;
            border-radius: 4px;
            height: 36px;
            box-shadow: none;
            transition: all 0.15s ease;
        }
        .controls select {
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%231e293b" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>');
            background-repeat: no-repeat;
            background-position: right 8px center;
            appearance: none;
            padding-right: 28px;
            min-width: 160px;
        }
        .controls button {
            background: #f8fafc;
            border: 1px solid #94a3b8;
            color: #0f172a;
            padding: 6px 16px;
        }
        .controls button:hover {
            background: #e2e8f0;
        }
        .controls button.primary {
            background: #2563eb;
            border: 1px solid #2563eb;
            color: white;
        }
        .controls button.primary:hover {
            background: #1d4ed8;
            border-color: #1d4ed8;
            box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
        }
        .controls button.secondary {
            background: #f8fafc;
            border: 1px solid #94a3b8;
            color: #0f172a;
        }
        .controls button.secondary:hover {
            background: #e2e8f0;
            border-color: #64748b;
        }
        .controls input[type="checkbox"] {
            width: 16px;
            height: 16px;
            accent-color: #2563eb;
            margin: 0;
            border-radius: 2px;
        }
        .lang-switch {
            display: inline-flex;
            align-items: center;
            border: 1px solid #94a3b8;
            border-radius: 4px;
            overflow: hidden;
            background: #ffffff;
            height: 36px;
        }
        .controls .lang-switch button,
        .lang-switch button {
            min-width: 42px;
            height: 34px;
            padding: 0 10px;
            margin: 0;
            border: 0;
            border-right: 1px solid #cbd5e1;
            border-radius: 0;
            background: #ffffff;
            color: #475569;
            font-size: 0.78rem;
            font-weight: 700;
            box-shadow: none;
        }
        .controls .lang-switch button:last-child,
        .lang-switch button:last-child { border-right: 0; }
        .controls .lang-switch button:hover,
        .lang-switch button:hover { background: #f1f5f9; }
        .controls .lang-switch button.active,
        .lang-switch button.active {
            background: #0f172a;
            color: #ffffff;
        }
        .report-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border: 1px solid #cbd5e1;
            font-size: 0.9rem;
        }
        .report-table th,
        .report-table td {
            font-size: 0.9rem;
            padding: 10px 8px;
            border: 1px solid #cbd5e1;
            vertical-align: top;
            text-align: left;
        }
        .report-table th {
            background: #f8fafc;
            color: #0f172a;
            font-weight: 600;
        }
        .report-table tbody tr:hover {
            background: #f1f5f9;
        }
        .replacement-teacher {
            font-weight: 700;
        }
        .highlight {
            background: #fef9c3 !important;
        }
        .highlight td {
            background: #fef9c3 !important;
        }
        .footer-note {
            margin-top: 20px;
            color: #64748b;
            font-size: 0.8rem;
            border-top: 1px solid #cbd5e1;
            padding-top: 12px;
        }
        .absent-list {
            background: #f8fafc;
            padding: 12px 20px;
            border-radius: 6px;
            margin-bottom: 24px;
            display: flex;
            flex-wrap: wrap;
            align-items: baseline;
            gap: 8px 16px;
        }
        .absent-list strong {
            color: #1e293b;
            font-size: 0.95rem;
        }
        .absent-list .absent-name {
            background: #ffffff;
            padding: 4px 14px;
            border-radius: 40px;
            font-size: 0.85rem;
            font-weight: 500;
            color: #0f172a;
            border: 1px solid #cbd5e1;
        }
        .absent-list .absent-name:before {
            content: "• ";
            color: #ef4444;
        }
        @media (max-width: 640px) {
            .controls {
                flex-direction: column;
                align-items: stretch;
            }
            .controls .control-group {
                flex-wrap: wrap;
            }
            .report-table,
            .report-table thead,
            .report-table tbody,
            .report-table tr,
            .report-table th,
            .report-table td {
                display: block;
            }
            .report-table thead {
                display: none;
            }
            .report-table tr {
                margin-bottom: 1rem;
                border: 1px solid #cbd5e1;
                background: white;
                padding: 0.75rem;
            }
            .report-table td {
                border: none;
                padding: 0.5rem 0;
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                gap: 0.75rem;
                font-size: 0.85rem;
            }
            .report-table td::before {
                content: attr(data-label);
                font-weight: 700;
                color: #1e293b;
                width: 35%;
                flex-shrink: 0;
                font-size: 0.75rem;
                background: #f8fafc;
                padding: 4px 8px;
                display: inline-block;
                text-align: center;
                border: 1px solid #e2e8f0;
            }
            .absent-list {
                flex-direction: column;
                align-items: stretch;
                gap: 6px;
            }
            .absent-list .absent-name {
                display: inline-block;
                width: fit-content;
            }
        }
    </style>
</head>
<body>
<div class="container">
    <h1>Covers ${formatDate(date, lang)}</h1>

    <div class="absent-list">
        <strong><i class="fas fa-user-slash" style="color:#ef4444; margin-right:6px;"></i> ${L.absentTeachers}</strong>
        ${absentTeachers.length ? absentTeachers.map(name => `<span class="absent-name">${name}</span>`).join('') : `<span style="color:#64748b;">${L.none}</span>`}
    </div>

    <div class="controls">
        <div class="control-group">
            <label for="teacherSelect"><i class="fas fa-user"></i> ${L.teacher}:</label>
            <select id="teacherSelect">
                <option value="">${L.all}</option>
                ${teachers.filter(t => teacherRows.some(row => row.replacementIds.split(',').includes(String(t.id))) || swapRows.some(row => row.teacherId === t.id)).map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
        </div>
        <div class="control-group">
            <label><input type="checkbox" id="onlyMine"> ${L.onlyMine}</label>
        </div>
        <div class="control-group" style="margin-left: auto;">
            <div class="lang-switch" aria-label="Language">
                <button type="button" class="${lang === 'ru' ? 'active' : ''}" aria-pressed="${lang === 'ru'}" onclick="setReportLanguage('ru')">RU</button>
                <button type="button" class="${lang === 'en' ? 'active' : ''}" aria-pressed="${lang === 'en'}" onclick="setReportLanguage('en')">EN</button>
            </div>
            <button onclick="copyLink()" class="primary"><i class="fas fa-copy"></i> ${L.copyLink}</button>
            <button onclick="window.print()" class="secondary"><i class="fas fa-print"></i> ${L.print}</button>
        </div>
    </div>

    <h2 class="section-title">${L.teacherReplacements}</h2>
    ${teacherRows.length === 0 ? `<p>${L.noTeacherReplacements}</p>` : `
    <div class="report-table-wrapper"><table class="report-table" id="reportTable">
        <thead><tr>
            <th>${L.periods}</th><th>${L.time}</th><th>${L.classes}</th><th>${L.subject}</th>
            <th>${L.room}</th><th>${L.absentTeacher}</th><th>${L.replacementTeacher}</th><th>${L.comment}</th>
        </tr></thead><tbody>
        ${teacherRows.map(row => `
            <tr data-replacement-ids="${row.replacementIds}">
                <td data-label="${L.periods}"><strong>${row.lessonDisplay}</strong></td>
                <td data-label="${L.time}">${row.timeRange}</td>
                <td data-label="${L.classes}" style="min-width:180px; max-width:310px;">${row.classHtml || escapeHtml(row.className)}</td>
                <td data-label="${L.subject}">${row.subject}</td>
                <td data-label="${L.room}">${row.roomInfo}</td>
                <td data-label="${L.absentTeacher}">${row.absentName}</td>
                <td data-label="${L.replacementTeacher}" class="replacement-teacher">${row.assignedName}</td>
                <td data-label="${L.comment}">${row.comment}</td>
            </tr>
        `).join('')}
        </tbody></table></div>
    `}

    <h2 class="section-title">${L.classroomReplacements}</h2>
    ${swapRows.length === 0 ? `<p>${L.noClassroomReplacements}</p>` : `
    <div class="report-table-wrapper"><table class="report-table" id="swapTable">
        <thead><tr>
            <th>${L.periods}</th>
            <th>${L.time}</th>
            <th>${L.classes}</th>
            <th>${L.originalRoom}</th>
            <th>${L.newRoom}</th>
            <th>${L.teacher}</th>
            <th>${L.comment}</th>
        </tr></thead><tbody>
        ${swapRows.map(row => `
            <tr data-teacher-id="${row.teacherId || ''}">
                <td data-label="${L.periods}">${row.lessonFrom === row.lessonTo ? row.lessonFrom : row.lessonFrom + '–' + row.lessonTo}</td>
                <td data-label="${L.time}">${row.timeRange}</td>
                <td data-label="${L.classes}" style="min-width:180px; max-width:310px;">${row.classHtml || escapeHtml(row.classNames)}</td>
                <td data-label="${L.originalRoom}">${row.originalRoom}</td>
                <td data-label="${L.newRoom}">${row.newRoom}</td>
                <td data-label="${L.teacher}" class="replacement-teacher">${row.teacherName}</td>
                <td data-label="${L.comment}">${row.comment}</td>
            </tr>
        `).join('')}
        </tbody></table></div>
    `}

    <div class="footer-note">${L.footerNote}</div>
    <footer style="text-align:center; margin-top:32px; font-size:0.75rem; color:#64748b;">${L.footer}</footer>
</div>
<script>
    const teacherSelect = document.getElementById('teacherSelect');
    const onlyMine = document.getElementById('onlyMine');
    const teacherRows = document.querySelectorAll('#reportTable tbody tr');
    const swapRows = document.querySelectorAll('#swapTable tbody tr');

    function filterRows() {
        const selectedId = teacherSelect.value;
        const only = onlyMine.checked;

        teacherRows.forEach(row => {
            const ids = row.dataset.replacementIds ? row.dataset.replacementIds.split(',').map(id => id.trim()).filter(id => id !== '') : [];
            const contains = selectedId && ids.includes(selectedId);
            if (only) {
                row.style.display = (selectedId && contains) ? '' : 'none';
            } else {
                row.style.display = '';
                if (selectedId && contains) {
                    row.classList.add('highlight');
                } else {
                    row.classList.remove('highlight');
                }
            }
        });

        swapRows.forEach(row => {
            const teacherId = row.dataset.teacherId || '';
            const matches = selectedId && teacherId === selectedId;
            if (only) {
                row.style.display = matches ? '' : 'none';
            } else {
                row.style.display = '';
                if (selectedId && matches) {
                    row.classList.add('highlight');
                } else {
                    row.classList.remove('highlight');
                }
            }
        });
    }

    teacherSelect.addEventListener('change', filterRows);
    onlyMine.addEventListener('change', filterRows);

    function setReportLanguage(nextLang) {
        if (!['ru', 'en'].includes(nextLang)) return;
        try { localStorage.setItem('covers_lang', nextLang); } catch (e) {}

        const url = new URL(window.location.href);
        url.searchParams.set('lang', nextLang);

        // Сохраняем выбранного учителя при переключении языка.
        const selectedTeacher = teacherSelect ? teacherSelect.value : '';
        if (selectedTeacher) url.searchParams.set('teacher', selectedTeacher);
        else url.searchParams.delete('teacher');

        window.location.href = url.toString();
    }

    function copyLink() {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            alert(${JSON.stringify(L.linkCopied)});
        }).catch(() => {
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            alert(${JSON.stringify(L.linkCopied)});
        });
    }

    (function() {
        const urlParams = new URLSearchParams(window.location.search);
        const teacherParam = urlParams.get('teacher');
        if (teacherParam) {
            teacherSelect.value = teacherParam;
            filterRows();
        }
    })();
</script>
</body>
</html>`;

        res.set('Cache-Control', 'no-store');
        res.send(html);
    } catch (err) {
        console.error(err);
        res.status(500).send(L.serverError);
    }
});

// ===== ОТДЕЛЬНЫЙ ОТЧЁТ ДЛЯ КУРАТОРОВ (с группировкой по параллелям и объединением классов в строке) =====
router.get('/report-curator/:date', async (req, res) => {
    const date = req.params.date === 'today' ? getTodayReportDate() : req.params.date;
    const lang = getReportLanguage(req);
    const L = getReportLabels(lang);

    if (isNaN(new Date(date).getTime())) {
        return res.status(400).send(L.invalidDate);
    }

    const day = new Date(date + 'T00:00:00').toLocaleString('en-US', { weekday: 'long' });
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (!validDays.includes(day)) {
        return res.status(400).send(L.invalidWeekday);
    }

    try {
        // ---- Справочники ----
        const teachersRes = await pool.query('SELECT id, name FROM teachers ORDER BY name');
        const teachers = teachersRes.rows;
        const classesRes = await pool.query('SELECT id, name FROM classes ORDER BY name');
        const classes = classesRes.rows;
        const roomsRes = await pool.query('SELECT id, name FROM rooms ORDER BY name');
        const rooms = roomsRes.rows;
        const subjectsRes = await pool.query('SELECT id, name FROM subjects ORDER BY name');
        const subjects = subjectsRes.rows;

        const teacherMap = {};
        teachers.forEach(t => teacherMap[t.id] = t.name);
        const classMap = {};
        classes.forEach(c => classMap[c.id] = c.name);
        const roomMap = {};
        rooms.forEach(r => roomMap[r.id] = r.name);
        const subjectMap = {};
        subjects.forEach(s => subjectMap[s.id] = s.name);

        // ---- Логическая группа класса для отчёта куратора ----
        // D/M объединяем в одну параллель, а индивидуальные 12/13 классы
        // показываем как привычные 10Y12 / 11Y13.
        function getCuratorClassGroup(className) {
            const name = String(className || '').trim();
            if (/^12\s+/i.test(name)) return '10Y12';
            if (/^13\s+/i.test(name)) return '11Y13';

            const match = name.match(/^(\d+Y\d+)/i);
            return match ? match[1].toUpperCase() : null;
        }

        // ---- 1. Замены учителей (собираем данные) ----
        const lessonsRes = await pool.query(`
            SELECT l.*, 
                   s.name as subject_name, c.name as class_name, r.name as room_name
            FROM lessons l
            JOIN subjects s ON l.subject_id = s.id
            JOIN classes c ON l.class_id = c.id
            JOIN rooms r ON l.room_id = r.id
            WHERE l.day = $1
        `, [day]);
        const lessons = lessonsRes.rows;

        const absencesRes = await pool.query(`
            SELECT a.*, t.name as teacher_name
            FROM absences a
            JOIN teachers t ON a.teacher_id = t.id
            WHERE a.day = $1 AND a.date = $2
        `, [day, date]);
        const absences = absencesRes.rows;

        const absenceIds = absences.map(a => a.id);
        let replacements = [];
        if (absenceIds.length > 0) {
            const replRes = await pool.query(`
                SELECT r.*, t.name as replacement_name
                FROM replacements r
                JOIN teachers t ON r.replacement_teacher_id = t.id
                WHERE r.absence_id = ANY($1)
            `, [absenceIds]);
            replacements = replRes.rows;
        }

        const replByAbsence = {};
        replacements.forEach(r => {
            if (!replByAbsence[r.absence_id]) replByAbsence[r.absence_id] = {};
            if (!replByAbsence[r.absence_id][r.period]) replByAbsence[r.absence_id][r.period] = [];
            replByAbsence[r.absence_id][r.period].push({
                teacherId: r.replacement_teacher_id,
                teacherName: r.replacement_name,
                comment: r.comment
            });
        });

        // ---- Формируем сырые элементы (без группировки по классу) ----
        const rawItems = [];
        for (const lesson of lessons) {
            const absent = absences.find(a => a.teacher_id === lesson.teacher_id);
            if (!absent) continue;
            const replList = (replByAbsence[absent.id] && replByAbsence[absent.id][lesson.period]) || [];
            // Не показываем урок в отчёте, если на этот период фактически не назначена замена.
            if (!replList.length) continue;
            const assignedTeacherIds = replList.map(r => r.teacherId).filter(id => id !== null && id !== undefined);
            const commentsArray = replList.map(r => r.comment).filter(c => c && c.trim() !== '');
            rawItems.push({
                absentId: lesson.teacher_id,
                absentName: teacherMap[lesson.teacher_id] || '?',
                period: lesson.period,
                classId: lesson.class_id,
                className: lesson.class_name,
                subject: lesson.subject_name,
                roomInfo: lesson.room_name,
                assignedTeacherIds,
                commentsArray
            });
        }

        // Один фактический урок = одна строка; все class_id этого урока объединяются.
        const teacherRows = buildTeacherReportRows(rawItems, classes, teacherMap, lang);

        // ---- 2. Замены кабинетов (оставляем как есть) ----
        const swapsRes = await pool.query(`
            SELECT cs.*, 
                   (SELECT array_agg(class_id) FROM swap_classes WHERE swap_id = cs.id) as class_ids
            FROM classroom_swaps cs
            WHERE cs.day = $1 AND cs.date = $2
        `, [day, date]);
        const swaps = swapsRes.rows;

        const swapRows = [];
        for (const swap of swaps) {
            const originalRoomName = roomMap[swap.original_room_id] || '?';
            const newRoomName = roomMap[swap.new_room_id] || '?';
            const teacherId = swap.teacher_id || null;
            const teacherName = teacherId ? (teacherMap[teacherId] || '?') : L.all;
            const classIds = swap.class_ids || [];
            const classDisplay = classIds.length
                ? formatClassCell(classIds.map(id => classMap[id] || '?'), classes, lang)
                : { text: L.all, html: escapeHtml(L.all) };
            const classNames = classDisplay.text;
            const timeRange = getTimeRangeForPeriods(swap.lesson_from, swap.lesson_to);
            swapRows.push({
                lessonFrom: swap.lesson_from,
                lessonTo: swap.lesson_to,
                timeRange: timeRange,
                originalRoom: originalRoomName,
                newRoom: newRoomName,
                teacherId: teacherId,
                teacherName: teacherName,
                classNames: classNames,
                classHtml: classDisplay.html,
                classIds: classIds,
                comment: swap.comment || '—'
            });
        }
        swapRows.sort((a, b) => a.lessonFrom - b.lessonFrom);

        // ---- Получаем кураторов ----
        const curatorsRes = await pool.query(`
            SELECT cr.id, cr.name, array_agg(c.id) as class_ids
            FROM curators cr
            LEFT JOIN classes c ON c.curator_id = cr.id
            GROUP BY cr.id, cr.name
        `);
        const curators = curatorsRes.rows;

        // ---- Генерируем HTML для кураторов ----
        let curatorHtml = '';
        for (const curator of curators) {
            const classIds = curator.class_ids || [];
            if (classIds.length === 0) continue;

            const parallelSet = new Set();
            classIds.forEach(id => {
                const name = classMap[id];
                if (name) {
                    const num = getCuratorClassGroup(name);
                    if (num) parallelSet.add(num);
                }
            });
            const sortedParallels = Array.from(parallelSet).sort((a, b) => parseInt(a) - parseInt(b));

            const hasAnyReplacement = teacherRows.some(row => row.classIds.some(id => classIds.includes(id))) ||
                                      swapRows.some(row => row.classIds.some(id => classIds.includes(id)));
            if (!hasAnyReplacement) continue;

            curatorHtml += `<div class="curator-block">`;
            curatorHtml += `<div class="curator-header">${escapeHtml(curator.name)}</div>`;

            for (const parallel of sortedParallels) {
                const teacherRowsForParallel = teacherRows.filter(row => {
                    return row.classIds.some(id => {
                        const name = classMap[id];
                        return name && getCuratorClassGroup(name) === parallel;
                    });
                });
                const swapRowsForParallel = swapRows.filter(row => {
                    return row.classIds.some(id => {
                        const name = classMap[id];
                        return name && getCuratorClassGroup(name) === parallel;
                    });
                });

                if (teacherRowsForParallel.length === 0 && swapRowsForParallel.length === 0) continue;

                curatorHtml += `<div class="parallel-group">`;
                curatorHtml += `<div class="parallel-label">${parallel}</div>`;

                if (teacherRowsForParallel.length > 0) {
                    curatorHtml += `<div class="subsection-label">${L.teacherReplacements}</div>`;
                    curatorHtml += `<div class="table-wrap">`;
                    curatorHtml += `<table class="report-table">`;
                    curatorHtml += `<thead><tr>
                        <th>${L.periods}</th><th>${L.time}</th><th>${L.classes}</th><th>${L.subject}</th>
                        <th>${L.room}</th><th>${L.absentTeacher}</th><th>${L.replacementTeacher}</th><th>${L.comment}</th>
                    </tr></thead><tbody>`;
                    for (const row of teacherRowsForParallel) {
                        curatorHtml += `<tr>
                            <td data-label="${L.periods}"><strong>${escapeHtml(row.lessonDisplay)}</strong></td>
                            <td data-label="${L.time}">${escapeHtml(row.timeRange)}</td>
                            <td data-label="${L.classes}" style="min-width:180px; max-width:310px;">${row.classHtml || escapeHtml(row.className)}</td>
                            <td data-label="${L.subject}">${escapeHtml(row.subject)}</td>
                            <td data-label="${L.room}">${escapeHtml(row.roomInfo)}</td>
                            <td data-label="${L.absentTeacher}">${escapeHtml(row.absentName)}</td>
                            <td data-label="${L.replacementTeacher}" class="replacement-teacher">${escapeHtml(row.assignedName)}</td>
                            <td data-label="${L.comment}">${escapeHtml(row.comment)}</td>
                        </tr>`;
                    }
                    curatorHtml += `</tbody></table></div>`;
                }

                if (swapRowsForParallel.length > 0) {
                    curatorHtml += `<div class="subsection-label">${L.classroomReplacements}</div>`;
                    curatorHtml += `<div class="table-wrap">`;
                    curatorHtml += `<table class="report-table">`;
                    curatorHtml += `<thead><tr>
                        <th>${L.periods}</th><th>${L.time}</th><th>${L.originalRoom}</th><th>${L.newRoom}</th>
                        <th>${L.teacher}</th><th>${L.classes}</th><th>${L.comment}</th>
                    </tr></thead><tbody>`;
                    for (const row of swapRowsForParallel) {
                        const lessonRange = row.lessonFrom === row.lessonTo ? row.lessonFrom : `${row.lessonFrom}–${row.lessonTo}`;
                        curatorHtml += `<tr>
                            <td data-label="${L.periods}"><strong>${escapeHtml(lessonRange)}</strong></td>
                            <td data-label="${L.time}">${escapeHtml(row.timeRange)}</td>
                            <td data-label="${L.originalRoom}">${escapeHtml(row.originalRoom)}</td>
                            <td data-label="${L.newRoom}">${escapeHtml(row.newRoom)}</td>
                            <td data-label="${L.teacher}" class="replacement-teacher">${escapeHtml(row.teacherName)}</td>
                            <td data-label="${L.classes}" style="min-width:180px; max-width:310px;">${row.classHtml || escapeHtml(row.classNames)}</td>
                            <td data-label="${L.comment}">${escapeHtml(row.comment)}</td>
                        </tr>`;
                    }
                    curatorHtml += `</tbody></table></div>`;
                }

                curatorHtml += `</div>`;
            }

            curatorHtml += `</div>`;
        }

        // ---- Финальный HTML с центрированными заголовками ----
        let html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${L.curatorTitle} - ${date}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #f1f5f9; font-family: 'Inter', system-ui, sans-serif; padding: 28px 20px; color: #0f172a; }
        .container { max-width: 1600px; margin: 0 auto; }
        h1 { font-size: 1.6rem; font-weight: 700; color: #0f172a; margin-bottom: 1.5rem; border-bottom: 2px solid #cbd5e1; padding-bottom: 0.3rem; text-align: center; }
        .curator-block {
            background: #ffffff;
            border-radius: 20px;
            padding: 1.2rem 1.5rem;
            margin-bottom: 1.8rem;
            border-left: 5px solid #3b82f6;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .curator-header {
            font-size: 1.1rem;
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 0.8rem;
            letter-spacing: -0.2px;
            text-align: center;
        }
        .parallel-group {
            margin-top: 1.2rem;
            border-top: 1px dashed #e2e8f0;
            padding-top: 0.8rem;
        }
        .parallel-label {
            font-size: 1rem;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 0.6rem;
            text-align: center;
        }
        .subsection-label {
            font-size: 0.85rem;
            font-weight: 600;
            color: #475569;
            margin: 0.8rem 0 0.4rem 0;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 0.2rem;
        }
        .table-wrap { overflow-x: auto; margin-top: 0.3rem; }
        .report-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            font-size: 0.85rem;
            border: 1px solid #e2e8f0;
        }
        .report-table th, .report-table td {
            padding: 8px 6px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
            text-align: left;
        }
        .report-table th {
            background: #f8fafc;
            font-weight: 600;
            font-size: 0.8rem;
            color: #1e293b;
        }
        .report-table tbody tr:hover {
            background: #f1f5f9;
        }
        .replacement-teacher {
            font-weight: 700;
        }
        @media (max-width: 640px) {
            .report-table, .report-table thead, .report-table tbody, .report-table tr, .report-table th, .report-table td {
                display: block;
            }
            .report-table thead { display: none; }
            .report-table tr {
                margin-bottom: 0.8rem;
                border: 1px solid #cbd5e1;
                background: white;
                padding: 0.5rem;
            }
            .report-table td {
                border: none;
                padding: 0.4rem 0;
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                gap: 0.5rem;
                font-size: 0.8rem;
            }
            .report-table td::before {
                content: attr(data-label);
                font-weight: 700;
                color: #1e293b;
                width: 35%;
                flex-shrink: 0;
                font-size: 0.7rem;
                background: #f8fafc;
                padding: 2px 6px;
                display: inline-block;
                text-align: center;
                border: 1px solid #e2e8f0;
            }
            .curator-block { padding: 0.8rem 1rem; }
            .curator-header { font-size: 1rem; }
            .parallel-label { font-size: 0.95rem; }
        }
        .report-topbar {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            margin-bottom: 12px;
        }
        .lang-switch {
            display: inline-flex;
            align-items: center;
            border: 1px solid #94a3b8;
            border-radius: 4px;
            overflow: hidden;
            background: #ffffff;
            height: 36px;
        }
        .lang-switch button {
            min-width: 42px;
            height: 34px;
            padding: 0 10px;
            border: 0;
            border-right: 1px solid #cbd5e1;
            background: #ffffff;
            color: #475569;
            font: inherit;
            font-size: 0.78rem;
            font-weight: 700;
            cursor: pointer;
        }
        .lang-switch button:last-child { border-right: 0; }
        .lang-switch button:hover { background: #f1f5f9; }
        .lang-switch button.active { background: #0f172a; color: #ffffff; }
        footer {
            text-align: center;
            margin-top: 32px;
            font-size: 0.75rem;
            color: #64748b;
        }
    </style>
</head>
<body>
<div class="container">
    <div class="report-topbar">
        <div class="lang-switch" aria-label="Language">
            <button type="button" class="${lang === 'ru' ? 'active' : ''}" aria-pressed="${lang === 'ru'}" onclick="setReportLanguage('ru')">RU</button>
            <button type="button" class="${lang === 'en' ? 'active' : ''}" aria-pressed="${lang === 'en'}" onclick="setReportLanguage('en')">EN</button>
        </div>
    </div>
    <h1>Covers ${formatDate(date, lang)}</h1>
    ${curatorHtml}
    <footer>${L.curatorFooter}</footer>
</div>
<script>
    function setReportLanguage(nextLang) {
        if (!['ru', 'en'].includes(nextLang)) return;
        try { localStorage.setItem('covers_lang', nextLang); } catch (e) {}
        const url = new URL(window.location.href);
        url.searchParams.set('lang', nextLang);
        window.location.href = url.toString();
    }
</script>
</body>
</html>`;

        res.set('Cache-Control', 'no-store');
        res.send(html);
    } catch (err) {
        console.error(err);
        res.status(500).send(L.serverError);
    }
});

// ===== Вспомогательная функция для экранирования HTML =====
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]);
}

module.exports = router;