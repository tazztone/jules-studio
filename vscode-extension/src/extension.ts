import * as vscode from 'vscode';
import { AuthManager } from './auth/keyManager';
import { ClientManager } from './api/clientManager';
import { SessionsTreeProvider } from './views/sessionsTreeProvider';
import { SessionDetailPanel } from './views/sessionDetailPanel';
import { createSessionCommand } from './commands/createSession';
import { CliRunner } from './terminal/cliRunner';
import { StatusBarManager } from './views/statusBar';
import { JulesCodeLensProvider } from './codelens/julesCodeLensProvider';

let treeProvider: SessionsTreeProvider;

export async function activate(context: vscode.ExtensionContext) {
    const authManager = new AuthManager(context);
    const clientManager = new ClientManager(authManager);
    const statusBarManager = new StatusBarManager();
    treeProvider = new SessionsTreeProvider(clientManager, (sessions) => {
        statusBarManager.update(sessions);
    });
    
    // Register TreeView
    vscode.window.registerTreeDataProvider('julesSessions', treeProvider);

    // Register CodeLens Provider
    const codeLensProvider = new JulesCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider)
    );

    // Initial context check
    const checkApiKey = async () => {
        const key = await authManager.getApiKey();
        vscode.commands.executeCommand('setContext', 'jules:hasApiKey', !!key);
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
            const step1 = '1. Get API Key';
            const step2 = '2. Configure Key';
            const step3 = '3. Verify & Finish';
            
            const choice = await vscode.window.showQuickPick([step1, step2, step3], {
                placeHolder: 'Jules Setup Wizard 🐙'
            });

            if (choice === step1) {
                vscode.env.openExternal(vscode.Uri.parse('https://jules.google.com/settings'));
                vscode.window.showInformationMessage('Opening Jules Settings. Once you have your key, run this wizard again for Step 2.');
            } else if (choice === step2) {
                await vscode.commands.executeCommand('jules.setApiKey');
            } else if (choice === step3) {
                // Verify logic: v0.2 Audit Fix (Error boundary)
                try {
                    await vscode.window.withProgress(
                        { location: vscode.ProgressLocation.Notification, title: 'Verifying Jules API Key...' },
                        async () => {
                            const client = await clientManager.getClient();
                            await client.listSources(1); // Call a lightweight endpoint
                        }
                    );
                    vscode.window.showInformationMessage('✅ API Key verified! You are all set.');
                } catch (err: any) {
                    vscode.window.showErrorMessage(`❌ Key verification failed: ${err.message}. Please check your key and try again.`);
                }
            }
        }),

        vscode.commands.registerCommand('jules.openSession', (item) => {
            const session = item?.session || (item as any);
            if (session) {
                SessionDetailPanel.createOrShow(context.extensionUri, session, clientManager);
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
                vscode.window.showInformationMessage('Jules API Key updated. Run "Verify & Finish" in the wizard to test it.');
                treeProvider.refresh();
            }
        }),

        vscode.commands.registerCommand('jules.refreshSessions', () => {
            treeProvider.refresh();
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
                CliRunner.applyPatch(session);
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
            if (session?.name) {
                const sessionId = session.name.split('/').pop();
                const url = `https://jules.google.com/sessions/${sessionId}`;
                vscode.env.openExternal(vscode.Uri.parse(url));
            } else if (session?.url) {
                vscode.env.openExternal(vscode.Uri.parse(session.url));
            }
        }),

        vscode.commands.registerCommand('jules.sendTerminalToJules', async () => {
            const doc = await vscode.workspace.openTextDocument({
                content: '\n\n// --- PASTE TERMINAL ERROR OUTPUT ABOVE THIS LINE ---\n// Once pasted, save (Ctrl+S) or close this file to proceed, \n// or click "Create Session" in the notification below.',
                language: 'log'
            });
            await vscode.window.showTextDocument(doc);
            
            const selection = await vscode.window.showInformationMessage(
                'Paste your terminal error into the opened file, then click "Create Session".',
                'Create Session'
            );

            if (selection === 'Create Session') {
                const errorText = doc.getText().split('// --- PASTE TERMINAL ERROR OUTPUT ABOVE THIS LINE ---')[0].trim();
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
