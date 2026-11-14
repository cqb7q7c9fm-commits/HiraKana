// Session logic check: proves the kana table and buildSession() keep their invariants.
// Zero dependencies on purpose. Imports the .ts sources directly via Node type stripping: node scripts/check-session.mjs
import { KANA, KANA_GROUPS } from "../src/lib/kana.ts";
import { buildGroupMastery, strengthOf } from "../src/lib/mastery.ts";
import { buildSession, MAX_REPEATS, OPTION_COUNT, SESSION_LENGTH, weightOf } from "../src/lib/services/session.ts";

const ITERATIONS = 500;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

// mulberry32: small deterministic PRNG.
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Kana table
assert(KANA.length === 71, `KANA must have 71 rows, got ${KANA.length}`);
for (const key of ["romaji", "hiragana", "katakana"]) {
  const values = KANA.map((e) => e[key]);
  assert(
    values.every((v) => typeof v === "string" && v.length > 0),
    `KANA.${key} has an empty value`,
  );
  assert(new Set(values).size === KANA.length, `KANA.${key} values are not unique`);
}
// Pairing: each katakana is its hiragana shifted by 0x60 code points (U+3042 あ -> U+30A2 ア).
for (const e of KANA) {
  assert(
    e.katakana.codePointAt(0) === e.hiragana.codePointAt(0) + 0x60,
    `KANA pairing mismatch for "${e.romaji}": ${e.hiragana} / ${e.katakana}`,
  );
}

// Groups: 13 groups, every character in exactly one, each with at least 5 members.
assert(KANA_GROUPS.length === 13, `KANA_GROUPS must have 13 groups, got ${KANA_GROUPS.length}`);
assert(new Set(KANA_GROUPS.map((g) => g.id)).size === KANA_GROUPS.length, "KANA_GROUPS ids are not unique");
for (const e of KANA) {
  const owners = KANA_GROUPS.filter((g) => g.members.includes(e.romaji));
  assert(owners.length === 1, `"${e.romaji}" must be in exactly one group, found ${owners.length}`);
  assert(owners[0].id === e.group, `"${e.romaji}" has group "${e.group}" but is listed in "${owners[0].id}"`);
}
for (const g of KANA_GROUPS) {
  assert(g.members.length >= 5, `group "${g.id}" has ${g.members.length} members, expected at least 5`);
  assert(
    g.members.every((m) => KANA.some((e) => e.romaji === m && e.group === g.id)),
    `group "${g.id}" lists a member that is not in KANA with that group`,
  );
}
assert(
  KANA_GROUPS.reduce((sum, g) => sum + g.members.length, 0) === KANA.length,
  "group members do not add up to the KANA length",
);

// Session
const alphabets = ["hiragana", "katakana"];
const directions = ["kana-to-romaji", "romaji-to-kana"];
const sources = [
  ["Math.random", () => Math.random],
  ["seeded", (i) => seeded(i + 1)],
];
let checked = 0;

for (const alphabet of alphabets) {
  for (const direction of directions) {
    for (const [sourceName, makeRandom] of sources) {
      for (let i = 0; i < ITERATIONS; i++) {
        const ctx = `${alphabet}/${direction}/${sourceName}#${i}`;
        const session = buildSession(KANA, alphabet, direction, makeRandom(i));
        assert(
          session.length === SESSION_LENGTH,
          `${ctx}: expected ${SESSION_LENGTH} questions, got ${session.length}`,
        );
        assert(
          new Set(session.map((q) => q.entry)).size === SESSION_LENGTH,
          `${ctx}: questions are not about distinct entries`,
        );
        for (const q of session) {
          const kana = q.entry[alphabet];
          const expectedPrompt = direction === "kana-to-romaji" ? kana : q.entry.romaji;
          const expectedAnswer = direction === "kana-to-romaji" ? q.entry.romaji : kana;
          const pool = new Set(KANA.map((e) => (direction === "kana-to-romaji" ? e.romaji : e[alphabet])));
          assert(KANA.includes(q.entry), `${ctx}: entry is not from KANA`);
          assert(q.prompt === expectedPrompt, `${ctx}: wrong prompt "${q.prompt}", expected "${expectedPrompt}"`);
          assert(
            q.options.length === OPTION_COUNT,
            `${ctx}: expected ${OPTION_COUNT} options, got ${q.options.length}`,
          );
          assert(new Set(q.options).size === OPTION_COUNT, `${ctx}: options are not unique: ${q.options.join(",")}`);
          assert(
            Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < OPTION_COUNT,
            `${ctx}: correctIndex out of range`,
          );
          assert(
            q.options[q.correctIndex] === expectedAnswer,
            `${ctx}: options[correctIndex] is not the correct answer`,
          );
          assert(
            q.options.every((o) => pool.has(o)),
            `${ctx}: option outside the chosen alphabet/direction`,
          );
          const distractors = q.options.filter((_, idx) => idx !== q.correctIndex);
          assert(!distractors.includes(expectedAnswer), `${ctx}: a distractor equals the correct answer`);
        }
        checked++;
      }
    }
  }
}

// Correct position must vary (not always the same slot).
const positions = new Set();
for (let i = 0; i < 50; i++) {
  for (const q of buildSession(KANA, "hiragana", "kana-to-romaji", seeded(i + 1))) positions.add(q.correctIndex);
}
assert(positions.size === OPTION_COUNT, `correct position is not random enough: ${[...positions].join(",")}`);

// Too few entries must throw.
let threw = false;
try {
  buildSession(KANA.slice(0, OPTION_COUNT - 1), "hiragana", "kana-to-romaji");
} catch {
  threw = true;
}
assert(threw, "buildSession must throw for fewer entries than OPTION_COUNT");

// Unknown group must throw.
threw = false;
try {
  buildSession(KANA, "hiragana", "kana-to-romaji", Math.random, new Map(), "nope");
} catch {
  threw = true;
}
assert(threw, "buildSession must throw for an unknown group");

// Weighted selection.
assert(weightOf(undefined) === 1, "weightOf(undefined) must be 1");
assert(weightOf({ romaji: "a", answers: 5, errors: 5 }) === 4, "weightOf with errors === answers must be 4");
assert(weightOf({ romaji: "a", answers: 5, errors: 0 }) === 1, "weightOf with errors 0 must be 1");
assert(weightOf({ romaji: "a", answers: 0, errors: 0 }) === 1, "weightOf with answers 0 must be 1");
assert(weightOf({ romaji: "a", answers: 4, errors: 2 }) === 2.5, "weightOf with half errors must be 2.5");

const emptyStats = new Map();
const hot = KANA[0].romaji;
const cold = KANA[1].romaji;
const hotStats = new Map([
  [hot, { romaji: hot, answers: 5, errors: 5 }],
  [cold, { romaji: cold, answers: 5, errors: 0 }],
]);
// Several errored characters to stress adjacent-duplicate avoidance.
const manyHotStats = new Map(KANA.slice(0, 4).map((e) => [e.romaji, { romaji: e.romaji, answers: 5, errors: 5 }]));

const hasAdjacentDuplicates = (session) => session.some((q, idx) => idx > 0 && session[idx - 1].entry === q.entry);
const countOf = (session, romaji) => session.filter((q) => q.entry.romaji === romaji).length;

let hotTotal = 0;
let coldTotal = 0;
for (let i = 0; i < ITERATIONS; i++) {
  // (a) empty map keeps the unweighted guarantees
  const plain = buildSession(KANA, "hiragana", "kana-to-romaji", seeded(i + 1), emptyStats);
  assert(plain.length === SESSION_LENGTH, `empty stats#${i}: wrong session length`);
  assert(new Set(plain.map((q) => q.entry)).size === SESSION_LENGTH, `empty stats#${i}: entries are not distinct`);

  // (b) + (c)
  const session = buildSession(KANA, "hiragana", "kana-to-romaji", seeded(i + 1), hotStats);
  assert(session.length === SESSION_LENGTH, `hot stats#${i}: wrong session length`);
  assert(countOf(session, hot) <= MAX_REPEATS, `hot stats#${i}: errored char exceeds ${MAX_REPEATS} repeats`);
  assert(countOf(session, cold) <= 1, `hot stats#${i}: error-free char appears more than once`);
  hotTotal += countOf(session, hot);
  coldTotal += countOf(session, cold);

  // (d)
  for (const stats of [emptyStats, hotStats, manyHotStats]) {
    const s = buildSession(KANA, "katakana", "romaji-to-kana", seeded(i + 1), stats);
    assert(s.length === SESSION_LENGTH, `stress#${i}: wrong session length`);
    assert(!hasAdjacentDuplicates(s), `stress#${i}: adjacent duplicate questions`);
  }
  const many = buildSession(KANA, "hiragana", "kana-to-romaji", seeded(i + 1), manyHotStats);
  for (const e of KANA) {
    const max = manyHotStats.has(e.romaji) ? MAX_REPEATS : 1;
    assert(countOf(many, e.romaji) <= max, `many hot#${i}: "${e.romaji}" exceeds its repeat limit`);
  }
}
assert(
  hotTotal >= 2 * coldTotal,
  `errored char should appear >= 2x as often as an error-free one (${hotTotal} vs ${coldTotal})`,
);
assert(hotTotal > 0, "errored char never appeared");

// Group sessions: every group in 4 modes, both random sources, without and with error stats.
let groupChecked = 0;
for (const g of KANA_GROUPS) {
  const n = g.members.length;
  const plainCap = Math.ceil(SESSION_LENGTH / n);
  const gHot = g.members[0];
  const gCold = g.members[1];
  const gStats = new Map([
    [gHot, { romaji: gHot, answers: 5, errors: 5 }],
    [gCold, { romaji: gCold, answers: 5, errors: 0 }],
  ]);
  let gHotTotal = 0;
  let gColdTotal = 0;
  for (const alphabet of alphabets) {
    for (const direction of directions) {
      const pool = new Set(KANA.map((e) => (direction === "kana-to-romaji" ? e.romaji : e[alphabet])));
      const groupAnswers = new Set(
        KANA.filter((e) => e.group === g.id).map((e) => (direction === "kana-to-romaji" ? e.romaji : e[alphabet])),
      );
      for (const [sourceName, makeRandom] of sources) {
        for (let i = 0; i < 100; i++) {
          for (const [statsName, stats] of [
            ["no stats", new Map()],
            ["stats", gStats],
          ]) {
            const ctx = `group ${g.id}/${alphabet}/${direction}/${sourceName}/${statsName}#${i}`;
            const session = buildSession(KANA, alphabet, direction, makeRandom(i), stats, g.id);
            assert(session.length === SESSION_LENGTH, `${ctx}: wrong session length ${session.length}`);
            assert(
              session.every((q) => q.entry.group === g.id),
              `${ctx}: target outside the group`,
            );
            for (const m of g.members) {
              const errored = stats.has(m) && stats.get(m).errors > 0;
              const max = errored ? MAX_REPEATS : plainCap;
              assert(countOf(session, m) <= max, `${ctx}: "${m}" exceeds its repeat limit ${max}`);
            }
            if (statsName === "no stats") {
              if (n === 5) {
                for (const m of g.members)
                  assert(countOf(session, m) === 2, `${ctx}: "${m}" must appear exactly 2 times`);
              }
              if (g.id === "zd") {
                assert(
                  new Set(session.map((q) => q.entry)).size === SESSION_LENGTH,
                  `${ctx}: targets are not distinct`,
                );
                assert(!hasAdjacentDuplicates(session), `${ctx}: adjacent duplicate questions`);
              }
            } else {
              gHotTotal += countOf(session, gHot);
              gColdTotal += countOf(session, gCold);
            }
            for (const q of session) {
              const kana = q.entry[alphabet];
              const expectedAnswer = direction === "kana-to-romaji" ? q.entry.romaji : kana;
              assert(q.options.length === OPTION_COUNT, `${ctx}: wrong option count`);
              assert(new Set(q.options).size === OPTION_COUNT, `${ctx}: options are not unique`);
              assert(q.options[q.correctIndex] === expectedAnswer, `${ctx}: options[correctIndex] is not the answer`);
              assert(
                q.options.every((o) => pool.has(o)),
                `${ctx}: option outside the chosen alphabet/direction`,
              );
              assert(
                q.options.every((o) => groupAnswers.has(o)),
                `${ctx}: option outside the group (distractors must come from the group)`,
              );
            }
            groupChecked++;
          }
        }
      }
    }
  }
  assert(
    gHotTotal > gColdTotal,
    `group ${g.id}: errored char should appear more often (${gHotTotal} vs ${gColdTotal})`,
  );
}

// Without a group, distractors still come from the whole alphabet (more than one group's worth of options overall).
const wide = new Set();
for (let i = 0; i < 50; i++) {
  for (const q of buildSession(KANA, "hiragana", "kana-to-romaji", seeded(i + 1))) {
    for (const o of q.options) wide.add(o);
  }
}
assert(wide.size > 10, "without a group, distractors must come from the whole alphabet");

// Mastery: per-character strength thresholds.
const st = (answers, errors) => ({ romaji: "a", answers, errors });
assert(strengthOf(st(1, 0)) === "new", "1/1 correct must be new");
assert(strengthOf(st(2, 0)) === "new", "2/2 correct must be new");
assert(strengthOf(st(3, 0)) === "strong", "3/3 correct must be strong");
assert(strengthOf(st(5, 1)) === "strong", "4/5 correct (80%) must be strong");
assert(strengthOf(st(5, 2)) === "medium", "3/5 correct (60%) must be medium");
assert(strengthOf(st(5, 3)) === "medium", "2/5 correct (40%) must be medium");
assert(strengthOf(st(5, 4)) === "weak", "1/5 correct (20%) must be weak");
assert(strengthOf(st(3, 3)) === "weak", "0/3 correct must be weak");
assert(strengthOf(undefined) === "new", "no stat must be new");

// Mastery: group aggregation.
const statsFor = (romajis, answers, errors) => romajis.map((romaji) => ({ romaji, answers, errors }));
const kMembers = KANA_GROUPS.find((g) => g.id === "k").members;
const kOf = (stats) => buildGroupMastery(stats).find((g) => g.id === "k");

const allStrong = kOf(statsFor(kMembers, 5, 0));
assert(allStrong.strength === "strong" && allStrong.mastered, "all-strong group must be strong and mastered");
assert(allStrong.strongCount === kMembers.length, "all-strong group must count every member as strong");

const fourStrongOneNew = kOf(statsFor(kMembers.slice(0, 4), 5, 0));
assert(
  fourStrongOneNew.strength === "new" && !fourStrongOneNew.mastered,
  "4 strong + 1 new must be new and not mastered",
);
assert(fourStrongOneNew.strongCount === 4, "4 strong + 1 new must have strongCount 4");

const strongPlusWeak = kOf([...statsFor(kMembers.slice(0, 4), 5, 0), ...statsFor(kMembers.slice(4), 5, 4)]);
assert(strongPlusWeak.strength === "weak" && !strongPlusWeak.mastered, "strong + one weak must be weak");

const strongPlusMedium = kOf([...statsFor(kMembers.slice(0, 4), 5, 0), ...statsFor(kMembers.slice(4), 5, 2)]);
assert(strongPlusMedium.strength === "medium", "one medium + rest strong must be medium");

const noData = buildGroupMastery([]);
assert(
  noData.every((g) => g.strength === "new" && g.strongCount === 0 && !g.mastered),
  "no data must give new groups with strongCount 0",
);
assert(noData.length === KANA_GROUPS.length, "buildGroupMastery must return one entry per group");
assert(
  noData.every((g, idx) => g.id === KANA_GROUPS[idx].id && g.label === KANA_GROUPS[idx].label),
  "buildGroupMastery must keep KANA_GROUPS order",
);
assert(
  noData.reduce((sum, g) => sum + g.chars.length, 0) === KANA.length,
  "chars across mastery groups must add up to KANA.length",
);
const ignored = buildGroupMastery([{ romaji: "zzz", answers: 9, errors: 9 }]);
assert(
  ignored.every((g) => g.strength === "new"),
  "stats for romaji outside KANA must be ignored",
);

console.log(
  `PASS: ${KANA.length} kana rows, ${checked} sessions checked (4 modes x 2 random sources x ${ITERATIONS}), ${groupChecked} group sessions, weighted selection (errored ${hotTotal} vs error-free ${coldTotal} appearances over ${ITERATIONS} sessions), mastery strength and group aggregation`,
);
