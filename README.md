# 2048

A personal 2048: the classic 4×4 sliding-tile game with no ads, popups or tracking, plus stats, playing on past the win, and a 3-minute Blitz pace.

**Play:** https://koshin43.github.io/twentyfortyeight/

It is an installable web app (PWA). Add it to your home screen and it opens instantly and works offline. Each device keeps its own game and stats; nothing leaves the device.

## How to play

Slide the tiles with a swipe on the board, or with the arrow keys / W A S D on a laptop. Equal tiles merge into their sum. Each move adds a new tile. Reach 2048, then keep going as long as the board allows.

**New Game** chooses the pace:

- **Endless**: play until the board is stuck.
- **Blitz**: a 3-minute game. The clock starts on your first swipe and pauses while the app is hidden or a dialog is open.

**Stats** (📊) shows the best score, best tile, games played, win rate and top 10 for each pace.

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
| `src/game/` | Pure game rules: seeded random, slides and merges, spawning, game end, Blitz clock, validation |
| `src/stats/` | Recording finished games, per-pace stats, the Stats screen |
| `src/save/` | Reading and writing the saved state |
| `src/play/` | The game screen: board, input, New Game panel, sound and vibration |
| `src/app/` | App shell, theme, error boundary |

How changes are made is described in [AGENTS.md](AGENTS.md).

## Deployment

Every push to `master` runs the tests, lint and build, then deploys `dist/` to GitHub Pages ([workflow](.github/workflows/deploy.yml)).

## License

[Apache License 2.0](LICENSE)
