// -------------------- Фокус на учителе в большой таблице --------------------
window._pinnedScheduleTeacherId = window._pinnedScheduleTeacherId || null;

function ensureScheduleFocusUI() {
    if (document.getElementById('scheduleFocusBar')) return;
    const scheduleContent = document.getElementById('scheduleContent');
    if (!scheduleContent) return;

    const bar = document.createElement('div');
    bar.id = 'scheduleFocusBar';
    bar.className = 'schedule-focus-bar';
    bar.innerHTML = `
        <span id="scheduleFocusText" class="schedule-focus-text"></span>
        <button type="button" id="scheduleFocusClear" class="schedule-focus-clear"></button>
    `;
    scheduleContent.insertBefore(bar, scheduleContent.firstChild);

    document.getElementById('scheduleFocusClear').addEventListener('click', () => {
        window._pinnedScheduleTeacherId = null;
        applyScheduleTeacherFocus();
    });
    applyScheduleTeacherFocus();
}

function applyScheduleTeacherFocus() {
    const pinnedId = Number(window._pinnedScheduleTeacherId) || null;
    document.querySelectorAll('#gridBody tr[data-teacher-id]').forEach(row => {
        const rowId = Number(row.dataset.teacherId);
        row.classList.toggle('is-teacher-focused', !!pinnedId && rowId === pinnedId);
        row.classList.toggle('is-teacher-muted', !!pinnedId && rowId !== pinnedId);
    });

    const text = document.getElementById('scheduleFocusText');
    const clear = document.getElementById('scheduleFocusClear');
    if (!text || !clear) return;

    if (pinnedId) {
        text.innerHTML = `<strong>${escapeHtml(t('schedule.focusSelected', { teacher: getTeacherName(pinnedId) }))}</strong>`;
        clear.textContent = t('schedule.focusClear');
        clear.hidden = false;
    } else {
        text.textContent = t('schedule.focusHint');
        clear.hidden = true;
    }
}

window.focusScheduleTeacher = function(teacherId, force = false) {
    const id = Number(teacherId);
    if (!id) return;
    if (!force && Number(window._pinnedScheduleTeacherId) === id) {
        window._pinnedScheduleTeacherId = null;
    } else {
        window._pinnedScheduleTeacherId = id;
    }
    applyScheduleTeacherFocus();
};


// -------------------- Верхняя горизонтальная прокрутка расписания --------------------
function ensureScheduleTopScrollbar() {
    const scheduleContent = document.getElementById('scheduleContent');
    if (!scheduleContent) return;

    const tableWrapper = scheduleContent.querySelector('.table-wrapper');
    if (!tableWrapper) return;

    let topScroll = document.getElementById('scheduleTopScrollbar');
    let topScrollInner;

    if (!topScroll) {
        topScroll = document.createElement('div');
        topScroll.id = 'scheduleTopScrollbar';
        topScroll.className = 'schedule-top-scrollbar';
        topScroll.setAttribute('aria-hidden', 'true');

        topScrollInner = document.createElement('div');
        topScrollInner.className = 'schedule-top-scrollbar-inner';
        topScroll.appendChild(topScrollInner);

        scheduleContent.insertBefore(topScroll, tableWrapper);

        let syncingFromTop = false;
        let syncingFromBottom = false;

        topScroll.addEventListener('scroll', () => {
            if (syncingFromBottom) return;
            syncingFromTop = true;
            tableWrapper.scrollLeft = topScroll.scrollLeft;
            syncingFromTop = false;
        }, { passive: true });

        tableWrapper.addEventListener('scroll', () => {
            if (syncingFromTop) return;
            syncingFromBottom = true;
            topScroll.scrollLeft = tableWrapper.scrollLeft;
            syncingFromBottom = false;
        }, { passive: true });
    } else {
        topScrollInner = topScroll.querySelector('.schedule-top-scrollbar-inner');
    }

    if (!topScrollInner) return;

    const syncSize = () => {
        const scrollWidth = tableWrapper.scrollWidth;
        const clientWidth = tableWrapper.clientWidth;
        topScrollInner.style.width = `${scrollWidth}px`;
        topScroll.hidden = scrollWidth <= clientWidth + 1;
        if (!topScroll.hidden) topScroll.scrollLeft = tableWrapper.scrollLeft;
    };

    requestAnimationFrame(syncSize);
    setTimeout(syncSize, 0);

    if (!window._scheduleTopScrollbarResizeBound) {
        window._scheduleTopScrollbarResizeBound = true;
        window.addEventListener('resize', () => {
            const wrapper = document.querySelector('#scheduleContent .table-wrapper');
            const bar = document.getElementById('scheduleTopScrollbar');
            const inner = bar?.querySelector('.schedule-top-scrollbar-inner');
            if (!wrapper || !bar || !inner) return;
            inner.style.width = `${wrapper.scrollWidth}px`;
            bar.hidden = wrapper.scrollWidth <= wrapper.clientWidth + 1;
            if (!bar.hidden) bar.scrollLeft = wrapper.scrollLeft;
        }, { passive: true });
    }
}

// -------------------- Рендеринг сетки расписания --------------------
async function renderScheduleGrid() {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const allLessons = await loadLessons();
    // в common.js есть state, но там нет lessons, поэтому сохраним локально
    window._lessons = allLessons;

    let theadHtml = `<tr><th rowspan="2">${escapeHtml(t('schedule.teacherHeader'))}</th>`;
    for (let d of days) {
        theadHtml += `<th colspan="9">${escapeHtml(t(`days.short.${d}`))}</th>`;
    }
    theadHtml += `</tr><tr>`;
    for (let i = 0; i < days.length; i++) {
        for (let p = 1; p <= 9; p++) {
            theadHtml += `<th>${p}</th>`;
        }
    }
    theadHtml += `</tr>`;
    document.getElementById('gridHead').innerHTML = theadHtml;

    let tbodyHtml = '';
    for (let teacher of state.teachers) {
        tbodyHtml += `<tr class="schedule-teacher-row" data-teacher-id="${teacher.id}"><td class="schedule-teacher-name-cell" title="${escapeHtml(t('schedule.focusTeacherTitle'))}" onclick="focusScheduleTeacher(${teacher.id})"><span>${escapeHtml(teacher.name)}</span></td>`;
        for (let day of days) {
            for (let p = 1; p <= 9; p++) {
                const lessonsHere = allLessons.filter(l => l.teacher_id === teacher.id && l.day === day && l.period === p);
                const busy = lessonsHere.length > 0;
                const tooltip = lessonsHere.map(l => `${l.subject} | ${l.class} | ${t('common.room')}: ${l.room}`).join('\n') || (busy ? t('schedule.busy') : t('schedule.free'));
                const cellClass = busy ? 'busy lesson-cell' : 'free';
                let display = busy ? `<span class="lesson-cell-status">🔴 ${lessonsHere.length}</span>` : '🟢';
                if (busy && p < 9) {
                    display += `<button type="button" class="copy-next-period-btn" title="${escapeHtml(t('schedule.copyNext'))}" aria-label="${escapeHtml(t('schedule.copyNext'))}" onclick="event.stopPropagation(); copyLessonToNextPeriod(${teacher.id},'${day}',${p})">→</button>`;
                }
                tbodyHtml += `<td class="${cellClass}" title="${escapeHtml(tooltip)}" onclick="${busy ? `deleteLessonAt(${teacher.id},'${day}',${p})` : ''}">${display}</td>`;
            }
        }
        tbodyHtml += `</tr>`;
    }
    document.getElementById('gridBody').innerHTML = tbodyHtml;
    applyScheduleTeacherFocus();
    ensureScheduleTopScrollbar();
}

window.deleteLessonAt = async function(teacherId, day, period) {
    if (confirm(t('schedule.deleteLessonsConfirm', { teacher: getTeacherName(teacherId), day: t(`days.${day}`), period }))) {
        await deleteLesson(teacherId, day, period);
        await renderScheduleGrid();
    }
};


function lessonCopySignature(lesson) {
    return [
        Number(lesson.class_id),
        Number(lesson.subject_id),
        lesson.room_id == null ? '' : Number(lesson.room_id)
    ].join('|');
}

window.copyLessonToNextPeriod = async function(teacherId, day, period) {
    focusScheduleTeacher(teacherId, true);
    const nextPeriod = Number(period) + 1;
    if (nextPeriod > 9) {
        alert(t('schedule.copyLastPeriod'));
        return;
    }

    const allLessons = Array.isArray(window._lessons) ? window._lessons : [];
    const sourceLessons = allLessons.filter(l =>
        Number(l.teacher_id) === Number(teacherId) &&
        l.day === day &&
        Number(l.period) === Number(period)
    );

    if (!sourceLessons.length) {
        alert(t('schedule.copySourceMissing'));
        return;
    }

    const targetLessons = allLessons.filter(l =>
        Number(l.teacher_id) === Number(teacherId) &&
        l.day === day &&
        Number(l.period) === nextPeriod
    );

    const sourceByClass = new Map(sourceLessons.map(l => [Number(l.class_id), l]));

    // Если на следующем уроке у учителя уже стоит другое занятие,
    // не смешиваем его с копируемым уроком.
    const hasConflict = targetLessons.some(existing => {
        const source = sourceByClass.get(Number(existing.class_id));
        return !source || lessonCopySignature(source) !== lessonCopySignature(existing);
    });

    if (hasConflict) {
        alert(t('schedule.copyTargetOccupied', { period: nextPeriod }));
        return;
    }

    const existingSignatures = new Set(targetLessons.map(lessonCopySignature));
    const lessonsToCopy = sourceLessons
        .filter(l => !existingSignatures.has(lessonCopySignature(l)))
        .map(l => ({
            teacher_id: Number(l.teacher_id),
            day: l.day,
            period: nextPeriod,
            subject_id: Number(l.subject_id),
            class_id: Number(l.class_id),
            room_id: l.room_id == null ? null : Number(l.room_id)
        }));

    if (!lessonsToCopy.length) {
        alert(t('schedule.copyAlreadyExists', { period: nextPeriod }));
        return;
    }

    const confirmed = confirm(t('schedule.copyConfirm', {
        teacher: getTeacherName(teacherId),
        day: t(`days.${day}`),
        period,
        nextPeriod
    }));
    if (!confirmed) return;

    try {
        const res = await fetch('/api/lessons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lessonsToCopy)
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || result.success === false) {
            throw new Error(result.error || `${res.status} ${res.statusText}`);
        }

        alert(t('schedule.copySuccess', { period: nextPeriod }));
        await renderScheduleGrid();
    } catch (err) {
        alert(t('schedule.copyError', { message: err.message }));
    }
};

function ensureCopyButtonStyles() {
    if (document.getElementById('scheduleCopyButtonStyles')) return;
    const style = document.createElement('style');
    style.id = 'scheduleCopyButtonStyles';
    style.textContent = `
        .lesson-cell { position: relative; padding-right: 25px !important; }
        .lesson-cell-status { white-space: nowrap; }
        .copy-next-period-btn {
            position: absolute;
            right: 3px;
            top: 50%;
            transform: translateY(-50%);
            width: 20px;
            height: 20px;
            min-width: 20px;
            padding: 0;
            margin: 0;
            border: 1px solid rgba(0,0,0,.18);
            border-radius: 4px;
            background: rgba(255,255,255,.88);
            color: #1f2937;
            font: 700 13px/18px Arial, sans-serif;
            cursor: pointer;
            box-shadow: none;
        }
        .copy-next-period-btn:hover {
            background: #fff;
            border-color: rgba(0,0,0,.35);
        }
        .schedule-focus-bar {
            position: sticky;
            left: 0;
            z-index: 12;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            min-height: 38px;
            margin: 0 0 10px;
            padding: 8px 10px;
            border: 1px solid #d8dee9;
            border-left: 3px solid #b59443;
            background: #fff;
            color: #475569;
            font-size: 13px;
        }
        .schedule-focus-clear {
            flex: 0 0 auto;
            min-height: 28px;
            padding: 4px 9px;
            margin: 0;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            background: #fff;
            color: #334155;
            box-shadow: none;
            cursor: pointer;
        }
        .schedule-teacher-name-cell {
            position: sticky;
            left: 0;
            z-index: 6;
            min-width: 150px;
            max-width: 190px;
            font-weight: 700;
            background: #f8fafc;
            cursor: pointer;
            box-shadow: 1px 0 0 #d8dee9;
        }
        #gridHead th:first-child {
            position: sticky;
            left: 0;
            z-index: 9;
            background: #f3f4f6;
            box-shadow: 1px 0 0 #d8dee9;
        }
        #gridBody .schedule-teacher-row td {
            transition: opacity .12s ease, background-color .12s ease;
        }
        #gridBody .schedule-teacher-row.is-teacher-muted td {
            opacity: .34;
        }
        #gridBody .schedule-teacher-row.is-teacher-muted .schedule-teacher-name-cell {
            opacity: .58;
        }
        #gridBody .schedule-teacher-row.is-teacher-focused td {
            box-shadow: inset 0 2px 0 #b59443, inset 0 -2px 0 #b59443;
        }
        #gridBody .schedule-teacher-row.is-teacher-focused .schedule-teacher-name-cell {
            background: #fff7df;
            color: #172033;
            box-shadow: inset 3px 0 0 #b59443, inset 0 2px 0 #b59443, inset 0 -2px 0 #b59443, 1px 0 0 #d8dee9;
        }
        #gridBody .schedule-teacher-row.is-teacher-focused td:not(.schedule-teacher-name-cell) {
            background-color: rgba(181, 148, 67, .08);
        }
        .schedule-top-scrollbar {
            width: 100%;
            height: 15px;
            margin: 0 0 8px;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-gutter: stable;
        }
        .schedule-top-scrollbar-inner {
            height: 1px;
            min-width: 1px;
        }
    `;
    document.head.appendChild(style);
}

// -------------------- Добавление уроков --------------------
async function addLesson() {
    const teacherSelect = document.getElementById('teacherSelect');
    const teacherId = parseInt(teacherSelect.value);
    if (isNaN(teacherId)) { alert(t('schedule.selectTeacher')); return; }
    focusScheduleTeacher(teacherId, true);
    const day = document.getElementById('daySelectAdd').value;
    const periods = Array.from(document.querySelectorAll('#lessonCheckboxes input:checked')).map(cb => parseInt(cb.value));
    if (!periods.length) { alert(t('schedule.selectPeriods')); return; }
    const subjectName = document.getElementById('subjectSelect').value;
    const roomName = document.getElementById('roomSelect').value;
    const classNames = Array.from(document.querySelectorAll('#classCheckboxes input:checked')).map(cb => cb.value);
    if (!classNames.length) { alert(t('schedule.selectClasses')); return; }

    const subjectId = getSubjectIdByName(subjectName);
    const roomId = getRoomIdByName(roomName);
    if (!subjectId || !roomId) { alert(t('schedule.subjectOrRoomMissing')); return; }

    const lessonsToAdd = [];
    for (let p of periods) {
        for (let cls of classNames) {
            const classId = getClassIdByName(cls);
            if (!classId) { alert(t('schedule.classMissing', { className: cls })); return; }
            lessonsToAdd.push({
                teacher_id: teacherId,
                day,
                period: p,
                subject_id: subjectId,
                class_id: classId,
                room_id: roomId
            });
        }
    }
    try {
        await addLessons(lessonsToAdd);
        alert(`✅ ${t('schedule.lessonsAdded', { count: lessonsToAdd.length })}`);
        document.querySelectorAll('#lessonCheckboxes input:checked, #classCheckboxes input:checked').forEach(cb => cb.checked = false);
        await renderScheduleGrid();
    } catch (e) {
        alert(t('schedule.addError', { message: e.message }));
    }
}

// -------------------- Экспорт, импорт, сброс --------------------
async function exportData() {
    try {
        const res = await fetch('/api/export');
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'covers_backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        alert(t('schedule.exportError', { message: err.message }));
    }
}

async function exportScheduleExcel() {
    try {
        const lang = typeof getLanguage === 'function' ? getLanguage() : 'ru';
        const res = await fetch(`/api/export-schedule-xlsx?lang=${encodeURIComponent(lang)}`);
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `${res.status} ${res.statusText}`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const disposition = res.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^";]+)"?/i);
        a.href = url;
        a.download = match?.[1] || 'schedule_verification.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        alert(t('schedule.exportError', { message: err.message }));
    }
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                const res = await fetch('/api/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await res.json();
                if (result.success) {
                    alert(t('schedule.importSuccess'));
                    location.reload();
                } else {
                    alert(t('schedule.importError', { message: result.error || t('common.error') }));
                }
            } catch (err) {
                alert(t('schedule.fileReadError', { message: err.message }));
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

async function resetAll() {
    if (!confirm(t('schedule.resetConfirm'))) return;
    try {
        const res = await fetch('/api/reset', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            alert(t('schedule.resetSuccess'));
            location.reload();
        } else {
            alert(t('schedule.resetError', { message: result.error || t('common.error') }));
        }
    } catch (err) {
        alert(t('stats.loadError', { message: err.message }));
    }
}

// -------------------- Заполнение селектов --------------------
async function populateScheduleSelects() {
    state.teachers = await loadTeachers();
    state.classes = await loadClasses();
    state.rooms = await loadRooms();
    state.subjects = await loadSubjects();

    const teacherSelect = document.getElementById('teacherSelect');
    if (teacherSelect) {
        teacherSelect.innerHTML = state.teachers.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    }

    const subjectSelect = document.getElementById('subjectSelect');
    if (subjectSelect) {
        subjectSelect.innerHTML = state.subjects.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
    }

    const roomSelect = document.getElementById('roomSelect');
    if (roomSelect) {
        roomSelect.innerHTML = state.rooms.map(r => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('');
    }

    const classDiv = document.getElementById('classCheckboxes');
    if (classDiv) {
        classDiv.innerHTML = state.classes.map(c => {
            return `<label><input type="checkbox" value="${c.name}"> ${c.name}</label>`;
        }).join('');
    }

    const lessonDiv = document.getElementById('lessonCheckboxes');
    if (lessonDiv) {
        lessonDiv.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = i;
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${i}`));
            lessonDiv.appendChild(label);
        }
    }
}

// -------------------- Инициализация --------------------
document.addEventListener('DOMContentLoaded', async function() {
    ensureCopyButtonStyles();
    ensureScheduleFocusUI();
    ensureScheduleTopScrollbar();
    // Toggle формы добавления уроков — подключаем до загрузки данных,
    // чтобы блок открывался даже если API временно недоступно.
    const toggleAddLessonBtn = document.getElementById('toggleAddLessonBtn');
    const addLessonForm = document.getElementById('addLessonForm');
    addLessonForm.style.display = 'none';
    toggleAddLessonBtn.addEventListener('click', function() {
        const isVisible = addLessonForm.style.display !== 'none';
        addLessonForm.style.display = isVisible ? 'none' : 'block';
        this.textContent = isVisible ? t('schedule.addTitle') : t('schedule.hideForm');
    });

    // Toggle расписания
    const toggleScheduleBtn = document.getElementById('toggleScheduleBtn');
    const scheduleContent = document.getElementById('scheduleContent');
    scheduleContent.style.display = 'none';
    toggleScheduleBtn.addEventListener('click', function() {
        const isVisible = scheduleContent.style.display !== 'none';
        scheduleContent.style.display = isVisible ? 'none' : 'block';
        this.textContent = isVisible ? t('schedule.toggleSchedule') : t('schedule.hideSchedule');
        if (isVisible) requestAnimationFrame(ensureScheduleTopScrollbar);
    });

    // Обработчики действий
    document.getElementById('addLessonBtn').onclick = addLesson;
    document.getElementById('exportScheduleExcelBtn')?.addEventListener('click', exportScheduleExcel);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', importData);
    document.getElementById('resetBtn').addEventListener('click', resetAll);

    const teacherSelect = document.getElementById('teacherSelect');
    if (teacherSelect) {
        teacherSelect.addEventListener('change', () => {
            const teacherId = Number(teacherSelect.value);
            if (teacherId) focusScheduleTeacher(teacherId, true);
        });
    }

    // Загружаем данные после подключения интерфейса.
    try {
        await populateScheduleSelects();
        await renderScheduleGrid();
    } catch (err) {
        console.error('Schedule initialization error:', err);
    }
});