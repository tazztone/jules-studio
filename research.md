# Capabilities of the Jules REST API and CLI for Application Development

## Executive summary

The Jules REST API and CLI allow applications to create and manage AI-driven coding sessions on connected GitHub repositories, monitor fine‑grained progress, and retrieve structured outputs such as pull requests, code patches, command logs, and media artifacts. By combining HTTP endpoints with a scriptable CLI and terminal UI, developers can embed Jules into custom tools, workflows, and automations for task delegation, review, and monitoring.

## Core concepts and resources

The API revolves around three primary resources: **Source** (a connected repository), **Session** (a unit of work on that source), and **Activity** (an event within a session such as plan generation, messages, progress, or completion). Each resource has a stable name following Google‑style conventions, for example `sources/{sourceId}`, `sessions/{sessionId}`, and `sessions/{sessionId}/activities/{activityId}`.

A **Session** encapsulates the agent’s work on a repository given a `prompt`, an optional `title`, a required `sourceContext`, optional `requirePlanApproval`, and an `automationMode` that can automatically open pull requests. An **Activity** represents a single event inside that session and can include artifacts such as change sets, bash output, media, or plan and messaging events.

## Authentication and base patterns

The Jules REST API uses API keys; clients obtain keys from the Jules web app settings and send them on every request in the `x-goog-api-key` (or `X-Goog-Api-Key`) HTTP header. Keys are managed in the web UI, limited in number, and should be kept secret because exposed keys may be disabled automatically.

The reference describes common patterns for **pagination** using `pageSize` and `pageToken` query parameters on list endpoints, **resource naming** using hierarchical strings, and standard HTTP status codes (200, 400, 401, 403, 404, 429, 500) with JSON error bodies. These patterns allow applications to page through large result sets, robustly handle errors, and store stable resource identifiers.

## Sources API capabilities

Sources represent GitHub repositories that have been connected to Jules through the web interface; the API is currently read‑only for sources. Once a GitHub repository is connected via the Jules GitHub app, applications can discover and inspect those repositories programmatically.

The **List Sources** endpoint (`GET /v1alpha/sources`) returns all sources for the authenticated account, with support for `pageSize`, `pageToken`, and an AIP‑160‑style `filter` expression (for example filtering by specific `name` values). The **Get Source** endpoint (`GET /v1alpha/sources/{sourceId}`) retrieves a specific source object including its GitHub repository details and available branches, which applications can then use when creating sessions.

## Sessions API capabilities

The **Create Session** endpoint (`POST /v1alpha/sessions`) is the main entry point to delegate a coding task; it accepts fields such as `prompt`, optional `title`, required `sourceContext` (including `source` and GitHub repo context), `requirePlanApproval`, and `automationMode` (e.g., `AUTO_CREATE_PR`). The quickstart demonstrates creating a session that asks Jules to build a “boba app” in a specified repository and branch, optionally auto‑creating a pull request with the resulting changes.

The **List Sessions** endpoint (`GET /v1alpha/sessions`) lets applications enumerate a user’s sessions with pagination parameters, while **Get Session** (`GET /v1alpha/sessions/{sessionId}`) returns the full session object including outputs such as pull requests once complete. There is also a **Delete Session** endpoint to remove a session and two action endpoints: **Send Message** (`POST /v1alpha/sessions/{sessionId}:sendMessage`) to add user messages to an active session and **Approve Plan** (`POST /v1alpha/sessions/{sessionId}:approvePlan`) to approve a pending plan when `requirePlanApproval` is true.

### Session state model and outputs

Sessions progress through well‑defined states such as `QUEUED`, `PLANNING`, `AWAITING_PLAN_APPROVAL`, `AWAITING_USER_FEEDBACK`, `IN_PROGRESS`, `PAUSED`, `COMPLETED`, and `FAILED`. Applications can poll session objects to track these states and decide when to surface status to users or fetch results.

When a session completes, its `outputs` field exposes **SessionOutput** objects, which can include pull request metadata like URL, title, and description; this allows an app to deep‑link users directly to generated pull requests. The session object also exposes timestamps such as `createTime` and `updateTime`, plus a web `url` for viewing the session directly in Jules.

## Activities API capabilities and artifacts

The **List Activities** endpoint (`GET /v1alpha/sessions/{sessionId}/activities`) returns all activities for a given session, supporting `pageSize` and `pageToken` to page through the event stream. The **Get Activity** endpoint (`GET /v1alpha/sessions/{sessionId}/activities/{activityId}`) retrieves a single activity including all of its details and artifacts.

The documentation enumerates activity event variants such as `planGenerated`, `planApproved`, `userMessaged`, `agentMessaged`, `progressUpdated`, `sessionCompleted`, and `sessionFailed`, exactly one of which is populated per activity. Activities can also include an `artifacts` array containing rich outputs like code change sets, bash command output, or media files created during the session.

### Artifact and plan structures

Artifacts include **ChangeSet**, **BashOutput**, and **Media** structures, which give applications structured access to Jules’s outputs. A `ChangeSet` references a `source` and embeds a `GitPatch` with fields such as `baseCommitId`, unified diff text (`unidiffPatch`), and a `suggestedCommitMessage`, allowing apps to inspect or apply patches programmatically.

`BashOutput` records executed commands, combined stdout/stderr output, and the exit code, while `Media` encapsulates binary outputs via MIME type and base64‑encoded data. Plans are represented by **Plan** and **PlanStep** types, where a plan has an `id`, `steps`, and `createTime`, and each step has its own `id`, index, title, and description explaining the planned work.

## Data types for GitHub and context

The **Source** type ties a Jules source to a specific **GitHubRepo**, containing properties such as repository owner, name, privacy flag, default branch, and a list of active branches modeled as **GitHubBranch** objects. The **GitHubRepoContext** type specifies session‑level GitHub configuration, notably the required `startingBranch` from which Jules begins its work.

The **SourceContext** type combines the `source` resource name with the optional `githubRepoContext` and is required when creating a session, ensuring that all work is properly scoped to an existing connected repository. These types enable applications to design flows around branch selection, repository privacy, or branch‑specific automations.

## Request/response helper types

The types reference defines helper request and response messages such as **SendMessageRequest**, **ApprovePlanRequest**, and their corresponding empty response types. There are also list response types such as **ListSessionsResponse**, **ListActivitiesResponse**, and **ListSourcesResponse**, each containing an array of the relevant resource and a `nextPageToken` for pagination.

By modeling these as explicit types, the API provides consistent patterns that generated clients or strongly typed SDKs can consume, simplifying integration in larger applications.

## CLI: Jules Tools capabilities

Jules Tools is a Node‑installable CLI (`jules`) that exposes Jules’s capabilities from the terminal as both a command surface and an interactive dashboard. It authenticates using Google account login via a browser flow and supports logging out when needed.

The CLI supports global flags such as `-h/--help` for documentation and `--theme` to switch between dark and light themes for the terminal UI. Running `jules` with no arguments launches a terminal user interface (TUI) that shows sessions, provides a dashboard‑style view, and offers guided flows for creating new sessions similar to the web UI.

### Core CLI commands

The `version` command prints the installed CLI version, and `completion` generates shell completion scripts for shells like bash or zsh to enable tab completion. The `remote` command is the main way to work with cloud sessions and has several subcommands that map closely to API capabilities.

`remote list` can list either connected repositories (`--repo`) or active sessions (`--session`), effectively surfacing sources and sessions from the command line. `remote new` creates a new remote session by specifying a `--repo` (such as `torvalds/linux` or `.` for the current repo) and a `--session` string describing the task, while `remote pull` retrieves results from a completed session given its `--session` ID.

## CLI scripting and automation patterns

The examples documentation emphasizes that Jules Tools is designed to be composed with other Unix tools for automation and scripting. One example reads a local `TODO.md` file and turns each line into a new session in the current repository, effectively batch‑delegating tasks to Jules from a plain‑text backlog.

Another example pipes the title of the first GitHub issue assigned to the user into `jules remote new`, using the `gh` and `jq` CLIs to select the issue; this pattern shows how apps or scripts can dynamically create sessions from external issue trackers. A third example uses the Gemini CLI to analyze assigned issues, identify the most tedious one, and then send that issue to Jules, demonstrating more complex multi‑tool pipelines where other AI tools triage work before delegating to Jules.

## Application design possibilities using the API

Because applications can list sources, create and manage sessions, stream activities, and inspect artifacts, they can implement custom task‑delegation frontends that let users describe coding tasks and then watch Jules’s progress, including plan creation and status updates. Input forms can expose fields such as `prompt`, repository choice, branch selection, plan‑approval requirement, and automation mode, mirroring the Create Session request structure.

By polling session and activity endpoints, applications can offer rich progress dashboards that surface the latest agent messages, user messages, plan steps, and progress updates, with direct links to the underlying session and any generated pull requests. Error states such as `FAILED` or quota issues can be surfaced using the documented status codes and session state values, allowing robust UX around retries or support escalation.

### Approval, feedback, and review flows

The combination of `requirePlanApproval`, the Approve Plan endpoint, and user messaging allows applications to build explicit review and feedback workflows. For example, an app can show the generated plan (from plan‑related activities) to a human reviewer, call Approve Plan when the reviewer confirms, and then enable in‑session messaging to refine the task.

Since activities capture both user and agent messages as well as progress updates, applications can implement chat‑like views, activity timelines, or notifications (e.g., via email or chat) whenever certain activity types occur. Artifacts such as change sets and bash output can be rendered inline in code review UIs, logs viewers, or diff inspectors.

### Code change management and repository tooling

Using the Session outputs and Artifact types, applications can detect when pull requests are created and surface them in custom dashboards or integrate them into CI/CD pipelines. For more advanced flows, apps can parse `ChangeSet` and `GitPatch` artifacts to analyze or transform diffs before applying them, for example to enforce internal policies or run additional checks.

Because sources capture repository metadata, apps can specialize flows by repository owner, privacy, or branch, for example limiting automation to certain branches or surfacing different UI options for public versus private repositories. GitHub‑aware apps can also use the default branch and branch list to drive branch selection widgets when creating sessions.

## Application design possibilities using the CLI

The CLI and TUI enable building lightweight tools where shell scripts or local apps orchestrate Jules sessions without managing HTTP requests directly. For example, a desktop app could invoke `jules remote new` under the hood to create sessions and then periodically call `remote list` or `remote pull` to fetch results.

Because the CLI is composable with tools like `gh`, `jq`, and the Gemini CLI, developers can script multi‑step automations such as auto‑triaging issue backlogs, assigning certain issues to Jules, and retrieving results into local branches or other systems. The interactive TUI can act as a built‑in dashboard that complements any custom UI, providing immediate visibility into active sessions even when users are not inside a browser.

## Conclusion

Taken together, the Jules REST API and CLI provide a comprehensive surface for applications to delegate coding work, monitor rich progress signals, and consume structured outputs bound to GitHub repositories. By combining HTTP endpoints, typed resources, and a scriptable CLI, developers can embed Jules into bespoke apps, dashboards, and automation pipelines tailored to their development workflows.