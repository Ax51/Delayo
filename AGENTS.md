# AGENTS.md

## Project Overview

Delayo is a Manifest V3 Chrome extension for delaying/snoozing tabs and reopening
them later. It is built with Vite, React 19, TypeScript, CRX, Tailwind CSS,
DaisyUI, i18next, and Vitest.

## Repository Layout

- `src/manifest.ts` defines the Chrome extension manifest and permissions.
- `src/background/` contains the service worker and delayed tab controller.
- `src/pages/popup/` contains the extension popup React app and routes.
- `src/pages/options/` contains the options page React app.
- `src/components/` contains shared React UI.
- `src/hooks/` contains shared React hooks.
- `src/utils/` contains domain utilities, storage helpers, time logic, and tests.
- `src/i18n/locales/` contains app translation JSON files.
- `public/_locales/` contains Chrome extension locale messages.
- `public/html/` contains extension entry HTML files.
- `config/` holds shared tooling configs re-exported by root config files.
- `docs/` contains user and contributor documentation.

## Tooling

Use Bun for package management and local script execution.

Common commands:

```bash
bun install
bun dev
bun run build
bun run test
bun run lint
bun run preview
```

`bun run build` runs `tsc` before `vite build`. Run it when changes affect extension
packaging, manifest behavior, TypeScript contracts, or release artifacts. Run
`bun run test` for logic changes and `bun run lint` before handing off code changes.

## Code Style

- TypeScript is strict. Avoid `any`; model Chrome API and storage data explicitly.
- Keep React components functional and typed with `React.ReactElement` where that
  is already the local pattern.
- Use the configured import aliases: `@`, `@utils`, and `@assets`.
- Prettier settings use semicolons, single quotes, 2-space indentation, LF
  endings, trailing commas where valid in ES5, and 80-column wrapping.
- Tailwind and DaisyUI are the expected UI styling tools. Prefer matching existing
  component structure and utility class conventions over adding new styling
  systems.
- Keep files ASCII unless the edited file already uses non-ASCII content for user
  facing copy, localization, or documentation.

## Extension Behavior

- Treat `src/background/delayedTabsController.ts` as the core scheduling state
  machine. Preserve its queueing, storage sanitization, alarm naming, and
  best-effort rollback behavior unless deliberately changing that flow.
- Do not assume Chrome API calls always succeed. Existing code uses defensive
  checks around missing URLs, notification failures, and rollback paths.
- Keep stored delayed tab data compatible with existing `chrome.storage.local`
  records. Normalize or migrate persisted shapes instead of breaking older data.
- Manifest permission changes in `src/manifest.ts` affect user trust and store
  review; keep them minimal and explain why they are needed.

## Internationalization

- User-visible extension copy should go through i18next locale files under
  `src/i18n/locales/`.
- Chrome Web Store and manifest-localized strings belong in `public/_locales/`.
- When adding or renaming keys, update all supported locales: `en`, `es`, and
  `pt`.

## Testing Guidance

- Existing unit tests live beside utilities and background logic with
  `*.test.ts` names.
- Prefer focused Vitest coverage for date/time calculations, recurrence,
  delayed-tab normalization, extension storage, and background controller flows.
- Mock Chrome APIs in tests instead of relying on a real browser extension
  runtime.
- For UI-only changes, at minimum run `bun run lint`; run `bun run build` when the
  change could affect bundling, routing, entry points, or TypeScript contracts.

## Git And Contribution Notes

- Follow semantic commit messages such as `feat:`, `fix:`, `docs:`, and `chore:`.
- Do not edit generated build output in `dist/`.
- Avoid broad refactors when making focused fixes; keep changes scoped to the
  requested behavior and nearby tests.
