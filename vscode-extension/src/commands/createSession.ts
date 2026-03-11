import * as vscode from 'vscode';
import { ClientManager } from '../api/clientManager';
import { RepoDetector } from '../workspace/repoDetector';
import { validatePrompt, validateBranchName } from '../utils/validators';
import { ValidationError, SecurityError } from '../utils/errors';
import { PromptGenerator } from '../workspace/promptGenerator';
import { GitContextManager } from '../workspace/gitContext';
import { GeminiClient } from '../api/geminiClient';

export async function createSessionCommand(clientManager: ClientManager, refresh: () => void, initialContext?: string) {
    try {
        const client = await clientManager.getClient();
        const detector = new RepoDetector(client);
        
        // 1. Auto-detect source
        let sourceName: string | undefined;
        let detectionFailed = false;

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Detecting Jules Source...' },
            async () => {
                sourceName = await detector.getMatchingSource();
                if (!sourceName) {
                    detectionFailed = true;
                }
            }
        );

        if (detectionFailed) {
            vscode.window.showInformationMessage('Could not automatically match your local git remote to a Jules Source. Please select one manually.');
            const sources = await client.listSources();
            const selected = await vscode.window.showQuickPick(
                sources.sources.map(s => ({
                    label: s.githubRepo ? `${s.githubRepo.owner}/${s.githubRepo.repo}` : s.id,
                    description: s.name,
                    name: s.name
                })),
                { placeHolder: 'Select a Jules Source (Repository)' }
            );
            if (selected) {
                sourceName = selected.name;
            } else {
                return; // User cancelled
            }
        }

        if (!sourceName) {
            return;
        }

        // 1b. Brain Artifact Discovery (Antigravity)
        const outputChannel = vscode.window.createOutputChannel('Jules Bridge');

        // Pass a GeminiClient so PromptGenerator can extract a smart summary to prepopulate our input box
        const authManager = clientManager.authManager;
        const geminiClient = new GeminiClient(authManager);

        const generator = new PromptGenerator(outputChannel, geminiClient);
        let selectedBrainContextPath: string | undefined;

        const contexts = await generator.getAvailableContexts();
        if (contexts && contexts.length > 0) {
            const brainChoice = await vscode.window.showQuickPick(
                [
                    { label: '$(x) None', detail: 'Do not include previous agent brain context', path: undefined },
                    ...contexts.map(c => ({
                        label: `$(brain) ${c.name}`,
                        detail: c.title,
                        path: c.path
                    }))
                ],
                { placeHolder: 'Continue from an existing agent context?' }
            );

            if (brainChoice && brainChoice.path) {
                selectedBrainContextPath = brainChoice.path;
            }
        }

        // 5. Detect current branch: v0.2 Audit Fix
        const gitExt = vscode.extensions.getExtension('vscode.git')?.exports;
        const api = gitExt?.getAPI(1);
        const repo = api?.repositories[0];
        let currentBranch = repo?.state?.HEAD?.name || 'main';

        const config = vscode.workspace.getConfiguration('jules');
        const autoSyncWip = config.get<boolean>('autoSyncWip', false);

        // Ensure generator uses the selected context path (if any) when we implement the full prompt generation in the next step.
        // For now, we will add selectedBrainContextPath to the fileContext to silence the unused variable warning
        let fileContext = '';
        if (selectedBrainContextPath) {
            fileContext += `\n\nContinuing from Antigravity Brain Context: ${selectedBrainContextPath}`;
        }

        // 1c. Generate Rich Context from PromptGenerator & Auto-Sync
        const activeEditor = vscode.window.activeTextEditor;
        let generatedContext = '';
        if (repo) {
            if (autoSyncWip) {
                const isDirty = repo.state.workingTreeChanges.length > 0 || repo.state.indexChanges.length > 0;
                if (isDirty) {
                    const gitManager = new GitContextManager(outputChannel);
                    await vscode.window.withProgress(
                        { location: vscode.ProgressLocation.Notification, title: 'Auto-Syncing Uncommitted Changes...' },
                        async () => {
                            await gitManager.pushWipChanges(repo as any);
                            currentBranch = repo?.state?.HEAD?.name || currentBranch;
                        }
                    );
                }
            }

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Gathering Workspace Context...' },
                async () => {
                    generatedContext = await generator.generatePrompt(repo, activeEditor, selectedBrainContextPath);
                }
            );
        }

        // Append earlier brain context selection if we had one and generator doesn't do it
        if (fileContext && !generatedContext.includes(selectedBrainContextPath || '')) {
            generatedContext += fileContext;
        }

        // 2. Prompt
        // The generator's `generatePrompt` returns an XML string that contains `<mission_brief>...</mission_brief>`.
        // Let's attempt to extract it to prefill the prompt box.
        let defaultPrompt = initialContext || '';
        if (generatedContext) {
            const briefMatch = generatedContext.match(/<mission_brief>([\s\S]*?)<\/mission_brief>/);
            if (briefMatch && briefMatch[1] && !briefMatch[1].includes('[Describe your task here...]')) {
                defaultPrompt = briefMatch[1].trim();
            }
        }

        const prompt = await vscode.window.showInputBox({
            prompt: initialContext ? 'What should Jules do with this code?' : 'What should Jules do?',
            placeHolder: 'e.g., Fix the bug in auth middleware, Add unit tests for utils.js',
            value: defaultPrompt
        });
        if (!prompt) {
            return;
        }

        try {
            validatePrompt(prompt);
        } catch (err: any) {
            vscode.window.showErrorMessage(`Invalid prompt: ${err.message}`);
            return;
        }

        const combinedContext = [initialContext, generatedContext].filter(Boolean).join('\n\n');
        const finalPrompt = combinedContext ? `${prompt}\n\n${combinedContext}` : prompt;

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
        if (!modeChoice) {
            return;
        }

        try {
            validateBranchName(currentBranch);
        } catch (err: any) {
            vscode.window.showErrorMessage(`Invalid branch name: ${err.message}`);
            return;
        }

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
        if (err instanceof ValidationError || err instanceof SecurityError) {
            vscode.window.showErrorMessage(`Validation failed: ${err.message}`);
            return;
        }
        if (err.message?.includes('API Key missing')) {
            return; // KeyManager already shows error message
        }
        vscode.window.showErrorMessage(`Failed to create session: ${err.message}`);
    }
}
