import * as vscode from 'vscode';

export class AuthManager {
    private static readonly KEY = 'jules-api-key';

    constructor(private readonly context: vscode.ExtensionContext) {}

    async getApiKey(): Promise<string | undefined> {
        return await this.context.secrets.get(AuthManager.KEY);
    }

    async setApiKey(key: string): Promise<void> {
        await this.context.secrets.store(AuthManager.KEY, key);
    }

    async clearApiKey(): Promise<void> {
        await this.context.secrets.delete(AuthManager.KEY);
    }
}
