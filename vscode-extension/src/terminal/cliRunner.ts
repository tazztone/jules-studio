import * as vscode from 'vscode';
import { Session } from '../api/types';

export class CliRunner {
    private static terminal: vscode.Terminal | undefined;

    static applyPatch(session: Session) {
        if (!this.terminal || this.terminal.exitStatus !== undefined) {
            this.terminal = vscode.window.createTerminal('Jules CLI');
        }
        
        this.terminal.show();
        this.terminal.sendText(`jules remote pull --session ${session.id}`);
        
        vscode.window.showInformationMessage(`Applying patch for session "${session.title || session.id}"...`);
    }

    static async checkCliInstalled(): Promise<boolean> {
        // We can't easily run a command and get output synchronously to check presence without node's exec
        // But we can try to run it in a hidden terminal or just assume it's there and show error if pull fails
        return true; 
    }
}
