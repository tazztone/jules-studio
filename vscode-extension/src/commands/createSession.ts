import * as vscode from 'vscode';
import { ClientManager } from '../api/clientManager';
import { RepoDetector } from '../workspace/repoDetector';

export async function createSessionCommand(clientManager: ClientManager, refresh: () => void, initialContext?: string) {
    try {
        const client = await clientManager.getClient();
        const detector = new RepoDetector(client);
        
        // 1. Auto-detect source
        let sourceName = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Detecting Jules Source...' },
            async () => {
                let name = await detector.getMatchingSource();
                if (!name) {
                    const sources = await client.listSources();
                    const selected = await vscode.window.showQuickPick(
                        sources.sources.map(s => ({ label: s.githubRepo ? `${s.githubRepo.owner}/${s.githubRepo.repo}` : s.id, name: s.name })),
                        { placeHolder: 'Select a Jules Source (Repository)' }
                    );
                    if (selected) name = selected.name;
                }
                return name;
            }
        );

        if (!sourceName) return;

        // 1b. Include Active File?
        const activeEditor = vscode.window.activeTextEditor;
        let fileContext = '';
        if (activeEditor) {
            const includeFile = await vscode.window.showQuickPick(
                [
                    { label: '$(file) Include Active File', detail: activeEditor.document.fileName, picked: true },
                    { label: '$(x) Skip', detail: 'Don\'t include file context' }
                ],
                { placeHolder: 'Include the currently open file as context?' }
            );
            if (includeFile?.label.includes('Include')) {
                const doc = activeEditor.document;
                // Basic truncation for safety
                const text = doc.getText();
                const lines = text.split('\n');
                const truncatedText = lines.length > 500 ? lines.slice(0, 500).join('\n') + '\n... (truncated)' : text;
                fileContext = `\n\nFile: ${doc.fileName}\n\`\`\`${doc.languageId}\n${truncatedText}\n\`\`\``;
            }
        }

        // 2. Prompt
        const prompt = await vscode.window.showInputBox({
            prompt: initialContext ? 'What should Jules do with this code?' : 'What should Jules do?',
            placeHolder: 'e.g., Fix the bug in auth middleware, Add unit tests for utils.js'
        });
        if (!prompt) return;

        const combinedContext = [initialContext, fileContext].filter(Boolean).join('\n\n');
        const finalPrompt = combinedContext ? `${prompt}\n\nCode Context:\n${combinedContext}` : prompt;

        // 3. Optional Title
        const title = await vscode.window.showInputBox({
            prompt: 'Session Title (Optional)',
            placeHolder: 'e.g., Fix Auth Bug'
        });

        // 4. Automation Mode
        const modeChoice = await vscode.window.showQuickPick(
            [
                { label: 'Manual Approval', detail: 'Approve every plan manually before implementation.', value: true },
                { label: 'Auto Create PR', detail: 'Jules will create a PR automatically once finished.', value: false, automationMode: 'AUTO_CREATE_PR' }
            ],
            { placeHolder: 'Select Automation Mode' }
        );
        if (!modeChoice) return;

        // 5. Detect current branch: v0.2 Audit Fix
        const gitExt = vscode.extensions.getExtension('vscode.git')?.exports;
        const api = gitExt?.getAPI(1);
        const repo = api?.repositories[0];
        const currentBranch = repo?.state?.HEAD?.name || 'main';

        const sourceContext = {
            source: sourceName,
            githubRepoContext: { startingBranch: currentBranch }
        };

        const session = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Starting Jules Session...' },
            async () => {
                return await client.createSession(
                    finalPrompt, 
                    sourceContext, 
                    title, 
                    modeChoice.value, 
                    modeChoice.automationMode as any
                );
            }
        );

        vscode.window.showInformationMessage(`Session "${session.title || session.id}" created!`);
        refresh();
        
        // Open the detail view
        vscode.commands.executeCommand('jules.openSession', { session });

    } catch (err: any) {
        if (err.message.includes('API Key missing')) {
            return; // KeyManager already shows error message
        }
        vscode.window.showErrorMessage(`Failed to create session: ${err.message}`);
    }
}
