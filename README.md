# Jules Studio (Web Dashboard)

Jules Studio is a modern, unified web dashboard for managing AI-driven coding sessions via the [Jules REST API](https://jules.google/docs/api/reference/overview). Built with **React 18**, **Vite**, and **Tailwind CSS**, it provides a visual interface for delegating tasks, reviewing generated plans, monitoring real-time agent activity, and inspecting code artifacts.

## ✨ Features

### Standalone Web Application
Jules Studio acts as a full-featured dashboard for managing your AI coding workspace independently of your IDE.

- **Session Control Center**: Create and manage AI coding tasks with granular control over prompt, source repository, branch, and `automationMode` (`AUTO_CREATE_PR` vs `MANUAL`).
- **Real-time Activity Timeline**: Monitor progress events as they happen, from plan generation to completion.
- **Interactive Review UI**: Human-in-the-loop workflows for approving agent plans and communicating with Jules through in-session messaging.
- **Power-User Features**:
  - **Bulk Operations**: Multi-select sessions with "Select All" and bulk-delete with a single confirmation.
  - **AIP-160 Search**: Server-side filtering on session lists (press **Enter** to trigger) using standard Google API query syntax.
  - **Load More Pagination**: Efficient infinite-scroll style navigation for large session lists via `nextPageToken`.
  - **Local Notes**: Persistent, per-session sticky notes saved securely to your browser's `localStorage`.
- **Artifact Inspector**: View rendered code diffs (unified patch), terminal logs (bash output), and generated media.
- **Desktop Notifications**: Browser Notification API alerts when sessions reach `AWAITING_PLAN_APPROVAL` or `COMPLETED`.
- **API Resilience**: Global error handling and exponential backoff for `429 Too Many Requests` (5s → 60s).

### CLI & Integrations
Bridge your web dashboard with your local terminal environment.
- **CLI Setup Guide**: Interactive step-by-step instructions for installing and authenticating the `@google/jules` CLI.
- **TUI Dashboard Preview**: Preview the Terminal User Interface ([TUI](file:///home/tazztone/_coding/jules-studio/src/components/CliRecipesView.jsx#L68)) for console-based management.
- **Automation Recipes**: Pre-configured bash snippets for batch issue delegation, GitHub CLI triage, and Gemini-powered tasking.
- **Session Pulling**: Dynamic per-session `jules remote pull` snippets for immediate local application of patches.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: Version 18 or higher.
- **Jules API Key**: Obtain your key from [jules.google.com/settings](https://jules.google.com/settings).

### Local Development
1. **Clone & Install**:
   ```bash
   git clone https://github.com/tazztone/jules-studio.git
   cd jules-studio
   npm install
   ```
2. **Start Dev Server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`.
3. **Configure Authentication**: Navigate to the **Settings** tab and enter your API Key. The app will transition from **Demo Mode** (mock data) to **Live Mode**.

## 🏗 Architecture & Routing

Jules Studio uses **React Router v6** for client-side navigation:

| Route | View | Purpose |
|---|---|---|
| `/sessions` | `SessionsList` | Dashboard overview, search, and bulk operations. |
| `/sessions/:id` | `SessionDetailView` | Timeline, Artifacts, Diff Viewer, and Chat. |
| `/sources` | `SourcesView` | Repository and branch management. |
| `/cli` | `CliRecipesView` | CLI installation guides and automation snippets. |
| `/settings` | `SettingsView` | API Key management and Persistance. |

## 🛡️ Security & Stability
- **XSS Prevention**: Strict HTML escaping and Content Security Policy (CSP).
- **Resource Management**: Resolved memory leaks in background state polling.
- **Vite Proxy**: API requests (`/v1alpha`) are proxied to `jules.googleapis.com` to avoid CORS issues.

## ⚙️ CI/CD & Automated Release
- **Continuous Integration**: GitHub Actions runs Vitest suites on every push (**86.78% coverage**).
- **Automated Tags**: Creating a version tag (e.g., `v0.2.0`) triggers an automated build and publish to the [Open VSX Registry](https://open-vsx.org/) for the sibling extension.

## 📖 Evolution
Modernized in **Phase 1** from a monolithic React prototype into a modular Vite architecture, Jules Studio now serves as the foundational core for both this web dashboard and the native VS Code extension located in `vscode-extension/`.

---

```bash
npm run build
```
Output is in `dist/`, ready for Vercel, Netlify, or any static host. Ensure your host redirects all paths to `index.html` to support client-side routing.

## ❓ Troubleshooting

**CORS Errors ("Failed to fetch")**
Ensure you are accessing the app via `localhost` so the Vite proxy is active. Direct file access (`file://`) will not proxy requests.

**API Key not saving**
`localStorage` must be enabled. Avoid Private/Incognito mode, or use a standard browser window.

**Search/Filter not working**
The search bar uses [AIP-160](https://google.aip.dev/160) syntax. Press **Enter** to trigger — blurring the field will not fire a search to avoid unnecessary API calls.

**Desktop notifications not appearing**
Ensure browser notifications are allowed for `localhost` in your browser settings.

---

## 👨‍💻 Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request.

---
*Created with ❤️ by the **Antigravity** team at Google DeepMind.*
