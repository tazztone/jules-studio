import * as assert from 'assert';
import * as vscode from 'vscode';
import { ClientManager } from '../../api/clientManager';

suite('ClientManager Test Suite', () => {
    vscode.window.showInformationMessage('Start ClientManager tests.');

    test('Cache is persistent for same key', async () => {
        const mockAuth = {
            getApiKey: async () => 'test-key',
            setApiKey: async () => {},
            deleteApiKey: async () => {}
        } as any;

        const manager = new ClientManager(mockAuth);
        const client1 = await manager.getClient();
        const client2 = await manager.getClient();

        assert.strictEqual(client1, client2, 'Clients should be identical when key is the same');
    });

    test('Cache resets on key change', async () => {
        let currentKey = 'key1';
        const mockAuth = {
            getApiKey: async () => currentKey
        } as any;

        const manager = new ClientManager(mockAuth);
        const client1 = await manager.getClient();
        
        // Simulate key change and reset
        currentKey = 'key2';
        manager.reset();
        
        const client2 = await manager.getClient();

        assert.notStrictEqual(client1, client2, 'Client should be recreated after reset');
    });

    test('getClient throws when key is missing', async () => {
        const mockAuth = {
            getApiKey: async () => undefined
        } as any;

        const manager = new ClientManager(mockAuth);
        await assert.rejects(manager.getClient(), /API Key missing/);
    });

    test('Cache rotates automatically if key in storage changes', async () => {
        let currentKey = 'key1';
        const mockAuth = {
            getApiKey: async () => currentKey
        } as any;

        const manager = new ClientManager(mockAuth);
        const client1 = await manager.getClient();
        
        currentKey = 'key3'; // Change key without calling reset()
        const client2 = await manager.getClient();

        assert.notStrictEqual(client1, client2, 'Client should be rotated automatically');
    });
});
