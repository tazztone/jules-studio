# Jules Studio

[![Node](https://img.shields.io/badge/node-18%2B-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18-61dafb)](https://react.dev/)
[![Vite](https://img.shields.io/badge/vite-5-646cff)](https://vitejs.dev/)
[![Coverage](https://img.shields.io/badge/coverage-86.78%25-green)](#)
[![License](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

A unified web dashboard for managing AI-driven coding sessions via the [Jules REST API](https://jules.google/docs/api/reference/overview). Provides a visual interface for delegating tasks, reviewing generated plans, monitoring real-time agent activity, and inspecting code artifacts.

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 + Vite 5 |
| Routing | React Router v6 |
| Styling | Tailwind CSS |
| API | Jules REST API (`/v1alpha`) via Vite proxy (avoids CORS) |
| Testing | Vitest (86.78% coverage) |
| CI/CD | GitHub Actions — test on push, automated tag-triggered publish to Open VSX |

## Architecture

```
src/
├── components/
│   ├── SessionsList.jsx        # Dashboard overview, search (AIP-160), bulk ops
│   ├── SessionDetailView.jsx   # Timeline, artifacts, diff viewer, in-session chat
│   ├── SourcesView.jsx         # Repository and branch management
│   ├── CliRecipesView.jsx      # CLI setup guide + automation bash snippets
│   └── SettingsView.jsx        # API key management
├── api/                        # Jules API client (fetch + exponential backoff)
├── hooks/                      # Custom React hooks
└── main.jsx                    # Router + app entry

vscode-extension/               # Sibling VS Code extension (same core)
```

### Routing

| Route | View | Purpose |
|---|---|---|
| `/sessions` | `SessionsList` | Dashboard, search, bulk delete |
| `/sessions/:id` | `SessionDetailView` | Timeline, artifacts, diff viewer, chat |
| `/sources` | `SourcesView` | Repo and branch management |
| `/cli` | `CliRecipesView` | CLI guides and automation snippets |
| `/settings` | `SettingsView` | API key + persistence |

## Key Features

- **Session control** — create tasks with prompt, repo, branch, and `automationMode` (`AUTO_CREATE_PR` / `MANUAL`)
- **Real-time timeline** — live progress events from plan generation to completion
- **Human-in-the-loop** — approve agent plans and communicate via in-session messaging
- **Bulk operations** — multi-select + bulk delete with confirmation
- **AIP-160 search** — server-side session filtering using Google API query syntax
- **Artifact inspector** — unified diff viewer, terminal logs, generated media
- **Desktop notifications** — browser Notification API alerts on `AWAITING_PLAN_APPROVAL` / `COMPLETED`
- **API resilience** — exponential backoff on 429/5xx (5s → 60s)
- **Demo mode** — runs on mock data when no API key is configured

## Quick Start

**Prerequisites:** Node.js 18+, Jules API key from [jules.google.com/settings](https://jules.google.com/settings)

```bash
git clone https://github.com/tazztone/jules-studio.git
cd jules-studio
npm install
npm run dev
# → http://localhost:5173
```

Open **Settings** and enter your Jules API key to switch from Demo Mode to Live Mode.

```bash
npm run build   # → dist/ (deploy to Vercel, Netlify, or any static host)
```

> **Note:** Ensure your static host redirects all paths to `index.html` for client-side routing. Access via `localhost` to keep the Vite proxy active (direct `file://` access will not proxy API requests).

## Security

- XSS prevention via strict HTML escaping and Content Security Policy (CSP)
- API keys stored in `localStorage` (not transmitted except to the Jules API via proxy)
- Memory leaks in background state polling resolved

## License

MIT
