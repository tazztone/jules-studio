import * as vscode from 'vscode';
import { Session } from '../api/types';
import { ClientManager } from '../api/clientManager';

export class SessionsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private _refreshTimer: NodeJS.Timeout | undefined;
    
    // Proactive tracking: v0.4
    private _previousStates: Map<string, string> = new Map();
    private _previousUpdateTimes: Map<string, string> = new Map();
    private _bgPollInterval: NodeJS.Timeout | undefined;
    private _sessions: Session[] = [];
    private _nextPageToken: string | undefined;
    private _isFirstLoad: boolean = true;

    private _repoFilter: string | undefined;

    public readonly onSessionUpdatedEmitter = new vscode.EventEmitter<Session>();
    public readonly onSessionUpdated = this.onSessionUpdatedEmitter.event;

    constructor(
        private readonly clientManager: ClientManager,
        private readonly onSessionsUpdate?: (sessions: Session[]) => void
    ) {}

    /**
     * Start background polling for proactive notifications
     */
    startBackgroundPolling(intervalMs: number = 60000) {
        this.stopBackgroundPolling();

        const poll = async () => {
            this.refresh({ mode: 'background' });

            // Adaptive polling based on active sessions
            const hasActiveSessions = this._sessions.some(s =>
                !['COMPLETED', 'FAILED'].includes(s.state)
            );

            const nextInterval = hasActiveSessions ? Math.min(intervalMs, 10000) : intervalMs;
            this._bgPollInterval = setTimeout(poll, nextInterval);
        };

        this._bgPollInterval = setTimeout(poll, intervalMs);
    }

    /**
     * Stop background polling
     */
    stopBackgroundPolling() {
        if (this._bgPollInterval) {
            clearTimeout(this._bgPollInterval);
            this._bgPollInterval = undefined;
        }
    }

    public setRepoFilter(repo: string | undefined) {
        this._repoFilter = repo;
        this.refresh({ mode: 'user' });
    }

    public getRepoFilter(): string | undefined {
        return this._repoFilter;
    }

    public getLoadedSessions(): Session[] {
        return this._sessions;
    }

    private _refreshQueue: { mode: 'user' | 'loadMore' | 'background' }[] = [];

    /**
     * Debounced refresh
     */
    refresh(options: { mode: 'user' | 'loadMore' | 'background' } = { mode: 'user' }): void {
        this._refreshQueue.push(options);

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
        if (element) {
            return [];
        }

        // Process all queued requests
        const requests = [...this._refreshQueue];
        this._refreshQueue = [];

        const isLoadMore = requests.some(r => r.mode === 'loadMore');
        const isUserRefresh = requests.some(r => r.mode === 'user');
        const isBackground = requests.length > 0 && requests.every(r => r.mode === 'background');

        try {
            const client = await this.clientManager.getClient();

            if (isUserRefresh && !isLoadMore) {
                this._nextPageToken = undefined;
            }

            const pageSize = vscode.workspace.getConfiguration('jules').get<number>('pageSize', 10);

            if (isBackground && this._sessions.length > 0) {
                // On background poll, only fetch the first page to get state updates
                // and don't reset _nextPageToken so load more still works later
                const { sessions = [] } = await client.listSessions(pageSize, undefined, this._repoFilter);

                // Merge updates into existing sessions to preserve pagination
                const sessionMap = new Map(this._sessions.map(s => [s.id, s]));

                for (const s of sessions) {
                    sessionMap.set(s.id, s);
                }

                // Rebuild array, preserving the order of the newly fetched first page,
                // then appending any older sessions that weren't in the first page.
                this._sessions = [
                    ...sessions,
                    ...this._sessions.filter(s => !sessions.find(ns => ns.id === s.id))
                ];

            } else {
                const { sessions = [], nextPageToken } = await client.listSessions(pageSize, this._nextPageToken, this._repoFilter);

                if (isLoadMore && this._nextPageToken) {
                    // Append unique sessions
                    const existingIds = new Set(this._sessions.map(s => s.id));
                    const newSessions = sessions.filter(s => !existingIds.has(s.id));
                    this._sessions.push(...newSessions);
                } else {
                    this._sessions = sessions;
                }

                this._nextPageToken = nextPageToken;
            }

            // Proactive checks: v0.4
            this.handleStateChanges(this._sessions);

            if (this.onSessionsUpdate) {
                this.onSessionsUpdate(this._sessions);
            }

            const filteredSessions = this._repoFilter
                ? this._sessions.filter(s => s.sourceContext?.source === this._repoFilter)
                : this._sessions;

            if (filteredSessions.length === 0) {
                if (this._repoFilter && this._sessions.length > 0) {
                     return [new InfoTreeItem(`No sessions match filter '${this._repoFilter}'.`)];
                }
                return [new InfoTreeItem('No sessions found.')];
            }

            const items: vscode.TreeItem[] = filteredSessions.map(s => new SessionTreeItem(s));
            // Only show load more if not filtered (as filtering happens client side for now, load more would be confusing)
            // or if we have a next page token.
            if (this._nextPageToken && !this._repoFilter) {
                items.push(new LoadMoreTreeItem());
            }

            return items;
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
            const prevUpdateTime = this._previousUpdateTimes.get(session.id);

            if (!prevState || (prevState && prevState !== session.state && !this._isFirstLoad)) {
                if (prevState) {
                    changes.push(session); // Only notify via popups if it's an actual change (not first load)
                }
                // Broadcast state change to any listening panels
                this.onSessionUpdatedEmitter.fire(session);
            } else if (prevState === session.state && prevUpdateTime !== session.updateTime && ['IN_PROGRESS', 'QUEUED', 'PLANNING'].includes(session.state)) {
                // If the session is actively doing something and has actually updated,
                // notify panels to pull the latest activities even if the state hasn't changed.
                this.onSessionUpdatedEmitter.fire(session);
            }
            this._previousStates.set(session.id, session.state);
            this._previousUpdateTimes.set(session.id, session.updateTime);
        }

        this._isFirstLoad = false;

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
        } else if (session.state === 'AWAITING_USER_FEEDBACK') {
            vscode.window.showInformationMessage(
                `💬 Jules: Session "${title}" needs your input.`,
                'Open Detail'
            ).then(selection => {
                if (selection === 'Open Detail') {
                    vscode.commands.executeCommand('jules.openSession', { session });
                }
            });
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

export class LoadMoreTreeItem extends vscode.TreeItem {
    constructor() {
        super('Load More...', vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'loadMore';
        this.command = {
            command: 'jules.loadMoreSessions',
            title: 'Load More Sessions'
        };
        this.iconPath = new vscode.ThemeIcon('sync');
    }
}

export class SessionTreeItem extends vscode.TreeItem {
    constructor(public readonly session: Session) {
        const title = session.title || session.prompt?.slice(0, 50) + (session.prompt?.length > 50 ? '...' : '') || session.id;
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
        if (seconds < 60) {
            return 'just now';
        }
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return `${minutes}m ago`;
        }
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return `${hours}h ago`;
        }
        return date.toLocaleDateString();
    }

    private getStateLabel(state: string): string {
        /* eslint-disable @typescript-eslint/naming-convention */
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
        /* eslint-enable @typescript-eslint/naming-convention */
        return labels[state] || state;
    }

    private getStateIcon(state: string): vscode.ThemeIcon {
        /* eslint-disable @typescript-eslint/naming-convention */
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
        /* eslint-enable @typescript-eslint/naming-convention */
        return new vscode.ThemeIcon(icons[state] || 'question');
    }
}
