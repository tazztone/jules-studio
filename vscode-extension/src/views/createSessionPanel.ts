import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { ClientManager } from '../api/clientManager';
import { RepoDetector } from '../workspace/repoDetector';
import { PromptGenerator } from '../workspace/promptGenerator';
import { GeminiClient } from '../api/geminiClient';
import { validatePrompt, validateBranchName } from '../utils/validators';
import { ValidationError, SecurityError } from '../utils/errors';
import { GitContextManager } from '../workspace/gitContext';

export class CreateSessionPanel {
    public static currentPanel: CreateSessionPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(clientManager: ClientManager, refreshCallback: () => void, initialContext?: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (CreateSessionPanel.currentPanel) {
            CreateSessionPanel.currentPanel._panel.reveal(column);
            // Re-initialize with new context if provided
            if (initialContext) {
                CreateSessionPanel.currentPanel._initialize(initialContext);
            }
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'julesCreateSession',
            'New Jules Session',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        CreateSessionPanel.currentPanel = new CreateSessionPanel(panel, clientManager, refreshCallback, initialContext);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly clientManager: ClientManager,
        private readonly refreshCallback: () => void,
        initialContext?: string
    ) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'submit':
                        this._submitSession(message.data);
                        return;
                    case 'cancel':
                        this._panel.dispose();
                        return;
                }
            },
            null,
            this._disposables
        );

        this._initialize(initialContext);
    }

    private async _initialize(initialContext?: string) {
        this._panel.webview.html = this._getLoadingHtml();

        try {
            const client = await this.clientManager.getClient();
            const detector = new RepoDetector(client);

            // Auto-detect source
            let defaultSource = await detector.getMatchingSource();

            // List all sources
            const sourcesList = await client.listSources();
            const sources = sourcesList.sources.map(s => ({
                id: s.id,
                name: s.name,
                label: s.githubRepo ? `${s.githubRepo.owner}/${s.githubRepo.repo}` : s.id
            }));

            // Get current branch
            const gitExt = vscode.extensions.getExtension('vscode.git')?.exports;
            const api = gitExt?.getAPI(1);
            const repo = api?.repositories[0];
            const currentBranch = repo?.state?.HEAD?.name || 'main';

            // Get available contexts (brains)
            const authManager = this.clientManager.authManager;
            const geminiClient = new GeminiClient(authManager);
            const outputChannel = vscode.window.createOutputChannel('Jules Bridge');
            const generator = new PromptGenerator(outputChannel, geminiClient);
            const brainContexts = await generator.getAvailableContexts() || [];

            // Try to generate a prepopulated mission brief
            let defaultPrompt = initialContext || '';
            if (repo && vscode.window.activeTextEditor) {
                try {
                    const generatedContext = await generator.generatePrompt(repo, vscode.window.activeTextEditor, undefined);
                    const briefMatch = generatedContext.match(/<mission_brief>([\s\S]*?)<\/mission_brief>/);
                    if (briefMatch && briefMatch[1] && !briefMatch[1].includes('[Describe your task here...]')) {
                        defaultPrompt = briefMatch[1].trim();
                    }
                } catch (err) {
                    console.log('Error generating initial prompt context', err);
                }
            }

            this._panel.webview.html = this._getHtmlForWebview(
                sources,
                defaultSource || '',
                currentBranch,
                brainContexts,
                defaultPrompt,
                initialContext || ''
            );

        } catch (err: any) {
            this._panel.webview.html = this._getErrorHtml(err.message);
        }
    }

    private async _submitSession(data: any) {
        try {
            validatePrompt(data.prompt);
            validateBranchName(data.branch);

            const client = await this.clientManager.getClient();
            const gitExt = vscode.extensions.getExtension('vscode.git')?.exports;
            const api = gitExt?.getAPI(1);
            const repo = api?.repositories[0];

            let finalPrompt = data.prompt;
            let currentBranch = data.branch;

            // Sync WIP if enabled and we have a repo
            if (repo) {
                const config = vscode.workspace.getConfiguration('jules');
                const autoSyncWip = config.get<boolean>('autoSyncWip', false);

                if (autoSyncWip) {
                    const isDirty = repo.state.workingTreeChanges.length > 0 || repo.state.indexChanges.length > 0;
                    if (isDirty) {
                        const outputChannel = vscode.window.createOutputChannel('Jules Bridge');
                        const gitManager = new GitContextManager(outputChannel);
                        await vscode.window.withProgress(
                            { location: vscode.ProgressLocation.Notification, title: 'Auto-Syncing Uncommitted Changes...' },
                            async () => {
                                await gitManager.pushWipChanges(repo as any);
                                currentBranch = repo?.state?.HEAD?.name || currentBranch;
                            }
                        );
                    }
                }

                // Generate context
                const authManager = this.clientManager.authManager;
                const geminiClient = new GeminiClient(authManager);
                const outputChannel = vscode.window.createOutputChannel('Jules Bridge');
                const generator = new PromptGenerator(outputChannel, geminiClient);

                let selectedBrainContextPath = data.brainContext === 'none' ? undefined : data.brainContext;

                let generatedContext = '';
                await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: 'Gathering Workspace Context...' },
                    async () => {
                        generatedContext = await generator.generatePrompt(
                            repo,
                            vscode.window.activeTextEditor,
                            selectedBrainContextPath
                        );
                    }
                );

                let fileContext = '';
                if (selectedBrainContextPath && !generatedContext.includes(selectedBrainContextPath)) {
                    fileContext += `\n\nContinuing from Antigravity Brain Context: ${selectedBrainContextPath}`;
                }

                const combinedContext = [data.initialContext, generatedContext, fileContext].filter(Boolean).join('\n\n');
                finalPrompt = combinedContext ? `${data.prompt}\n\n${combinedContext}` : data.prompt;
            }

            const sourceContext = {
                source: data.source,
                githubRepoContext: { startingBranch: currentBranch }
            };

            const session = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Starting Jules Session...' },
                async () => {
                    return await client.createSession(
                        finalPrompt,
                        sourceContext,
                        data.title,
                        data.automationMode === 'manual',
                        data.automationMode === 'auto_pr' ? 'AUTO_CREATE_PR' : undefined
                    );
                }
            );

            vscode.window.showInformationMessage(`Session "${session.title || session.id}" created!`);
            this.refreshCallback();

            // Open the detail view
            vscode.commands.executeCommand('jules.openSession', { session });

            // Close the creation panel
            this.dispose();

        } catch (err: any) {
            if (err instanceof ValidationError || err instanceof SecurityError) {
                vscode.window.showErrorMessage(`Validation failed: ${err.message}`);
                return;
            }
            vscode.window.showErrorMessage(`Failed to create session: ${err.message}`);
        }
    }

    private _getLoadingHtml() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body { padding: 20px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
                .loader { margin-top: 20px; }
            </style>
        </head>
        <body>
            <h2>New Jules Session</h2>
            <div class="loader">Loading workspace context and Jules sources...</div>
        </body>
        </html>`;
    }

    private _getErrorHtml(error: string) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body { padding: 20px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
                .error { color: var(--vscode-errorForeground); margin-top: 20px; }
            </style>
        </head>
        <body>
            <h2>New Jules Session</h2>
            <div class="error">Error loading session data: ${error}</div>
        </body>
        </html>`;
    }

    private _getHtmlForWebview(
        sources: any[],
        defaultSource: string,
        currentBranch: string,
        brainContexts: any[],
        defaultPrompt: string,
        initialContext: string
    ) {
        const nonce = this._generateNonce();

        const sourceOptions = sources.map(s =>
            `<option value="${s.name}" ${s.name === defaultSource ? 'selected' : ''}>${s.label} (${s.name})</option>`
        ).join('');

        const brainOptions = [
            `<option value="none">None (Do not include previous agent brain context)</option>`,
            ...brainContexts.map(c => `<option value="${c.path}">${c.name} - ${c.title}</option>`)
        ].join('');

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Jules Session</title>
            <style>
                body {
                    padding: 20px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    max-width: 800px;
                    margin: 0 auto;
                }
                .form-group {
                    margin-bottom: 20px;
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                input[type="text"], select, textarea {
                    width: 100%;
                    padding: 8px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 2px;
                    box-sizing: border-box;
                    font-family: var(--vscode-font-family);
                }
                textarea {
                    min-height: 150px;
                    resize: vertical;
                }
                .actions {
                    margin-top: 30px;
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    cursor: pointer;
                    border-radius: 2px;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                button.secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                button.secondary:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                .help-text {
                    font-size: 0.85em;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }
            </style>
        </head>
        <body>
            <h2>Create New Jules Session</h2>

            <form id="sessionForm">
                <input type="hidden" id="initialContext" value="${this._escapeHtml(initialContext)}">

                <div class="form-group">
                    <label for="title">Title (Optional)</label>
                    <input type="text" id="title" placeholder="e.g., Fix Auth Bug">
                </div>

                <div class="form-group">
                    <label for="prompt">Prompt / Mission Brief <span style="color:var(--vscode-errorForeground)">*</span></label>
                    <textarea id="prompt" placeholder="What should Jules do? e.g., Fix the bug in auth middleware" required>${this._escapeHtml(defaultPrompt)}</textarea>
                </div>

                <div class="form-group">
                    <label for="source">Repository Source <span style="color:var(--vscode-errorForeground)">*</span></label>
                    <select id="source" required>
                        ${sourceOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label for="branch">Branch <span style="color:var(--vscode-errorForeground)">*</span></label>
                    <input type="text" id="branch" value="${this._escapeHtml(currentBranch)}" required>
                    <div class="help-text">The branch to start from.</div>
                </div>

                <div class="form-group">
                    <label for="brainContext">Brain Context (Antigravity)</label>
                    <select id="brainContext">
                        ${brainOptions}
                    </select>
                    <div class="help-text">Continue from an existing agent context.</div>
                </div>

                <div class="form-group">
                    <label for="automationMode">Automation Mode</label>
                    <select id="automationMode">
                        <option value="manual">Manual Approval - Approve every plan manually</option>
                        <option value="auto_pr">Auto Create PR - Create PR automatically once finished</option>
                    </select>
                </div>

                <div class="actions">
                    <button type="button" class="secondary" id="cancelBtn">Cancel</button>
                    <button type="submit" id="submitBtn">Create Session</button>
                </div>
            </form>

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();

                document.getElementById('sessionForm').addEventListener('submit', (e) => {
                    e.preventDefault();

                    const btn = document.getElementById('submitBtn');
                    btn.disabled = true;
                    btn.textContent = 'Creating...';

                    vscode.postMessage({
                        command: 'submit',
                        data: {
                            title: document.getElementById('title').value,
                            prompt: document.getElementById('prompt').value,
                            source: document.getElementById('source').value,
                            branch: document.getElementById('branch').value,
                            brainContext: document.getElementById('brainContext').value,
                            automationMode: document.getElementById('automationMode').value,
                            initialContext: document.getElementById('initialContext').value
                        }
                    });
                });

                document.getElementById('cancelBtn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'cancel' });
                });
            </script>
        </body>
        </html>`;
    }

    private _escapeHtml(text: string) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private _generateNonce() {
        return crypto.randomBytes(16).toString('hex');
    }

    public dispose() {
        CreateSessionPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length > 0) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
