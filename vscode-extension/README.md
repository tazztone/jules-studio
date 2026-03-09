# Jules Studio for VS Code

Bring the power of Jules directly into your IDE. Manage sessions, approve plans, and apply patches without leaving your editor.

## Prerequisites

This extension requires the **Jules CLI** to be installed on your machine for pulling changes to your local workspace:

```bash
npm install -g @google/jules
```

---

## Features

- **Sidebar TreeView**: View all your Jules sessions at a glance with live status updates.
- **Auto-Detection**: The extension auto-detects your repository remote and maps it to your Jules sources.
- **Session Detail View**: Rich Webview panel with activity timeline, plan steps, and unidiff viewer.
- **Secure Storage**: API keys are stored securely using VS Code's SecretStorage (OS Keychain).
- **Integrated Terminal**: Apply patches and pull changes directly with one click.
- **Status Bar**: Monitor active session counts and pending approvals from the bottom bar.

## Getting Started

1. **Install Dependencies**: Ensure you have the Jules CLI installed:
   ```bash
   npm install -g @google/jules
   ```
2. **Set API Key**: Run the command `Jules: Set API Key` from the command palette (`Cmd/Ctrl+Shift+P`).
3. **Open a Project**: Open a git-tracked folder that is connected to Jules.
4. **Start Coding**: Use the `+` icon in the Jules sidebar or run `Jules: Create New Session`.

## Commands

- `Jules: Set API Key` — Configure your authentication.
- `Jules: Create New Session` — Start a new task with Jules.
- `Jules: Refresh Sessions` — Reload the session list.
- `Jules: Open Session Detail` — View detailed timeline and diffs.
- `Jules: Apply Patch (CLI)` — Run the CLI pull command in your terminal.

## Requirements

- Jules API Key (get from jules.google.com/settings)
- Jules CLI (`@google/jules`) for `Apply Patch` functionality.
