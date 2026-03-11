# Changelog

All notable changes to **Jules Studio for VS Code** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The **v0.2.0-beta** series focuses on stabilizing the CI/CD pipeline, refining UI/UX safety (confirmations, loading states), and hardening monorepo integrity through linting and test isolation improvements.

## [0.2.0-beta.13] — 2026-03-11

### Added
- **Repository Detection**: Added a fallback UI and improved error handling when automatic repository detection fails.
- **CodeLens Intelligence**: CodeLens actions (Write Tests/Refactor) are now dynamically hidden if no API key is configured or if the active file is not part of a Git repository.

### Changed
- **Configuration**: Renamed `jules.autoApplyAfterApproval` to `jules.autoApplyAfterCompletion` to more accurately reflect its behavior.
- **Security**: Upgraded Webview Content Security Policy (CSP) to use cryptographically secure nonces (`crypto.randomBytes`).

### Improved
- **Session Detail View**: Significant internal refactoring to support better state transitions and more robust error fallbacks.

## [0.2.0-beta.1] through [0.2.0-beta.12] — Summary of Improvements

This series of beta releases focused on transitioning the project to a robust monorepo structure with automated delivery and hardened user safety.

### Development & Automation
- **CI/CD Pipeline**: Integrated GitHub Actions for automated testing and multi-registry publishing (Open VSX). Established secure release workflows with automated versioning.
- **Monorepo Integrity**: Standardized linting rules across the codebase, decoupling extension and web app configurations to resolve conflicts.
- **Testing**: significantly increased test coverage for core logic (Repo Detection, TreeView mapping) and implemented strict test isolation for asynchronous operations.

### UI/UX & Safety
- **Operation Safety**: Introduced modal confirmations for destructive or terminal-based actions.
- **Feedback Loops**: Added loading states and disabled-button states to prevent redundant action triggers. 
- **Error Handling**: Implemented a temporary text editor flow for submitting complex terminal errors to Jules, overcoming previous multi-line input limitations.

### Stability
- **Loop Prevention**: Resolved multiple recursive re-render bugs in the web app views.
- **Resource Management**: Fixed background polling leaks and ensured clean extension deactivation.
- **Hardening**: Fixed 100+ ESLint errors and resolved various latent `ReferenceError` and `TypeError` issues across the extension.

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
