import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { AuthManager } from './auth/keyManager';
import { ClientManager } from './api/clientManager';
import { SessionsTreeProvider } from './views/sessionsTreeProvider';
import { SessionDetailPanel } from './views/sessionDetailPanel';
import { createSessionCommand } from './commands/createSession';
import { CliRunner } from './terminal/cliRunner';
import { StatusBarManager } from './views/statusBar';
import { JulesCodeLensProvider } from './codelens/julesCodeLensProvider';

let treeProvider: SessionsTreeProvider;
let sessionsTreeView: vscode.TreeView<vscode.TreeItem>;

export async function activate(context: vscode.ExtensionContext) {
    const authManager = new AuthManager(context);
    const clientManager = new ClientManager(authManager);
    const statusBarManager = new StatusBarManager();
    treeProvider = new SessionsTreeProvider(clientManager, (sessions) => {
        statusBarManager.update(sessions);
    });
    
    // Register TreeView
    sessionsTreeView = vscode.window.createTreeView('julesSessions', {
        treeDataProvider: treeProvider,
        showCollapseAll: false
    });

    // Register CodeLens Provider
    const codeLensProvider = new JulesCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider)
    );

    // Initial context check
    const checkApiKey = async () => {
        const key = await authManager.getApiKey();
        const hasKey = !!key;
        vscode.commands.executeCommand('setContext', 'jules:hasApiKey', hasKey);
        codeLensProvider.setApiKeyStatus(hasKey);
    };
    checkApiKey();

    context.subscriptions.push(
        statusBarManager,
        
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('jules.autoRefreshInterval')) {
                const interval = vscode.workspace.getConfiguration('jules').get<number>('autoRefreshInterval', 60);
                if (interval > 0) {
                    treeProvider.startBackgroundPolling(interval * 1000);
                } else {
                    treeProvider.stopBackgroundPolling();
                }
            }
        }),
        vscode.commands.registerCommand('jules.setupWizard', async () => {
            const getApiKeyChoice = await vscode.window.showInformationMessage(
                'Welcome to Jules Setup! 🐙\nDo you already have your API key from jules.google.com?',
                'Yes, I have it', 'No, get one now'
            );

            if (getApiKeyChoice === 'No, get one now') {
                vscode.env.openExternal(vscode.Uri.parse('https://jules.google.com/settings'));
                const wait = await vscode.window.showInformationMessage('Please copy your API key from the browser, then click Continue.', 'Continue', 'Cancel');
                if (wait !== 'Continue') {
                    return;
                }
            } else if (getApiKeyChoice !== 'Yes, I have it') {
                return;
            }

            // Step 2: Input Key
            const key = await vscode.window.showInputBox({
                prompt: 'Enter your Jules API Key',
                password: true,
                placeHolder: 'Get it from jules.google.com/settings',
                ignoreFocusOut: true
            });

            if (!key) {
                vscode.window.showWarningMessage('Setup cancelled. API key is required to use Jules.');
                return;
            }

            await authManager.setApiKey(key);
            clientManager.reset(); // Clear old client
            vscode.commands.executeCommand('setContext', 'jules:hasApiKey', true);
            codeLensProvider.setApiKeyStatus(true);

            // Step 3: Verify
            try {
                await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: 'Verifying Jules API Key...', cancellable: true },
                    async (_, token) => {
                        const client = await clientManager.getClient();

                        // We wrap the listSources call so we can check the token
                        await new Promise<void>((resolve, reject) => {
                            client.listSources(1).then(() => resolve()).catch(reject);
                            token.onCancellationRequested(() => {
                                reject(new Error('Verification cancelled'));
                            });
                        });
                    }
                );
                vscode.window.showInformationMessage('✅ API Key verified! You are all set. You can now create sessions.');
                treeProvider.refresh();
            } catch (err: any) {
                if (err.message === 'Verification cancelled') {
                    vscode.window.showWarningMessage('Setup cancelled.');
                } else {
                    vscode.window.showErrorMessage(`❌ Key verification failed: ${err.message}. Please check your key and try again.`);
                }
                await authManager.setApiKey(''); // Clear invalid key
                vscode.commands.executeCommand('setContext', 'jules:hasApiKey', false);
                codeLensProvider.setApiKeyStatus(false);
            }
        }),

        vscode.commands.registerCommand('jules.openSession', (item) => {
            const session = item?.session || (item as any);
            if (session) {
                SessionDetailPanel.createOrShow(session, clientManager, treeProvider.onSessionUpdated);
            }
        }),

        vscode.commands.registerCommand('jules.setApiKey', async () => {
            const key = await vscode.window.showInputBox({
                prompt: 'Enter your Jules API Key',
                password: true,
                placeHolder: 'Get it from jules.google.com/settings'
            });
            if (key) {
                await authManager.setApiKey(key);
                clientManager.reset(); // Clear old client
                vscode.commands.executeCommand('setContext', 'jules:hasApiKey', true);
                codeLensProvider.setApiKeyStatus(true);
                vscode.window.showInformationMessage('Jules API Key updated. Run "Verify & Finish" in the wizard to test it.');
                treeProvider.refresh();
            }
        }),

        vscode.commands.registerCommand('jules.refreshSessions', () => {
            treeProvider.refresh();
        }),

        vscode.commands.registerCommand('jules.loadMoreSessions', () => {
            treeProvider.refresh({ mode: 'loadMore' });
        }),

        vscode.commands.registerCommand('jules.createSession', () => {
            createSessionCommand(clientManager, () => treeProvider.refresh());
        }),

        vscode.commands.registerCommand('jules.createSessionWithSelection', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
            const selection = editor.selection;
            const text = editor.document.getText(selection);
            if (!text) {
                vscode.window.showInformationMessage('No code selected.');
                return;
            }
            createSessionCommand(clientManager, () => treeProvider.refresh(), text);
        }),

        vscode.commands.registerCommand('jules.applyPatch', (item) => {
            const session = item?.session || (item as any);
            if (session?.id) {
                CliRunner.applyPatch(session, clientManager);
            }
        }),

        vscode.commands.registerCommand('jules.approvePlan', async (item) => {
            if (!item?.session) {
                return;
            }
            try {
                const client = await clientManager.getClient();
                await client.approvePlan(item.session.id);
                vscode.window.showInformationMessage('Plan approved.');
                treeProvider.refresh();
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to approve plan: ${err.message}`);
            }
        }),

        vscode.commands.registerCommand('jules.deleteSession', async (item) => {
            if (!item?.session) {
                return;
            }
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete session "${item.session.title || item.session.id}"?`,
                { modal: true },
                'Delete'
            );
            if (confirm === 'Delete') {
                try {
                    const client = await clientManager.getClient();
                    await client.deleteSession(item.session.id);
                    treeProvider.refresh();
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Failed to delete session: ${err.message}`);
                }
            }
        }),

        vscode.commands.registerCommand('jules.openInBrowser', (item) => {
            const session = item?.session || (item as any);
            if (session?.url) {
                vscode.env.openExternal(vscode.Uri.parse(session.url));
            } else if (session?.name) {
                const sessionId = session.name.split('/').pop();
                const url = `https://jules.google.com/sessions/${sessionId}`;
                vscode.env.openExternal(vscode.Uri.parse(url));
            }
        }),

        vscode.commands.registerCommand('jules.sendTerminalToJules', async () => {
            const markerId = crypto.randomUUID();
            const doc = await vscode.workspace.openTextDocument({
                content: `\n\n// --- PASTE TERMINAL ERROR OUTPUT ABOVE THIS LINE ---\n// Marker: ${markerId}\n// Once pasted, save (Ctrl+S) or close this file to proceed, \n// or click "Create Session" in the notification below.`,
                language: 'log'
            });
            await vscode.window.showTextDocument(doc);
            
            const selection = await vscode.window.showInformationMessage(
                'Paste your terminal error into the opened file, then click "Create Session".',
                'Create Session'
            );

            if (selection === 'Create Session') {
                const docText = doc.getText();
                const markerText = `// --- PASTE TERMINAL ERROR OUTPUT ABOVE THIS LINE ---\n// Marker: ${markerId}`;
                const errorText = docText.split(markerText)[0].trim();

                if (!errorText) {
                    vscode.window.showWarningMessage('No error text found. Please paste the error above the marker.');
                    return;
                }
                // Close the doc: standard way is to close the editor
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                
                await createSessionCommand(clientManager, () => treeProvider.refresh(), 
                    `Fix the following terminal error:\n\n\`\`\`\n${errorText}\n\`\`\``);
            }
        }),

        vscode.commands.registerCommand('jules.filterByRepo', async () => {
            const sessions = treeProvider.getLoadedSessions();

            // Extract unique repos
            const repos = new Set<string>();
            sessions.forEach(s => {
                if (s.sourceContext?.source) {
                    repos.add(s.sourceContext.source);
                }
            });

            const currentFilter = treeProvider.getRepoFilter();
            const clearOption = { label: '$(clear-all) Clear Filter', description: currentFilter ? `Current: ${currentFilter}` : '' };
            const repoItems = Array.from(repos).map(repo => ({ label: repo }));

            const items = [clearOption, ...repoItems];

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a repository to filter sessions by'
            });

            if (selected) {
                if (selected === clearOption) {
                    treeProvider.setRepoFilter(undefined);
                    sessionsTreeView.message = undefined;
                } else {
                    treeProvider.setRepoFilter(selected.label);
                    sessionsTreeView.message = `Filtered by: ${selected.label}`;
                }
            }
        }),

        vscode.commands.registerCommand('jules.codeLensAction', async (uri: vscode.Uri, symbol: any, action: string) => {
            if (!symbol?.range) {
                return;
            }
            const doc = await vscode.workspace.openTextDocument(uri);
            const code = doc.getText(new vscode.Range(
                new vscode.Position(symbol.range.start.line, symbol.range.start.character),
                new vscode.Position(symbol.range.end.line, symbol.range.end.character)
            ));
            
            const prompts: Record<string, string> = {
                test: `Write comprehensive unit tests for the following:`,
                refactor: `Refactor the following code for better readability and maintainability:`
            };

            const initialContext = `File: ${doc.fileName}\n\`\`\`${doc.languageId}\n${code}\n\`\`\``;
            
            await createSessionCommand(
                clientManager, 
                () => treeProvider.refresh(), 
                `${prompts[action]}\n\n${initialContext}`
            );
        })
    );

    // Initial refresh
    treeProvider.refresh();

    // Start background polling if enabled
    const interval = vscode.workspace.getConfiguration('jules').get<number>('autoRefreshInterval', 60);
    if (interval > 0) {
        treeProvider.startBackgroundPolling(interval * 1000);
    }
}

/**
 * Cleanup on extension deactivation: v0.2 Audit Fix
 */
export function deactivate() {
    if (treeProvider) {
        treeProvider.stopBackgroundPolling();
    }
    SessionDetailPanel.panels.forEach(panel => panel.dispose());
}
