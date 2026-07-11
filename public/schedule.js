// -------------------- Рендеринг сетки расписания --------------------
async function renderScheduleGrid() {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const dayRu = { Monday: "ПН", Tuesday: "ВТ", Wednesday: "СР", Thursday: "ЧТ", Friday: "ПТ" };
    const allLessons = await loadLessons();
    // в common.js есть state, но там нет lessons, поэтому сохраним локально
    window._lessons = allLessons;

    let theadHtml = `<tr><th rowspan="2">Учитель / Teacher</th>`;
    for (let d of days) {
        theadHtml += `<th colspan="9">${dayRu[d]}</th>`;
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
    for (let t of state.teachers) {
        tbodyHtml += `<tr><td style="font-weight:bold; background:#f8fafc;">${escapeHtml(t.name)}</td>`;
        for (let day of days) {
            for (let p = 1; p <= 9; p++) {
                const lessonsHere = allLessons.filter(l => l.teacher_id === t.id && l.day === day && l.period === p);
                const busy = lessonsHere.length > 0;
                const tooltip = lessonsHere.map(l => `${l.subject} | ${l.class} | room ${l.room}`).join('\n') || (busy ? 'busy' : 'free');
                const cellClass = busy ? 'busy lesson-cell' : 'free';
                const display = busy ? `🔴 ${lessonsHere.length}` : '🟢';
                tbodyHtml += `<td class="${cellClass}" title="${escapeHtml(tooltip)}" onclick="${busy ? `deleteLessonAt(${t.id},'${day}',${p})` : ''}">${display}</td>`;
            }
        }
        tbodyHtml += `</tr>`;
    }
    document.getElementById('gridBody').innerHTML = tbodyHtml;
}

window.deleteLessonAt = async function(teacherId, day, period) {
    if (confirm(`Удалить уроки ${getTeacherName(teacherId)} в ${day} урок ${period}?`)) {
        await deleteLesson(teacherId, day, period);
        await renderScheduleGrid();
    }
};

// -------------------- Добавление уроков --------------------
async function addLesson() {
    const teacherSelect = document.getElementById('teacherSelect');
    const teacherId = parseInt(teacherSelect.value);
    if (isNaN(teacherId)) { alert("Выберите учителя"); return; }
    const day = document.getElementById('daySelectAdd').value;
    const periods = Array.from(document.querySelectorAll('#lessonCheckboxes input:checked')).map(cb => parseInt(cb.value));
    if (!periods.length) { alert("Выберите уроки"); return; }
    const subjectName = document.getElementById('subjectSelect').value;
    const roomName = document.getElementById('roomSelect').value;
    const classNames = Array.from(document.querySelectorAll('#classCheckboxes input:checked')).map(cb => cb.value);
    if (!classNames.length) { alert("Выберите классы"); return; }

    const subjectId = getSubjectIdByName(subjectName);
    const roomId = getRoomIdByName(roomName);
    if (!subjectId || !roomId) { alert("Не найден предмет или кабинет"); return; }

    const lessonsToAdd = [];
    for (let p of periods) {
        for (let cls of classNames) {
            const classId = getClassIdByName(cls);
            if (!classId) { alert(`Класс ${cls} не найден`); return; }
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
        alert(`✅ Добавлено уроков: ${lessonsToAdd.length}`);
        document.querySelectorAll('#lessonCheckboxes input:checked, #classCheckboxes input:checked').forEach(cb => cb.checked = false);
        await renderScheduleGrid();
    } catch (e) {
        alert("Ошибка при добавлении: " + e.message);
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
        alert('Ошибка экспорта: ' + err.message);
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
                    alert('Импорт выполнен успешно! Страница будет перезагружена.');
                    location.reload();
                } else {
                    alert('Ошибка импорта: ' + (result.error || 'неизвестная ошибка'));
                }
            } catch (err) {
                alert('Ошибка чтения файла: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

async function resetAll() {
    if (!confirm('Вы уверены, что хотите удалить все уроки, замены и отсутствия? Справочники останутся.')) return;
    try {
        const res = await fetch('/api/reset', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            alert('Все данные сброшены!');
            location.reload();
        } else {
            alert('Ошибка сброса: ' + (result.error || 'неизвестная ошибка'));
        }
    } catch (err) {
        alert('Ошибка: ' + err.message);
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
    await populateScheduleSelects();
    await renderScheduleGrid();

    // Обработчики
    document.getElementById('addLessonBtn').onclick = addLesson;
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', importData);
    document.getElementById('resetBtn').addEventListener('click', resetAll);

    // Toggle формы добавления уроков
    const toggleAddLessonBtn = document.getElementById('toggleAddLessonBtn');
    const addLessonForm = document.getElementById('addLessonForm');
    toggleAddLessonBtn.addEventListener('click', function() {
        const isVisible = addLessonForm.style.display !== 'none';
        addLessonForm.style.display = isVisible ? 'none' : 'block';
        this.innerHTML = isVisible ? '<i class="fas fa-book-open"></i> Добавить уроки / Add lessons' : '<i class="fas fa-minus-circle"></i> Скрыть форму / Hide form';
    });
    addLessonForm.style.display = 'none';

    // Toggle расписания
    const toggleScheduleBtn = document.getElementById('toggleScheduleBtn');
    const scheduleContent = document.getElementById('scheduleContent');
    toggleScheduleBtn.addEventListener('click', function() {
        const isVisible = scheduleContent.style.display !== 'none';
        scheduleContent.style.display = isVisible ? 'none' : 'block';
        this.innerHTML = isVisible ? '<i class="fas fa-calendar-alt"></i> Расписание / Schedule' : '<i class="fas fa-minus-circle"></i> Скрыть расписание / Hide schedule';
    });
    scheduleContent.style.display = 'none';
});