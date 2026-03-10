import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Session } from '../api/types';
import { ClientManager } from '../api/clientManager';

export class SessionDetailPanel {
    public static panels: Map<string, SessionDetailPanel> = new Map();
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _pollTimeout: NodeJS.Timeout | undefined;
    private _session: Session; // Refactor: Mutable state

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        session: Session,
        private readonly clientManager: ClientManager
    ) {
        this._session = session;
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtmlForWebview(extensionUri);
        
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

        this._startPolling();
    }

    public static createOrShow(extensionUri: vscode.Uri, session: Session, clientManager: ClientManager) {
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

        const sessionDetailPanel = new SessionDetailPanel(panel, extensionUri, session, clientManager);
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

    private async _update(): Promise<Session | undefined> {
        try {
            const client = await this.clientManager.getClient();
            const freshSession = await client.getSession(this._session.id);
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

    private _startPolling() {
        this._update();
        
        const poll = async () => {
            const terminalStates = ['COMPLETED', 'FAILED'];
            const idleStates = ['PAUSED', 'QUEUED'];

            const freshSession = await this._update();
            if (!freshSession || terminalStates.includes(freshSession.state)) {
                return; // Stop polling
            }

            const delay = idleStates.includes(freshSession.state) ? 30000 : 10000;
            this._pollTimeout = setTimeout(poll, delay);
        };

        this._pollTimeout = setTimeout(poll, 10000);
    }

    private _getHtmlForWebview(extensionUri: vscode.Uri): string {
        const filePath = path.join(extensionUri.fsPath, 'media', 'sessionDetail.html');
        let html = fs.readFileSync(filePath, 'utf8');
        
        // Nonce for CSP security
        const nonce = this._generateNonce();
        html = html.replace(/\${cspNonce}/g, nonce);
        
        return html;
    }

    private _generateNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    public dispose() {
        SessionDetailPanel.panels.delete(this._session.id);
        if (this._pollTimeout) {
            clearTimeout(this._pollTimeout);
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
