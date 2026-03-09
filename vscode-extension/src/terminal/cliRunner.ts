import * as vscode from 'vscode';
import { Session } from '../api/types';
import { execSync } from 'child_process';

export class CliRunner {
    private static terminal: vscode.Terminal | undefined;

    static async applyPatch(session: Session) {
        // CLI guard: v0.2
        const isInstalled = await this.checkCliInstalled();
        if (!isInstalled) {
            const install = 'Install CLI';
            const choice = await vscode.window.showErrorMessage(
                'Jules CLI not found. Please install "@google/jules" to apply local patches.',
                install
            );
            if (choice === install) {
                vscode.env.openExternal(vscode.Uri.parse('https://www.npmjs.com/package/@google/jules'));
            }
            return;
        }

        if (!this.terminal || this.terminal.exitStatus !== undefined) {
            this.terminal = vscode.window.createTerminal('Jules CLI');
        }
        
        this.terminal.show();
        this.terminal.sendText(`jules remote pull --session ${session.id}`);
        
        vscode.window.showInformationMessage(`Applying patch for session "${session.title || session.id}"...`);
    }

    static async checkCliInstalled(): Promise<boolean> {
        try {
            // v0.2: Real check
            execSync('jules --version', { stdio: 'ignore' });
            return true;
        } catch (e) {
            return false;
        }
    }
}
