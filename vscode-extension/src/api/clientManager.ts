import { JulesClient } from './julesClient';
import { AuthManager } from '../auth/keyManager';

export class ClientManager {
    private _client: JulesClient | undefined;
    private _cachedKey: string | undefined;

    constructor(private readonly authManager: AuthManager) {}

    /**
     * Returns a cached JulesClient instance. 
     * Refreshes the instance ONLY if the API key in SecretStorage has changed.
     */
    async getClient(): Promise<JulesClient> {
        const key = await this.authManager.getApiKey();
        if (!key) {
            throw new Error('Jules API Key missing. Please configure it in the Setup Wizard.');
        }

        if (key !== this._cachedKey || !this._client) {
            this._client = new JulesClient(key);
            this._cachedKey = key;
        }

        return this._client;
    }

    /**
     * Invalidates the cache (e.g., after the user updates their key).
     */
    reset() {
        this._client = undefined;
        this._cachedKey = undefined;
    }
}
