(function () {
    const translations = {
        ru: {
            'common.replacements': 'Замены',
            'common.schedule': 'Расписание',
            'common.statistics': 'Статистика',
            'common.logout': 'Выйти',
            'common.all': 'Все',
            'common.allTeachers': 'Все учителя',
            'common.comment': 'Комментарий',
            'common.optional': 'Опционально',
            'common.teacher': 'Учитель',
            'common.classes': 'Классы',
            'common.room': 'Кабинет',
            'common.period': 'Урок',
            'common.periods': 'Уроки',
            'common.time': 'Время',
            'common.subject': 'Предмет',
            'common.date': 'Дата',
            'common.show': 'Показать',
            'common.reset': 'Сбросить',
            'common.add': 'Добавить',
            'common.save': 'Сохранить',
            'common.downloadCsv': 'Скачать CSV',
            'common.error': 'Ошибка',
            'common.selectDate': 'Пожалуйста, выберите дату.',
            'common.networkError': 'Ошибка сети',
            'common.logoutConfirm': 'Вы уверены, что хотите выйти?',
            'common.logoutError': 'Ошибка при выходе',

            'brand.indexSubtitle': 'Russian International School · замены учителей и кабинетов',
            'brand.scheduleSubtitle': 'Russian International School · расписание',
            'brand.statsSubtitle': 'Russian International School · статистика',

            'index.title': 'Covers — замены',
            'index.pageTitle': 'Замены на день',
            'index.pageNote': 'Отсутствующие учителя, назначения и изменения кабинетов.',
            'index.absentTitle': 'Отсутствующие учителя',
            'index.absentNote': 'Найдите и отметьте отсутствующих на выбранную дату.',
            'index.teacherSearch': 'Поиск учителя',
            'index.teacherSearchPlaceholder': 'Фамилия или имя',
            'index.showReplacements': 'Показать замены',
            'index.teacherReplacementsTitle': 'Замены учителей',
            'index.teacherReplacementsNote': 'Проверьте уроки и назначьте заменяющих учителей.',
            'index.saveReplacements': 'Сохранить замены',
            'index.classroomReplacementsTitle': 'Замены кабинетов',
            'index.classroomReplacementsNote': 'При выборе конкретного учителя классы подбираются по расписанию автоматически.',
            'index.originalRoom': 'Исходный кабинет',
            'index.newRoom': 'Новый кабинет',
            'index.classesStudents': 'Классы / ученики',
            'index.resetClassroomSwaps': 'Сбросить замены кабинетов',
            'index.openReport': 'Открыть отчёт',
            'index.curators': 'Для кураторов',
            'index.copyLink': 'Копировать ссылку',
            'index.copyHtml': 'Копировать HTML',
            'index.noAbsentTeachers': 'Нет отсутствующих учителей для выбранной даты.',
            'index.noLesson': 'урок отсутствует',
            'index.notAssigned': '— не назначено —',
            'index.sameClass': 'тот же класс',
            'index.replacementsSaved': 'Замены учителей сохранены',
            'index.resetTeacherConfirm': 'Сбросить все замены учителей?',
            'index.resetDone': 'Сброшено',
            'index.chooseDate': 'Выберите дату',
            'index.noClassroomSwaps': 'Нет замен кабинетов на эту дату',
            'index.deleteSwap': 'Удалить замену',
            'index.chooseDateForClassroom': 'Выберите дату для замен кабинетов',
            'index.invalidPeriodRange': 'Урок «от» не может быть больше «до»',
            'index.sameRoom': 'Исходный и новый кабинет совпадают',
            'index.roomNotFound': 'Кабинет не найден',
            'index.resetClassroomConfirm': 'Сбросить все замены кабинетов?',
            'index.classroomDeleted': 'Замены кабинетов удалены',
            'index.chooseDateForReport': 'Выберите дату для отчёта.',
            'index.reportTitle': 'Отчёт о заменах за {date}',
            'index.noTeacherReplacements': 'Нет замен учителей на выбранную дату.',
            'index.noRoomReplacements': 'Нет замен кабинетов на выбранную дату.',
            'index.absentTeacher': 'Кого заменяем',
            'index.replacementTeacher': 'Кто заменяет',
            'index.copyReportFirst': 'Сначала сформируйте отчёт.',
            'index.htmlCopied': 'HTML отчёта скопирован в буфер обмена!',
            'index.copyError': 'Ошибка копирования: {message}',
            'index.linkCopied': 'Ссылка на отчёт скопирована!',
            'index.other': 'Другие',
            'index.students': '{count} учеников',
            'index.selectAll': 'Выбрать всех',
            'index.clearAll': 'Снять все',

            'schedule.title': 'Расписание — Covers',
            'schedule.pageTitle': 'Управление расписанием',
            'schedule.pageNote': 'Добавление уроков и просмотр базовой сетки.',
            'schedule.addTitle': 'Добавить уроки',
            'schedule.addNote': 'Используйте форму для ручных изменений расписания.',
            'schedule.day': 'День',
            'schedule.scheduleTitle': 'Расписание',
            'schedule.scheduleNote': 'Красные ячейки заняты, зелёные свободны.',
            'schedule.toggleSchedule': 'Показать / скрыть расписание',
            'schedule.exportJson': 'Экспорт JSON',
            'schedule.exportExcel': 'Экспорт Excel для сверки',
            'schedule.importJson': 'Импорт JSON',
            'schedule.resetAll': 'Сбросить всё',
            'schedule.selectTeacher': 'Выберите учителя',
            'schedule.selectPeriods': 'Выберите уроки',
            'schedule.selectClasses': 'Выберите классы',
            'schedule.subjectOrRoomMissing': 'Не найден предмет или кабинет',
            'schedule.classMissing': 'Класс {className} не найден',
            'schedule.lessonsAdded': 'Добавлено уроков: {count}',
            'schedule.addError': 'Ошибка при добавлении: {message}',
            'schedule.exportError': 'Ошибка экспорта: {message}',
            'schedule.importSuccess': 'Импорт выполнен успешно! Страница будет перезагружена.',
            'schedule.importError': 'Ошибка импорта: {message}',
            'schedule.fileReadError': 'Ошибка чтения файла: {message}',
            'schedule.resetConfirm': 'Вы уверены, что хотите удалить все уроки, замены и отсутствия? Справочники останутся.',
            'schedule.resetSuccess': 'Все данные сброшены!',
            'schedule.resetError': 'Ошибка сброса: {message}',
            'schedule.teacherHeader': 'Учитель',
            'schedule.busy': 'занято',
            'schedule.free': 'свободно',
            'schedule.deleteLessonsConfirm': 'Удалить уроки {teacher} в {day}, урок {period}?',
            'schedule.hideForm': 'Скрыть форму',
            'schedule.hideSchedule': 'Скрыть расписание',
            'schedule.copyNext': 'Скопировать на следующий урок',
            'schedule.copyConfirm': 'Скопировать уроки {teacher}: {day}, {period} → {nextPeriod}?',
            'schedule.copySuccess': 'Урок скопирован на {period}-й урок.',
            'schedule.copyLastPeriod': 'После 9-го урока следующего периода нет.',
            'schedule.copySourceMissing': 'Исходный урок не найден.',
            'schedule.copyTargetOccupied': 'Урок {period} у этого учителя уже занят другим занятием.',
            'schedule.copyAlreadyExists': 'На {period}-м уроке эта запись уже есть.',
            'schedule.copyError': 'Ошибка копирования: {message}',
            'schedule.focusHint': 'Нажмите на имя учителя, чтобы зафиксировать его строку.',
            'schedule.focusSelected': 'Выбран: {teacher}',
            'schedule.focusClear': 'Снять',
            'schedule.focusTeacherTitle': 'Зафиксировать строку этого учителя',

            'stats.title': 'Статистика — Covers',
            'stats.pageTitle': 'Статистика замен',
            'stats.pageNote': 'Фактически сохранённые замены за выбранный месяц.',
            'stats.month': 'Месяц',
            'stats.year': 'Год',
            'stats.prompt': 'Выберите месяц и нажмите «Показать»',
            'stats.selectMonthYear': 'Выберите месяц и год',
            'stats.noData': 'Нет замен за выбранный месяц',
            'stats.replacementTeacher': 'Учитель (заменяющий)',
            'stats.absentTeacher': 'Кого заменяли',
            'stats.totalTeacher': 'Итого по {teacher}: {count} замен',
            'stats.totalMonth': 'Всего замен за месяц: {count}',
            'stats.loadFirst': 'Сначала загрузите статистику',
            'stats.total': 'Итого',
            'stats.loadError': 'Ошибка: {message}',

            'login.title': 'Вход — Covers',
            'login.heading': 'Вход в систему замен',
            'login.password': 'Пароль',
            'login.passwordPlaceholder': 'Введите пароль',
            'login.submit': 'Войти',
            'login.foot': 'Замены учителей и кабинетов',
            'login.error': 'Ошибка входа',
            'login.connectionError': 'Ошибка соединения с сервером',

            'months.1': 'Январь', 'months.2': 'Февраль', 'months.3': 'Март', 'months.4': 'Апрель',
            'months.5': 'Май', 'months.6': 'Июнь', 'months.7': 'Июль', 'months.8': 'Август',
            'months.9': 'Сентябрь', 'months.10': 'Октябрь', 'months.11': 'Ноябрь', 'months.12': 'Декабрь',
            'days.Monday': 'Понедельник', 'days.Tuesday': 'Вторник', 'days.Wednesday': 'Среда', 'days.Thursday': 'Четверг', 'days.Friday': 'Пятница',
            'days.short.Monday': 'ПН', 'days.short.Tuesday': 'ВТ', 'days.short.Wednesday': 'СР', 'days.short.Thursday': 'ЧТ', 'days.short.Friday': 'ПТ'
        },
        en: {
            'common.replacements': 'Covers',
            'common.schedule': 'Schedule',
            'common.statistics': 'Statistics',
            'common.logout': 'Log out',
            'common.all': 'All',
            'common.allTeachers': 'All teachers',
            'common.comment': 'Comment',
            'common.optional': 'Optional',
            'common.teacher': 'Teacher',
            'common.classes': 'Classes',
            'common.room': 'Room',
            'common.period': 'Period',
            'common.periods': 'Periods',
            'common.time': 'Time',
            'common.subject': 'Subject',
            'common.date': 'Date',
            'common.show': 'Show',
            'common.reset': 'Reset',
            'common.add': 'Add',
            'common.save': 'Save',
            'common.downloadCsv': 'Download CSV',
            'common.error': 'Error',
            'common.selectDate': 'Please select a date.',
            'common.networkError': 'Network error',
            'common.logoutConfirm': 'Are you sure you want to log out?',
            'common.logoutError': 'Log out failed',

            'brand.indexSubtitle': 'Russian International School · teacher and classroom covers',
            'brand.scheduleSubtitle': 'Russian International School · schedule',
            'brand.statsSubtitle': 'Russian International School · statistics',

            'index.title': 'Covers — daily covers',
            'index.pageTitle': 'Daily covers',
            'index.pageNote': 'Absent teachers, cover assignments and classroom changes.',
            'index.absentTitle': 'Absent teachers',
            'index.absentNote': 'Find and select teachers who are absent on the selected date.',
            'index.teacherSearch': 'Teacher search',
            'index.teacherSearchPlaceholder': 'Surname or first name',
            'index.showReplacements': 'Show covers',
            'index.teacherReplacementsTitle': 'Teacher covers',
            'index.teacherReplacementsNote': 'Review lessons and assign cover teachers.',
            'index.saveReplacements': 'Save covers',
            'index.classroomReplacementsTitle': 'Classroom changes',
            'index.classroomReplacementsNote': 'When a specific teacher is selected, classes are picked automatically from the timetable.',
            'index.originalRoom': 'Original room',
            'index.newRoom': 'New room',
            'index.classesStudents': 'Classes / students',
            'index.resetClassroomSwaps': 'Reset classroom changes',
            'index.openReport': 'Open report',
            'index.curators': 'For tutors',
            'index.copyLink': 'Copy link',
            'index.copyHtml': 'Copy HTML',
            'index.noAbsentTeachers': 'There are no absent teachers for the selected date.',
            'index.noLesson': 'no lesson',
            'index.notAssigned': '— not assigned —',
            'index.sameClass': 'same class',
            'index.replacementsSaved': 'Teacher covers saved',
            'index.resetTeacherConfirm': 'Reset all teacher covers?',
            'index.resetDone': 'Reset complete',
            'index.chooseDate': 'Select a date',
            'index.noClassroomSwaps': 'No classroom changes for this date',
            'index.deleteSwap': 'Delete classroom change',
            'index.chooseDateForClassroom': 'Select a date for classroom changes',
            'index.invalidPeriodRange': 'The first period cannot be later than the last period',
            'index.sameRoom': 'Original and new rooms are the same',
            'index.roomNotFound': 'Room not found',
            'index.resetClassroomConfirm': 'Reset all classroom changes?',
            'index.classroomDeleted': 'Classroom changes deleted',
            'index.chooseDateForReport': 'Select a date for the report.',
            'index.reportTitle': 'Cover report for {date}',
            'index.noTeacherReplacements': 'No teacher covers for the selected date.',
            'index.noRoomReplacements': 'No classroom changes for the selected date.',
            'index.absentTeacher': 'Absent teacher',
            'index.replacementTeacher': 'Cover teacher',
            'index.copyReportFirst': 'Generate the report first.',
            'index.htmlCopied': 'Report HTML copied to the clipboard!',
            'index.copyError': 'Copy failed: {message}',
            'index.linkCopied': 'Report link copied!',
            'index.other': 'Other',
            'index.students': '{count} students',
            'index.selectAll': 'Select all',
            'index.clearAll': 'Clear all',

            'schedule.title': 'Schedule — Covers',
            'schedule.pageTitle': 'Schedule management',
            'schedule.pageNote': 'Add lessons and review the base timetable.',
            'schedule.addTitle': 'Add lessons',
            'schedule.addNote': 'Use this form for manual timetable changes.',
            'schedule.day': 'Day',
            'schedule.scheduleTitle': 'Schedule',
            'schedule.scheduleNote': 'Red cells are busy, green cells are free.',
            'schedule.toggleSchedule': 'Show / hide schedule',
            'schedule.exportJson': 'Export JSON',
            'schedule.exportExcel': 'Export Excel for checking',
            'schedule.importJson': 'Import JSON',
            'schedule.resetAll': 'Reset all',
            'schedule.selectTeacher': 'Select a teacher',
            'schedule.selectPeriods': 'Select periods',
            'schedule.selectClasses': 'Select classes',
            'schedule.subjectOrRoomMissing': 'Subject or room not found',
            'schedule.classMissing': 'Class {className} not found',
            'schedule.lessonsAdded': 'Lessons added: {count}',
            'schedule.addError': 'Could not add lessons: {message}',
            'schedule.exportError': 'Export failed: {message}',
            'schedule.importSuccess': 'Import completed successfully. The page will reload.',
            'schedule.importError': 'Import failed: {message}',
            'schedule.fileReadError': 'Could not read file: {message}',
            'schedule.resetConfirm': 'Are you sure you want to delete all lessons, covers and absences? Reference lists will remain.',
            'schedule.resetSuccess': 'All data has been reset!',
            'schedule.resetError': 'Reset failed: {message}',
            'schedule.teacherHeader': 'Teacher',
            'schedule.busy': 'busy',
            'schedule.free': 'free',
            'schedule.deleteLessonsConfirm': 'Delete lessons for {teacher} on {day}, period {period}?',
            'schedule.hideForm': 'Hide form',
            'schedule.hideSchedule': 'Hide schedule',
            'schedule.copyNext': 'Copy to the next period',
            'schedule.copyConfirm': 'Copy {teacher} lessons: {day}, period {period} → {nextPeriod}?',
            'schedule.copySuccess': 'Lesson copied to period {period}.',
            'schedule.copyLastPeriod': 'There is no period after period 9.',
            'schedule.copySourceMissing': 'Source lesson was not found.',
            'schedule.copyTargetOccupied': 'Period {period} is already occupied by another lesson for this teacher.',
            'schedule.copyAlreadyExists': 'This lesson already exists in period {period}.',
            'schedule.copyError': 'Copy failed: {message}',
            'schedule.focusHint': 'Click a teacher name to keep that row in focus.',
            'schedule.focusSelected': 'Selected: {teacher}',
            'schedule.focusClear': 'Clear',
            'schedule.focusTeacherTitle': 'Keep this teacher row in focus',

            'stats.title': 'Statistics — Covers',
            'stats.pageTitle': 'Cover statistics',
            'stats.pageNote': 'Saved teacher covers for the selected month.',
            'stats.month': 'Month',
            'stats.year': 'Year',
            'stats.prompt': 'Select a month and click “Show”',
            'stats.selectMonthYear': 'Select a month and year',
            'stats.noData': 'No covers for the selected month',
            'stats.replacementTeacher': 'Cover teacher',
            'stats.absentTeacher': 'Absent teacher',
            'stats.totalTeacher': 'Total for {teacher}: {count} covers',
            'stats.totalMonth': 'Total covers this month: {count}',
            'stats.loadFirst': 'Load the statistics first',
            'stats.total': 'Total',
            'stats.loadError': 'Error: {message}',

            'login.title': 'Sign in — Covers',
            'login.heading': 'Sign in to Covers',
            'login.password': 'Password',
            'login.passwordPlaceholder': 'Enter password',
            'login.submit': 'Sign in',
            'login.foot': 'Teacher and classroom covers',
            'login.error': 'Sign in failed',
            'login.connectionError': 'Could not connect to the server',

            'months.1': 'January', 'months.2': 'February', 'months.3': 'March', 'months.4': 'April',
            'months.5': 'May', 'months.6': 'June', 'months.7': 'July', 'months.8': 'August',
            'months.9': 'September', 'months.10': 'October', 'months.11': 'November', 'months.12': 'December',
            'days.Monday': 'Monday', 'days.Tuesday': 'Tuesday', 'days.Wednesday': 'Wednesday', 'days.Thursday': 'Thursday', 'days.Friday': 'Friday',
            'days.short.Monday': 'MON', 'days.short.Tuesday': 'TUE', 'days.short.Wednesday': 'WED', 'days.short.Thursday': 'THU', 'days.short.Friday': 'FRI'
        }
    };

    function getLanguage() {
        const stored = localStorage.getItem('covers_lang');
        return stored === 'en' ? 'en' : 'ru';
    }

    function t(key, vars = {}) {
        const lang = getLanguage();
        let value = translations[lang]?.[key] ?? translations.ru[key] ?? key;
        Object.entries(vars).forEach(([name, replacement]) => {
            value = value.replaceAll(`{${name}}`, String(replacement));
        });
        return value;
    }

    function applyTranslations(root = document) {
        const lang = getLanguage();
        document.documentElement.lang = lang;

        root.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
        });
        root.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.setAttribute('title', t(el.dataset.i18nTitle));
        });
        root.querySelectorAll('[data-lang]').forEach(el => {
            el.classList.toggle('active', el.dataset.lang === lang);
            el.setAttribute('aria-pressed', el.dataset.lang === lang ? 'true' : 'false');
        });
    }

    function setLanguage(lang) {
        if (!['ru', 'en'].includes(lang)) return;
        localStorage.setItem('covers_lang', lang);
        window.location.reload();
    }

    function initLanguageSwitch() {
        document.querySelectorAll('[data-lang]').forEach(button => {
            button.addEventListener('click', () => setLanguage(button.dataset.lang));
        });
        applyTranslations();
    }

    window.CoversI18n = { t, getLanguage, setLanguage, applyTranslations };
    window.t = t;
    window.getLanguage = getLanguage;
    window.setLanguage = setLanguage;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLanguageSwitch, { once: true });
    } else {
        initLanguageSwitch();
    }
})();
