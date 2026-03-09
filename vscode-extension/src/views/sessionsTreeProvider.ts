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
            if (!apiKey) return [];

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
        this.tooltip = this.createTooltip(session);
        this.iconPath = this.getStateIcon(session.state);
        this.contextValue = `state-${session.state.toLowerCase().replace(/_/g, '-')}`;
        
        this.command = {
            command: 'jules.openSession',
            title: 'Open Session',
            arguments: [this]
        };
    }

    private createTooltip(session: Session): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.isTrusted = true;
        tooltip.supportHtml = true;

        const timeAgoStr = this.getTimeAgo(new Date(session.updateTime));
        const repo = session.sourceContext?.source || 'No repository';
        const nextAction = this.getApplyAction(session.state);

        tooltip.appendMarkdown(`**Session:** ${session.title || session.id}\n\n`);
        tooltip.appendMarkdown(`**Prompt:** ${session.prompt}\n\n`);
        tooltip.appendMarkdown(`---\n`);
        tooltip.appendMarkdown(`**Repo:** \`${repo}\`  \n`);
        tooltip.appendMarkdown(`**Last Update:** ${timeAgoStr}  \n`);
        tooltip.appendMarkdown(`**Status:** ${this.getStateLabel(session.state)}  \n`);
        
        if (nextAction) {
            tooltip.appendMarkdown(`\n**Next Action:** ${nextAction}`);
        }

        return tooltip;
    }

    private getApplyAction(state: string): string {
        switch (state) {
            case 'AWAITING_PLAN_APPROVAL': return 'Go to Panel → **Approve Plan**';
            case 'COMPLETED': return 'Right-click → **Apply Changes**';
            case 'AWAITING_USER_FEEDBACK': return 'Open Panel → **Respond to Jules**';
            case 'FAILED': return 'Check logs in Browser';
            case 'PLANNING':
            case 'IN_PROGRESS': return 'Wait for Jules to finish...';
            default: return '';
        }
    }

    private getTimeAgo(date: Date): string {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
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
