// Добавить в common.js перед всеми функциями
// Глобальный обработчик для всех fetch-запросов (если 401 – редирект на login)
const originalFetch = window.fetch;
window.fetch = function(...args) {
    return originalFetch.apply(this, args).then(response => {
        if (response.status === 401) {
            // Если не авторизованы, перенаправляем на страницу входа
            window.location.href = '/login.html';
        }
        return response;
    });
};



// -------------------- API взаимодействие --------------------
const API_BASE = '/api';

async function loadTeachers() {
    const res = await fetch(`${API_BASE}/teachers`);
    return res.json();
}
async function loadClasses() {
    const res = await fetch(`${API_BASE}/classes`);
    return res.json();
}
async function loadRooms() {
    const res = await fetch(`${API_BASE}/rooms`);
    return res.json();
}
async function loadSubjects() {
    const res = await fetch(`${API_BASE}/subjects`);
    return res.json();
}

async function loadLessons(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/lessons?${query}`);
    return res.json();
}
async function addLessons(lessonsArray) {
    const res = await fetch(`${API_BASE}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lessonsArray)
    });
    return res.json();
}
async function deleteLesson(teacherId, day, period) {
    const query = new URLSearchParams({ teacher_id: teacherId, day, period }).toString();
    const res = await fetch(`${API_BASE}/lessons?${query}`, { method: 'DELETE' });
    return res.json();
}

async function loadAbsences(day, date) {
    const query = new URLSearchParams({ day, date }).toString();
    const res = await fetch(`${API_BASE}/absences?${query}`);
    return res.json();
}
async function setAbsence(teacherId, day, date, action) {
    const res = await fetch(`${API_BASE}/absences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: teacherId, day, date, action })
    });
    return res.json();
}

async function loadReplacements(day, date) {
    const query = new URLSearchParams({ day, date }).toString();
    const res = await fetch(`${API_BASE}/replacements?${query}`);
    return res.json();
}
async function saveReplacements(day, date, replacements) {
    const res = await fetch(`${API_BASE}/replacements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, date, replacements })
    });
    return res.json();
}

async function loadSwaps(day, date) {
    const res = await fetch(`${API_BASE}/classroomSwaps?day=${day}&date=${date}`);
    return res.json();
}
async function addSwap(swapData) {
    const res = await fetch(`${API_BASE}/classroomSwaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swapData)
    });
    return res.json();
}
async function deleteSwap(id) {
    const res = await fetch(`${API_BASE}/classroomSwaps?id=${id}`, { method: 'DELETE' });
    return res.json();
}

// -------------------- Глобальное состояние (справочники) --------------------
const state = {
    teachers: [],
    classes: [],
    rooms: [],
    subjects: []
};

// -------------------- Вспомогательные функции --------------------
function getTeacherName(id) {
    const t = state.teachers.find(t => t.id === id);
    return t ? t.name : '?';
}
function getClassName(id) {
    const c = state.classes.find(c => c.id === id);
    return c ? c.name : '?';
}
function getRoomName(id) {
    const r = state.rooms.find(r => r.id === id);
    return r ? r.name : '?';
}
function getSubjectName(id) {
    const s = state.subjects.find(s => s.id === id);
    return s ? s.name : '?';
}
function getSubjectIdByName(name) {
    const s = state.subjects.find(s => s.name === name);
    return s ? s.id : null;
}
function getClassIdByName(name) {
    const c = state.classes.find(c => c.name === name);
    return c ? c.id : null;
}
function getRoomIdByName(name) {
    const r = state.rooms.find(r => r.name === name);
    return r ? r.id : null;
}
function getTeacherIdByName(name) {
    const t = state.teachers.find(t => t.name === name);
    return t ? t.id : null;
}

function getClassFamily(className) {
    const match = className.match(/^(\d+[A-Z]+\d+)/);
    return match ? match[1] : className.substring(0, 4);
}

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

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]);
}

// Выход из системы
async function logout() {
    if (!confirm('Вы уверены, что хотите выйти?')) return;
    try {
        const res = await fetch('/api/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
            window.location.href = '/login.html';
        } else {
            alert('Ошибка при выходе');
        }
    } catch (e) {
        alert('Ошибка сети');
    }
}