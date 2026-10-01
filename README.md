# 2048

A personal 2048: the classic sliding-tile game with no ads, popups or tracking, plus stats, playing on past the win, three board sizes, and a twist style, **Wild**, with Jokers, stones and power-ups.

**Play:** https://koshin43.github.io/twentyfortyeight/

It is an installable web app (PWA). Add it to your home screen and it opens instantly and works offline. Each device keeps its own game and stats; nothing leaves the device.

## How to play

Slide the tiles with a swipe on the board, or with the arrow keys / W A S D on a laptop. Equal tiles merge into their sum. Each move adds a new tile. Reach the win tile, then keep going as long as the board allows.

| Board | Win tile |
|---|---|
| 3×3 | 512 |
| 4×4 | 2048 |
| 5×5 | 8192 |

**New Game** chooses the board, the style and the pace:

- **Classic**: plain 2048.
- **Wild**: a crowded board can bring a **Joker** (★), which merges with any number. A roomy one can bring a **stone**, which blocks slides and crumbles after 10 moves. You draft 2 of 3 powers: **Smash** removes a tile, **Swap** exchanges two tiles, **Undo** rewinds the last move. Used powers recharge over moves, and reaching the win tile (and each doubling after it) earns a refill.
- **Endless** or **Blitz**: Blitz is a 3-minute game. The clock starts on your first swipe and pauses while the app is hidden or a dialog is open.

**Stats** (📊) shows the best score, best tile, games played, win rate and top 10 for each of the 12 board × style × pace combinations.

The full rules live in the [design spec](docs/superpowers/specs/2026-10-01-2048-design.md).

## Development

Requires Node 22.

```sh
npm install
npm run dev        # local dev server
npm test           # rules scenarios and app flows (Vitest)
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # type-check and production build into dist/
```

Built with React, TypeScript and Vite; `vite-plugin-pwa` provides the manifest and offline service worker. The game state is saved in one `localStorage` key and validated whenever it is read or written.

| Folder | Contents |
|---|---|
| `src/game/` | Pure game rules: seeded random, slides and merges, spawning, powers, game end, validation |
| `src/stats/` | Recording finished games, per-set stats, the Stats screen |
| `src/save/` | Reading and writing the saved state |
| `src/play/` | The game screen: board, input, power bar, New Game panel, sound and vibration |
| `src/app/` | App shell, theme, error boundary |

How changes are made is described in [AGENTS.md](AGENTS.md).

## Deployment

Every push to `master` runs the tests, lint and build, then deploys `dist/` to GitHub Pages ([workflow](.github/workflows/deploy.yml)).

## License

[Apache License 2.0](LICENSE)
