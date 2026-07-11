const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

async function importSchedule() {
    const client = await pool.connect();
    try {
        // 1. Читаем JSON
        const rawData = fs.readFileSync('Russian International School 26-27 Secondary Module 1 copy for tests for apps.json', 'utf8');
        const data = JSON.parse(rawData);

        // 2. Строим словари
        const teachers = {};
        data.teachers.forEach(t => { teachers[t.id] = t.name; });

        const subjects = {};
        data.subjects.forEach(s => { subjects[s.id] = s.name; });

        const days = {};
        data.days.forEach(d => { days[d.id] = d.name; }); // "Monday", ...

        const periods = {};
        data.periods.forEach(p => { periods[p.id] = p.position; }); // 1..9

        // Для классов: сопоставляем groupId -> classId (или className)
        const groupToClass = {};
        data.classes.forEach(cls => {
            const classId = cls.id;
            const className = cls.name;
            // Ищем все группы внутри classSets
            if (cls.groupSets) {
                cls.groupSets.forEach(gs => {
                    if (gs.groups) {
                        gs.groups.forEach(g => {
                            groupToClass[g.id] = { classId, className };
                        });
                    }
                });
            }
        });

        // 3. Начинаем транзакцию
        await client.query('BEGIN');

        // 4. Очищаем таблицу lessons
        await client.query('DELETE FROM lessons');
        console.log('✅ Таблица lessons очищена');

        // 5. Вставляем уроки
        let inserted = 0;
        for (const activity of data.activities) {
            const subjectId = activity.subjectId;
            const teacherIds = activity.teacherIds || [];
            const groupIds = activity.groupIds || [];
            const cards = activity.cards || [];

            if (!subjectId || teacherIds.length === 0 || groupIds.length === 0 || cards.length === 0) {
                continue; // пропускаем неполные активности
            }

            // Для каждой карточки (день + период)
            for (const card of cards) {
                const dayId = card.dayId;
                const periodId = card.periodId;
                const dayName = days[dayId];
                const periodNumber = periods[periodId];
                if (!dayName || !periodNumber) continue;

                // Для каждого учителя и каждой группы создаём урок
                for (const teacherId of teacherIds) {
                    for (const groupId of groupIds) {
                        const classInfo = groupToClass[groupId];
                        if (!classInfo) {
                            console.warn(`⚠️ Группа ${groupId} не найдена в классах, пропускаем`);
                            continue;
                        }
                        const classId = classInfo.classId;
                        // Вставляем урок (room_id = NULL)
                        await client.query(
                            `INSERT INTO lessons (teacher_id, day, period, subject_id, class_id, room_id)
                             VALUES ($1, $2, $3, $4, $5, NULL)`,
                            [teacherId, dayName, periodNumber, subjectId, classId]
                        );
                        inserted++;
                    }
                }
            }
        }

        await client.query('COMMIT');
        console.log(`✅ Импорт завершён. Вставлено ${inserted} уроков.`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка при импорте:', err);
    } finally {
        client.release();
        pool.end();
    }
}

importSchedule();