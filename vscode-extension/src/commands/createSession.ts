import * as vscode from 'vscode';
import { AuthManager } from '../auth/keyManager';
import { JulesClient } from '../api/julesClient';
import { RepoDetector } from '../workspace/repoDetector';

export async function createSessionCommand(authManager: AuthManager, refresh: () => void, initialContext?: string) {
    try {
        const apiKey = await authManager.getApiKey();
        if (!apiKey) {
            const setKey = 'Set API Key';
            const choice = await vscode.window.showErrorMessage('API Key missing. Please set your Jules API key.', setKey);
            if (choice === setKey) {
                vscode.commands.executeCommand('jules.setApiKey');
            }
            return;
        }


        const client = new JulesClient(apiKey);
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

        // 2. Prompt
        const prompt = await vscode.window.showInputBox({
            prompt: initialContext ? 'What should Jules do with this code?' : 'What should Jules do?',
            placeHolder: 'e.g., Fix the bug in auth middleware, Add unit tests for utils.js'
        });
        if (!prompt) return;

        const finalPrompt = initialContext ? `${prompt}\n\nCode Context:\n\`\`\`\n${initialContext}\n\`\`\`` : prompt;

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

        // 5. Create Session
        const sourceContext = {
            source: sourceName,
            githubRepoContext: { startingBranch: 'main' } // Default to main for now
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
        vscode.window.showErrorMessage(`Failed to create session: ${err.message}`);
    }
}
