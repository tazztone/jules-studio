import * as vscode from 'vscode';
import { Session } from '../api/types';
import { ClientManager } from '../api/clientManager';
import { CliRunner } from '../terminal/cliRunner';

export class SessionsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private _refreshTimer: NodeJS.Timeout | undefined;
    
    // Proactive tracking: v0.4
    private _previousStates: Map<string, string> = new Map();
    private _bgPollInterval: NodeJS.Timeout | undefined;

    constructor(
        private readonly clientManager: ClientManager,
        private readonly onSessionsUpdate?: (sessions: Session[]) => void
    ) {}

    /**
     * Start background polling for proactive notifications
     */
    startBackgroundPolling(intervalMs: number = 60000) {
        this.stopBackgroundPolling();
        this._bgPollInterval = setInterval(() => this.refresh(), intervalMs);
    }

    /**
     * Stop background polling
     */
    stopBackgroundPolling() {
        if (this._bgPollInterval) {
            clearInterval(this._bgPollInterval);
            this._bgPollInterval = undefined;
        }
    }

    /**
     * Debounced refresh
     */
    refresh(): void {
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }
        this._refreshTimer = setTimeout(() => {
            this._onDidChangeTreeData.fire();
        }, 300);
    }

    getTreeItem(element: SessionTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (element) return [];

        try {
            const client = await this.clientManager.getClient();
            const { sessions = [] } = await client.listSessions(50);
            
            // Proactive checks: v0.4
            this.handleStateChanges(sessions);

            if (this.onSessionsUpdate) {
                this.onSessionsUpdate(sessions);
            }

            if (sessions.length === 0) {
                return [new InfoTreeItem('No sessions found.')];
            }

            return sessions.map(s => new SessionTreeItem(s));
        } catch (err: any) {
            if (err.message.includes('API Key missing')) {
                return [];
            }
            return [new InfoTreeItem(`Error: ${err.message}`)];
        }
    }

    private handleStateChanges(sessions: Session[]) {
        const changes: Session[] = [];
        for (const session of sessions) {
            const prevState = this._previousStates.get(session.id);
            if (prevState && prevState !== session.state) {
                changes.push(session);
            }
            this._previousStates.set(session.id, session.state);
        }

        if (changes.length > 3) {
            vscode.window.showInformationMessage(`🐙 Jules: ${changes.length} sessions have state updates.`);
        } else {
            changes.forEach(s => this.notifyStateChange(s));
        }
    }

    private notifyStateChange(session: Session) {
        const title = session.title || session.id;
        
        if (session.state === 'AWAITING_PLAN_APPROVAL') {
            vscode.window.showInformationMessage(
                `🐙 Jules: Session "${title}" needs plan approval.`,
                'Approve Plan', 'Open Detail'
            ).then(selection => {
                if (selection === 'Approve Plan') {
                    vscode.commands.executeCommand('jules.approvePlan', { session });
                } else if (selection === 'Open Detail') {
                    vscode.commands.executeCommand('jules.openSession', { session });
                }
            });
        } else if (session.state === 'COMPLETED') {
            const autoApply = vscode.workspace.getConfiguration('jules').get<boolean>('autoApplyAfterApproval', false);
            if (autoApply) {
                vscode.window.showInformationMessage(`🚀 Jules: Auto-applying changes for "${title}"...`);
                CliRunner.applyPatch(session);
            } else {
                vscode.window.showInformationMessage(
                    `✅ Jules: Session "${title}" completed successfully!`,
                    'Apply Changes', 'Open Detail'
                ).then(selection => {
                    if (selection === 'Apply Changes') {
                        vscode.commands.executeCommand('jules.applyPatch', { session });
                    } else if (selection === 'Open Detail') {
                        vscode.commands.executeCommand('jules.openSession', { session });
                    }
                });
            }
        } else if (session.state === 'FAILED') {
            vscode.window.showErrorMessage(
                `❌ Jules: Session "${title}" failed.`,
                'Open Detail', 'Open in Browser'
            ).then(selection => {
                if (selection === 'Open Detail') {
                    vscode.commands.executeCommand('jules.openSession', { session });
                } else if (selection === 'Open in Browser') {
                    vscode.commands.executeCommand('jules.openInBrowser', { session });
                }
            });
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
