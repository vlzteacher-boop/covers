// ===== Функции для страницы статистики =====

async function loadStats() {
    const month = document.getElementById('statsMonth').value;
    const year = document.getElementById('statsYear').value;
    if (!month || !year) {
        alert('Выберите месяц и год');
        return;
    }

    console.log(`📊 Запрос статистики: month=${month}, year=${year}`);

    try {
        const res = await fetch(`/api/stats?month=${month}&year=${year}`);
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Ошибка загрузки данных (${res.status}): ${errorText}`);
        }
        const data = await res.json();
        console.log('📈 Данные статистики:', data);
        renderStatsTable(data);
    } catch (err) {
        console.error('❌ Ошибка в loadStats:', err);
        alert('Ошибка: ' + err.message);
    }
}

function renderStatsTable(data) {
    const container = document.getElementById('statsResult');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = `<p style="color:#64748b; text-align:center;">Нет замен за выбранный месяц</p>`;
        return;
    }

    // Группируем по учителю (заменяющему)
    const groups = {};
    data.forEach(row => {
        const teacher = row.teacher_name;
        if (!groups[teacher]) groups[teacher] = [];
        groups[teacher].push(row);
    });

    // Сортируем учителей по алфавиту
    const sortedTeachers = Object.keys(groups).sort();

    let html = `<table class="report-table">
        <thead>
            <tr>
                <th>Учитель (заменяющий)</th>
                <th>Дата</th>
                <th>Урок</th>
                <th>Предмет</th>
                <th>Класс(ы)</th>
                <th>Кого заменяли</th>
                <th>Комментарий</th>
            </tr>
        </thead>
        <tbody>`;

    let grandTotal = 0;

    sortedTeachers.forEach(teacher => {
        const rows = groups[teacher];
        const teacherTotal = rows.length;
        grandTotal += teacherTotal;

        // Все строки учителя
        rows.forEach(row => {
            let formattedDate = row.absence_date || '';
            if (formattedDate && formattedDate.includes('-')) {
                const parts = formattedDate.split('-');
                if (parts.length === 3) {
                    formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
                }
            }

            html += `<tr>
                <td><strong>${escapeHtml(row.teacher_name)}</strong></td>
                <td>${escapeHtml(formattedDate)}</td>
                <td>${escapeHtml(row.period)}</td>
                <td>${escapeHtml(row.subjects || '—')}</td>
                <td>${escapeHtml(row.classes || '—')}</td>
                <td>${escapeHtml(row.absent_teacher_name)}</td>
                <td>${escapeHtml(row.comment || '—')}</td>
            </tr>`;
        });

        // Строка итога по этому учителю
        html += `<tr class="subtotal-row">
            <td colspan="7" style="text-align: right; padding: 6px 10px;">
                <span>Итого по ${escapeHtml(teacher)}: ${teacherTotal} замен</span>
            </td>
        </tr>`;
    });

    // Общий итог
    html += `<tr class="total-row">
        <td colspan="7" style="text-align: right; padding: 8px 10px;">
            <span>Всего замен за месяц: ${grandTotal}</span>
        </td>
    </tr>`;

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function exportStatsCSV() {
    const container = document.getElementById('statsResult');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) {
        alert('Сначала загрузите статистику');
        return;
    }

    // Собираем данные из таблицы (включая итоговые строки)
    const rows = table.querySelectorAll('tbody tr');
    let csv = 'Учитель,Дата,Урок,Предмет,Класс(ы),Кого заменяли,Комментарий\n';

    let isSubtotal = false;
    let teacherName = '';

    rows.forEach(row => {
        if (row.classList.contains('subtotal-row')) {
            // Пропускаем, так как это итог по учителю (можно добавить в CSV, но не обязательно)
            // Для простоты пропускаем, чтобы CSV содержал только детальные строки
            return;
        }
        if (row.classList.contains('total-row')) {
            return;
        }

        const cells = row.querySelectorAll('td');
        if (cells.length === 7) {
            const teacher = cells[0].textContent.trim();
            const date = cells[1].textContent.trim();
            const period = cells[2].textContent.trim();
            const subject = cells[3].textContent.trim();
            const classes = cells[4].textContent.trim();
            const absent = cells[5].textContent.trim();
            const comment = cells[6].textContent.trim();

            csv += `"${teacher}","${date}","${period}","${subject}","${classes}","${absent}","${comment}"\n`;
        }
    });

    // Добавляем итоговую строку с общим количеством
    const totalRow = table.querySelector('.total-row');
    if (totalRow) {
        const totalText = totalRow.textContent.trim();
        csv += `\n"Итого",,,,,"${totalText}"\n`;
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const month = document.getElementById('statsMonth').value;
    const year = document.getElementById('statsYear').value;
    a.download = `stats_${month}_${year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Установка текущего месяца и года по умолчанию
    const yearInput = document.getElementById('statsYear');
    if (yearInput) {
        yearInput.value = new Date().getFullYear();
    }
    const monthSelect = document.getElementById('statsMonth');
    if (monthSelect) {
        monthSelect.value = new Date().getMonth() + 1;
    }

    // Привязка обработчиков
    const loadBtn = document.getElementById('loadStatsBtn');
    if (loadBtn) {
        loadBtn.addEventListener('click', loadStats);
    }
    const exportBtn = document.getElementById('exportStatsBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportStatsCSV);
    }
});