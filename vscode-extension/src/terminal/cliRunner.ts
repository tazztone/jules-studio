import * as vscode from 'vscode';
import { Session } from '../api/types';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ClientManager } from '../api/clientManager';

const execFileAsync = promisify(execFile);

export class CliRunner {
    private static terminal: vscode.Terminal | undefined;

    static async applyPatch(session: Session, clientManager?: ClientManager) {
        // CLI guard: v0.2
        const isInstalled = await this.checkCliInstalled();
        if (!isInstalled) {
            if (clientManager) {
                // Try fallback logic
                return this.applyPatchFallback(session, clientManager);
            } else {
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
        }

        const confirm = await vscode.window.showWarningMessage(
            `This will download and apply code changes from session "${session.title || session.id}" to your local workspace. Proceed?`,
            { modal: true },
            'Apply Changes'
        );
        if (confirm !== 'Apply Changes') {
            return;
        }

        if (!this.terminal || this.terminal.exitStatus !== undefined) {
            this.terminal = vscode.window.createTerminal('Jules CLI');
        }
        
        this.terminal.show();
        this.terminal.sendText(`jules remote pull --session ${session.id} --apply`);
        
        vscode.window.showInformationMessage(`Applying patch for session "${session.title || session.id}"...`);

        // Focus SCM after a short delay to let the pull complete
        setTimeout(() => {
            vscode.commands.executeCommand('workbench.view.scm');
        }, 5000);
    }

    static async applyPatchFallback(session: Session, clientManager: ClientManager) {
        try {
            const client = await clientManager.getClient();
            const { activities } = await client.listActivities(session.id, 50);

            // Find the most recent activity with a patch
            let latestPatch: string | undefined;
            if (activities) {
                for (const act of activities) {
                    if (act.artifacts) {
                        for (const artifact of act.artifacts) {
                            if (artifact.changeSet?.gitPatch?.unidiffPatch) {
                                latestPatch = artifact.changeSet.gitPatch.unidiffPatch;
                                break;
                            }
                        }
                    }
                    if (latestPatch) {
                        break;
                    }
                }
            }

            if (!latestPatch) {
                vscode.window.showErrorMessage(`No code changes found for session "${session.title || session.id}".`);
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Jules CLI is not installed. Would you like to apply changes using Git directly?`,
                { modal: true },
                'Apply with Git'
            );

            if (confirm !== 'Apply with Git') {
                return;
            }

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('No workspace folder open to apply patch.');
                return;
            }

            const workspaceRoot = workspaceFolders[0].uri.fsPath;

            // Write patch to a temporary file
            const patchPath = path.join(os.tmpdir(), `jules-${session.id}.patch`);
            fs.writeFileSync(patchPath, latestPatch, 'utf8');

            vscode.window.showInformationMessage(`Applying patch for session "${session.title || session.id}" via Git...`);

            try {
                // Try applying with git apply
                await execFileAsync('git', ['apply', patchPath], { cwd: workspaceRoot });
                vscode.window.showInformationMessage(`Patch applied successfully via Git!`);
            } catch (err: any) {
                // If it fails, maybe try 3-way merge
                try {
                    await execFileAsync('git', ['apply', '--3way', patchPath], { cwd: workspaceRoot });
                    vscode.window.showInformationMessage(`Patch applied successfully (with 3-way merge) via Git! Please resolve any conflicts.`);
                } catch (err2: any) {
                    vscode.window.showErrorMessage(`Failed to apply patch via Git. Error: ${err.message || err2.message}`);
                }
            } finally {
                // Cleanup temp file
                if (fs.existsSync(patchPath)) {
                    fs.unlinkSync(patchPath);
                }
            }

            // Focus SCM
            setTimeout(() => {
                vscode.commands.executeCommand('workbench.view.scm');
            }, 1000);

        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to fetch patch: ${err.message}`);
        }
    }

    static async checkCliInstalled(): Promise<boolean> {
        try {
            // v0.2: Real check (async)
            await execFileAsync('jules', ['--version']);
            return true;
        } catch (e) {
            return false;
        }
    }
}
