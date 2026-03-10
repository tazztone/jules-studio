import * as vscode from 'vscode';

export class AuthManager {
    private static readonly key = 'jules-api-key';

    constructor(private readonly context: vscode.ExtensionContext) {}

    async getApiKey(): Promise<string | undefined> {
        return await this.context.secrets.get(AuthManager.key);
    }

    async setApiKey(key: string): Promise<void> {
        await this.context.secrets.store(AuthManager.key, key);
    }

    async clearApiKey(): Promise<void> {
        await this.context.secrets.delete(AuthManager.key);
    }
}
