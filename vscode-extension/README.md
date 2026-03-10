# Jules Studio for VS Code

[![CI](https://github.com/tazztone/jules-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/tazztone/jules-studio/actions/workflows/ci.yml)

> [!IMPORTANT]
> **Beta Preview**: This extension is currently in beta. We are actively refining the experience and appreciate your feedback.

Bring the full power of Jules directly into your IDE. Manage sessions, review and approve plans, apply patches, and get proactive notifications — all without leaving your editor.

## Prerequisites

- **Jules API Key**: Get yours from [jules.google.com/settings](https://jules.google.com/settings).
- **Jules CLI** *(required for applying patches)*:
  ```bash
  npm install -g @google/jules
  ```
  The extension will detect whether the CLI is installed and show an install link if it’s missing.

---

## ✨ Features

### Session Management
- **Sidebar TreeView**: All your Jules sessions at a glance with live state-aware icons (🚀 in-progress, ✅ completed, ⚠️ awaiting approval).
- **Rich Tooltips**: Hover a session to see the repository name, relative last-updated time (e.g., “5m ago”), and a contextual next action hint.
- **Multi-Panel Support**: Open multiple session detail panels simultaneously; state is preserved when switching tabs.
- **Friendly Empty States**: Status-aware messages (e.g., “⏳ Jules is preparing a plan…”) instead of blank screens.

### Session Detail Webview
- Full **activity timeline** with plan steps and inline unified diff viewer.
- **Approve Plan**, **Send Message**, and **Apply Patch** actions available directly in the panel.
- XSS-safe rendering with strict **Content Security Policy (CSP)** and nonce-based script execution.

### CodeLens & Context Integration
- **Inline CodeLens**: `🐙 Jules: Write Tests` and `🐙 Jules: Refactor` buttons appear above functions, methods, and classes.
- **Include Active File**: Toggle to attach your currently open file as context when creating a new session.
- **Terminal Error Delegation**: Right-click in the integrated terminal → “Send Terminal Error to Jules” — automatically creates a fix session.

### Proactive Workflows
- **Background Polling**: Session states are polled in the background (default: 60s, configurable).
- **Desktop Notifications**: Action-button alerts (Approve / Apply / Open) for `AWAITING_PLAN_APPROVAL`, `COMPLETED`, and `FAILED` transitions. Batched to a single summary if 3+ sessions change at once.
- **Auto-Apply**: Optionally pull changes automatically when a session completes.
- **SCM Auto-Focus**: Source Control view auto-focuses 5 seconds after applying changes to encourage immediate review.

### Workspace Intelligence
- **Repo Auto-Detection**: Parses workspace git remotes and maps them to Jules sources automatically.
- **Manual Fallback**: If a matching repository is not found, the system prompts you with a **QuickPick** to select the correct Jules source manually.
- **Current Branch Detection**: "Create Session" pre-fills the branch from your active git branch.
- **QuickPick Flow**: Streamlined command palette workflow for session creation.

### Security & Performance
- **SecretStorage**: API keys stored securely in the OS Keychain — never in plaintext settings.
- **ClientManager Singleton**: Cached API client eliminates redundant SecretStorage reads.
- **Smart Polling**: Stops entirely for `COMPLETED`/`FAILED` sessions; slows to 30s for `PAUSED`/`QUEUED`.
- **Debounced TreeView**: 300ms debounce on refresh calls to batch rapid updates.
- **Async CLI Calls**: All CLI interactions use non-blocking async `execFile`.

### Status Bar
Live count of active sessions and pending approvals always visible at the bottom of VS Code.

---

## 🛡️ Security & Quality Assurance

This extension has been refined through a rigorous security audit and testing process:

- **CSP Protection**: A strict Content Security Policy (CSP) prevents unauthorized script execution and data exfiltration.
- **HTML Escaping**: All dynamic content in the Webview is escaped to eliminate XSS risks.
- **Leak Prevention**: Explicitly managed polling timers and disposable resources prevent memory leaks during long-running sessions.
- **Coverage**: Maintained as part of a mono-repo suite with over **86% test coverage**.

## ⚙️ Automated Release Pipeline

The extension's lifecycle is managed by a structured CI/CD pipeline in GitHub Actions:

1. **Validation**: Every commit is verified for linting errors and test regressions.
2. **Tagging**: Creating a version tag (e.g., `v0.2.x`) triggers a release build.
3. **Publishing**: The extension is automatically packaged into a `.vsix` file and published to the **Open VSX Registry**, ensuring immediate availability for VS Code and VSCodium users.

## 🚀 Getting Started

1. **Install the CLI** (if you haven’t already):
   ```bash
   npm install -g @google/jules
   ```
2. **Authenticate** via Jules:
   ```bash
   jules login
   ```
3. **Set your API Key** in VS Code:
   Open the command palette (`Cmd/Ctrl+Shift+P`) → `Jules: Set API Key`.
   The Setup Wizard will validate your key against the API before confirming.
4. **Open a git-tracked project** that is connected to Jules.
5. **Use the Jules sidebar** or run `Jules: Create New Session` from the command palette.

---

## 🛠️ Commands

| Command | Description |
|---|---|
| `Jules: Set API Key` | Configure your authentication (stored in OS Keychain) |
| `Jules: Create New Session` | Start a new Jules task with QuickPick flow |
| `Jules: New Session with Selection` | Create a session using highlighted code as context |
| `Jules: Refresh Sessions` | Reload the session list |
| `Jules: Open Session Detail` | Open the detail webview for a session |
| `Jules: Delete Session` | Remove a session from the list and the API |
| `Jules: Open in Browser` | View the session in the Jules standalone web dashboard |
| `Jules: Apply Patch (CLI)` | Run `jules remote pull --apply` in the integrated terminal |
| `Jules: Send Terminal Error to Jules` | Automatically fix terminal tracebacks using Jules |

---

### Recent Feature Highlights (latest Beta)

#### 🛡️ CLI Safety & Confirmations
Before any local code is modified, Jules now provides a **Modal Warning** for the `Apply Patch` command. This ensures that users explicitly approve the `jules remote pull --apply` action before the CLI touches the filesystem.

#### 🐙 Multi-line Terminal Errors
The "Send Terminal Error to Jules" command has been enhanced. It now opens a **Virtual Text Editor** buffer, allowing you to paste full, multi-line stack traces or large logs as context for the fix session. Jules will automatically parse the content above the marker:
`// --- PASTE TERMINAL ERROR OUTPUT ABOVE THIS LINE ---`

#### ⏳ Visual Loading States
Action buttons in the Session Detail webview (e.g., **Approve Plan**, **Apply Changes**, **Send Message**) now provide immediate visual feedback. Buttons transition to a **Loading State** (e.g., "Approving...") and are temporarily disabled to prevent duplicate requests while API calls are in flight.

---

## ⚙️ Settings

| Setting | Default | Description |
|---|---|---|
| `jules.codeLens.enabled` | `true` | Show/hide inline CodeLens action buttons |
| `jules.autoRefreshInterval` | `60` | Background polling interval in seconds |
| `jules.autoApplyAfterApproval` | `false` | Auto-pull changes when a session completes |

---

## ❓ Troubleshooting

**“jules: command not found” when applying a patch**
Install the CLI: `npm install -g @google/jules`. The extension will surface a direct link if it detects the CLI is missing.

**API Key not accepted in Setup Wizard**
Ensure the key is a valid `x-goog-api-key` from [jules.google.com/settings](https://jules.google.com/settings). The wizard performs a live validation call.

**Notifications not appearing**
Check that OS-level notifications for VS Code are enabled in your system preferences.

**Sessions panel is blank after opening**
Click the refresh icon in the Jules sidebar or run `Jules: Refresh Sessions` from the command palette.
