// -------------------- Функции для главной страницы (замены) --------------------

function getSelectedDate() {
    const input = document.getElementById('reportDateMain');
    return input ? input.value : '';
}

// -------------------- Управление датой --------------------
const dateInputMain = document.getElementById('reportDateMain');
const dayDisplay = document.getElementById('dayDisplay');
const dateDisplay = document.getElementById('dateDisplay');

function updateDateDisplay() {
    if (!dateInputMain) return;
    const dateValue = dateInputMain.value;
    if (!dateValue) return;

    const parts = dateValue.split('-');
    const formatted = `${parts[2]}.${parts[1]}.${parts[0]}`;
    if (dateDisplay) dateDisplay.textContent = formatted;

    const dateObj = new Date(dateValue + 'T00:00:00');
    const dayNameRu = dateObj.toLocaleDateString('ru-RU', { weekday: 'long' });
    if (dayDisplay) dayDisplay.textContent = dayNameRu.charAt(0).toUpperCase() + dayNameRu.slice(1);

    const englishDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    window._currentDay = englishDays[dateObj.getDay()];
    window._currentDate = dateValue;

    loadAbsenceCheckboxes();
    renderSwapsTable();
}

function setDefaultDate() {
    if (!dateInputMain) return;
    const today = new Date().toISOString().split('T')[0];
    dateInputMain.value = today;
    updateDateDisplay();
}

if (dateInputMain) {
    dateInputMain.addEventListener('change', updateDateDisplay);
    dateInputMain.addEventListener('input', updateDateDisplay);
}

// -------------------- Загрузка отсутствующих для чекбоксов --------------------
async function loadAbsenceCheckboxes() {
    const day = window._currentDay;
    const date = getSelectedDate();
    if (!date) {
        console.warn('Дата не выбрана');
        return;
    }
    const absences = await loadAbsences(day, date);
    window._absences = absences;
    const absentIds = absences.map(a => a.teacher_id);

    const checkboxes = document.querySelectorAll('#absentCheckboxes input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const teacherId = parseInt(cb.value);
        cb.checked = absentIds.includes(teacherId);
    });
}

// -------------------- Управление отсутствующими и заменами --------------------
async function renderAssignmentsTable(loadFromServer = true) {
    const day = window._currentDay;
    const date = getSelectedDate();
    if (!date) {
        alert('Пожалуйста, выберите дату.');
        return;
    }
    window._currentDate = date;

    if (loadFromServer) {
        const absences = await loadAbsences(day, date);
        window._absences = absences;
        const replacementsData = await loadReplacements(day, date);
        window._replacements = replacementsData;
    } else {
        if (!window._absences || window._absences.length === 0) {
            window._absences = await loadAbsences(day, date);
        }
    }

    const absentIds = window._absences.map(a => a.teacher_id);
    if (!absentIds.length) {
        alert("Нет отсутствующих учителей для выбранной даты.");
        return;
    }

    const lessonsForDay = await loadLessons({ day });
    window._lessonsForDay = lessonsForDay;

    let html = `<div class="assignments-wrapper"><table class="assignment-table"><thead><tr><th>Урок / Period</th>`;
    for (let a of absentIds) {
        html += `<th>${escapeHtml(getTeacherName(a))}</th>`;
    }
    html += `</tr></thead><tbody>`;

    for (let p = 1; p <= 9; p++) {
        html += `<tr><td style="font-weight:bold; text-align:center;">${p}</td>`;
        for (let a of absentIds) {
            const absentLessons = lessonsForDay.filter(l => l.teacher_id === a && l.period === p);
            let lessonInfo = absentLessons.length ? absentLessons.map(l => `${l.subject} | ${l.class} | room ${l.room}`).join('<br>') : '⚠️ no lesson';
            html += `<td><div style="margin-bottom:8px; background:#f1f5f9; padding:6px; border-radius:18px;">${lessonInfo}</div>`;

            if (absentLessons.length === 0) {
                html += `<span style="color:#64748b;">урок отсутствует / no lesson</span>`;
            } else {
                const absentClasses = absentLessons.map(l => l.class_id);
                const candidates = state.teachers.filter(t => {
                    if (t.id === a) return false;
                    const tLessons = lessonsForDay.filter(l => l.teacher_id === t.id && l.period === p);
                    if (tLessons.length === 0) return true;
                    return tLessons.some(l => absentClasses.includes(l.class_id));
                });
                candidates.sort((t1, t2) => {
                    const t1Same = lessonsForDay.some(l => l.teacher_id === t1.id && l.period === p && absentClasses.includes(l.class_id));
                    const t2Same = lessonsForDay.some(l => l.teacher_id === t2.id && l.period === p && absentClasses.includes(l.class_id));
                    if (t1Same && !t2Same) return -1;
                    if (!t1Same && t2Same) return 1;
                    return 0;
                });

                const replList = (window._replacements[a] && window._replacements[a][p]) || [];
                const containerId = `repl-${day}-${a}-${p}`;
                html += `<div id="${containerId}">`;
                for (let idx = 0; idx < replList.length; idx++) {
                    const r = replList[idx];
                    const teacherOptions = `<option value="">— не назначено —</option>` + 
                        candidates.map(t => {
                            const hasSameClass = lessonsForDay.some(l => l.teacher_id === t.id && l.period === p && absentClasses.includes(l.class_id));
                            const label = hasSameClass ? `${escapeHtml(t.name)} (тот же класс)` : escapeHtml(t.name);
                            return `<option value="${t.id}" ${r.teacherId == t.id ? 'selected' : ''}>${label}</option>`;
                        }).join('');
                    html += `<div class="replacement-item" data-day="${day}" data-absent="${a}" data-period="${p}" data-idx="${idx}">
                                <select class="candidate-select">${teacherOptions}</select>
                                <button class="icon-button remove" data-action="remove"><i class="fas fa-trash-alt"></i></button>
                                <input type="text" class="comment-input" placeholder="Комментарий / Comment" value="${escapeHtml(r.comment || '')}">
                             </div>`;
                }
                html += `<div class="add-button-wrapper"><button class="icon-button add" data-action="add"><i class="fas fa-plus-circle"></i></button></div></div>`;
            }
            html += `</div>`;
        }
        html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    document.getElementById('assignmentsTableDiv').innerHTML = html;
    document.getElementById('assignmentsContainer').style.display = 'block';
}

document.addEventListener('change', async function(e) {
    const target = e.target;
    if (!target.closest('.replacement-item')) return;
    const parentDiv = target.closest('.replacement-item');
    if (!parentDiv) return;
    const day = parentDiv.dataset.day;
    const absent = parseInt(parentDiv.dataset.absent);
    const period = parseInt(parentDiv.dataset.period);
    const idx = parseInt(parentDiv.dataset.idx);
    const date = window._currentDate;

    if (!window._replacements[absent]) window._replacements[absent] = {};
    if (!window._replacements[absent][period]) window._replacements[absent][period] = [];
    if (!window._replacements[absent][period][idx]) window._replacements[absent][period][idx] = { teacherId: null, comment: '' };

    if (target.classList.contains('candidate-select')) {
        const val = target.value;
        window._replacements[absent][period][idx].teacherId = val ? parseInt(val) : null;
        await renderAssignmentsTable(false);
    } else if (target.classList.contains('comment-input')) {
        window._replacements[absent][period][idx].comment = target.value.trim();
        await renderAssignmentsTable(false);
    }
});

document.addEventListener('click', async function(e) {
    const target = e.target.closest('.icon-button');
    if (!target) return;
    const date = window._currentDate;

    if (target.dataset.action === 'add') {
        const container = target.closest('div[id^="repl-"]');
        if (!container) return;
        const match = container.id.match(/repl-(.+)-(\d+)-(\d+)/);
        if (match) {
            const day = match[1], absent = parseInt(match[2]), period = parseInt(match[3]);
            if (!window._replacements[absent]) window._replacements[absent] = {};
            if (!window._replacements[absent][period]) window._replacements[absent][period] = [];
            window._replacements[absent][period].push({ teacherId: null, comment: '' });
            await renderAssignmentsTable(false);
        }
    } else if (target.dataset.action === 'remove') {
        const parentDiv = target.closest('.replacement-item');
        if (parentDiv) {
            const day = parentDiv.dataset.day;
            const absent = parseInt(parentDiv.dataset.absent);
            const period = parseInt(parentDiv.dataset.period);
            const idx = parseInt(parentDiv.dataset.idx);
            if (window._replacements[absent] && window._replacements[absent][period]) {
                window._replacements[absent][period].splice(idx, 1);
                if (window._replacements[absent][period].length === 0) delete window._replacements[absent][period];
                await renderAssignmentsTable(false);
            }
        }
    }
});

async function saveAllAssignments() {
    await saveReplacements(window._currentDay, window._currentDate, window._replacements);
    alert("Замены учителей сохранены");
    await renderAssignmentsTable(true);
}

async function clearAllReplacements() {
    if (confirm("Сбросить все замены учителей?")) {
        window._replacements = {};
        await saveReplacements(window._currentDay, window._currentDate, {});
        await renderAssignmentsTable(true);
        document.getElementById('reportContainer').style.display = 'none';
        alert("Сброшено");
    }
}

// -------------------- Замены кабинетов --------------------
async function renderSwapsTable() {
    const day = window._currentDay;
    const date = getSelectedDate();
    if (!date) {
        document.getElementById('swapsTbody').innerHTML = '<tr><td colspan="8">Выберите дату</td></tr>';
        return;
    }
    const swaps = await loadSwaps(day, date);
    window._classroomSwaps = swaps;

    const tbody = document.getElementById('swapsTbody');
    tbody.innerHTML = '';
    if (swaps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">Нет замен кабинетов на эту дату</td></tr>';
        return;
    }
    swaps.forEach((swap, idx) => {
        const row = tbody.insertRow();

        // 1. Урок(и)
        const lessonRange = swap.lesson_from === swap.lesson_to
            ? `${swap.lesson_from}`
            : `${swap.lesson_from}–${swap.lesson_to}`;
        row.insertCell(0).innerText = lessonRange;

        // 2. Время
        const timeRange = getTimeRangeForPeriods(swap.lesson_from, swap.lesson_to);
        row.insertCell(1).innerText = timeRange;

        // 3. Класс(ы)
        const classNames = swap.class_ids && swap.class_ids.length
            ? swap.class_ids.map(id => getClassName(id)).join(', ')
            : 'Все';
        row.insertCell(2).innerText = classNames;

        // 4. Исходный кабинет
        row.insertCell(3).innerText = swap.original_room_name || getRoomName(swap.original_room_id);

        // 5. Новый кабинет
        row.insertCell(4).innerText = swap.new_room_name || getRoomName(swap.new_room_id);

        // 6. Учитель
        const teacherName = swap.teacher_id ? getTeacherName(swap.teacher_id) : 'Все';
        row.insertCell(5).innerText = teacherName;

        // 7. Комментарий
        row.insertCell(6).innerText = swap.comment || '—';

        // 8. Кнопка удаления
        const delCell = row.insertCell(7);
        const delBtn = document.createElement('button');
        delBtn.className = 'icon-button';
        delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        delBtn.title = 'Удалить замену';
        delBtn.onclick = async () => {
            await deleteSwap(swap.id);
            await renderSwapsTable();
        };
        delCell.appendChild(delBtn);
    });
}

async function addClassroomSwap() {
    const day = window._currentDay;
    const date = getSelectedDate();
    if (!date) { alert("Выберите дату для замен кабинетов"); return; }
    const lessonFrom = parseInt(document.getElementById('swapLessonFrom').value);
    const lessonTo = parseInt(document.getElementById('swapLessonTo').value);
    if (lessonFrom > lessonTo) { alert("Урок «от» не может быть больше «до»"); return; }
    const originalRoomName = document.getElementById('swapOrigRoom').value;
    const newRoomName = document.getElementById('swapNewRoom').value;
    const teacherId = document.getElementById('swapTeacherId').value;
    const teacherIdVal = teacherId ? parseInt(teacherId) : null;
    const selectedClasses = Array.from(document.querySelectorAll('#swapClassCheckboxes input:checked')).map(cb => cb.value);
    const comment = document.getElementById('swapComment').value.trim() || '';

    if (originalRoomName === newRoomName) { alert("Исходный и новый кабинет совпадают"); return; }

    const originalRoomId = getRoomIdByName(originalRoomName);
    const newRoomId = getRoomIdByName(newRoomName);
    if (!originalRoomId || !newRoomId) { alert("Кабинет не найден"); return; }

    const classIds = selectedClasses.map(cls => getClassIdByName(cls)).filter(id => id !== null);

    await addSwap({
        day,
        date,
        lessonFrom,
        lessonTo,
        originalRoomId,
        newRoomId,
        teacherId: teacherIdVal,
        comment,
        classIds
    });
    document.getElementById('swapComment').value = '';
    document.querySelectorAll('#swapClassCheckboxes input:checked').forEach(cb => cb.checked = false);
    await renderSwapsTable();
}

async function clearAllSwaps() {
    if (confirm("Сбросить все замены кабинетов?")) {
        const swaps = window._classroomSwaps || [];
        for (let swap of swaps) {
            await deleteSwap(swap.id);
        }
        await renderSwapsTable();
        alert("Замены кабинетов удалены");
    }
}

// -------------------- ОТЧЁТ --------------------
async function generateUnifiedReport() {
    console.log('generateUnifiedReport вызван');
    const day = window._currentDay;
    const date = getSelectedDate();
    if (!date) {
        alert('Выберите дату для отчёта.');
        return;
    }

    const absences = await loadAbsences(day, date);
    const replacementsData = await loadReplacements(day, date);
    const lessonsForDay = await loadLessons({ day });

    const rawItems = [];
    for (const lesson of lessonsForDay) {
        const absentId = lesson.teacher_id;
        const isAbsent = absences.some(a => a.teacher_id === absentId);
        if (!isAbsent) continue;

        const replList = (replacementsData[absentId] && replacementsData[absentId][lesson.period]) || [];
        const assignedTeacherIds = replList.map(r => r.teacherId).filter(id => id !== null && id !== undefined);
        const commentsArray = replList.map(r => r.comment).filter(c => c && c.trim() !== '');
        rawItems.push({
            absentId,
            absentName: getTeacherName(absentId),
            period: lesson.period,
            className: lesson.class,
            subject: lesson.subject,
            roomInfo: lesson.room,
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
                classes: new Set(),
                comments: new Set()
            });
        }
        const g = tempGroups.get(key);
        g.periods.add(item.period);
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
            finalGroups.push({
                absentId: g.absentId,
                absentName: g.absentName,
                subject: g.subject,
                roomInfo: g.roomInfo,
                assignedTeacherIds: [...g.assignedTeacherIds],
                periods: new Set(g.periods),
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
        const assignedNames = g.assignedTeacherIds.map(id => getTeacherName(id)).filter(n => n);
        const assignedStr = assignedNames.length ? assignedNames.join(', ') : '—';
        const combinedComment = Array.from(g.comments).join('; ') || '—';

        for (const r of ranges) {
            teacherRows.push({
                lessonDisplay: r.start === r.end ? `${r.start}` : `${r.start}–${r.end}`,
                timeRange: getTimeRangeForPeriods(r.start, r.end),
                className: classesListStr,
                subject: g.subject,
                roomInfo: g.roomInfo,
                absentName: g.absentName,
                assignedName: assignedStr,
                comment: combinedComment
            });
        }
    }

    teacherRows.sort((a, b) => {
        const aStart = parseInt(a.lessonDisplay.split('–')[0]);
        const bStart = parseInt(b.lessonDisplay.split('–')[0]);
        return aStart - bStart;
    });

    const swaps = await loadSwaps(day, date);
    const swapRows = [];
    for (const swap of swaps) {
        const originalRoomName = swap.original_room_name || getRoomName(swap.original_room_id);
        const newRoomName = swap.new_room_name || getRoomName(swap.new_room_id);
        const teacherName = swap.teacher_id ? getTeacherName(swap.teacher_id) : 'Все / All';
        const classNames = swap.class_ids && swap.class_ids.length
            ? swap.class_ids.map(id => getClassName(id)).join(', ')
            : 'Все / All';
        const lessonRange = swap.lesson_from === swap.lesson_to
            ? `${swap.lesson_from}`
            : `${swap.lesson_from}–${swap.lesson_to}`;
        const timeRange = getTimeRangeForPeriods(swap.lesson_from, swap.lesson_to);
        swapRows.push({
            lessonRange,
            timeRange,
            originalRoom: originalRoomName,
            newRoom: newRoomName,
            teacher: teacherName,
            classes: classNames,
            comment: swap.comment || '—'
        });
    }

    let html = `<h3>Отчёт о заменах за ${date}</h3>`;

    html += `<h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">1. Замены учителей</h4>`;
    if (teacherRows.length === 0) {
        html += `<p>Нет замен учителей на выбранную дату.</p>`;
    } else {
        html += `<div class="report-table-wrapper"><table class="report-table">`;
        html += `<thead><tr>
            <th>Урок(и)</th><th>Время</th><th>Класс(ы)</th><th>Предмет</th>
            <th>Кабинет</th><th>Кого заменяем</th><th>Кто заменяет</th><th>Комментарий</th>
        </tr></thead><tbody>`;
        for (const row of teacherRows) {
            html += `<tr>
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
        html += `</tbody></table></div>`;
    }

    html += `<h4 style="margin-top: 2rem; margin-bottom: 0.5rem;">2. Замены кабинетов</h4>`;
    if (swapRows.length === 0) {
        html += `<p>Нет замен кабинетов на выбранную дату.</p>`;
    } else {
        html += `<div class="report-table-wrapper"><table class="report-table">`;
        html += `<thead><tr>
            <th>Урок(и)</th><th>Время</th><th>Исходный кабинет</th><th>Новый кабинет</th>
            <th>Учитель</th><th>Класс(ы)</th><th>Комментарий</th>
        </tr></thead><tbody>`;
        for (const row of swapRows) {
            html += `<tr>
                <td data-label="Урок(и)"><strong>${escapeHtml(row.lessonRange)}</strong></td>
                <td data-label="Время">${escapeHtml(row.timeRange)}</td>
                <td data-label="Исходный кабинет">${escapeHtml(row.originalRoom)}</td>
                <td data-label="Новый кабинет">${escapeHtml(row.newRoom)}</td>
                <td data-label="Учитель">${escapeHtml(row.teacher)}</td>
                <td data-label="Класс(ы)">${escapeHtml(row.classes)}</td>
                <td data-label="Комментарий">${escapeHtml(row.comment)}</td>
            </tr>`;
        }
        html += `</tbody></table></div>`;
    }

    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportContainer').style.display = 'block';
}

// -------------------- Копирование отчёта для email --------------------
function copyReportForEmail() {
    const reportContent = document.getElementById('reportContent');
    if (!reportContent || !reportContent.innerHTML.trim()) {
        alert('Сначала сформируйте отчёт.');
        return;
    }
    const styles = document.querySelector('style')?.innerHTML || '';
    const html = reportContent.outerHTML;
    const fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${styles}</style></head>
<body>${html}</body>
</html>`;
    navigator.clipboard.writeText(fullHtml).then(() => {
        alert('HTML отчёта скопирован в буфер обмена!');
    }).catch(err => {
        alert('Ошибка копирования: ' + err.message);
    });
}

// -------------------- Заполнение селектов для главной страницы --------------------
async function populateMainSelects() {
    state.teachers = await loadTeachers();
    state.classes = await loadClasses();
    state.rooms = await loadRooms();
    state.subjects = await loadSubjects();

    // Отсутствующие
    const absentDiv = document.getElementById('absentCheckboxes');
    if (absentDiv) {
        absentDiv.innerHTML = state.teachers.map(t => {
            return `<label><input type="checkbox" value="${t.id}"> ${escapeHtml(t.name)}</label>`;
        }).join('');
    }

    // Замены кабинетов
    const origSel = document.getElementById('swapOrigRoom');
    if (origSel) {
        origSel.innerHTML = state.rooms.map(r => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('');
    }
    const newSel = document.getElementById('swapNewRoom');
    if (newSel) {
        newSel.innerHTML = state.rooms.map(r => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('');
    }
    const teacherSwapSel = document.getElementById('swapTeacherId');
    if (teacherSwapSel) {
        teacherSwapSel.innerHTML = '<option value="">Все учителя / All teachers</option>' + state.teachers.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    }
    const swapClassDiv = document.getElementById('swapClassCheckboxes');
    if (swapClassDiv) {
        swapClassDiv.innerHTML = state.classes.map(c => {
            return `<label><input type="checkbox" value="${c.name}"> ${c.name}</label>`;
        }).join('');
    }
}

// -------------------- Инициализация --------------------
document.addEventListener('DOMContentLoaded', async function() {
    await populateMainSelects();
    setDefaultDate();
    await loadAbsenceCheckboxes();
    await renderSwapsTable();

    // Обработчики
    document.getElementById('showAssignmentsBtn').onclick = () => renderAssignmentsTable(true);
    document.getElementById('saveAssignmentsBtn')?.addEventListener('click', saveAllAssignments);
    document.getElementById('clearReplacementsBtn').onclick = clearAllReplacements;
    document.getElementById('addSwapBtn').onclick = addClassroomSwap;
    document.getElementById('clearSwapsBtn').onclick = clearAllSwaps;
    document.getElementById('genReportBtn').onclick = generateUnifiedReport;
    document.getElementById('openReportNewTabBtn').addEventListener('click', function() {
        const day = window._currentDay;
        const date = getSelectedDate();
        if (!date) { alert('Пожалуйста, выберите дату.'); return; }
        window.open(`/api/report/${date}`, '_blank');
    });
    document.getElementById('copyReportLinkBtn').addEventListener('click', function() {
        const day = window._currentDay;
        const date = getSelectedDate();
        if (!date) { alert('Пожалуйста, выберите дату.'); return; }
        const url = `${window.location.origin}/api/report/${date}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('Ссылка на отчёт скопирована!');
        }).catch(() => {
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            alert('Ссылка на отчёт скопирована!');
        });
    });
    document.getElementById('copyReportForEmailBtn')?.addEventListener('click', copyReportForEmail);

    // Обработчик для чекбоксов отсутствующих
    document.getElementById('absentCheckboxes').addEventListener('change', async function(e) {
        if (e.target.type === 'checkbox') {
            const teacherId = parseInt(e.target.value);
            const day = window._currentDay;
            const date = getSelectedDate();
            if (!date) return;
            const action = e.target.checked ? 'add' : 'remove';
            await setAbsence(teacherId, day, date, action);
            await loadAbsenceCheckboxes();
        }
    });

    document.getElementById('curatorReportBtn')?.addEventListener('click', function() {
        const date = getSelectedDate();
        if (!date) {
            alert('Пожалуйста, выберите дату.');
            return;
        }
        window.open(`/api/report/report-curator/${date}`, '_blank');
    });
}); // ← Закрытие DOMContentLoaded