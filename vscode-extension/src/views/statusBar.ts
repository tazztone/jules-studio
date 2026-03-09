import * as vscode from 'vscode';
import { Session } from '../api/types';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'workbench.view.extension.jules-sidebar';
        this.statusBarItem.hide();
    }

    update(sessions: Session[]) {
        const activeCount = sessions.filter(s => 
            s.state !== 'COMPLETED' && s.state !== 'FAILED' && s.state !== 'PAUSED'
        ).length;

        if (activeCount > 0) {
            const needsApproval = sessions.filter(s => s.state === 'AWAITING_PLAN_APPROVAL').length;
            this.statusBarItem.text = `$(rocket) Jules: ${activeCount}`;
            this.statusBarItem.tooltip = `${activeCount} active sessions${needsApproval > 0 ? ` (${needsApproval} need approval)` : ''}`;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}
