# Driver App — Project Context

Read this before changing code. When this file and the code disagree, the code wins; update this file in the same PR.

## What this app is

The driver client of Delivery Plus (backend issue #99). Scaffolded from the customer app (`delivery-plus-customer-app`), so the foundation is shared and should stay in step:

| Shared with the customer app | Files |
| --- | --- |
| API client (timeouts, auth header, error mapping, 204 → empty) | `src/services/api.ts` |
| Session (SecureStore on native, localStorage on web; JWT decode) | `src/services/session.ts` |
| Data hooks (cache, focus revalidation, polling, in-flight dedupe) | `src/hooks/use-resource.ts`, `src/state/resource-cache.ts` |
| UI kit and theme | `src/components/ui/*`, `src/constants/theme.ts` |
| Login fixes (one request per submit, actionable errors) | `src/app/(auth)/login.tsx`, `src/utils/login-errors.ts` |

A fix to any of these belongs in both apps.

## Driver-specific code

| Concern | File |
| --- | --- |
| Driver profile, online/offline | `src/services/drivers.ts` |
| Current delivery, actions | `src/services/deliveries.ts` |
| Screen state and actions | `src/state/driver.ts` |
| Status rules and labels | `src/utils/driver-status.ts` |
| Location sharing (send loop + rules, device/fixed position, API call, hook) | `src/utils/location-sharing.ts`, `src/services/location.ts`, `src/services/tracking.ts`, `src/hooks/use-location-sharing.ts` |
| Main screen (vehicle form, status card, delivery card) | `src/app/(app)/home.tsx` |
| Maestro suites, runner, control actions | `e2e/` (see `e2e/README.md`) |
| Role guard (DRIVER only) | `src/app/(auth)/login.tsx` (refuses before storing a session), `src/app/(app)/_layout.tsx` (clears any non-driver session) |

## Backend contracts (verified against `delivery-plus` dev)

| Call | Behavior the app relies on |
| --- | --- |
| `POST /api/auth/register` with `role: DRIVER` | Self-service roles only (#105): CUSTOMER, RESTAURANT_OWNER, DRIVER |
| `GET /api/drivers/me` | 404 until `POST /api/drivers/register` (vehicleType, licensePlate ≥ 2 chars) |
| `POST /api/drivers/me/online` / `offline` | OFFLINE ↔ AVAILABLE only; repeating is a no-op; while BUSY: 403 (online) / 409 (offline) (#33) |
| `GET /api/deliveries/me/current` | DRIVER only; 200 with pickup, drop-off, items, total, `nextActions`; **204** when no job (#96) |
| `POST /api/deliveries/:id/pickup|start|complete` | Assigned driver only; retry-safe: repeating re-runs side effects instead of 409 |
| Dispatch | Automatic on `order.ready_for_pickup` (#97); a driver who comes online gets a waiting delivery within one sweep (15 s default, 2 s on the E2E stack) |
| `POST /api/tracking/location` `{latitude, longitude}` | DRIVER only, keyed by the token's user; last position kept 300 s in Redis. Customers read it via `GET /api/tracking/delivery/:deliveryId` |
| Gateway CORS (development) | Allows web origins on ports 8081–8085; the E2E web build is served on 8084 (backend #111, #124) |

## Location rules

- Shared only while the delivery is DRIVER_ASSIGNED, PICKED_UP or IN_TRANSIT, every 10 s, foreground only (the app must be open).
- `EXPO_PUBLIC_FIXED_LOCATION="lat,lng"` replaces the device position. Only dev/E2E builds set it: Maestro's web driver cannot grant or fake geolocation (`setLocation` fails on web).
- After completion the backend still holds the last position until its TTL expires; stopping it server-side is Phase 7.

## Cross-app run

The customer app's business flow drives this app's real UI (go online, pickup → start → complete), next to the real restaurant app (customer repo #19, #20). It needs the driver and restaurant web builds, so on GitHub it runs only once the customer repo has the `CLIENT_APPS_READ_TOKEN` secret.

## Not built yet

- Background location, location stop on completion server-side (Phase 7).
- Offer/accept, earnings, shift planning, navigation hand-off (out of MVP scope).
