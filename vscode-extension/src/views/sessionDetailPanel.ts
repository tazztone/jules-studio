import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Session } from '../api/types';
import { ClientManager } from '../api/clientManager';

export class SessionDetailPanel {
    public static panels: Map<string, SessionDetailPanel> = new Map();
    private static globalPollInterval: NodeJS.Timeout | undefined;
    private static isPolling: boolean = false;

    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _session: Session; // Refactor: Mutable state

    private constructor(
        panel: vscode.WebviewPanel,
        session: Session,
        private readonly clientManager: ClientManager,
        onSessionUpdatedEvent: vscode.Event<Session>
    ) {
        this._session = session;
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtmlForWebview();
        
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'approve':
                        await this._approvePlan();
                        break;
                    case 'sendMessage':
                        await this._sendMessage(message.text);
                        break;
                    case 'applyPatch':
                        vscode.commands.executeCommand('jules.applyPatch', { session: this._session });
                        break;
                    case 'openBrowser':
                        const url = `https://jules.google.com/sessions/${this._session.name.split('/').pop()}`;
                        vscode.env.openExternal(vscode.Uri.parse(url));
                        break;
                }
            },
            null,
            this._disposables
        );

        // Listen for tree view updates just in case, but rely primarily on our own sequential polling
        onSessionUpdatedEvent((updatedSession: Session) => {
            if (updatedSession.id === this._session.id) {
                this._update(updatedSession);
            }
        }, null, this._disposables);

        // Initial update
        this._update();

        // Ensure global polling is running
        SessionDetailPanel.startGlobalPolling();
    }

    private static startGlobalPolling() {
        if (this.globalPollInterval) {
            return;
        }

        const poll = async () => {
            if (this.isPolling) {
                return;
            }
            this.isPolling = true;

            try {
                // Determine if we need to poll fast or slow based on the active panels
                let hasActive = false;

                // Poll each panel sequentially to avoid 429
                for (const panel of this.panels.values()) {
                    const session = await panel._update();
                    if (session && !['COMPLETED', 'FAILED'].includes(session.state)) {
                        hasActive = true;
                    }
                    // Small delay between panel updates
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                // If any panel is active, poll every 10s. If all are idle, 30s.
                const nextDelay = hasActive ? 10000 : 30000;

                if (this.panels.size > 0) {
                    this.globalPollInterval = setTimeout(poll, nextDelay);
                } else {
                    this.globalPollInterval = undefined;
                }
            } finally {
                this.isPolling = false;
            }
        };

        this.globalPollInterval = setTimeout(poll, 10000);
    }

    public static createOrShow(session: Session, clientManager: ClientManager, onSessionUpdatedEvent: vscode.Event<Session>) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        const existingPanel = SessionDetailPanel.panels.get(session.id);
        if (existingPanel) {
            existingPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'sessionDetail',
            `Session: ${session.title || session.id}`,
            column || vscode.ViewColumn.One,
            { 
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const sessionDetailPanel = new SessionDetailPanel(panel, session, clientManager, onSessionUpdatedEvent);
        SessionDetailPanel.panels.set(session.id, sessionDetailPanel);
    }

    private async _approvePlan() {
        try {
            const client = await this.clientManager.getClient();
            await client.approvePlan(this._session.id);
            vscode.window.showInformationMessage('Plan approved.');
            this._update();
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to approve plan: ${err.message}`);
        }
    }

    private async _sendMessage(text: string) {
        try {
            const client = await this.clientManager.getClient();
            await client.sendMessage(this._session.id, text);
            this._update();
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to send message: ${err.message}`);
        }
    }

    private async _update(updatedSession?: Session): Promise<Session | undefined> {
        try {
            const client = await this.clientManager.getClient();
            // If we received an updated session from the TreeProvider, use it
            // otherwise fetch it to be safe
            const freshSession = updatedSession || await client.getSession(this._session.id);
            const { activities } = await client.listActivities(this._session.id, 50);
            
            // Sync state: v0.2 Audit fix
            this._session = freshSession;

            this._panel.webview.postMessage({
                command: 'update',
                session: freshSession,
                activities: activities
            });
            return freshSession;
        } catch (err) {
            console.error('Error updating webview:', err);
            return undefined;
        }
    }

    private _getHtmlForWebview(): string {
        // Nonce for CSP security
        const nonce = this._generateNonce();
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Session Details</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-\${cspNonce}';">
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .title {
            font-size: 1.5rem;
            margin: 0;
        }
        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
            text-transform: uppercase;
        }
        .badge-planning { background: var(--vscode-charts-blue); color: white; }
        .badge-awaiting-approval { background: var(--vscode-charts-yellow); color: black; }
        .badge-completed { background: var(--vscode-charts-green); color: white; }
        .badge-failed { background: var(--vscode-charts-red); color: white; }

        .activity-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .activity-item {
            padding: 12px;
            background: var(--vscode-editor-lineHighlightBackground);
            border-radius: 6px;
            border-left: 4px solid var(--vscode-button-background);
        }
        .activity-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 0.85rem;
            opacity: 0.8;
        }
        .activity-desc { font-weight: 500; }

        .diff-container {
            margin-top: 15px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            white-space: pre-wrap;
            background: var(--vscode-editorWidget-background);
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
        }
        .diff-add { color: var(--vscode-charts-green); }
        .diff-remove { color: var(--vscode-charts-red); }

        .actions {
            margin-top: 20px;
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
        button:hover { background: var(--vscode-button-hoverBackground); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }

        #messageInput {
            width: 100%;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 10px 12px;
            margin-bottom: 12px;
            border-radius: 4px;
            resize: vertical;
            min-height: 120px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            line-height: 1.5;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        #messageInput:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }
        #sendBtn {
            font-weight: 500;
            padding: 8px 20px;
            transition: background 0.2s, opacity 0.2s;
        }
        .message-help {
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            opacity: 0.7;
        }
        .empty-state .icon {
            font-size: 3rem;
            margin-bottom: 10px;
            display: block;
        }
    </style>
</head>
<body>
    <div id="content">
        <div class="header">
            <div>
                <h1 class="title" id="sessionTitle">Loading...</h1>
                <div style="margin-top: 4px; opacity: 0.7;" id="sessionRepo"></div>
            </div>
            <span id="stateBadge" class="badge"></span>
        </div>

        <h3>Activity Timeline</h3>
        <div id="activityList" class="activity-list">
            <div class="empty-state">
                <span class="icon">🐙</span>
                <p>Loading activities...</p>
            </div>
        </div>

        <div class="actions" id="actionPanel">
            <!-- Dynamic Actions -->
        </div>

        <div style="margin-top: 30px; border-top: 1px solid var(--vscode-panel-border); padding-top: 24px">
            <h3 style="margin-bottom: 12px;">Send Message to Jules</h3>
            <div class="message-help">Use <b>Ctrl+Enter</b> to send message quickly.</div>
            <textarea id="messageInput" rows="5" placeholder="Type a message to Jules..."></textarea>
            <button id="sendBtn">Send Message</button>
        </div>
    </div>

    <script nonce="\${cspNonce}">
        const vscode = acquireVsCodeApi();

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'update':
                    updateUI(message.session, message.activities);
                    break;
            }
        });

        function updateUI(session, activities) {
            document.getElementById('sessionTitle').textContent = session.title || session.id;
            document.getElementById('sessionRepo').textContent = session.sourceContext?.source || '';

            const badge = document.getElementById('stateBadge');
            badge.textContent = session.state.replace(/_/g, ' ');
            badge.className = 'badge badge-' + session.state.toLowerCase().replace(/_/g, '-');

            const list = document.getElementById('activityList');
            if (activities && activities.length > 0) {
                list.innerHTML = activities.map(act => \`
                    <div class="activity-item">
                        <div class="activity-header">
                            <span>\${escapeHtml(act.originator)}</span>
                            <span>\${new Date(act.createTime).toLocaleTimeString()}</span>
                        </div>
                        <div class="activity-desc">\${escapeHtml(act.description)}</div>
                        \${renderArtifacts(act.artifacts)}
                    </div>
                \`).join('');
            } else {
                list.innerHTML = getEmptyStateHtml(session.state);
            }

            const actions = document.getElementById('actionPanel');
            actions.innerHTML = '';
            if (session.state === 'AWAITING_PLAN_APPROVAL') {
                actions.innerHTML += '<button id="approveBtn" onclick="approvePlan()">Approve Plan</button>';
            }
            if (session.state === 'COMPLETED') {
                actions.innerHTML += '<button id="applyBtn" onclick="applyPatch()">Pull & Apply Changes to Local Files</button>';
            }
            actions.innerHTML += '<button onclick="openInBrowser()">Open in Browser</button>';

            const sendBtn = document.getElementById('sendBtn');
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send Message';
        }

        function getEmptyStateHtml(state) {
            let icon = '🐙';
            let text = 'No activities yet.';

            if (state === 'PLANNING' || state === 'QUEUED') {
                icon = '⏳';
                text = 'Jules is preparing a plan...';
            } else if (state === 'AWAITING_PLAN_APPROVAL') {
                icon = '📋';
                text = 'Plan ready! Review and approve below.';
            } else if (state === 'COMPLETED') {
                icon = '✅';
                text = 'Session completed. You can now apply changes.';
            }

            return \`
                <div class="empty-state">
                    <span class="icon">\${icon}</span>
                    <p>\${text}</p>
                </div>
            \`;
        }

        function renderArtifacts(artifacts) {
            if (!artifacts) return '';
            return artifacts.map(art => {
                if (art.changeSet?.gitPatch?.unidiffPatch) {
                    const diffText = art.changeSet.gitPatch.unidiffPatch;
                    const lines = diffText.split('\\n');
                    let html = '<div class="diff-container">';
                    lines.forEach(l => {
                        const cls = l.startsWith('+') ? 'diff-add' : l.startsWith('-') ? 'diff-remove' : '';
                        html += \`<div class="\${cls}">\${escapeHtml(l)}</div>\`;
                    });
                    html += '</div>';
                    return html;
                }
                if (art.bashOutput) {
                    return \`<div class="diff-container" style="background:#000; color:#fff"><strong>\${escapeHtml(art.bashOutput.command)}</strong>\\n\${escapeHtml(art.bashOutput.output)}</div>\`;
                }
                return '';
            }).join('');
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function approvePlan() {
            const btn = document.getElementById('approveBtn');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Approving...';
            }
            vscode.postMessage({ command: 'approve' });
        }

        function applyPatch() {
            const btn = document.getElementById('applyBtn');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Applying...';
            }
            vscode.postMessage({ command: 'applyPatch' });
        }

        function openInBrowser() { vscode.postMessage({ command: 'openBrowser' }); }

        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        // Ctrl+Enter to send
        messageInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });

        const sendMessage = () => {
            if (messageInput.value.trim() && !sendBtn.disabled) {
                sendBtn.disabled = true;
                sendBtn.textContent = 'Sending...';
                vscode.postMessage({ command: 'sendMessage', text: messageInput.value.trim() });
                
                // Visual feedback
                const originalText = sendBtn.textContent;
                setTimeout(() => {
                    if (sendBtn.textContent === 'Sending...') {
                        sendBtn.textContent = 'Sent ✓';
                        messageInput.value = '';
                        setTimeout(() => {
                            sendBtn.textContent = 'Send Message';
                            sendBtn.disabled = false;
                        }, 2000);
                    }
                }, 500);
            }
        };

        sendBtn.onclick = sendMessage;
    </script>
</body>
</html>`;

        html = html.replace(/\${cspNonce}/g, nonce);
        
        return html;
    }

    private _generateNonce() {
        return crypto.randomBytes(16).toString('hex');
    }

    public dispose() {
        SessionDetailPanel.panels.delete(this._session.id);

        if (SessionDetailPanel.panels.size === 0 && SessionDetailPanel.globalPollInterval) {
            clearTimeout(SessionDetailPanel.globalPollInterval);
            SessionDetailPanel.globalPollInterval = undefined;
        }

        this._panel.dispose();
        while (this._disposables.length > 0) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
