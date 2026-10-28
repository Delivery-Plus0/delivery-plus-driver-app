#!/usr/bin/env node
// Runs the driver app's Maestro suites against the isolated E2E backend (delivery-plus:
// `npm run e2e:env:reset`). Same runner design as the customer app; see e2e/README.md.
//
//   node e2e/scripts/run.mjs --suite smoke|business|all [--build] [--headless]
//
// Env: E2E_API_URL (http://localhost:3100), E2E_WEB_PORT (8084), E2E_CONTROL_PORT (8091),
//      E2E_MANIFEST (../delivery-plus/e2e-seed-manifest.json), MAESTRO_BIN (maestro),
//      E2E_COMPOSE_PROJECT (delivery-plus-e2e)
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = resolve(E2E_DIR, '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const suite = option('suite', 'smoke');
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3100';
// Different default ports from the customer app's runner, so both suites can run on one machine.
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 8084);
const CONTROL_PORT = Number(process.env.E2E_CONTROL_PORT ?? 8091);
const APP_URL = `http://localhost:${WEB_PORT}`;
const CONTROL_URL = `http://localhost:${CONTROL_PORT}`;
const MANIFEST = resolve(process.env.E2E_MANIFEST ?? join(APP_DIR, '..', 'delivery-plus', 'e2e-seed-manifest.json'));
const MAESTRO = process.env.MAESTRO_BIN ?? 'maestro';
const PROJECT = process.env.E2E_COMPOSE_PROJECT ?? 'delivery-plus-e2e';
const WEB_BUILD = join(E2E_DIR, '.web-build');
const SCREEN_SIZE = process.env.E2E_SCREEN_SIZE ?? '430x1600';
const ARTIFACTS = join(E2E_DIR, '.artifacts', suite);
const FIXED_LOCATION = { latitude: 30.0444, longitude: 31.2357 };

const SUITES = {
  smoke: [
    'smoke/01-sign-in.yaml',
    'smoke/02-online-offline.yaml',
    'smoke/03-new-driver-registers-vehicle.yaml',
    'smoke/04-tabs-and-profile.yaml',
    'smoke/05-profile-edit.yaml',
    'smoke/06-arabic.yaml',
    'smoke/07-change-password.yaml',
    'smoke/08-forgot-password.yaml',
  ],
  business: ['business/deliver-an-order.yaml'],
  // #34: needs the stack's access tokens at 60 s (JWT_EXPIRES_IN=60s), so it is not part of `all`.
  session: ['session/stay-signed-in.yaml', 'session/sign-out.yaml'],
  // #58: needs EMAIL_VERIFICATION_REQUIRED=true on auth-service (backend #252), so it is not part of `all`.
  verification: ['verification/sign-up.yaml', 'verification/unverified-sign-in.yaml'],
};
// #44: the two password flows on their own (they are in smoke too); they need no seed data.
SUITES.password = ['smoke/07-change-password.yaml', 'smoke/08-forgot-password.yaml'];
SUITES.all = [...SUITES.smoke, ...SUITES.business];

/** The session suite proves refreshes only with short tokens; refuse a stack that issues long ones. */
const SESSION_MAX_TOKEN_SECONDS = 90;

if (!SUITES[suite]) {
  console.error(`Unknown suite "${suite}". Use one of: ${Object.keys(SUITES).join(', ')}`);
  process.exit(2);
}
if (!existsSync(MANIFEST)) {
  console.error(`No seed manifest at ${MANIFEST}. Run \`npm run e2e:env:reset\` in delivery-plus first.`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

// ---------------------------------------------------------------------------------------------
// Gateway client used by the control server (customer/restaurant stand-ins, driver reset).
// ---------------------------------------------------------------------------------------------

/**
 * fetch reuses pooled keep-alive connections. When the runner is idle longer than the gateway's
 * keep-alive timeout (slow fixtures), the next request can land on a socket the server already closed
 * (UND_ERR_SOCKET, nothing was sent), and fetch retries only idempotent methods. Retry once on exactly
 * that error.
 */
async function fetchRetryingClosedSocket(url, init) {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (error?.cause?.code !== 'UND_ERR_SOCKET') throw error;
    return fetch(url, init);
  }
}

async function api(method, path, token, body) {
  const res = await fetchRetryingClosedSocket(API_URL + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return data;
}

/** Fails the session suite unless the stack's access tokens expire within SESSION_MAX_TOKEN_SECONDS. */
async function requireShortAccessTokens() {
  resetRateLimits();
  const auth = await api('POST', '/api/auth/login', null, { email: manifest.accounts.driver.email, password: manifest.password });
  const seconds = Math.round((Date.parse(auth.accessTokenExpiresAt) - Date.now()) / 1000);
  if (!auth.refreshToken || !(seconds <= SESSION_MAX_TOKEN_SECONDS)) {
    throw new Error(
      `The session suite needs refresh tokens and access tokens of ${SESSION_MAX_TOKEN_SECONDS} s or less (this stack: ${Number.isFinite(seconds) ? `${seconds} s` : 'unknown'}). ` +
        'Start the backend with `JWT_EXPIRES_IN=60s npm run e2e:env:up` (delivery-plus#244).',
    );
  }
  await api('POST', '/api/auth/logout', null, { refreshToken: auth.refreshToken }).catch(() => undefined);
  console.log(`Session suite: access tokens last ${seconds} s.`);
}

async function login(email) {
  resetRateLimits();
  return (await api('POST', '/api/auth/login', null, { email, password: manifest.password })).accessToken;
}

/**
 * The verification suite needs the stack to require email verification: a new account must get no
 * tokens. Refuse a stack where it is off rather than pass without testing the code screen.
 */
async function requireEmailVerification() {
  resetRateLimits();
  const probe = await api('POST', '/api/auth/register', null, {
    email: `e2e.verify-probe.${Date.now()}@example.com`,
    password: manifest.password,
    fullName: 'E2E Verify Probe',
    role: 'DRIVER',
  });
  if (probe?.verificationRequired !== true) {
    if (probe?.refreshToken) await api('POST', '/api/auth/logout', null, { refreshToken: probe.refreshToken }).catch(() => undefined);
    throw new Error(
      'The verification suite needs email verification on. Restart auth-service with `EMAIL_VERIFICATION_REQUIRED=true` ' +
        '(docker compose -p delivery-plus-e2e … up -d --no-deps auth-service; delivery-plus#252).',
    );
  }
  console.log('Verification suite: new accounts wait for their email code.');
}

/** The code the test email sender (EMAIL_PROVIDER=test) kept for `email`; never sent anywhere. */
function readEmailCode(email) {
  const stored = execFileSync('docker', ['exec', container('redis'), 'redis-cli', 'GET', `test:email:${email}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const code = stored ? /\b(\d{6})\b/.exec(JSON.parse(stored).text ?? '')?.[1] : undefined;
  if (!code) throw new Error(`No verification email was sent to ${email}`);
  return code;
}

const state = { orderId: null };

async function waitForOrderStatus(orderId, token, status, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const order = await api('GET', `/api/orders/${orderId}`, token);
    if (order.status === status) return order;
    if (Date.now() > deadline) throw new Error(`Order ${orderId} did not reach ${status} (last ${order.status})`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

const DRIVER_STEPS = ['pickup', 'start', 'complete'];

/** Completes whatever delivery the QA driver is still on (e.g. after a failed flow). Returns the driver token. */
async function finishLeftoverDelivery() {
  const driver = await login(manifest.accounts.driver.email);
  const current = await api('GET', '/api/deliveries/me/current', driver);
  const first = current?.nextActions[0];
  if (first) {
    for (const action of DRIVER_STEPS.slice(DRIVER_STEPS.indexOf(first))) {
      await api('POST', `/api/deliveries/${current.id}/${action}`, driver, {});
    }
  }
  return driver;
}

/**
 * After the suite: the seed's default state, a free and AVAILABLE QA driver. The customer app's
 * business flow shares this E2E stack and relies on it.
 */
async function restoreSeedDriverState() {
  const driver = await finishLeftoverDelivery();
  await restoreSeedProfile(driver);
  await api('POST', '/api/drivers/me/online', driver, {});
}

/**
 * The seed's QA driver profile (#147): name, no phone, no photo, Bicycle QA-0001. The vehicle only
 * changes while offline, so this goes offline first; callers put the driver back online if needed.
 */
async function restoreSeedProfile(driver) {
  await api('PATCH', '/api/users/me', driver, { fullName: manifest.accounts.driver.fullName, phone: '' });
  await api('DELETE', '/api/users/me/avatar', driver);
  // #153: no codes left from earlier runs, so the hourly send limit never trips (test stack only).
  const account = await api('GET', '/api/users/me', driver);
  docker('exec', container('postgres'), 'psql', '-U', 'postgres', '-d', 'user_service', '-c', `delete from phone_verifications where "userId" = '${account.id}'`);
  const me = await api('GET', '/api/drivers/me', driver);
  if (me.vehicleType !== 'Bicycle' || me.licensePlate !== manifest.accounts.driver.plate) {
    if (me.status === 'AVAILABLE') await api('POST', '/api/drivers/me/offline', driver, {});
    await api('PATCH', '/api/drivers/me/vehicle', driver, { vehicleType: 'Bicycle', licensePlate: manifest.accounts.driver.plate });
  }
}

function container(service) {
  return `${PROJECT}-${service}-1`;
}

function docker(...cmd) {
  return execFileSync('docker', cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** E2E stack only: clear rate-limit counters so repeated sign-ins across flows don't 429. */
function resetRateLimits() {
  docker(
    'exec',
    container('redis'),
    'redis-cli',
    'EVAL',
    "for _,k in ipairs(redis.call('KEYS','ratelimit:*')) do redis.call('DEL',k) end return 1",
    '0',
  );
}

const actions = {
  // Password flows (#44, backend #35): a fresh DRIVER whose phone is verified (straight in
  // user-service's table, test stack only), so the flows never change the QA driver's password.
  'password/new-account': async () => {
    resetRateLimits();
    const stamp = Date.now();
    state.newEmail = `e2e.password.${stamp}@example.com`;
    state.newPhone = `011${String(stamp).slice(-8)}`; // as a person types it
    state.newPassword = 'E2e-New-Passw0rd!';
    const auth = await api('POST', '/api/auth/register', null, { email: state.newEmail, password: manifest.password, fullName: 'E2E Password', phone: state.newPhone, role: 'DRIVER' });
    if (!auth?.accessToken) throw new Error('Registering did not sign in: the password flows need EMAIL_VERIFICATION_REQUIRED off');
    const me = await api('GET', '/api/users/me', auth.accessToken);
    if (!/^[0-9a-f-]{36}$/i.test(me.id) || me.phone !== `+20${state.newPhone.slice(1)}`) throw new Error(`Unexpected profile ${me.id} ${me.phone}`);
    docker('exec', container('postgres'), 'psql', '-U', 'postgres', '-d', 'user_service', '-c', `update user_profiles set "phoneVerifiedAt" = now() where id = '${me.id}'`);
    await api('POST', '/api/auth/logout', null, { refreshToken: auth.refreshToken }).catch(() => undefined);
  },
  // The reset code the test SMS sender (SMS_PROVIDER=test) kept for that phone, and a wrong one. It is
  // texted after the answer (user-service sends in the background), so wait for it briefly.
  'password/read-reset-code': async () => {
    const phone = `+20${state.newPhone.slice(1)}`;
    const deadline = Date.now() + 10_000;
    for (;;) {
      const code = /(\d{6})/.exec(docker('exec', container('redis'), 'redis-cli', 'GET', `test:sms:${phone}`).trim())?.[1];
      if (code) {
        state.code = code;
        state.wrongCode = code === '000000' ? '111111' : '000000';
        return;
      }
      if (Date.now() > deadline) throw new Error(`No reset code was texted to ${phone}`);
      await new Promise((r) => setTimeout(r, 250));
    }
  },
  // Verification suite (#58): a fresh address for this flow, never used before.
  'verification/new-email': async () => {
    state.newEmail = `e2e.code.${Date.now()}@example.com`;
  },
  // A DRIVER account for state.newEmail that waits for its code (registered through the API; no tokens).
  'verification/register-unverified': async () => {
    const pending = await api('POST', '/api/auth/register', null, { email: state.newEmail, password: manifest.password, fullName: 'E2E Code', role: 'DRIVER' });
    if (pending?.verificationRequired !== true) throw new Error(`Registering ${state.newEmail} did not wait for verification`);
  },
  // The latest code emailed to state.newEmail, and a wrong one.
  'verification/read-email-code': async () => {
    state.code = readEmailCode(state.newEmail);
    state.wrongCode = state.code === '000000' ? '111111' : '000000';
  },
  // The QA driver starts every flow OFFLINE and free: a leftover delivery is finished first.
  'driver/reset': async () => {
    const driver = await finishLeftoverDelivery();
    const me = await api('GET', '/api/drivers/me', driver);
    if (me.status === 'AVAILABLE') await api('POST', '/api/drivers/me/offline', driver, {});
    state.orderId = null;
  },
  // Fixture (#147): the profile flow starts from the seed's profile, whatever an earlier run left.
  'profile/restore': async () => {
    const driver = await login(manifest.accounts.driver.email);
    await restoreSeedProfile(driver);
  },
  // The code the test SMS sender (SMS_PROVIDER=test) kept for the QA driver's phone (#153); never sent anywhere.
  'profile/read-sms-code': async () => {
    const driver = await login(manifest.accounts.driver.email);
    const me = await api('GET', '/api/users/me', driver);
    const text = docker('exec', container('redis'), 'redis-cli', 'GET', `test:sms:${me.phone}`).trim();
    const code = /(\d{6})/.exec(text)?.[1];
    if (!code) throw new Error(`No verification code was sent to ${me.phone}`);
    state.code = code;
  },
  // CUSTOMER + RESTAURANT stand-ins (no restaurant client yet): the QA customer orders and pays,
  // the QA restaurant prepares it and marks it ready. Auto-dispatch then assigns an online driver.
  'scenario/order-ready': async () => {
    const customer = await login(manifest.accounts.customer.email);
    const owner = await login(manifest.accounts.restaurant.email);
    await api('DELETE', '/api/cart', customer);
    await api('POST', '/api/cart/items', customer, { menuItemId: manifest.menuItems['QA Pasta'], quantity: 1 });
    const order = await api('POST', '/api/orders', customer, {});
    const payment = await api('POST', '/api/payments', customer, { orderId: order.id });
    await api('POST', `/api/payments/${payment.id}/process`, customer, { simulateFailure: false });
    await waitForOrderStatus(order.id, customer, 'CONFIRMED');
    await api('PATCH', `/api/orders/${order.id}/status`, owner, { status: 'PREPARING' });
    await api('PATCH', `/api/orders/${order.id}/status`, owner, { status: 'READY_FOR_PICKUP' });
    state.orderId = order.id;
  },
  // Cross-app assertion: the customer's tracking view shows the position the driver app sent.
  'tracking/assert-location': async () => {
    const customer = await login(manifest.accounts.customer.email);
    const delivery = await api('GET', `/api/deliveries/by-order/${state.orderId}`, customer);
    const deadline = Date.now() + 20_000;
    for (;;) {
      const tracking = await api('GET', `/api/tracking/delivery/${delivery.id}`, customer);
      const { latitude, longitude } = tracking.location ?? {};
      if (latitude === FIXED_LOCATION.latitude && longitude === FIXED_LOCATION.longitude) return;
      if (Date.now() > deadline) throw new Error(`No driver location for delivery ${delivery.id} (got ${JSON.stringify(tracking.location)})`);
      await new Promise((r) => setTimeout(r, 1_000));
    }
  },
  // Cross-app assertion: the order the driver delivered in the UI is DELIVERED for the customer.
  'order/assert-delivered': async () => {
    const customer = await login(manifest.accounts.customer.email);
    await waitForOrderStatus(state.orderId, customer, 'DELIVERED');
  },
};

const control = createServer(async (req, res) => {
  const action = (req.url ?? '').replace(/^\//, '');
  try {
    if (req.method !== 'POST' || !actions[action]) throw Object.assign(new Error(`Unknown action ${action}`), { code: 404 });
    await actions[action]();
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ action, ...state }));
  } catch (error) {
    console.error(`[control] ${action} failed:`, error.message);
    res.writeHead(error.code ?? 500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error.message }));
  }
});

// ---------------------------------------------------------------------------------------------

function buildWeb() {
  console.log(`Building web app against ${API_URL} ...`);
  rmSync(WEB_BUILD, { recursive: true, force: true });
  // --clear matters: a warm Metro cache can keep a previously inlined EXPO_PUBLIC_API_BASE_URL.
  const result = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', WEB_BUILD, '--clear'], {
    cwd: APP_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    // Maestro's web driver can't grant or fake geolocation, so the E2E build reports a fixed position.
    env: { ...process.env, CI: '1', EXPO_PUBLIC_API_BASE_URL: API_URL, EXPO_PUBLIC_DEFAULT_LOCALE: process.env.E2E_LOCALE ?? 'en', EXPO_PUBLIC_FIXED_LOCATION: `${FIXED_LOCATION.latitude},${FIXED_LOCATION.longitude}` },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Asynchronous: flows call back into this process's control server (spawnSync would deadlock). */
function runFlow(flow) {
  const name = flow.replace(/[\\/]/g, '__').replace(/\.yaml$/, '');
  const outDir = join(ARTIFACTS, name);
  mkdirSync(outDir, { recursive: true });
  const env = {
    APP_URL,
    CONTROL_URL,
    EMAIL: manifest.accounts.driver.email,
    PASSWORD: manifest.password,
    // A fresh account per run for the first-use flow.
    NEW_DRIVER_EMAIL: `qa.driver.${Date.now()}@delivery-plus.test`,
  };
  const maestroArgs = [
    'test',
    join(E2E_DIR, 'flows', flow),
    '--format',
    'JUNIT',
    '--output',
    join(ARTIFACTS, `${name}.junit.xml`),
    '--test-output-dir',
    outDir,
    '--debug-output',
    outDir,
    '--flatten-debug-output',
    ...(flag('headless') ? ['--headless', '--screen-size', SCREEN_SIZE] : []),
    ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
  ];
  resetRateLimits();
  const started = Date.now();
  return new Promise((resolveFlow) => {
    const child = spawn(MAESTRO, maestroArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => resolveFlow({ flow, ok: code === 0, seconds: Math.round((Date.now() - started) / 1000) }));
  });
}

async function main() {
  if (flag('build') || !existsSync(join(WEB_BUILD, 'index.html'))) buildWeb();
  mkdirSync(ARTIFACTS, { recursive: true });

  await fetch(`${API_URL}/health`).then(
    (r) => { if (!r.ok) throw new Error(); },
    () => { throw new Error(`E2E gateway not reachable at ${API_URL}. Start it with \`npm run e2e:env:up\` in delivery-plus.`); },
  );

  if (suite === 'session') await requireShortAccessTokens();
  if (suite === 'verification') await requireEmailVerification();

  const web = spawn(process.execPath, [join(E2E_DIR, 'scripts', 'serve-web.mjs'), WEB_BUILD, String(WEB_PORT)], { stdio: 'inherit' });
  await new Promise((r) => control.listen(CONTROL_PORT, '127.0.0.1', r));
  await new Promise((r) => setTimeout(r, 500));

  const results = [];
  try {
    for (const flow of SUITES[suite]) {
      console.log(`\n=== ${flow}`);
      results.push(await runFlow(flow));
    }
  } finally {
    await restoreSeedDriverState().catch((error) => console.error('[cleanup] restoring the QA driver failed:', error.message));
    web.kill();
    control.close();
  }

  console.log(`\nSuite "${suite}" results (artifacts: ${ARTIFACTS})`);
  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.flow}  (${r.seconds}s)`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} flows passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
