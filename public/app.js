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
    const englishDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    window._currentDay = englishDays[dateObj.getDay()];
    if (dayDisplay) dayDisplay.textContent = t(`days.${window._currentDay}`);
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
        alert(t('common.selectDate'));
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
        alert(t('index.noAbsentTeachers'));
        return;
    }

    const lessonsForDay = await loadLessons({ day });
    window._lessonsForDay = lessonsForDay;

    let html = `<div class="assignments-wrapper"><table class="assignment-table"><thead><tr><th>${escapeHtml(t('common.period'))}</th>`;
    for (let a of absentIds) {
        html += `<th>${escapeHtml(getTeacherName(a))}</th>`;
    }
    html += `</tr></thead><tbody>`;

    for (let p = 1; p <= 9; p++) {
        html += `<tr><td style="font-weight:bold; text-align:center;">${p}</td>`;
        for (let a of absentIds) {
            const absentLessons = lessonsForDay.filter(l => l.teacher_id === a && l.period === p);
            let lessonInfo = absentLessons.length ? absentLessons.map(l => `${l.subject} | ${l.class} | ${t('common.room')}: ${l.room}`).join('<br>') : `⚠️ ${t('index.noLesson')}`;
            html += `<td><div style="margin-bottom:8px; background:#f1f5f9; padding:6px; border-radius:18px;">${lessonInfo}</div>`;

            if (absentLessons.length === 0) {
                html += `<span style="color:#64748b;">${escapeHtml(t('index.noLesson'))}</span>`;
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
                    const teacherOptions = `<option value="">${escapeHtml(t('index.notAssigned'))}</option>` + 
                        candidates.map(t => {
                            const hasSameClass = lessonsForDay.some(l => l.teacher_id === t.id && l.period === p && absentClasses.includes(l.class_id));
                            const label = hasSameClass ? `${escapeHtml(t.name)} (${escapeHtml(window.t('index.sameClass'))})` : escapeHtml(t.name);
                            return `<option value="${t.id}" ${r.teacherId == t.id ? 'selected' : ''}>${label}</option>`;
                        }).join('');
                    html += `<div class="replacement-item" data-day="${day}" data-absent="${a}" data-period="${p}" data-idx="${idx}">
                                <select class="candidate-select">${teacherOptions}</select>
                                <button class="icon-button remove" data-action="remove"><i class="fas fa-trash-alt"></i></button>
                                <input type="text" class="comment-input" placeholder="${escapeHtml(t('common.comment'))}" value="${escapeHtml(r.comment || '')}">
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
    alert(t('index.replacementsSaved'));
    await renderAssignmentsTable(true);
}

async function clearAllReplacements() {
    if (confirm(t('index.resetTeacherConfirm'))) {
        window._replacements = {};
        await saveReplacements(window._currentDay, window._currentDate, {});
        await renderAssignmentsTable(true);
        document.getElementById('reportContainer').style.display = 'none';
        alert(t('index.resetDone'));
    }
}

// -------------------- Замены кабинетов --------------------
async function renderSwapsTable() {
    const day = window._currentDay;
    const date = getSelectedDate();
    if (!date) {
        document.getElementById('swapsTbody').innerHTML = `<tr><td colspan="8">${escapeHtml(t('index.chooseDate'))}</td></tr>`;
        return;
    }
    const swaps = await loadSwaps(day, date);
    window._classroomSwaps = swaps;

    const tbody = document.getElementById('swapsTbody');
    tbody.innerHTML = '';
    if (swaps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">${escapeHtml(t('index.noClassroomSwaps'))}</td></tr>`;
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
            ? formatReportClassesForDisplay(swap.class_ids.map(id => getClassName(id)))
            : t('common.all');
        row.insertCell(2).innerText = classNames;

        // 4. Исходный кабинет
        row.insertCell(3).innerText = swap.original_room_name || getRoomName(swap.original_room_id);

        // 5. Новый кабинет
        row.insertCell(4).innerText = swap.new_room_name || getRoomName(swap.new_room_id);

        // 6. Учитель
        const teacherName = swap.teacher_id ? getTeacherName(swap.teacher_id) : t('common.all');
        row.insertCell(5).innerText = teacherName;

        // 7. Комментарий
        row.insertCell(6).innerText = swap.comment || '—';

        // 8. Кнопка удаления
        const delCell = row.insertCell(7);
        const delBtn = document.createElement('button');
        delBtn.className = 'icon-button';
        delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        delBtn.title = t('index.deleteSwap');
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
    if (!date) { alert(t('index.chooseDateForClassroom')); return; }
    const lessonFrom = parseInt(document.getElementById('swapLessonFrom').value);
    const lessonTo = parseInt(document.getElementById('swapLessonTo').value);
    if (lessonFrom > lessonTo) { alert(t('index.invalidPeriodRange')); return; }
    const originalRoomName = document.getElementById('swapOrigRoom').value;
    const newRoomName = document.getElementById('swapNewRoom').value;
    const teacherId = document.getElementById('swapTeacherId').value;
    const teacherIdVal = teacherId ? parseInt(teacherId) : null;
    const selectedClasses = Array.from(document.querySelectorAll('#swapClassCheckboxes input:checked')).map(cb => cb.value);
    const comment = document.getElementById('swapComment').value.trim() || '';

    if (originalRoomName === newRoomName) { alert(t('index.sameRoom')); return; }

    const originalRoomId = getRoomIdByName(originalRoomName);
    const newRoomId = getRoomIdByName(newRoomName);
    if (!originalRoomId || !newRoomId) { alert(t('index.roomNotFound')); return; }

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
    if (confirm(t('index.resetClassroomConfirm'))) {
        const swaps = window._classroomSwaps || [];
        for (let swap of swaps) {
            await deleteSwap(swap.id);
        }
        await renderSwapsTable();
        alert(t('index.classroomDeleted'));
    }
}



function formatReportClassesForDisplay(classNames) {
    const names = (classNames || []).filter(Boolean);
    if (!names.length) return '';

    const selected = new Set(names);
    const allClassNames = (state.classes || []).map(c => c.name).filter(Boolean);
    const cohorts = [
        { pattern: /^12\s+/i, label: '10Y12' },
        { pattern: /^13\s+/i, label: '11Y13' }
    ];

    for (const cohort of cohorts) {
        const allMembers = allClassNames.filter(name => cohort.pattern.test(name));
        if (!allMembers.length) continue;
        if (!allMembers.every(name => selected.has(name))) continue;

        allMembers.forEach(name => selected.delete(name));
        selected.add(cohort.label);
    }

    return [...selected].sort((a, b) => a.localeCompare(b, 'ru')).join(', ');
}

// Компактное отображение классов в отчёте.
// Полный старший класс -> 10Y12 / 11Y13.
// Один ученик -> обычное имя класса (например, 12 Iva).
// Несколько, но не все -> заголовок 10Y12 / 11Y13 отдельной строкой, имена ниже без префикса 12/13.
function formatReportClassCell(classNames) {
    const names = [...new Set((classNames || []).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'ru'));
    if (!names.length) return { text: '', html: '' };

    const allClassNames = (state.classes || []).map(c => c.name).filter(Boolean);
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

function buildUnifiedTeacherRows(rawItems) {
    const lessonGroups = new Map();

    for (const item of rawItems) {
        const assignedTeacherIds = [...new Set(item.assignedTeacherIds || [])]
            .sort((a, b) => String(a).localeCompare(String(b)));
        const comments = [...new Set((item.commentsArray || [])
            .map(c => String(c || '').trim())
            .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));

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
        if (item.classId !== null && item.classId !== undefined) group.classIds.add(item.classId);
        if (item.className) group.classNames.add(item.className);
    }

    const periodRows = [...lessonGroups.values()].map(group => {
        const classNames = [...group.classNames].sort((a, b) => a.localeCompare(b, 'ru'));
        const classIds = [...group.classIds].sort((a, b) => Number(a) - Number(b));
        const mergeKey = JSON.stringify([
            group.absentId,
            group.subject || '',
            group.roomInfo || '',
            group.assignedTeacherIds,
            group.comments,
            classIds,
            classNames
        ]);

        const assignedNames = group.assignedTeacherIds.map(id => getTeacherName(id)).filter(Boolean);
        const classDisplay = formatReportClassCell(classNames);
        return {
            period: group.period,
            mergeKey,
            className: classDisplay.text,
            classHtml: classDisplay.html,
            subject: group.subject,
            roomInfo: group.roomInfo,
            absentName: group.absentName,
            assignedName: assignedNames.length ? assignedNames.join(', ') : '—',
            comment: group.comments.join('; ') || '—'
        };
    }).sort((a, b) => a.period - b.period);

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
        subject: row.subject,
        roomInfo: row.roomInfo,
        absentName: row.absentName,
        assignedName: row.assignedName,
        comment: row.comment
    }));
}

// -------------------- ОТЧЁТ --------------------
async function generateUnifiedReport() {
    console.log('generateUnifiedReport вызван');
    const day = window._currentDay;
    const date = getSelectedDate();
    if (!date) {
        alert(t('index.chooseDateForReport'));
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
            classId: lesson.class_id,
            className: lesson.class,
            subject: lesson.subject,
            roomInfo: lesson.room,
            assignedTeacherIds,
            commentsArray
        });
    }

    const teacherRows = buildUnifiedTeacherRows(rawItems);

    const swaps = await loadSwaps(day, date);
    const swapRows = [];
    for (const swap of swaps) {
        const originalRoomName = swap.original_room_name || getRoomName(swap.original_room_id);
        const newRoomName = swap.new_room_name || getRoomName(swap.new_room_id);
        const teacherName = swap.teacher_id ? getTeacherName(swap.teacher_id) : t('common.all');
        const swapClassList = swap.class_ids && swap.class_ids.length
            ? swap.class_ids.map(id => getClassName(id))
            : [];
        const swapClassDisplay = swapClassList.length
            ? formatReportClassCell(swapClassList)
            : { text: t('common.all'), html: escapeHtml(t('common.all')) };
        const classNames = swapClassDisplay.text;
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
            classesHtml: swapClassDisplay.html,
            comment: swap.comment || '—'
        });
    }

    let html = `<h3>${escapeHtml(t('index.reportTitle', { date }))}</h3>`;

    html += `<h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">1. ${escapeHtml(t('index.teacherReplacementsTitle'))}</h4>`;
    if (teacherRows.length === 0) {
        html += `<p>${escapeHtml(t('index.noTeacherReplacements'))}</p>`;
    } else {
        html += `<div class="report-table-wrapper"><table class="report-table">`;
        html += `<thead><tr>
            <th>${escapeHtml(t('common.periods'))}</th><th>${escapeHtml(t('common.time'))}</th><th>${escapeHtml(t('common.classes'))}</th><th>${escapeHtml(t('common.subject'))}</th>
            <th>${escapeHtml(t('common.room'))}</th><th>${escapeHtml(t('index.absentTeacher'))}</th><th>${escapeHtml(t('index.replacementTeacher'))}</th><th>${escapeHtml(t('common.comment'))}</th>
        </tr></thead><tbody>`;
        for (const row of teacherRows) {
            html += `<tr>
                <td data-label="${escapeHtml(t('common.periods'))}"><strong>${escapeHtml(row.lessonDisplay)}</strong></td>
                <td data-label="${escapeHtml(t('common.time'))}">${escapeHtml(row.timeRange)}</td>
                <td data-label="${escapeHtml(t('common.classes'))}" style="min-width:180px; max-width:310px;">${row.classHtml || escapeHtml(row.className)}</td>
                <td data-label="${escapeHtml(t('common.subject'))}">${escapeHtml(row.subject)}</td>
                <td data-label="${escapeHtml(t('common.room'))}">${escapeHtml(row.roomInfo)}</td>
                <td data-label="${escapeHtml(t('index.absentTeacher'))}">${escapeHtml(row.absentName)}</td>
                <td data-label="${escapeHtml(t('index.replacementTeacher'))}" class="replacement-teacher">${escapeHtml(row.assignedName)}</td>
                <td data-label="${escapeHtml(t('common.comment'))}">${escapeHtml(row.comment)}</td>
            </tr>`;
        }
        html += `</tbody></table></div>`;
    }

    html += `<h4 style="margin-top: 2rem; margin-bottom: 0.5rem;">2. ${escapeHtml(t('index.classroomReplacementsTitle'))}</h4>`;
    if (swapRows.length === 0) {
        html += `<p>${escapeHtml(t('index.noRoomReplacements'))}</p>`;
    } else {
        html += `<div class="report-table-wrapper"><table class="report-table">`;
        html += `<thead><tr>
            <th>${escapeHtml(t('common.periods'))}</th><th>${escapeHtml(t('common.time'))}</th><th>${escapeHtml(t('index.originalRoom'))}</th><th>${escapeHtml(t('index.newRoom'))}</th>
            <th>${escapeHtml(t('common.teacher'))}</th><th>${escapeHtml(t('common.classes'))}</th><th>${escapeHtml(t('common.comment'))}</th>
        </tr></thead><tbody>`;
        for (const row of swapRows) {
            html += `<tr>
                <td data-label="${escapeHtml(t('common.periods'))}"><strong>${escapeHtml(row.lessonRange)}</strong></td>
                <td data-label="${escapeHtml(t('common.time'))}">${escapeHtml(row.timeRange)}</td>
                <td data-label="${escapeHtml(t('index.originalRoom'))}">${escapeHtml(row.originalRoom)}</td>
                <td data-label="${escapeHtml(t('index.newRoom'))}">${escapeHtml(row.newRoom)}</td>
                <td data-label="${escapeHtml(t('common.teacher'))}">${escapeHtml(row.teacher)}</td>
                <td data-label="${escapeHtml(t('common.classes'))}" style="min-width:180px; max-width:310px;">${row.classesHtml || escapeHtml(row.classes)}</td>
                <td data-label="${escapeHtml(t('common.comment'))}">${escapeHtml(row.comment)}</td>
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
        alert(t('index.copyReportFirst'));
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
        alert(t('index.htmlCopied'));
    }).catch(err => {
        alert(t('index.copyError', { message: err.message }));
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
        teacherSwapSel.innerHTML = `<option value="">${escapeHtml(t('common.allTeachers'))}</option>` + state.teachers.map(teacher => `<option value="${teacher.id}">${escapeHtml(teacher.name)}</option>`).join('');
    }
    const swapClassDiv = document.getElementById('swapClassCheckboxes');
    if (swapClassDiv) {
        renderSwapClassPicker(swapClassDiv, state.classes);
    }
}


function getSwapClassFamily(className) {
    const name = String(className || '').trim();

    // Индивидуальные траектории старших классов показываем как одну параллель.
    if (/^12\s+/i.test(name)) {
        return { key: '10Y12', label: '10Y12', order: 10, collapsed: true, individual: true };
    }
    if (/^13\s+/i.test(name)) {
        return { key: '11Y13', label: '11Y13', order: 11, collapsed: true, individual: true };
    }

    // Обычные D/M классы группируем по параллели: 5Y7D + 5Y7M -> 5Y7.
    const regular = name.match(/^(\d+)Y(\d+)([A-Za-zА-Яа-я]*)$/);
    if (regular) {
        const schoolYear = parseInt(regular[1], 10);
        const family = `${regular[1]}Y${regular[2]}`;
        return { key: family, label: family, order: schoolYear, collapsed: false, individual: false };
    }

    return { key: `other:${name}`, label: t('index.other'), order: 99, collapsed: false, individual: false };
}

function renderSwapClassPicker(container, classes) {
    const groups = new Map();

    for (const cls of classes || []) {
        const family = getSwapClassFamily(cls.name);
        if (!groups.has(family.key)) {
            groups.set(family.key, { ...family, items: [] });
        } else if (family.individual) {
            // Если сначала встретился старый общий класс 10Y12/11Y13,
            // а затем индивидуальные ученики, переводим всю группу
            // в режим индивидуальной параллели.
            const existing = groups.get(family.key);
            existing.individual = true;
            existing.collapsed = true;
        }
        groups.get(family.key).items.push(cls);
    }

    // Убираем старые общие технические классы из выбора, если уже есть
    // более точные варианты этой параллели.
    // Например: 9Y11 + 9Y11D + 9Y11M -> показываем только 9Y11D и 9Y11M.
    // Для старших: 10Y12/11Y13 не показываем как отдельного ребёнка,
    // если существуют индивидуальные классы вида "12 Iva" / "13 Alex".
    for (const group of groups.values()) {
        if (group.individual) {
            group.items = group.items.filter(cls => String(cls.name || '').trim() !== group.key);
            continue;
        }

        const hasDetailedVariants = group.items.some(cls => {
            const name = String(cls.name || '').trim();
            return name !== group.key && name.startsWith(group.key);
        });

        if (hasDetailedVariants) {
            group.items = group.items.filter(cls => String(cls.name || '').trim() !== group.key);
        }
    }

    const orderedGroups = [...groups.values()].sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.label.localeCompare(b.label, 'ru');
    });

    container.innerHTML = orderedGroups.map((group, groupIndex) => {
        const items = group.items
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
            .map(c => {
                // Внутри индивидуальных групп номер параллели уже указан в заголовке,
                // поэтому показываем только имя ученика: "12 Iva" -> "Iva".
                const displayName = group.individual
                    ? String(c.name || '').replace(/^\d+\s+/, '').trim()
                    : c.name;

                return `
                    <label class="swap-class-option" title="${escapeHtml(c.name)}">
                        <input class="swap-class-item" type="checkbox" value="${escapeHtml(c.name)}">
                        <span>${escapeHtml(displayName)}</span>
                    </label>
                `;
            }).join('');

        const collapsedClass = group.collapsed ? ' is-collapsed' : '';
        const individualClass = group.individual ? ' is-individual' : '';

        return `
            <div class="swap-class-group${collapsedClass}${individualClass}" data-swap-group="${escapeHtml(group.key)}">
                <div class="swap-class-group-head">
                    <button type="button" class="swap-class-group-toggle" aria-expanded="${group.collapsed ? 'false' : 'true'}">
                        <span class="swap-class-group-name">${escapeHtml(group.label)}</span>
                        <span class="swap-class-group-count">${group.individual ? t('index.students', { count: group.items.length }) : group.items.length}</span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <button type="button" class="swap-class-select-all">${escapeHtml(group.individual ? t('index.selectAll') : t('common.all'))}</button>
                </div>
                <div class="swap-class-group-items">${items}</div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.swap-class-group-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const group = button.closest('.swap-class-group');
            group.classList.toggle('is-collapsed');
            button.setAttribute('aria-expanded', group.classList.contains('is-collapsed') ? 'false' : 'true');
        });
    });

    container.querySelectorAll('.swap-class-select-all').forEach(button => {
        button.addEventListener('click', () => {
            const group = button.closest('.swap-class-group');
            const checkboxes = [...group.querySelectorAll('input.swap-class-item')];
            const allChecked = checkboxes.length > 0 && checkboxes.every(cb => cb.checked);
            checkboxes.forEach(cb => { cb.checked = !allChecked; });
            syncSwapClassGroupState(group);
        });
    });

    container.addEventListener('change', (event) => {
        if (!event.target.matches('input.swap-class-item')) return;
        syncSwapClassGroupState(event.target.closest('.swap-class-group'));
    });

    container.querySelectorAll('.swap-class-group').forEach(syncSwapClassGroupState);
}

function syncSwapClassGroupState(group) {
    if (!group) return;
    const checkboxes = [...group.querySelectorAll('input.swap-class-item')];
    const selected = checkboxes.filter(cb => cb.checked).length;
    const button = group.querySelector('.swap-class-select-all');
    const count = group.querySelector('.swap-class-group-count');

    group.classList.toggle('has-selection', selected > 0);
    group.classList.toggle('is-complete', checkboxes.length > 0 && selected === checkboxes.length);

    if (button) {
        const isIndividual = group.classList.contains('is-individual');
        button.textContent = checkboxes.length > 0 && selected === checkboxes.length
            ? t('index.clearAll')
            : (isIndividual ? t('index.selectAll') : t('common.all'));
    }
    if (count) {
        const isIndividual = group.classList.contains('is-individual');
        count.textContent = selected > 0
            ? `${selected} / ${checkboxes.length}`
            : (isIndividual ? t('index.students', { count: checkboxes.length }) : `${checkboxes.length}`);
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
    document.getElementById('genReportBtn')?.addEventListener('click', generateUnifiedReport);
    document.getElementById('openReportNewTabBtn').addEventListener('click', function() {
        const day = window._currentDay;
        const date = getSelectedDate();
        if (!date) { alert(t('common.selectDate')); return; }
        window.open(`/api/report/${date}?lang=${encodeURIComponent(getLanguage())}`, '_blank');
    });
    document.getElementById('copyReportLinkBtn').addEventListener('click', function() {
        const day = window._currentDay;
        const date = getSelectedDate();
        if (!date) { alert(t('common.selectDate')); return; }
        const url = `${window.location.origin}/api/report/${date}?lang=${encodeURIComponent(getLanguage())}`;
        navigator.clipboard.writeText(url).then(() => {
            alert(t('index.linkCopied'));
        }).catch(() => {
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            alert(t('index.linkCopied'));
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

    // Быстрый поиск учителя в списке отсутствующих
    const absentTeacherSearch = document.getElementById('absentTeacherSearch');
    absentTeacherSearch?.addEventListener('input', function() {
        const search = this.value.trim().toLowerCase();
        const labels = document.querySelectorAll('#absentCheckboxes label');

        labels.forEach(label => {
            const teacherName = label.textContent.toLowerCase();
            label.style.display = teacherName.includes(search) ? '' : 'none';
        });
    });

    document.getElementById('curatorReportBtn')?.addEventListener('click', function() {
        const date = getSelectedDate();
        if (!date) {
            alert(t('common.selectDate'));
            return;
        }
        window.open(`/api/report/report-curator/${date}?lang=${encodeURIComponent(getLanguage())}`, '_blank');
    });
}); // ← Закрытие DOMContentLoaded