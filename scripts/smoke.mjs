// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const password = "Smoke-Test-Passw0rd!";
const emailA = `smoke-a-${Date.now()}@example.com`;
const emailB = `smoke-b-${Date.now()}@example.com`;

// Each client owns its cookie jar, so several accounts can be signed in at the same time.
function createClient() {
  const jar = new Map();

  function cookieHeader() {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  function storeCookies(response) {
    for (const raw of response.headers.getSetCookie()) {
      const [pair, ...attrs] = raw.split(";");
      const [name, ...rest] = pair.split("=");
      const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
      if (expired) jar.delete(name.trim());
      else jar.set(name.trim(), rest.join("="));
    }
  }

  async function request(path, { method = "GET", form, json } = {}) {
    const response = await fetch(BASE_URL + path, {
      method,
      redirect: "manual",
      headers: {
        Cookie: cookieHeader(),
        Origin: BASE_URL,
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : json !== undefined ? JSON.stringify(json) : undefined,
    });
    storeCookies(response);
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    return { status: response.status, location: response.headers.get("location") ?? "", body };
  }

  return { request };
}

const anon = createClient();
const userA = createClient();
const userB = createClient();
const request = userA.request;

const api = "/api/practice/sessions";
const statsApi = "/api/practice/stats";
const statOf = (body, romaji) => (Array.isArray(body) ? body.find((s) => s.romaji === romaji) : undefined);
let windowSessionId = "";
let dakutenSessionId = "";
// 7 answers for "ha": the 2 oldest wrong, the 5 newest correct -> the window must cover only the 5 newest.
const windowAnswers = [false, false, true, true, true, true, true];
let sessionId = "";
const answer = (position, romaji, isCorrect) => ({ position, romaji, isCorrect });

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["practice redirects anonymous user", () => request("/practice"), { status: 302, location: "/auth/signin" }],
  [
    "signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email: emailA, password } }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email: emailA, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email: emailA, password } }),
    { status: 302, location: "/" },
  ],
  ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 200 }],
  ["practice renders for signed-in user", () => request("/practice"), { status: 200 }],
  [
    "anonymous cannot create a session",
    () => anon.request(api, { method: "POST", json: { alphabet: "hiragana", direction: "kana-to-romaji", total: 3 } }),
    { status: 401 },
  ],
  [
    "user A rejects an invalid session body",
    () => userA.request(api, { method: "POST", json: { alphabet: "latin", direction: "kana-to-romaji", total: 3 } }),
    { status: 400 },
  ],
  [
    "user A creates a session",
    async () => {
      const result = await userA.request(api, {
        method: "POST",
        json: { alphabet: "hiragana", direction: "kana-to-romaji", total: 3 },
      });
      sessionId = result.body?.id ?? "";
      return result;
    },
    { status: 201, body: (b) => typeof b?.id === "string" && b.id.length > 0 },
  ],
  [
    "user A saves answer 0",
    () => userA.request(`${api}/${sessionId}/answers`, { method: "POST", json: answer(0, "a", true) }),
    { status: 200 },
  ],
  [
    "user A saves answer 1 (wrong)",
    () => userA.request(`${api}/${sessionId}/answers`, { method: "POST", json: answer(1, "ki", false) }),
    { status: 200 },
  ],
  [
    "user A retries answer 1 idempotently",
    () => userA.request(`${api}/${sessionId}/answers`, { method: "POST", json: answer(1, "ki", false) }),
    { status: 200 },
  ],
  [
    "user A rejects unknown romaji",
    () => userA.request(`${api}/${sessionId}/answers`, { method: "POST", json: answer(2, "xyz", true) }),
    { status: 400 },
  ],
  [
    "user A rejects position out of range",
    () => userA.request(`${api}/${sessionId}/answers`, { method: "POST", json: answer(3, "su", true) }),
    { status: 400 },
  ],
  [
    "complete before all answers is 409 with one missing",
    () => userA.request(`${api}/${sessionId}/complete`, { method: "POST" }),
    { status: 409, body: (b) => b?.missing === 1 },
  ],
  [
    "user A saves answer 2",
    () => userA.request(`${api}/${sessionId}/answers`, { method: "POST", json: answer(2, "su", true) }),
    { status: 200 },
  ],
  [
    "complete returns score and mistakes",
    () => userA.request(`${api}/${sessionId}/complete`, { method: "POST" }),
    {
      status: 200,
      body: (b) =>
        b?.session?.score === 2 &&
        b.session.total === 3 &&
        b.session.completedAt !== null &&
        JSON.stringify(b.mistakes) === JSON.stringify(["ki"]),
    },
  ],
  [
    "complete again returns the same result",
    () => userA.request(`${api}/${sessionId}/complete`, { method: "POST" }),
    { status: 200, body: (b) => b?.session?.score === 2 && JSON.stringify(b.mistakes) === JSON.stringify(["ki"]) },
  ],
  [
    "user A reads own session",
    () => userA.request(`${api}/${sessionId}`),
    { status: 200, body: (b) => b?.session?.id === sessionId && b.session.score === 2 },
  ],
  [
    "user A lists the completed session",
    () => userA.request(api),
    { status: 200, body: (b) => Array.isArray(b) && b.some((s) => s.id === sessionId) },
  ],
  ["anonymous cannot read stats", () => anon.request(statsApi), { status: 401 }],
  [
    "user A stats reflect the saved answers",
    () => userA.request(statsApi),
    {
      status: 200,
      body: (b) =>
        statOf(b, "ki")?.answers === 1 &&
        statOf(b, "ki").errors === 1 &&
        statOf(b, "a")?.answers === 1 &&
        statOf(b, "a").errors === 0 &&
        statOf(b, "su")?.answers === 1 &&
        statOf(b, "su").errors === 0,
    },
  ],
  [
    "user A creates a session for the stats window",
    async () => {
      const result = await userA.request(api, {
        method: "POST",
        json: { alphabet: "hiragana", direction: "kana-to-romaji", total: windowAnswers.length },
      });
      windowSessionId = result.body?.id ?? "";
      return result;
    },
    { status: 201 },
  ],
  ...windowAnswers.map((isCorrect, position) => [
    `user A saves window answer ${position} for "ha"`,
    () =>
      userA.request(`${api}/${windowSessionId}/answers`, { method: "POST", json: answer(position, "ha", isCorrect) }),
    { status: 200 },
  ]),
  [
    "user A stats window covers only the 5 most recent answers",
    () => userA.request(statsApi),
    { status: 200, body: (b) => statOf(b, "ha")?.answers === 5 && statOf(b, "ha").errors === 0 },
  ],
  [
    "user A creates a session for a dakuten character",
    async () => {
      const result = await userA.request(api, {
        method: "POST",
        json: { alphabet: "hiragana", direction: "kana-to-romaji", total: 1 },
      });
      dakutenSessionId = result.body?.id ?? "";
      return result;
    },
    { status: 201 },
  ],
  [
    "user A saves an answer for a dakuten character",
    () => userA.request(`${api}/${dakutenSessionId}/answers`, { method: "POST", json: answer(0, "di", true) }),
    { status: 200 },
  ],
  [
    "user A stats include the stored dakuten answer",
    () => userA.request(statsApi),
    { status: 200, body: (b) => statOf(b, "di")?.answers === 1 && statOf(b, "di").errors === 0 },
  ],
  [
    "user B signup creates account",
    () => userB.request("/api/auth/signup", { method: "POST", form: { email: emailB, password } }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "user B signin accepts correct password",
    () => userB.request("/api/auth/signin", { method: "POST", form: { email: emailB, password } }),
    { status: 302, location: "/" },
  ],
  ["user B cannot read A's session (RLS)", () => userB.request(`${api}/${sessionId}`), { status: 404 }],
  [
    "user B cannot write answers to A's session (RLS)",
    () => userB.request(`${api}/${sessionId}/answers`, { method: "POST", json: answer(0, "a", true) }),
    { status: 404 },
  ],
  [
    "user B cannot complete A's session (RLS)",
    () => userB.request(`${api}/${sessionId}/complete`, { method: "POST" }),
    { status: 404 },
  ],
  [
    "user B does not see A's session in the list",
    () => userB.request(api),
    { status: 200, body: (b) => Array.isArray(b) && b.length === 0 },
  ],
  [
    "user B does not see A's stats",
    () => userB.request(statsApi),
    { status: 200, body: (b) => Array.isArray(b) && b.length === 0 },
  ],
  ["results redirects anonymous user", () => anon.request("/results"), { status: 302, location: "/auth/signin" }],
  ["results renders for signed-in user", () => userA.request("/results"), { status: 200 }],
  ["user A opens own result detail", () => userA.request(`/results/${sessionId}`), { status: 200 }],
  ["user B cannot open A's result detail", () => userB.request(`/results/${sessionId}`), { status: 404 }],
  ["unknown result id is 404", () => userA.request("/results/not-a-session"), { status: 404 }],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined || actual.location.startsWith(expected.location)) &&
    (expected.body === undefined || expected.body(actual.body));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}${expected.body ? " (body check)" : ""}`);
    if (actual.body !== undefined) console.log(`      body ${JSON.stringify(actual.body)}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
