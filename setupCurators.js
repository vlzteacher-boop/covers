const pool = require('./db');

const CURATORS = [
    {
        name: 'Казьмина Ольга Владимировна',
        matches: className => /^5Y7(?:D|M)?$/i.test(className.trim())
    },
    {
        name: 'Василиса Дмитриевна Неминущая',
        matches: className => /^6Y8(?:D|M)?$/i.test(className.trim())
    },
    {
        name: 'Рыжова Алина Евгеньевна',
        matches: className => /^(?:7Y9|8Y10)(?:D|M)?$/i.test(className.trim())
    },
    {
        name: 'Кийко Екатерина Анатольевна',
        matches: className => {
            const name = className.trim();
            return /^9Y11(?:D|M)?$/i.test(name) || /^10Y12$/i.test(name) || /^12\s+/.test(name);
        }
    },
    {
        name: 'Гредина Елена Николаевна',
        matches: className => {
            const name = className.trim();
            return /^11Y13$/i.test(name) || /^13\s+/.test(name);
        }
    }
];

const OLD_PLACEHOLDER_CURATORS = [
    'Иванова И.И.',
    'Петров П.П.',
    'Сидорова С.С.'
];

async function getOrCreateCurator(client, name) {
    const existing = await client.query(
        'SELECT id FROM curators WHERE name = $1 ORDER BY id LIMIT 1',
        [name]
    );

    if (existing.rows.length) {
        return existing.rows[0].id;
    }

    const inserted = await client.query(
        'INSERT INTO curators (name) VALUES ($1) RETURNING id',
        [name]
    );

    return inserted.rows[0].id;
}

async function setupCurators() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const classesRes = await client.query(
            'SELECT id, name, curator_id FROM classes ORDER BY name'
        );
        const classes = classesRes.rows;

        console.log('\nКУРАТОРЫ И КЛАССЫ\n');

        for (const curatorConfig of CURATORS) {
            const curatorId = await getOrCreateCurator(client, curatorConfig.name);
            const matchedClasses = classes.filter(c => curatorConfig.matches(c.name));
            const classIds = matchedClasses.map(c => c.id);

            if (classIds.length) {
                await client.query(
                    'UPDATE classes SET curator_id = $1 WHERE id = ANY($2::int[])',
                    [curatorId, classIds]
                );
            }

            console.log(`${curatorConfig.name}:`);
            if (matchedClasses.length) {
                console.log(`  ${matchedClasses.map(c => c.name).join(', ')}`);
            } else {
                console.log('  ⚠️ Подходящие классы не найдены');
            }
        }

        // Удаляем старые тестовые записи только если после переназначения
        // на них больше не ссылается ни один класс.
        await client.query(
            `DELETE FROM curators cr
             WHERE cr.name = ANY($1::text[])
               AND NOT EXISTS (
                   SELECT 1 FROM classes c WHERE c.curator_id = cr.id
               )`,
            [OLD_PLACEHOLDER_CURATORS]
        );

        await client.query('COMMIT');

        console.log('\n✅ Кураторы добавлены и классы привязаны.\n');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка настройки кураторов:', err);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

setupCurators();
