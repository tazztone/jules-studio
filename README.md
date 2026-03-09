# Jules Studio

Jules Studio is a modern, unified dashboard for managing AI-driven coding sessions via the [Jules REST API](https://jules.google/docs/api/reference/overview). It provides a visual interface for delegating tasks, reviewing generated plans, monitoring real-time agent activity, and inspecting code artifacts.

## ✨ Features

- **Session Control Center**: Create and manage AI coding tasks with granular control over prompt, source repository, and branch.
- **Real-time Activity Timeline**: Monitor progress events as they happen, from plan generation to completion.
- **Interactive Review UI**: Human-in-the-loop workflows for approving agent plans and communicating with Jules through in-session messaging.
- **Artifact Inspector**: View rendered code diffs (unified patch), terminal logs (bash output), and generated media.
- **Repository Explorer**: Browse connected GitHub repositories and branches.
- **CLI Recipe Builder**: A collection of common automation patterns using the `jules` CLI.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher.
- **Jules API Key**: Obtain your key from the Jules web app settings.

### Installation

1. Clone this repository to your local machine.
2. Install dependencies:
   ```bash
   npm install
   ```

### Local Development

Start the development server:
```bash
npm run dev
```
The application will be available at `http://localhost:5173`.

### 🔏 Configuration & Security

#### API Key
Navigate to the **Settings** tab in the application to enter your `x-goog-api-key`. For local development, this key is stored in your browser's `localStorage`. If no key is provided, the app runs in **Demo Mode** with mock data.

#### Vite Proxy (CORS Handling)
To avoid Cross-Origin Resource Sharing (CORS) issues when communicating with `https://jules.googleapis.com`, this project is configured with a built-in proxy in `vite.config.js`. API requests starting with `/v1alpha` are automatically routed to the Google API backend.

## 🏗 Architecture

- **Frontend**: React (Hooks, Functional Components)
- **Routing**: React Router v6
- **Styling**: Tailwind CSS (Utility-first, Dark mode)
- **Icons**: Lucide React
- **Build Tool**: Vite

### Directory Structure
```text
src/
├── components/          # Modular React components
│   ├── Common.jsx       # Shared UI and API helpers
│   ├── Sidebar.jsx      # Navigation sidebar
│   ├── SessionsList.jsx # Dashboard for active sessions
│   ├── SessionDetail.jsx# Timeline and Artifact workspace
│   └── ...
├── App.jsx              # Main application entry and routing
├── main.jsx             # React DOM mounting
└── index.css            # Global styles and Tailwind directives
```

## 🛠 Advanced: CLI Integration

Jules Studio complements the official [Jules Tools CLI](https://jules.google/docs/cli/reference). You can use the **CLI Recipes** tab to find scripts for:
- Batch delegating tasks from a `TODO.md`.
- Triaging GitHub issues with Gemini and Jules.
- Pulling remote artifacts directly into your local IDE.

---
*Created by [Antigravity](https://github.com/google-deepmind/jules-studio).*
