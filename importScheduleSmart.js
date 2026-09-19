const fs = require('fs');
const path = require('path');

/**
 * RIS timetable -> Covers PostgreSQL smart importer.
 *
 * Usage:
 *   node importScheduleSmart.js "schedule.json" --source-only
 *       Analyse only the source JSON. No DB connection.
 *
 *   node importScheduleSmart.js "schedule.json"
 *       Dry run against the DB. Nothing is changed.
 *
 *   node importScheduleSmart.js "schedule.json" --apply
 *       Import in a single transaction.
 *
 * Important:
 * - Source UUIDs are never written into integer FK columns.
 * - activity.length is expanded to consecutive lesson periods.
 * - Unplaced cards (no dayId/periodId) are skipped and reported.
 * - Individual KS5 students ("12 Iva", "13 Amelia", etc.) remain separate DB classes.
 * - Existing reference IDs are reused by normalized name; missing rows are created.
 * - Only lessons are rebuilt. Historical teachers/classes/subjects/rooms are NOT deleted.
 * - New/changed classes are assigned to the configured curators automatically.
 */

const args = process.argv.slice(2);
const jsonArg = args.find(a => !a.startsWith('--'));
const APPLY = args.includes('--apply');
const SOURCE_ONLY = args.includes('--source-only');
const KEEP_SUBJECT_VARIANTS = args.includes('--keep-subject-variants');
const NO_ROOM_NAME = 'NO ROOM / TBD';

if (!jsonArg) {
  console.error('Usage: node importScheduleSmart.js <schedule.json> [--source-only | --apply] [--keep-subject-variants]');
  process.exit(1);
}
if (APPLY && SOURCE_ONLY) {
  console.error('Choose either --source-only or --apply, not both.');
  process.exit(1);
}

const jsonPath = path.resolve(process.cwd(), jsonArg);

function cleanName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeName(value) {
  return cleanName(value)
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е');
}

function indexById(items = []) {
  return new Map(items.map(item => [item.id, item]));
}

function canonicalRoomName(rawName) {
  const name = cleanName(rawName);
  const aliases = new Map([
    ['Singapore', 'Singapore (Green room)'],
  ]);
  return aliases.get(name) || name;
}

function canonicalSubjectName(rawName) {
  const name = cleanName(rawName);
  if (KEEP_SUBJECT_VARIANTS) return name;

  const aliases = new Map([
    ['Русский KS3', 'Русский'],
    ['Русский KS4', 'Русский'],
    ['Русский KS5', 'Русский'],
    ['Математика KS3', 'Математика'],
    ['Математика KS3 Olymp', 'Математика'],
    ['Математика KS4', 'Математика'],
    ['Математика KS5', 'Математика'],
    ['Информатика KS3', 'Информатика'],
    ['Информатика KS4', 'Информатика'],
    ['Биология KS3', 'Биология'],
    ['Биология KS4-5', 'Биология'],
    ['Биология ЕГЭ', 'Биология'],
    ['Физика KS3', 'Физика'],
    ['История KS3', 'История'],
    ['История KS4/5', 'История'],
    ['Обществознание KS3', 'Обществознание'],
    ['Обществознание KS4', 'Обществознание'],
    ['General Studies KS3', 'General Studies'],
    ['General Studies KS4', 'General Studies'],
    ['Digital Lit KS3', 'Digital Lit'],
    ['Digital Lit KS4', 'Digital Lit'],
    ['English KS3', 'English'],
    ['English KS4', 'English'],
    ['EAL KS3', 'EAL'],
    ['EAL KS4', 'EAL'],
    ['EAL KS5', 'EAL'],
    ['History KS3', 'History'],
    ['History KS5', 'History'],
    ['History AS', 'History'],
    ['Business KS4', 'Business'],
    ['Business KS5', 'Business'],
    ['Maths KS3', 'Maths'],
    ['Maths KS4', 'Maths'],
    ['Maths KS5', 'Maths'],
    ['Maths A level', 'Maths'],
    ['Science KS3', 'Science'],
    ['Science KS4', 'Science'],
    ['Economics AS', 'Economics'],
    ['Sociology AS', 'Sociology'],
    ['Sociology A', 'Sociology'],
    ['General English AS', 'General English'],
    ['English Language AS', 'English Language'],
    ['Further Maths AS', 'Further Maths'],
    ['Philosophy A2', 'Philosophy'],
    ['Physics A2', 'Physics'],
    ['French AS', 'French'],
    ['Computer Science AS', 'Comp Sci'],
  ]);

  return aliases.get(name) || name;
}

function curatorForClass(className) {
  const name = cleanName(className);
  if (/^5Y7(?:D|M)?$/i.test(name)) return 'Казьмина Ольга Владимировна';
  if (/^6Y8(?:D|M)?$/i.test(name)) return 'Василиса Дмитриевна Неминущая';
  if (/^(?:7Y9|8Y10)(?:D|M)?$/i.test(name)) return 'Рыжова Алина Евгеньевна';
  if (/^9Y11(?:D|M)?$/i.test(name) || /^10Y12$/i.test(name) || /^12\s+/i.test(name)) {
    return 'Кийко Екатерина Анатольевна';
  }
  if (/^11Y13$/i.test(name) || /^13\s+/i.test(name)) {
    return 'Гредина Елена Николаевна';
  }
  return null;
}

function buildLogicalLessons(data) {
  const teachersById = indexById(data.teachers);
  const subjectsById = indexById(data.subjects);
  const roomsById = indexById(data.rooms);
  const daysById = indexById(data.days);
  const periodsById = indexById(data.periods);

  const periodPositions = [...periodsById.values()]
    .map(p => Number(p.position))
    .filter(Number.isFinite);
  const maxPeriod = periodPositions.length ? Math.max(...periodPositions) : 9;

  // Source group UUID -> parent class. Individual KS5 students are parent classes too.
  const groupToClass = new Map();
  for (const cls of data.classes || []) {
    for (const groupSet of cls.groupSets || []) {
      for (const group of groupSet.groups || []) {
        groupToClass.set(group.id, cls);
      }
    }
  }

  const lessons = [];
  const warnings = [];
  const unplacedCards = [];
  const roomlessCards = [];
  const activityLengthCounts = new Map();
  let skippedActivities = 0;
  let placedCards = 0;
  let expandedPeriodPlacements = 0;

  for (const activity of data.activities || []) {
    const subject = subjectsById.get(activity.subjectId);
    const teacherIds = Array.isArray(activity.teacherIds) ? activity.teacherIds : [];
    const groupIds = Array.isArray(activity.groupIds) ? activity.groupIds : [];
    const cards = Array.isArray(activity.cards) ? activity.cards : [];
    const length = Math.max(1, Number.parseInt(activity.length ?? 1, 10) || 1);
    activityLengthCounts.set(length, (activityLengthCounts.get(length) || 0) + 1);

    if (!subject || teacherIds.length === 0 || groupIds.length === 0 || cards.length === 0) {
      skippedActivities++;
      warnings.push(`Skipped incomplete activity ${activity.id || '(no id)'}`);
      continue;
    }

    const teachers = teacherIds.map(id => teachersById.get(id)).filter(Boolean);
    if (teachers.length !== teacherIds.length) {
      warnings.push(`Activity ${activity.id}: one or more teacherIds were not found.`);
    }
    if (teachers.length === 0) {
      skippedActivities++;
      continue;
    }

    // Several source groups can belong to the same class; collapse them to one parent class row.
    const classMap = new Map();
    for (const groupId of groupIds) {
      const cls = groupToClass.get(groupId);
      if (!cls) {
        warnings.push(`Activity ${activity.id}: group ${groupId} has no parent class.`);
        continue;
      }
      classMap.set(cls.id, cls);
    }
    const classes = [...classMap.values()];
    if (classes.length === 0) {
      skippedActivities++;
      continue;
    }

    for (const card of cards) {
      const day = daysById.get(card.dayId);
      const startPeriod = periodsById.get(card.periodId);

      // Timetable exports can contain pinned/unplaced cards with no dayId/periodId.
      if (!day || !startPeriod?.position) {
        unplacedCards.push({
          activityId: activity.id,
          cardId: card.id,
          subject: cleanName(subject.name),
          teachers: teachers.map(t => cleanName(t.name)),
          classes: classes.map(c => cleanName(c.name)),
        });
        continue;
      }

      placedCards++;

      const cardRoomIds = Array.isArray(card.roomIds) ? card.roomIds : [];
      const activityRoomIds = Array.isArray(activity.roomIds) ? activity.roomIds : [];
      const selectedRoomIds = cardRoomIds.length ? cardRoomIds : activityRoomIds;

      let roomName = NO_ROOM_NAME;
      if (selectedRoomIds.length > 0) {
        const room = roomsById.get(selectedRoomIds[0]);
        if (room) roomName = canonicalRoomName(room.name);
        else warnings.push(`Activity ${activity.id}: room ${selectedRoomIds[0]} was not found.`);
      } else {
        roomlessCards.push({
          activityId: activity.id,
          cardId: card.id,
          day: day.name,
          period: Number(startPeriod.position),
          subject: cleanName(subject.name),
        });
      }

      if (selectedRoomIds.length > 1) {
        warnings.push(
          `Activity ${activity.id}, ${day.name} period ${startPeriod.position}: ` +
          `multiple rooms are present; using the first one.`
        );
      }

      // IMPORTANT: one source card may span 2/3/4 periods. Covers stores one row per period.
      for (let offset = 0; offset < length; offset++) {
        const period = Number(startPeriod.position) + offset;
        if (period > maxPeriod) {
          warnings.push(
            `Activity ${activity.id}: ${day.name} starts at ${startPeriod.position} with length ${length}, ` +
            `which exceeds the last period (${maxPeriod}); period ${period} was skipped.`
          );
          continue;
        }
        expandedPeriodPlacements++;

        for (const teacher of teachers) {
          for (const cls of classes) {
            lessons.push({
              teacherName: cleanName(teacher.name),
              subjectName: canonicalSubjectName(subject.name),
              sourceSubjectName: cleanName(subject.name),
              className: cleanName(cls.name),
              roomName,
              day: cleanName(day.name),
              period,
              sourceActivityId: activity.id,
              sourceCardId: card.id,
              sourceLength: length,
            });
          }
        }
      }
    }
  }

  return {
    lessons,
    warnings,
    unplacedCards,
    roomlessCards,
    skippedActivities,
    placedCards,
    expandedPeriodPlacements,
    activityLengthCounts,
  };
}

function dedupeLogicalLessons(lessons) {
  const byKey = new Map();
  const conflicts = [];
  let exactDuplicates = 0;

  for (const lesson of lessons) {
    const key = [
      normalizeName(lesson.teacherName),
      lesson.day,
      lesson.period,
      normalizeName(lesson.className),
    ].join('|');

    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, lesson);
      continue;
    }

    const same =
      normalizeName(previous.subjectName) === normalizeName(lesson.subjectName) &&
      normalizeName(previous.roomName) === normalizeName(lesson.roomName);

    if (same) exactDuplicates++;
    else conflicts.push({ previous, next: lesson });
  }

  return { lessons: [...byKey.values()], conflicts, exactDuplicates };
}

function addToSet(map, table, name) {
  if (!map[table]) map[table] = new Set();
  map[table].add(name);
}

function printSourcePlan(data, built, deduped) {
  const lengths = [...built.activityLengthCounts.entries()].sort((a, b) => a[0] - b[0]);
  console.log('\n=== Source schedule analysis ===');
  console.log(`Schedule: ${cleanName(data.name || '(unnamed)')}`);
  if (data.updatedAt) console.log(`Source updatedAt: ${data.updatedAt}`);
  console.log(`Source activities: ${(data.activities || []).length}`);
  console.log(`Placed cards: ${built.placedCards}`);
  console.log(`Unplaced cards skipped: ${built.unplacedCards.length}`);
  console.log(`Activity lengths: ${lengths.map(([len, count]) => `${len}×=${count}`).join(', ')}`);
  console.log(`Expanded period placements: ${built.expandedPeriodPlacements}`);
  console.log(`Generated lesson rows: ${built.lessons.length}`);
  console.log(`Lesson rows after de-duplication: ${deduped.lessons.length}`);
  console.log(`Exact duplicate rows ignored: ${deduped.exactDuplicates}`);
  console.log(`Conflicts: ${deduped.conflicts.length}`);
  console.log(`Roomless cards using "${NO_ROOM_NAME}": ${built.roomlessCards.length}`);
  console.log(`Warnings: ${built.warnings.length}`);

  if (built.unplacedCards.length) {
    console.log('\nUnplaced cards (not imported):');
    for (const item of built.unplacedCards.slice(0, 30)) {
      console.log(
        `  - ${item.subject} | ${item.teachers.join(', ')} | ${item.classes.join(', ')}`
      );
    }
    if (built.unplacedCards.length > 30) {
      console.log(`  ... ${built.unplacedCards.length - 30} more`);
    }
  }

  if (built.warnings.length) {
    console.log('\nWarnings (first 30):');
    for (const warning of built.warnings.slice(0, 30)) console.log(`  ! ${warning}`);
    if (built.warnings.length > 30) console.log(`  ... ${built.warnings.length - 30} more`);
  }

  if (deduped.conflicts.length) {
    console.error('\nERROR: source contains conflicting rows for teacher/day/period/class.');
    for (const conflict of deduped.conflicts.slice(0, 20)) {
      console.error('  conflict:', conflict.previous, '<->', conflict.next);
    }
  }
}

async function loadDbNameMap(client, table) {
  const result = await client.query(`SELECT id, name FROM ${table}`);
  const map = new Map();
  for (const row of result.rows) {
    map.set(normalizeName(row.name), { id: row.id, name: row.name });
  }
  return map;
}

async function ensureNamedEntity(client, table, rawName, dbMap) {
  const name = cleanName(rawName);
  const key = normalizeName(name);
  const existing = dbMap.get(key);
  if (existing) return existing.id;

  const result = await client.query(
    `INSERT INTO ${table} (name) VALUES ($1) RETURNING id, name`,
    [name]
  );
  const row = result.rows[0];
  dbMap.set(key, row);
  console.log(`  + ${table}: ${row.name} (id=${row.id})`);
  return row.id;
}

async function syncCurators(client, classDbMap, classNames) {
  const curatorNames = [...new Set(classNames.map(curatorForClass).filter(Boolean))];
  if (!curatorNames.length) return;

  const curatorMap = await loadDbNameMap(client, 'curators');
  for (const curatorName of curatorNames) {
    await ensureNamedEntity(client, 'curators', curatorName, curatorMap);
  }

  let updated = 0;
  for (const className of classNames) {
    const curatorName = curatorForClass(className);
    if (!curatorName) continue;
    const cls = classDbMap.get(normalizeName(className));
    const curator = curatorMap.get(normalizeName(curatorName));
    if (!cls || !curator) continue;

    await client.query(
      `UPDATE classes SET curator_id = $1 WHERE id = $2 AND curator_id IS DISTINCT FROM $1`,
      [curator.id, cls.id]
    );
    updated++;
  }
  console.log(`Curator mapping checked for ${updated} imported classes.`);
}

async function main() {
  if (!fs.existsSync(jsonPath)) throw new Error(`JSON file not found: ${jsonPath}`);

  const raw = fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  const built = buildLogicalLessons(data);
  const deduped = dedupeLogicalLessons(built.lessons);
  const logicalLessons = deduped.lessons;

  printSourcePlan(data, built, deduped);

  if (deduped.conflicts.length) {
    throw new Error('Import aborted because source conflicts with the lessons unique key.');
  }

  if (SOURCE_ONLY) {
    console.log('\nSOURCE-ONLY CHECK COMPLETE. Database was not contacted.');
    return;
  }

  const required = {
    teachers: new Set(),
    subjects: new Set(),
    classes: new Set(),
    rooms: new Set(),
  };
  for (const lesson of logicalLessons) {
    addToSet(required, 'teachers', lesson.teacherName);
    addToSet(required, 'subjects', lesson.subjectName);
    addToSet(required, 'classes', lesson.className);
    addToSet(required, 'rooms', lesson.roomName);
  }

  const pool = require('./db');
  const client = await pool.connect();
  try {
    const dbMaps = {
      teachers: await loadDbNameMap(client, 'teachers'),
      subjects: await loadDbNameMap(client, 'subjects'),
      classes: await loadDbNameMap(client, 'classes'),
      rooms: await loadDbNameMap(client, 'rooms'),
    };

    const missing = {};
    for (const table of Object.keys(required)) {
      missing[table] = [...required[table]].filter(
        name => !dbMaps[table].has(normalizeName(name))
      );
    }

    console.log('\n=== Database import plan ===');
    for (const table of ['teachers', 'subjects', 'classes', 'rooms']) {
      console.log(`${table}: required=${required[table].size}, missing=${missing[table].length}`);
      for (const name of missing[table]) console.log(`  + ${name}`);
    }

    if (!APPLY) {
      console.log('\nDRY RUN ONLY. Database was not changed.');
      console.log('Run again with --apply to import.');
      return;
    }

    await client.query('BEGIN');
    try {
      console.log('\nCreating missing reference rows...');
      for (const table of ['teachers', 'subjects', 'classes', 'rooms']) {
        for (const name of missing[table]) {
          await ensureNamedEntity(client, table, name, dbMaps[table]);
        }
      }

      console.log('\nAssigning curators to imported classes...');
      await syncCurators(client, dbMaps.classes, [...required.classes]);

      console.log('\nReplacing lessons...');
      await client.query('DELETE FROM lessons');

      const insertSql = `
        INSERT INTO lessons (teacher_id, day, period, subject_id, class_id, room_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (teacher_id, day, period, class_id)
        DO UPDATE SET subject_id = EXCLUDED.subject_id, room_id = EXCLUDED.room_id
      `;

      let inserted = 0;
      for (const lesson of logicalLessons) {
        const teacherId = dbMaps.teachers.get(normalizeName(lesson.teacherName)).id;
        const subjectId = dbMaps.subjects.get(normalizeName(lesson.subjectName)).id;
        const classId = dbMaps.classes.get(normalizeName(lesson.className)).id;
        const roomId = dbMaps.rooms.get(normalizeName(lesson.roomName)).id;

        await client.query(insertSql, [
          teacherId,
          lesson.day,
          lesson.period,
          subjectId,
          classId,
          roomId,
        ]);
        inserted++;
      }

      await client.query('COMMIT');
      console.log(`\n✅ Import complete. ${inserted} lesson rows imported.`);
      console.log(`Unplaced source cards skipped: ${built.unplacedCards.length}`);
      console.log(`Roomless source cards: ${built.roomlessCards.length}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\n❌ Import failed:', err.message);
  process.exitCode = 1;
});
