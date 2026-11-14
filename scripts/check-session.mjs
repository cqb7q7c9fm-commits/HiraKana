// Session logic check: proves the kana table and buildSession() keep their invariants.
// Zero dependencies on purpose. Imports the .ts sources directly via Node type stripping: node scripts/check-session.mjs
import { KANA, KANA_GROUPS } from "../src/lib/kana.ts";
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
  buildSession(KANA.slice(0, 5), "hiragana", "kana-to-romaji");
} catch {
  threw = true;
}
assert(threw, "buildSession must throw for too few entries");

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

console.log(
  `PASS: ${KANA.length} kana rows, ${checked} sessions checked (4 modes x 2 random sources x ${ITERATIONS}), weighted selection (errored ${hotTotal} vs error-free ${coldTotal} appearances over ${ITERATIONS} sessions)`,
);
