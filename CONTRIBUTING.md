# Contributing

## Before you start

Read [.project-context/00-INDEX.md](.project-context/00-INDEX.md) first. Planning for all Delivery Plus clients lives in the customer app repository (`planning.md`); the driver app is issue #99 in the backend repository. This app talks only to the Delivery Plus API gateway; the backend lives in [Delivery-Plus0/delivery-plus](https://github.com/Delivery-Plus0/delivery-plus) (default branch `dev`). Check its `docs/services/<name>.md` and public OpenAPI contract (`docs/openapi/delivery-plus-public.json`) before relying on an endpoint.

## Workflow

1. Branch from `dev` with a focused name, for example `feat/send-location` or `fix/online-toggle`.
2. Copy `.env.example` to `.env.local` (git-ignored) and point `EXPO_PUBLIC_API_BASE_URL` at your gateway (`http://localhost:3000` for the backend dev stack).
3. Install Node.js 22 and run `npm ci`.
4. Run the backend dev stack (see the backend README), then `npm run web` (or `npm start` for Expo Go).
5. Make a small, tested change. Every new control gets a `testID` (and `nativeID` on web) from its first commit.

## Checks

Run before opening a pull request:

```bash
npm run typecheck
npm run lint        # zero warnings allowed
npm test            # vitest
```

UI changes on a critical path will also need the driver Maestro suite once it exists (the next step of #99), run against the isolated backend E2E stack (`npm run e2e:env:reset` in the backend repo).

## Pull requests

Open pull requests against `dev` and use the pull request template. Describe the user-visible impact, the related issue, the tests performed (unit, Maestro) and any backend contract the change depends on. Keep unrelated refactors out of the change. Pull requests must pass CI, must not commit secrets or generated output (`dist/`, `.expo/`), and need review from the code owners.

Use clear imperative commit subjects, such as `fix(delivery): keep the action button enabled after a network error`.

Branches: `dev` (default; integration), `testing` (release candidates), `main` (released).
