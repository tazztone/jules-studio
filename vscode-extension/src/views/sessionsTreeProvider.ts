import * as vscode from 'vscode';
import { AuthManager } from '../auth/keyManager';
import { JulesClient } from '../api/julesClient';
import { Session } from '../api/types';

export class SessionsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(
        private readonly authManager: AuthManager,
        private readonly onSessionsUpdate?: (sessions: Session[]) => void
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SessionTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (element) return [];

        try {
            const apiKey = await this.authManager.getApiKey();
            if (!apiKey) {
                return [];
            }

            const client = new JulesClient(apiKey);
            const { sessions } = await client.listSessions(50);
            
            if (this.onSessionsUpdate) {
                this.onSessionsUpdate(sessions);
            }

            if (sessions.length === 0) {
                return [new InfoTreeItem('No sessions found.')];
            }

            return sessions.map(s => new SessionTreeItem(s));
        } catch (err: any) {
            return [new InfoTreeItem(`Error: ${err.message}`)];
        }
    }
}

class InfoTreeItem extends vscode.TreeItem {
    constructor(label: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'info';
    }
}

export class SessionTreeItem extends vscode.TreeItem {
    constructor(public readonly session: Session) {
        const title = session.title || session.prompt.slice(0, 50) + (session.prompt.length > 50 ? '...' : '');
        super(title, vscode.TreeItemCollapsibleState.None);
        
        this.description = this.getStateLabel(session.state);
        this.tooltip = `Prompt: ${session.prompt}\nState: ${session.state}`;
        this.iconPath = this.getStateIcon(session.state);
        this.contextValue = `state-${session.state.toLowerCase().replace(/_/g, '-')}`;
        
        this.command = {
            command: 'jules.openSession',
            title: 'Open Session',
            arguments: [this]
        };
    }

    private getStateLabel(state: string): string {
        const labels: Record<string, string> = {
            'QUEUED': 'Queued',
            'PLANNING': 'Planning',
            'AWAITING_PLAN_APPROVAL': 'Needs Approval',
            'AWAITING_USER_FEEDBACK': 'Waiting for You',
            'IN_PROGRESS': 'In Progress',
            'PAUSED': 'Paused',
            'COMPLETED': 'Completed',
            'FAILED': 'Failed'
        };
        return labels[state] || state;
    }

    private getStateIcon(state: string): vscode.ThemeIcon {
        const icons: Record<string, string> = {
            'QUEUED': 'watch',
            'PLANNING': 'sync~spin',
            'AWAITING_PLAN_APPROVAL': 'warning',
            'AWAITING_USER_FEEDBACK': 'mail',
            'IN_PROGRESS': 'rocket',
            'PAUSED': 'debug-pause',
            'COMPLETED': 'check',
            'FAILED': 'error'
        };
        return new vscode.ThemeIcon(icons[state] || 'question');
    }
}
