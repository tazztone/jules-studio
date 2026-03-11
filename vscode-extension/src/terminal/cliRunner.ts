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
    static async applyPatch(session: Session, clientManager: ClientManager) {
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

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('No workspace folder open to apply patch.');
                return;
            }

            const workspaceRoot = workspaceFolders[0].uri.fsPath;

            // Show a preview of the patch
            const patchDoc = await vscode.workspace.openTextDocument({
                content: latestPatch,
                language: 'diff'
            });
            await vscode.window.showTextDocument(patchDoc, { preview: true });

            const confirm = await vscode.window.showInformationMessage(
                `Review the changes. Would you like to apply this patch to your workspace?`,
                { modal: true },
                'Apply Patch'
            );

            if (confirm !== 'Apply Patch') {
                return;
            }

            // Write patch to a temporary file
            const patchPath = path.join(os.tmpdir(), `jules-${session.id.replace(/[^a-zA-Z0-9-]/g, '_')}.patch`);
            fs.writeFileSync(patchPath, latestPatch, 'utf8');

            vscode.window.showInformationMessage(`Applying patch for session "${session.title || session.id}"...`);

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
}
