# Phantom

Phantom is a Windows-first personal Electron AI overlay prototype inspired by
the GPL Pluely project. It is local software with no payment, license,
activation, analytics, hosted usage reporting, or paywall behavior.

## Features

- Transparent overlay window with global shortcuts
- Dashboard for chats, prompts, providers, audio, screenshots, responses, and settings
- OpenAI-compatible AI provider configuration with editable endpoint, key, model, headers, and response paths
- STT provider configuration through editable curl/provider templates
- Main-process HTTP proxy for provider requests, avoiding browser CORS limits
- Full-screen and selected-area screenshots
- Microphone and Windows system-audio loopback prototype support
- Local SQLite persistence for conversations, messages, and system prompts
- Local secure storage for provider secrets through Electron `safeStorage` where available

## Development

```powershell
npm.cmd install
npm.cmd run dev
```

The dev server runs Vite at `http://127.0.0.1:1420` and starts Electron.

## Build

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dist
```

`npm.cmd run build` creates the renderer production bundle. `npm.cmd run dist`
builds Windows artifacts with Electron Builder.

## Shortcuts

- `Ctrl+\`: toggle overlay
- `Ctrl+Shift+I`: focus overlay input
- `Ctrl+Shift+D`: toggle dashboard
- `Ctrl+Arrow`: move overlay

Shortcuts can be changed from the dashboard.

## Attribution

Phantom uses Pluely as a GPL behavior and source reference:
https://github.com/iamsrikanthnani/pluely

See `LICENSE` and `NOTICE.md`.
