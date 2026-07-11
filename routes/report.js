const express = require('express');
const router = express.Router();
const pool = require('../db');
function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDate();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[date.getMonth()];
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

// ===== ОСНОВНОЙ ОТЧЁТ (без кураторов) =====
router.get('/:date', async (req, res) => {
    const { date } = req.params;

    if (isNaN(new Date(date).getTime())) {
        return res.status(400).send('Неверная дата');
    }

    const day = new Date(date + 'T00:00:00').toLocaleString('en-US', { weekday: 'long' });
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (!validDays.includes(day)) {
        return res.status(400).send('День недели не подходит (должен быть понедельник–пятница)');
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

        const tempGroups = new Map();
        for (const item of rawItems) {
            const key = `${item.absentId}|${item.subject}|${item.roomInfo}|${item.assignedTeacherIds.sort().join(',')}`;
            if (!tempGroups.has(key)) {
                tempGroups.set(key, {
                    absentId: item.absentId,
                    absentName: item.absentName,
                    subject: item.subject,
                    roomInfo: item.roomInfo,
                    assignedTeacherIds: [...item.assignedTeacherIds],
                    periods: new Set(),
                    classIds: new Set(),
                    classes: new Set(),
                    comments: new Set()
                });
            }
            const g = tempGroups.get(key);
            g.periods.add(item.period);
            g.classIds.add(item.classId);
            g.classes.add(item.className);
            if (item.commentsArray) {
                item.commentsArray.forEach(c => g.comments.add(c.trim()));
            }
        }

        const finalGroups = [];
        for (const g of tempGroups.values()) {
            const classesByFamily = new Map();
            for (const cls of g.classes) {
                const family = getClassFamily(cls);
                if (!classesByFamily.has(family)) classesByFamily.set(family, new Set());
                classesByFamily.get(family).add(cls);
            }
            for (const [family, classSet] of classesByFamily.entries()) {
                const classIdsForFamily = new Set();
                for (const cls of classSet) {
                    const id = classes.find(c => c.name === cls)?.id;
                    if (id) classIdsForFamily.add(id);
                }
                finalGroups.push({
                    absentId: g.absentId,
                    absentName: g.absentName,
                    subject: g.subject,
                    roomInfo: g.roomInfo,
                    assignedTeacherIds: [...g.assignedTeacherIds],
                    periods: new Set(g.periods),
                    classIds: classIdsForFamily,
                    classes: new Set(classSet),
                    comments: new Set(g.comments)
                });
            }
        }

        const teacherRows = [];
        for (const g of finalGroups) {
            const periods = Array.from(g.periods).sort((a, b) => a - b);
            const ranges = [];
            let start = periods[0], end = periods[0];
            for (let i = 1; i < periods.length; i++) {
                if (periods[i] === end + 1) {
                    end = periods[i];
                } else {
                    ranges.push({ start, end });
                    start = periods[i];
                    end = periods[i];
                }
            }
            ranges.push({ start, end });

            const classesListStr = Array.from(g.classes).sort().join(', ');
            const assignedNames = g.assignedTeacherIds.map(id => teacherMap[id] || '?').filter(n => n);
            const assignedStr = assignedNames.length ? assignedNames.join(', ') : '—';
            const combinedComment = Array.from(g.comments).join('; ') || '—';
            const replacementIdsStr = g.assignedTeacherIds.join(',');

            for (const r of ranges) {
                teacherRows.push({
                    lessonDisplay: r.start === r.end ? `${r.start}` : `${r.start}–${r.end}`,
                    timeRange: getTimeRangeForPeriods(r.start, r.end),
                    className: classesListStr,
                    classIds: Array.from(g.classIds),
                    subject: g.subject,
                    roomInfo: g.roomInfo,
                    absentName: g.absentName,
                    assignedName: assignedStr,
                    comment: combinedComment,
                    replacementIds: replacementIdsStr
                });
            }
        }

        teacherRows.sort((a, b) => {
            const aStart = parseInt(a.lessonDisplay.split('–')[0]);
            const bStart = parseInt(b.lessonDisplay.split('–')[0]);
            return aStart - bStart;
        });

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
            const teacherName = teacherId ? (teacherMap[teacherId] || '?') : 'Все';
            const classIds = swap.class_ids || [];
            const classNames = classIds.length ? classIds.map(id => classMap[id] || '?').join(', ') : 'Все';
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
                classIds: classIds,
                comment: swap.comment || '—'
            });
        }
        swapRows.sort((a, b) => a.lessonFrom - b.lessonFrom);

        // ---- Формируем HTML (без кураторов) ----
        let html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, viewport-fit=cover">
    <title>Отчёт о заменах - ${date}</title>
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
    <h1>Covers ${formatDate(date)}</h1>

    <div class="absent-list">
        <strong><i class="fas fa-user-slash" style="color:#ef4444; margin-right:6px;"></i> Отсутствующие учителя:</strong>
        ${absentTeachers.length ? absentTeachers.map(name => `<span class="absent-name">${name}</span>`).join('') : '<span style="color:#64748b;">нет</span>'}
    </div>

    <div class="controls">
        <div class="control-group">
            <label for="teacherSelect"><i class="fas fa-user"></i> Учитель:</label>
            <select id="teacherSelect">
                <option value="">Все</option>
                ${teachers.filter(t => teacherRows.some(row => row.replacementIds.split(',').includes(String(t.id))) || swapRows.some(row => row.teacherId === t.id)).map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
        </div>
        <div class="control-group">
            <label><input type="checkbox" id="onlyMine"> Только мои замены</label>
        </div>
        <div class="control-group" style="margin-left: auto;">
            <button onclick="copyLink()" class="primary"><i class="fas fa-copy"></i> Копировать ссылку</button>
            <button onclick="window.print()" class="secondary"><i class="fas fa-print"></i> Печать</button>
        </div>
    </div>

    <h2 class="section-title">Замены учителей</h2>
    ${teacherRows.length === 0 ? '<p>Нет замен учителей на выбранную дату.</p>' : `
    <div class="report-table-wrapper"><table class="report-table" id="reportTable">
        <thead><tr>
            <th>Урок(и)</th><th>Время</th><th>Класс(ы)</th><th>Предмет</th>
            <th>Кабинет</th><th>Кого заменяем</th><th>Кто заменяет</th><th>Комментарий</th>
        </tr></thead><tbody>
        ${teacherRows.map(row => `
            <tr data-replacement-ids="${row.replacementIds}">
                <td data-label="Урок(и)"><strong>${row.lessonDisplay}</strong></td>
                <td data-label="Время">${row.timeRange}</td>
                <td data-label="Класс(ы)">${row.className}</td>
                <td data-label="Предмет">${row.subject}</td>
                <td data-label="Кабинет">${row.roomInfo}</td>
                <td data-label="Кого заменяем">${row.absentName}</td>
                <td data-label="Кто заменяет" class="replacement-teacher">${row.assignedName}</td>
                <td data-label="Комментарий">${row.comment}</td>
            </tr>
        `).join('')}
        </tbody></table></div>
    `}

    <h2 class="section-title">Замены кабинетов</h2>
    ${swapRows.length === 0 ? '<p>Нет замен кабинетов на выбранную дату.</p>' : `
    <div class="report-table-wrapper"><table class="report-table" id="swapTable">
        <thead><tr>
            <th>Урок(и)</th>
            <th>Время</th>
            <th>Класс(ы)</th>
            <th>Исходный кабинет</th>
            <th>Новый кабинет</th>
            <th>Учитель</th>
            <th>Комментарий</th>
        </tr></thead><tbody>
        ${swapRows.map(row => `
            <tr data-teacher-id="${row.teacherId || ''}">
                <td data-label="Урок(и)">${row.lessonFrom === row.lessonTo ? row.lessonFrom : row.lessonFrom + '–' + row.lessonTo}</td>
                <td data-label="Время">${row.timeRange}</td>
                <td data-label="Класс(ы)">${row.classNames}</td>
                <td data-label="Исходный кабинет">${row.originalRoom}</td>
                <td data-label="Новый кабинет">${row.newRoom}</td>
                <td data-label="Учитель" class="replacement-teacher">${row.teacherName}</td>
                <td data-label="Комментарий">${row.comment}</td>
            </tr>
        `).join('')}
        </tbody></table></div>
    `}

    <div class="footer-note">* Жёлтая подсветка в таблицах — строки, где вы указаны как заменяющий (для кабинетов — указан как учитель).</div>
    <footer style="text-align:center; margin-top:32px; font-size:0.75rem; color:#64748b;">© Covers — система замен учителей и кабинетов</footer>
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

    function copyLink() {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            alert('Ссылка скопирована!');
        }).catch(() => {
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            alert('Ссылка скопирована!');
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

        res.send(html);
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

// ===== ОТДЕЛЬНЫЙ ОТЧЁТ ДЛЯ КУРАТОРОВ (с группировкой по параллелям и объединением классов в строке) =====
router.get('/report-curator/:date', async (req, res) => {
    const { date } = req.params;

    if (isNaN(new Date(date).getTime())) {
        return res.status(400).send('Неверная дата');
    }

    const day = new Date(date + 'T00:00:00').toLocaleString('en-US', { weekday: 'long' });
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (!validDays.includes(day)) {
        return res.status(400).send('День недели не подходит (должен быть понедельник–пятница)');
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

        // ---- Вспомогательная функция для извлечения номера параллели ----
        function getClassNumber(className) {
            const match = className.match(/^(\d+)/);
            return match ? match[1] : null;
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

        // ---- Группируем по absentId, subject, roomInfo, assignedTeacherIds и номеру параллели ----
        const groupMap = new Map();
        for (const item of rawItems) {
            const assignedKey = item.assignedTeacherIds.slice().sort().join(',');
            const parallel = getClassNumber(item.className);
            if (!parallel) continue;
            const key = `${item.absentId}|${item.subject}|${item.roomInfo}|${assignedKey}|${parallel}`;
            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    absentId: item.absentId,
                    absentName: item.absentName,
                    subject: item.subject,
                    roomInfo: item.roomInfo,
                    assignedTeacherIds: [...item.assignedTeacherIds],
                    periods: new Set(),
                    classIds: new Set(),
                    classNames: new Set(),
                    comments: new Set()
                });
            }
            const g = groupMap.get(key);
            g.periods.add(item.period);
            g.classIds.add(item.classId);
            g.classNames.add(item.className);
            if (item.commentsArray) {
                item.commentsArray.forEach(c => g.comments.add(c.trim()));
            }
        }

        // ---- Формируем строки для таблицы замен учителей ----
        const teacherRows = [];
        for (const g of groupMap.values()) {
            const periods = Array.from(g.periods).sort((a, b) => a - b);
            const ranges = [];
            let start = periods[0], end = periods[0];
            for (let i = 1; i < periods.length; i++) {
                if (periods[i] === end + 1) {
                    end = periods[i];
                } else {
                    ranges.push({ start, end });
                    start = periods[i];
                    end = periods[i];
                }
            }
            ranges.push({ start, end });

            const classNamesSorted = Array.from(g.classNames).sort();
            const classesListStr = classNamesSorted.join(', ');
            const assignedNames = g.assignedTeacherIds.map(id => teacherMap[id] || '?').filter(n => n);
            const assignedStr = assignedNames.length ? assignedNames.join(', ') : '—';
            const combinedComment = Array.from(g.comments).join('; ') || '—';
            const replacementIdsStr = g.assignedTeacherIds.join(',');

            for (const r of ranges) {
                teacherRows.push({
                    lessonDisplay: r.start === r.end ? `${r.start}` : `${r.start}–${r.end}`,
                    timeRange: getTimeRangeForPeriods(r.start, r.end),
                    className: classesListStr,
                    classIds: Array.from(g.classIds),
                    subject: g.subject,
                    roomInfo: g.roomInfo,
                    absentName: g.absentName,
                    assignedName: assignedStr,
                    comment: combinedComment,
                    replacementIds: replacementIdsStr
                });
            }
        }

        teacherRows.sort((a, b) => {
            const aStart = parseInt(a.lessonDisplay.split('–')[0]);
            const bStart = parseInt(b.lessonDisplay.split('–')[0]);
            return aStart - bStart;
        });

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
            const teacherName = teacherId ? (teacherMap[teacherId] || '?') : 'Все';
            const classIds = swap.class_ids || [];
            const classNames = classIds.length ? classIds.map(id => classMap[id] || '?').join(', ') : 'Все';
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
                    const num = getClassNumber(name);
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
                        return name && getClassNumber(name) === parallel;
                    });
                });
                const swapRowsForParallel = swapRows.filter(row => {
                    return row.classIds.some(id => {
                        const name = classMap[id];
                        return name && getClassNumber(name) === parallel;
                    });
                });

                if (teacherRowsForParallel.length === 0 && swapRowsForParallel.length === 0) continue;

                curatorHtml += `<div class="parallel-group">`;
                curatorHtml += `<div class="parallel-label">${parallel} классы</div>`;

                if (teacherRowsForParallel.length > 0) {
                    curatorHtml += `<div class="subsection-label">Замены учителей</div>`;
                    curatorHtml += `<div class="table-wrap">`;
                    curatorHtml += `<table class="report-table">`;
                    curatorHtml += `<thead><tr>
                        <th>Урок(и)</th><th>Время</th><th>Класс(ы)</th><th>Предмет</th>
                        <th>Кабинет</th><th>Кого заменяем</th><th>Кто заменяет</th><th>Комментарий</th>
                    </tr></thead><tbody>`;
                    for (const row of teacherRowsForParallel) {
                        curatorHtml += `<tr>
                            <td data-label="Урок(и)"><strong>${escapeHtml(row.lessonDisplay)}</strong></td>
                            <td data-label="Время">${escapeHtml(row.timeRange)}</td>
                            <td data-label="Класс(ы)">${escapeHtml(row.className)}</td>
                            <td data-label="Предмет">${escapeHtml(row.subject)}</td>
                            <td data-label="Кабинет">${escapeHtml(row.roomInfo)}</td>
                            <td data-label="Кого заменяем">${escapeHtml(row.absentName)}</td>
                            <td data-label="Кто заменяет" class="replacement-teacher">${escapeHtml(row.assignedName)}</td>
                            <td data-label="Комментарий">${escapeHtml(row.comment)}</td>
                        </tr>`;
                    }
                    curatorHtml += `</tbody></table></div>`;
                }

                if (swapRowsForParallel.length > 0) {
                    curatorHtml += `<div class="subsection-label">Замены кабинетов</div>`;
                    curatorHtml += `<div class="table-wrap">`;
                    curatorHtml += `<table class="report-table">`;
                    curatorHtml += `<thead><tr>
                        <th>Урок(и)</th><th>Время</th><th>Исходный кабинет</th><th>Новый кабинет</th>
                        <th>Учитель</th><th>Класс(ы)</th><th>Комментарий</th>
                    </tr></thead><tbody>`;
                    for (const row of swapRowsForParallel) {
                        const lessonRange = row.lessonFrom === row.lessonTo ? row.lessonFrom : `${row.lessonFrom}–${row.lessonTo}`;
                        curatorHtml += `<tr>
                            <td data-label="Урок(и)"><strong>${escapeHtml(lessonRange)}</strong></td>
                            <td data-label="Время">${escapeHtml(row.timeRange)}</td>
                            <td data-label="Исходный кабинет">${escapeHtml(row.originalRoom)}</td>
                            <td data-label="Новый кабинет">${escapeHtml(row.newRoom)}</td>
                            <td data-label="Учитель" class="replacement-teacher">${escapeHtml(row.teacherName)}</td>
                            <td data-label="Класс(ы)">${escapeHtml(row.classNames)}</td>
                            <td data-label="Комментарий">${escapeHtml(row.comment)}</td>
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
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Отчёт куратора - ${date}</title>
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
    <h1>Covers ${formatDate(date)}</h1>
    ${curatorHtml}
    <footer>© Covers — система замен</footer>
</div>
</body>
</html>`;

        res.send(html);
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

// ===== Вспомогательная функция для экранирования HTML =====
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]);
}

module.exports = router;