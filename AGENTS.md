# 2048 Repository Policy

## Authority

- `docs/superpowers/specs/2026-10-01-2048-design.md` is the sole product and design authority.
- This file defines how changes must be made.
- Tests describe only the current contract. Existing code, old plans, and Git history are not requirements.
- When code and the spec disagree, change the code. Never weaken the spec to preserve an old implementation.
- A product change starts as a spec change. Update the spec first, then code, tests, and docs together.

## Greenfield Only

- Treat this repository as a greenfield system.
- Never add backward compatibility, compatibility shims, legacy aliases, fallback readers, dual reads or writes, migrations, version bridges, deprecation periods, or support for obsolete saved-game formats or workflows.
- The save has exactly one shape. Each part is defined once by its owning feature. Changing it changes that single definition.
- Reject malformed or obsolete saved state. Never interpret it as current state.
- Update code, tests, fixtures, and documentation together.
- Delete superseded behavior. Do not retain dormant branches, flags, aliases, components, or tests.

## Every Line Must Earn Its Place

- Solve the current requirement directly. Do not build speculative extension points.
- Prefer deletion and simplification over another layer.
- Introduce an abstraction only for a real external boundary (`localStorage`, randomness, input events) or a required test seam.
- Do not create pass-through wrappers, generic repository layers, service locators, registries, event buses, plugin systems, or generic `Base*` components.
- Do not create `utils.ts`, `helpers.ts`, `common.ts`, `misc.ts`, `lib/`, or generic `manager.ts` dumping grounds.
- Do not duplicate types, validation rules, board dimensions, tile values, or palette values. Each has one owner.
- Write one general mechanism and drive it with data instead of writing special cases. One line-slide routine handles all four directions, all three sizes, Jokers and stones. Per-size values, spawn odds, tile colors and event feedback are tables, not branches.
- Derive values instead of tracking them. Won, ended, refills earned, best score and room are each computed from the game by one function where needed. They are never stored, cached, or mirrored in React state.
- Implement a rule by its spec definition when that is cheap. A board is stuck when none of the four slides changes it. Undo restores a stored snapshot.
- The engine's move events are the only source for animation, sound and vibration. Screens never work out merges, spawns or crumbles for themselves.
- Validate once, at the save boundary. Code behind that boundary trusts its types: no defensive checks, fallbacks, or branches for impossible cases inside rules or screens.
- Build the UI from React, semantic HTML, and CSS Modules. Do not add a UI kit: dialogs are native `<dialog>` elements, segmented controls are styled radio inputs, toggles are styled checkboxes.
- Beyond React, use the browser platform: Pointer Events, `KeyboardEvent`, `<dialog>`, CSS transitions, Web Audio, the Vibration API, and `crypto.getRandomValues` over libraries.
- Game rules are pure functions over immutable values. They import no React, touch no DOM, and read no storage or clock. Every random number comes from the seeded generator whose state is part of the game; rules never call `Math.random` or `crypto`.
- The game screen owns the game state in React state. Do not add a global state library or context-as-store.
- Catch errors only at real boundaries (storage reads and writes, the top-level error boundary). Never silently guess or continue with corrupted state.

### Dependency Budget

Runtime: `react`, `react-dom`.
Build and test: `typescript`, `@types/react`, `@types/react-dom`, `vite`, `vite-plugin-pwa`, `vitest`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `jsdom`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`.

Adding any other dependency requires a stated reason tied to a spec requirement. No UI kits, CSS frameworks, animation libraries, gesture libraries, routers, state managers, storage wrappers, or random-number libraries.

## Fixed Product Boundary

2048 is a single-player, on-device, installable web app for personal use. It works offline after the first load. The hosted site serves static files only.

The app is one game screen with two dialogs over it: the New Game panel and the Stats screen. There is no router.

Do not add a backend, accounts, authentication, sync, backup or export, leaderboards, sharing, multiplayer, analytics, telemetry, remote logging, ads, feature flags, AI hints or solvers, or any network request beyond loading the app itself. Do not add board sizes, styles, paces, rules, themes, or settings beyond what the spec defines.

## Required Package Shape

Use feature-first folders:

```text
src/
├── game/       pure rules: game state and its validation, seeded random, slide and merge with move events, spawning (room, Joker, stone), scoring, win and game over, powers
├── stats/      recording finished games, per-set stats and top 10, stats validation, the Stats screen
├── save/       the single `localStorage` key: read, validate each part, replace failing parts, write
├── play/       the game screen: board and tile animation, keyboard and swipe input, scores and Blitz clock, power bar and targeting, New Game panel, overlays, sound and vibration
├── app/        app shell, theme variables, top-level error boundary
└── main.tsx    the only composition root
```

Rules:

- Each feature owns its model, behavior, screens, and styles. Each part of the save is defined and validated by the feature that owns it; `save/` only reads, writes, and replaces parts.
- Each feature exposes its public API through its `index.ts`. Cross-feature callers import only from that file. Never deep-import another feature's internals.
- Dependency direction: `play` → `save`, `stats`, `game`; `save` → `stats`, `game`; `stats` → `game`. `game` imports no feature and no React. `app` composes features and is imported by none.
- Only `save/` touches `localStorage`. Web Audio and vibration live behind one module in `play/`.
- Theme values (page and board colors, per-value tile colors, radii, fonts, animation durations) are defined once as CSS custom properties in `app/`. Components use those variables, never literal palette values.
- CSS lives beside the component that needs it, as a CSS Module.
- Filenames describe one concrete capability. Components use `PascalCase.tsx`; other modules use `camelCase.ts`.

## Storage Rules

- `localStorage` is the only persistent store. Everything lives under one key, in the shape the spec defines, written in a single write. Nothing else is persisted.
- Saved state is strictly validated on write and on read. Unknown and missing fields and broken invariants are errors.
- A part that fails validation is replaced, never repaired. The spec defines the replacements and what the player sees.
- Do not store what can be derived (won, refills earned, game ended, best score).
- Do not add schema-version fields or migration machinery.
- The save is written whenever state changes, so closing the app never loses a move.

## Rendering and Input

- The board is DOM elements laid out with CSS. No canvas, WebGL, or `requestAnimationFrame` game loop; the game is turn-based.
- Tile movement, merging, and appearance animate with CSS transitions and keyframes on `transform` and `opacity` only.
- Animations are presentation only. Game logic never waits on animation timing or `transitionend`.
- Respect `prefers-reduced-motion`.
- Keyboard and swipe controls are exactly those the spec defines. Swipes are detected with Pointer Events. The page does not scroll, zoom, or pull-to-refresh while swiping on the board.
- The Blitz clock counts with timestamps and refreshes its display on a timer. It never drives game logic beyond ending the game at 0:00.

## Trust Model

- Saved state is untrusted on read and passes its owning feature's validation before it is used.
- The only other input is the player's keys, swipes, and taps.

## Testing

Tests exist to catch bugs. A test earns its place only if it would fail on a plausible bug that no other test catches. A few broad tests built around edge cases beat many narrow ones.

- There are exactly two suites, both integration-level. The spec's Testing section lists the edge cases each suite must catch.
  - **Rules scenarios** (`game/game.test.ts`) call only the public `game/` API. Each starts from a hand-written board and a fixed generator state, then compares whole boards, scores and events. Boards are written as text, so a failure shows the board.
  - **App flows** (`app/App.test.tsx`) render the whole app with the real game, save and stats code over jsdom's `localStorage`. They drive it with keys, pointer drags and clicks, and assert only on what the player sees and what gets saved. A flow sets up its starting situation by writing a crafted save before rendering.
- Prefer one table-driven test over several near-identical tests.
- What not to test:
  - private helpers, constants, defaults, type shapes, or styles
  - that a component merely renders
  - snapshots
  - internals, call counts of our own code, or animation timing

  Delete any test whose cases another test already covers.
- Do not mock our own modules. Stub only real boundaries: the sound and vibration module, timers, `crypto.getRandomValues`, and page visibility.
- A bug fix starts with a failing scenario that reproduces the bug.
- Coverage percentage is not a goal.
- Tests are deterministic, offline, and hermetic. Clear `localStorage` before each test.
- Run tests outside the sandbox by default, requesting execution approval when required.
- Never retain tests for superseded behavior.
- A change is incomplete until focused tests, the full test suite, `tsc --noEmit`, and ESLint pass.

## Change Discipline

Before finishing a change:

1. Remove the superseded implementation.
2. Search for stale names, types, CSS classes, CSS variables, and documentation.
3. Confirm dependency direction, public feature boundaries, and that `game/` rules are still pure.
4. Confirm no compatibility code, speculative infrastructure, or unbudgeted dependency was introduced.
5. Report intentionally unsupported behavior plainly.
