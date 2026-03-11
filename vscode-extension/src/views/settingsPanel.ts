import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { AuthManager } from '../auth/keyManager';

export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(authManager: AuthManager, refreshCallback: () => void) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'julesSettings',
            'Jules Settings',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, authManager, refreshCallback);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly authManager: AuthManager,
        private readonly refreshCallback: () => void
    ) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'saveSettings':
                        await this._saveSettings(message.data);
                        return;
                    case 'updateApiKey':
                        await this._updateApiKey(message.key);
                        return;
                    case 'removeApiKey':
                        await this._removeApiKey();
                        return;
                }
            },
            null,
            this._disposables
        );

        this._initialize();
    }

    private async _initialize() {
        try {
            const hasKey = !!(await this.authManager.getApiKey());
            const config = vscode.workspace.getConfiguration('jules');

            const autoRefreshInterval = config.get<number>('autoRefreshInterval', 60);
            const pageSize = config.get<number>('pageSize', 10);
            const autoDetectRepo = config.get<boolean>('autoDetectRepo', true);
            const autoSyncWip = config.get<boolean>('autoSyncWip', false);
            const codeLensEnabled = config.get<boolean>('codeLens.enabled', true);

            this._panel.webview.html = this._getHtmlForWebview(
                hasKey,
                autoRefreshInterval,
                pageSize,
                autoDetectRepo,
                autoSyncWip,
                codeLensEnabled
            );
        } catch (err: any) {
            this._panel.webview.html = `<h2>Error loading settings</h2><p>${err.message}</p>`;
        }
    }

    private async _saveSettings(data: any) {
        const config = vscode.workspace.getConfiguration('jules');

        await config.update('autoRefreshInterval', parseInt(data.autoRefreshInterval), vscode.ConfigurationTarget.Global);
        await config.update('pageSize', parseInt(data.pageSize), vscode.ConfigurationTarget.Global);
        await config.update('autoDetectRepo', data.autoDetectRepo, vscode.ConfigurationTarget.Global);
        await config.update('autoSyncWip', data.autoSyncWip, vscode.ConfigurationTarget.Global);
        await config.update('codeLens.enabled', data.codeLensEnabled, vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage('Jules settings saved successfully.');
        this.refreshCallback();
    }

    private async _updateApiKey(key: string) {
        if (!key) return;

        await this.authManager.setApiKey(key);
        vscode.commands.executeCommand('setContext', 'jules:hasApiKey', true);

        // Notify user and re-render
        vscode.window.showInformationMessage('API Key updated successfully.');
        this._initialize();
        this.refreshCallback();
    }

    private async _removeApiKey() {
        await this.authManager.setApiKey('');
        vscode.commands.executeCommand('setContext', 'jules:hasApiKey', false);

        vscode.window.showInformationMessage('API Key removed.');
        this._initialize();
        this.refreshCallback();
    }

    private _getHtmlForWebview(
        hasKey: boolean,
        autoRefreshInterval: number,
        pageSize: number,
        autoDetectRepo: boolean,
        autoSyncWip: boolean,
        codeLensEnabled: boolean
    ) {
        const nonce = this._generateNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Jules Settings</title>
            <style>
                body {
                    padding: 20px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    max-width: 600px;
                    margin: 0 auto;
                }
                .section {
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                h2 {
                    margin-top: 0;
                    margin-bottom: 15px;
                }
                .form-group {
                    margin-bottom: 15px;
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                .checkbox-group {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .checkbox-group label {
                    margin-bottom: 0;
                    font-weight: normal;
                }
                input[type="text"], input[type="password"], input[type="number"] {
                    width: 100%;
                    padding: 8px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 2px;
                    box-sizing: border-box;
                    font-family: var(--vscode-font-family);
                }
                .help-text {
                    font-size: 0.85em;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }
                .actions {
                    margin-top: 15px;
                    display: flex;
                    gap: 10px;
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
                .status-badge {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.8em;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .status-ok {
                    background: var(--vscode-charts-green);
                    color: white;
                }
                .status-missing {
                    background: var(--vscode-charts-red);
                    color: white;
                }
            </style>
        </head>
        <body>
            <div class="section">
                <h2>Authentication</h2>
                <div>
                    Status: <span class="status-badge ${hasKey ? 'status-ok' : 'status-missing'}">
                        ${hasKey ? 'API Key Configured' : 'API Key Missing'}
                    </span>
                </div>

                <div class="form-group" style="margin-top: 15px;">
                    <label for="apiKey">Set / Update API Key</label>
                    <input type="password" id="apiKey" placeholder="Paste your API key here">
                    <div class="help-text">Get your API key from <a href="https://jules.google.com/settings">jules.google.com/settings</a></div>
                </div>

                <div class="actions">
                    <button id="updateKeyBtn">Update Key</button>
                    ${hasKey ? '<button id="removeKeyBtn" class="secondary">Remove Key</button>' : ''}
                </div>
            </div>

            <div class="section">
                <h2>Preferences</h2>

                <form id="settingsForm">
                    <div class="form-group">
                        <label for="autoRefreshInterval">Auto-Refresh Interval (seconds)</label>
                        <input type="number" id="autoRefreshInterval" value="${autoRefreshInterval}" min="0">
                        <div class="help-text">Set to 0 to disable background polling. Recommended: 60</div>
                    </div>

                    <div class="form-group">
                        <label for="pageSize">Default Page Size</label>
                        <input type="number" id="pageSize" value="${pageSize}" min="1" max="50">
                        <div class="help-text">Number of sessions to load on startup.</div>
                    </div>

                    <div class="form-group checkbox-group">
                        <input type="checkbox" id="autoDetectRepo" ${autoDetectRepo ? 'checked' : ''}>
                        <label for="autoDetectRepo">Auto-Detect Repository</label>
                    </div>
                    <div class="help-text" style="margin-bottom: 15px; margin-left: 24px;">Automatically detect and filter sessions by the current workspace repository on startup.</div>

                    <div class="form-group checkbox-group">
                        <input type="checkbox" id="autoSyncWip" ${autoSyncWip ? 'checked' : ''}>
                        <label for="autoSyncWip">Auto-Sync Work In Progress</label>
                    </div>
                    <div class="help-text" style="margin-bottom: 15px; margin-left: 24px;">Automatically stage, commit to a new branch, and push before creating a session.</div>

                    <div class="form-group checkbox-group">
                        <input type="checkbox" id="codeLensEnabled" ${codeLensEnabled ? 'checked' : ''}>
                        <label for="codeLensEnabled">Enable CodeLens</label>
                    </div>
                    <div class="help-text" style="margin-bottom: 15px; margin-left: 24px;">Show Jules actions above functions and classes in the editor.</div>

                    <div class="actions" style="margin-top: 20px;">
                        <button type="submit" id="saveSettingsBtn">Save Preferences</button>
                    </div>
                </form>
            </div>

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();

                document.getElementById('updateKeyBtn').addEventListener('click', () => {
                    const keyInput = document.getElementById('apiKey');
                    if (keyInput.value.trim()) {
                        vscode.postMessage({ command: 'updateApiKey', key: keyInput.value.trim() });
                        keyInput.value = '';
                    }
                });

                const removeBtn = document.getElementById('removeKeyBtn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        vscode.postMessage({ command: 'removeApiKey' });
                    });
                }

                document.getElementById('settingsForm').addEventListener('submit', (e) => {
                    e.preventDefault();

                    const btn = document.getElementById('saveSettingsBtn');
                    btn.disabled = true;
                    btn.textContent = 'Saving...';

                    vscode.postMessage({
                        command: 'saveSettings',
                        data: {
                            autoRefreshInterval: document.getElementById('autoRefreshInterval').value,
                            pageSize: document.getElementById('pageSize').value,
                            autoDetectRepo: document.getElementById('autoDetectRepo').checked,
                            autoSyncWip: document.getElementById('autoSyncWip').checked,
                            codeLensEnabled: document.getElementById('codeLensEnabled').checked
                        }
                    });

                    setTimeout(() => {
                        btn.disabled = false;
                        btn.textContent = 'Save Preferences';
                    }, 1000);
                });
            </script>
        </body>
        </html>`;
    }

    private _generateNonce() {
        return crypto.randomBytes(16).toString('hex');
    }

    public dispose() {
        SettingsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length > 0) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
