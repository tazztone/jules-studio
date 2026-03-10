# Changelog

All notable changes to **Jules Studio for VS Code** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0-beta.3] — 2026-03-10

### Fixed
- **CI Linting**: Resolved 27 ESLint warnings (naming conventions, missing braces) to satisfy strict CI checks.

## [0.2.0-beta.2] — 2026-03-10

### Added
- **CI/CD Automation**: Integrated GitHub Actions for automated testing and Open VSX publishing.
- **CI Status Badge**: Added real-time build status to the README.

## [0.2.0-beta.1] — 2026-03-10

### Changed
- **Beta Preview**: Marked extension as a preview release to manage expectations.

### Fixed
- **Configuration Bug**: Relocated `configuration` block inside `contributes` in `package.json` so settings correctly appear in VS Code.
- **Timer Leak**: Ensured background polling stops immediately on extension deactivation.
- **Test Isolation**: Wrapped global fetch mocks in `try/finally` to prevent test-to-test leakage.

### Improved
- **Destructive Action Safety**: Added modal confirmation dialog before running terminal-based code applications.
- **Multi-line Error Input**: "Send Terminal Error to Jules" now opens a temporary text editor for full stack trace support.
- **Webview UX**: Buttons now provide immediate visual feedback (disabled + loading text) while actions are in flight.

### Testing
- **Coverage**: Added 16 automated tests covering `RepoDetector` URL parsing, `SessionsTreeProvider` data mapping, and `JulesClient` retry/error logic.
- **Linting**: Added official ESLint configuration for the project.

---

## [0.1.0] — 2026-03-10

### Added

#### Core
- **Sidebar TreeView** with state-aware session icons (🚀 in-progress, ✅ completed, ⚠️ awaiting approval).
- **Session Detail Webview** with activity timeline, plan steps, and inline unified diff viewer.
- **Multi-panel support** — open multiple sessions simultaneously with state preserved when switching tabs (`retainContextWhenHidden`).
- **Setup Wizard** with live API key validation against the Jules API.
- **Secure API key storage** via VS Code `SecretStorage` (OS Keychain).
- **Status Bar** showing live active session count and pending approvals.

#### Session Actions
- Approve Plan, Send Message, Apply Patch, Delete Session, Open in Browser — all available from the sidebar context menu and webview.
- `jules remote pull --apply` executed in the integrated terminal via **Apply Patch**.
- **CLI Guard**: detects whether `@google/jules` is installed before attempting a pull; shows install link if missing.

#### Workspace Intelligence
- **Repo auto-detection**: parses workspace git remotes and matches to Jules sources.
- **Current branch detection**: pre-fills the branch field on session creation.
- **QuickPick flow** for streamlined session creation from the command palette.

#### CodeLens & Context Integration
- `🐙 Jules: Write Tests` and `🐙 Jules: Refactor` CodeLens buttons above functions, methods, and classes (toggleable via `jules.codeLens.enabled`).
- **Include Active File** toggle when creating a session.
- **Send Terminal Error to Jules** via terminal right-click context menu.

#### Proactive Workflows
- **Background polling** at a configurable interval (`jules.autoRefreshInterval`, default 60s).
- **Desktop notifications** with Approve / Apply / Open action buttons for `AWAITING_PLAN_APPROVAL`, `COMPLETED`, and `FAILED` state transitions.
- **Notification batching**: single summary shown if 3+ sessions change state simultaneously.
- **Auto-Apply** setting (`jules.autoApplyAfterApproval`) to pull changes automatically on completion.
- **SCM Auto-Focus**: Source Control view auto-focused 5 seconds after applying changes.
- **Smart polling throttle**: stops for `COMPLETED`/`FAILED`, slows to 30s for `PAUSED`/`QUEUED`.

#### Security & Performance
- Strict **Content Security Policy (CSP)** + nonce-based script execution in all webviews.
- **XSS protection**: all dynamic API data sanitised with `escapeHtml()` before DOM injection.
- **ClientManager singleton** caches the API client, eliminating redundant `SecretStorage` reads.
- **Debounced TreeView refresh** (300ms) to batch rapid state updates.
- All CLI interactions use non-blocking async `execFile`.

#### Rich Tooltips
- Hover a session in the sidebar to see repository name, relative last-updated time, and contextual next action.

#### Friendly Empty States
- Status-aware messages in the webview (e.g., "⏳ Jules is preparing a plan…") instead of blank screens.
