import * as vscode from 'vscode';
import { AuthManager } from './auth/keyManager';
import { JulesClient } from './api/julesClient';
import { SessionsTreeProvider } from './views/sessionsTreeProvider';
import { SessionDetailPanel } from './views/sessionDetailPanel';
import { createSessionCommand } from './commands/createSession';
import { CliRunner } from './terminal/cliRunner';
import { StatusBarManager } from './views/statusBar';

export async function activate(context: vscode.ExtensionContext) {
    const authManager = new AuthManager(context);
    const statusBarManager = new StatusBarManager();
    const treeProvider = new SessionsTreeProvider(authManager, (sessions) => {
        statusBarManager.update(sessions);
    });
    
    // Register TreeView
    vscode.window.registerTreeDataProvider('julesSessions', treeProvider);

    // Initial context check
    const checkApiKey = async () => {
        const key = await authManager.getApiKey();
        vscode.commands.executeCommand('setContext', 'jules:hasApiKey', !!key);
    };
    checkApiKey();

    // Commands
    context.subscriptions.push(
        statusBarManager,
        
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
                // Verify logic: v0.2
                await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: 'Verifying Jules API Key...' },
                    async () => {
                        const key = await authManager.getApiKey();
                        if (!key) throw new Error('No key found. Please do Step 2 first.');
                        const client = new JulesClient(key);
                        await client.listSources(1); // Call a lightweight endpoint
                    }
                );
                vscode.window.showInformationMessage('✅ API Key verified! You are all set.');
            }
        }),

        vscode.commands.registerCommand('jules.openSession', (item) => {
            if (item?.session) {
                SessionDetailPanel.createOrShow(context.extensionUri, item.session, authManager);
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
                vscode.commands.executeCommand('setContext', 'jules:hasApiKey', true);
                vscode.window.showInformationMessage('Jules API Key updated. Run "Verify & Finish" in the wizard to test it.');
                treeProvider.refresh();
            }
        }),

        vscode.commands.registerCommand('jules.refreshSessions', () => {
            treeProvider.refresh();
        }),

        vscode.commands.registerCommand('jules.createSession', () => {
            createSessionCommand(authManager, () => treeProvider.refresh());
        }),

        vscode.commands.registerCommand('jules.createSessionWithSelection', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            const selection = editor.selection;
            const text = editor.document.getText(selection);
            if (!text) {
                vscode.window.showInformationMessage('No code selected.');
                return;
            }
            createSessionCommand(authManager, () => treeProvider.refresh(), text);
        }),

        vscode.commands.registerCommand('jules.applyPatch', (item) => {
            const session = item?.session || (item as any); // Handle call from webview
            if (session?.id) {
                CliRunner.applyPatch(session);
            }
        }),

        vscode.commands.registerCommand('jules.approvePlan', async (item) => {
            if (!item?.session) return;
            try {
                const apiKey = await authManager.getApiKey();
                if (!apiKey) throw new Error('API Key missing');
                const client = new JulesClient(apiKey);
                await client.approvePlan(item.session.id);
                vscode.window.showInformationMessage('Plan approved.');
                treeProvider.refresh();
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to approve plan: ${err.message}`);
            }
        }),

        vscode.commands.registerCommand('jules.deleteSession', async (item) => {
            if (!item?.session) return;
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete session "${item.session.title || item.session.id}"?`,
                { modal: true },
                'Delete'
            );
            if (confirm === 'Delete') {
                try {
                    const apiKey = await authManager.getApiKey();
                    if (!apiKey) throw new Error('API Key missing');
                    const client = new JulesClient(apiKey);
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
                // Construct URL correctly: v0.2
                const sessionId = session.name.split('/').pop();
                const url = `https://jules.google.com/sessions/${sessionId}`;
                vscode.env.openExternal(vscode.Uri.parse(url));
            } else if (session?.url) {
                vscode.env.openExternal(vscode.Uri.parse(session.url));
            }
        })
    );

    // Initial refresh
    treeProvider.refresh();
}

export function deactivate() {}
