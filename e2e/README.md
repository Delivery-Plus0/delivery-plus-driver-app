# Driver app — UI / E2E tests (Maestro)

Real UI automation: Maestro drives the app's own screens; nothing is mocked. The backend is the
isolated E2E stack from the `delivery-plus` repo with deterministic seed data, shared with the
customer app's suite.

```text
seed:e2e (deterministic data) → E2E stack (gateway :3100, own DB/Redis/Kafka/S3 volumes)
  → app web build (EXPO_PUBLIC_API_BASE_URL=http://localhost:3100) served on :8084
  → Maestro (Chromium) → UI actions + assertions → JUnit + screenshots in e2e/.artifacts/
```

Ports differ from the customer app's runner (web 8083, control 8090) so both suites can run on one
machine. The gateway allows browser requests from 8084 in development (delivery-plus #111).

## Run locally

Prerequisites: Docker, Node 20.19+/22, Java 17+, and the Maestro CLI (`maestro --version`, 2.11+).

```bash
# 1. Backend E2E environment (in ../delivery-plus)
npm run e2e:env:up        # docker compose -p delivery-plus-e2e … (fresh, isolated volumes)
npm run seed:e2e          # writes ../delivery-plus/e2e-seed-manifest.json
# or all three steps from scratch: npm run e2e:env:reset

# 2. UI tests (in this repo)
npm run e2e:smoke -- --build            # --build re-exports the web app against :3100
npm run e2e:all -- --headless           # smoke + business
```

`--build` always exports with `--clear`: a warm Metro cache can keep a previously inlined
`EXPO_PUBLIC_API_BASE_URL` and silently point the build at the dev gateway.

Tear down with `npm run e2e:env:down` (in `delivery-plus`; removes the E2E volumes).

## Suites

| Suite | Flows | Runs in CI |
| --- | --- | --- |
| `smoke` | QA driver signs in and sees vehicle + status · goes online (waiting for a job) and offline again · a new driver signs up, registers a vehicle and lands Offline | every PR |
| `business` | driver goes online → an order becomes ready → automatic dispatch assigns it → the job card shows restaurant, drop-off and items → the app shares its location and the customer's tracking view shows it → pickup → start → complete → back to waiting → the customer's order is DELIVERED | nightly / manual |

## Test data (from `npm run seed:e2e`)

| Account | Role | Use |
| --- | --- | --- |
| `qa.driver@delivery-plus.test` | DRIVER | signs in to the app (vehicle `Bicycle · QA-0001`) |
| `qa.customer@delivery-plus.test` | CUSTOMER | orders in the business flow (stand-in) |
| `qa.restaurant@delivery-plus.test` | RESTAURANT_OWNER | prepares and readies that order (stand-in) |
| `qa.driver.<timestamp>@delivery-plus.test` | DRIVER | created by the sign-up flow, one per run |

Password: `E2E_PASSWORD` (test-only default `Qa-Only-Passw0rd!`). The customer's profile address
(`1 Test Street, Apt 1`) is snapshotted onto the order and shown as the drop-off.

## How flows interact with things the app can't do

`e2e/scripts/run.mjs` hosts a small control server on `:8091`. Flows call it with
`runScript: ../../scripts/control.js` to:

- `driver/reset`: finish any delivery the QA driver is still on and put them OFFLINE.
- `scenario/order-ready`: act as the **customer** (cart → order → payment) and the **restaurant**
  (preparing → ready) through the real gateway. These are stand-ins; the customer app covers its
  side in its own suite. Dispatch is not a stand-in: delivery-service assigns the online driver.
- `tracking/assert-location`: cross-app check that `GET /api/tracking/delivery/:id`, read as the
  customer, returns the position the driver app sent.
- `order/assert-delivered`: cross-app check that the customer's order is DELIVERED.

The web build reports a fixed position (`EXPO_PUBLIC_FIXED_LOCATION=30.0444,31.2357`, set by the
runner) because Maestro's web driver can neither grant geolocation permission nor fake it
(`setLocation` fails on web with a CDP version error).

After the suite the runner finishes any leftover delivery and leaves the QA driver AVAILABLE (the
seed's state), because the customer app's flows depend on it. Between flows it clears
`ratelimit:*` keys in the E2E Redis only, so repeated sign-ins don't hit the 5/min login limit.

## Selectors

Controls carry `testID` and `nativeID` with the same value (see the shared UI components). Maestro's
`id:` matches `testID` on Android/iOS and the HTML `id` on web (react-native-web renders
`nativeID` as `id`). Text selectors are regular expressions: escape `$`, `.`, `?`.

## Adding a flow

1. Put it under `flows/<suite>/`; start with `runFlow: ../_shared/login.yaml` (and `driver/reset`
   when the flow depends on the driver's status).
2. Prefer `id:` selectors; add a `testID` (+ `nativeID`) to the component if needed.
3. Register it in `SUITES` in `scripts/run.mjs`.

## Not covered yet

- Android emulator / iOS simulator runs (web only today), and so the real device-location path.
- The permission-denied state (it needs a browser or device that refuses geolocation).
