# Delivery Plus — Driver App

The driver client of **Delivery Plus**, a food-delivery platform. Drivers go online, receive deliveries automatically, and take each order from the restaurant to the customer.

Built with **Expo 57 / React Native 0.86 / Expo Router / TypeScript**, on the same foundation as the [customer app](https://github.com/Yousefa7medmaher/delivery-plus-customer-app): API client, session handling, `useResource` cache and polling, UI kit, lint and test setup. It talks only to the Delivery Plus API gateway; the backend lives in [Yousefa7medmaher/delivery-plus](https://github.com/Yousefa7medmaher/delivery-plus) (issue #99).

## Features (MVP)

| Area | What works | Backend contract |
| --- | --- | --- |
| Account | Sign up as a driver; sign in (DRIVER accounts only; other roles are refused before a session is stored) | `POST /api/auth/register`, `/login` |
| Vehicle | First-use vehicle registration | `GET /api/drivers/me` (404 → register), `POST /api/drivers/register` |
| Availability | Go online / offline; "On a delivery" while busy (the backend frees the driver on completion) | `POST /api/drivers/me/online`, `/me/offline` |
| Current job | Pickup (restaurant, address), drop-off (address, notes), items and total; polled every 5 s while on shift | `GET /api/deliveries/me/current` (204 → waiting) |
| Actions | One button for the next step: picked up → start delivery → mark as delivered (retry-safe on the server) | `POST /api/deliveries/:id/pickup|start|complete` |

Deliveries are assigned by the backend (automatic dispatch), so there is no "accept" step in this MVP. Not yet built: sending the driver's location (`POST /api/tracking/location`), push notifications, earnings.

## Getting started

Requirements: Node.js 22 and the backend dev stack (gateway on `http://localhost:3000`).

```bash
cp .env.example .env.local     # EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
npm ci
npm run web                    # or: npm start  (Expo Go / emulator)
```

Demo driver (after `npm run seed` in the backend): `driver@example.com` / `password123`. On the E2E stack (`:3100`): `qa.driver@delivery-plus.test`.

## Project structure

```text
src/
├── app/            Expo Router screens: (auth) welcome·sign-in·sign-up, (app)/home (vehicle, status, current delivery)
├── components/     UI kit shared with the customer app (cards, buttons, form inputs, alerts, state views)
├── services/       API client (api.ts), session, auth, drivers (profile, online/offline), deliveries (current, actions)
├── state/          driver.ts: useMyDriver, useCurrentDelivery and the actions that update the cache
├── hooks/          useResource (cache, polling, in-flight dedupe), theme hooks
├── utils/          driver-status (labels, toggle rules, next action), formatting, login errors (unit-tested)
└── test/           Test setup
```

## Testing

| Level | Command |
| --- | --- |
| Typecheck | `npm run typecheck` |
| Lint (zero warnings) | `npm run lint` |
| Unit tests (vitest) | `npm test` |

A Maestro suite (online → receives delivery → pickup → start → complete, against the backend's isolated E2E stack) is the next step of #99.

## CI, branches and contributing

CI runs typecheck, lint, unit tests and a web export; the Security workflow runs `npm audit` and a Trivy filesystem/secret scan. `dev` is the default branch, `testing` and `main` follow the backend's model. See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

See [LICENSE](LICENSE).
