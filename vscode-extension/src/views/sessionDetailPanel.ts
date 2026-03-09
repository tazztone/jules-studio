import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AuthManager } from '../auth/keyManager';
import { JulesClient } from '../api/julesClient';
import { Session } from '../api/types';

export class SessionDetailPanel {
    public static currentPanel: SessionDetailPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private readonly session: Session,
        private readonly authManager: AuthManager
    ) {
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
                        vscode.commands.executeCommand('jules.applyPatch', { session: this.session });
                        break;
                    case 'openBrowser':
                        vscode.env.openExternal(vscode.Uri.parse(this.session.url));
                        break;
                }
            },
            null,
            this._disposables
        );

        this._startPolling();
    }

    public static createOrShow(extensionUri: vscode.Uri, session: Session, authManager: AuthManager) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

        if (SessionDetailPanel.currentPanel && SessionDetailPanel.currentPanel.session.id === session.id) {
            SessionDetailPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'sessionDetail',
            `Session: ${session.title || session.id}`,
            column || vscode.ViewColumn.One,
            { enableScripts: true }
        );

        SessionDetailPanel.currentPanel = new SessionDetailPanel(panel, extensionUri, session, authManager);
    }

    private async _approvePlan() {
        try {
            const apiKey = await this.authManager.getApiKey();
            if (!apiKey) throw new Error('API Key missing');
            const client = new JulesClient(apiKey);
            await client.approvePlan(this.session.id);
            vscode.window.showInformationMessage('Plan approved.');
            this._update();
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to approve plan: ${err.message}`);
        }
    }

    private async _sendMessage(text: string) {
        try {
            const apiKey = await this.authManager.getApiKey();
            if (!apiKey) throw new Error('API Key missing');
            const client = new JulesClient(apiKey);
            await client.sendMessage(this.session.id, text);
            this._update();
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to send message: ${err.message}`);
        }
    }

    private async _update() {
        try {
            const apiKey = await this.authManager.getApiKey();
            if (!apiKey) return;
            const client = new JulesClient(apiKey);
            const freshSession = await client.getSession(this.session.id);
            const { activities } = await client.listActivities(this.session.id, 50);
            
            this._panel.webview.postMessage({
                command: 'update',
                session: freshSession,
                activities: activities
            });
        } catch (err) {
            console.error('Error updating webview:', err);
        }
    }

    private _startPolling() {
        this._update();
        const interval = setInterval(() => this._update(), 10000);
        this._disposables.push(new vscode.Disposable(() => clearInterval(interval)));
    }

    private _getHtmlForWebview(extensionUri: vscode.Uri): string {
        const filePath = path.join(extensionUri.fsPath, 'src', 'views', 'sessionDetail.html');
        return fs.readFileSync(filePath, 'utf8');
    }

    public dispose() {
        SessionDetailPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }
}
