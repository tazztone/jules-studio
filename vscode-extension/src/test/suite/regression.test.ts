import * as assert from 'assert';
import { SessionsTreeProvider } from '../../views/sessionsTreeProvider';
import { JulesClient } from '../../api/julesClient';

suite('Regression Test Suite', () => {
    test('SessionsTreeProvider should not pass raw repo filter to API', async () => {
        // Mock JulesClient
        let capturedFilter: string | undefined = 'initial';
        const mockClient = {
            listSessions: async (_pageSize?: number, _pageToken?: string, filter?: string) => {
                capturedFilter = filter;
                return { sessions: [] };
            }
        } as any as JulesClient;

        // Mock ClientManager
        const mockClientManager = {
            getClient: async () => mockClient
        } as any;

        const provider = new SessionsTreeProvider(mockClientManager);
        
        // Set a repository filter (the raw source name that caused the 400)
        const rawSourceFilter = 'sources/123';
        provider.setRepoFilter(rawSourceFilter);

        // We need to trigger getChildren, but it's debounced and uses a queue.
        // For testing, we can bypass the queue or wait for the debounce.
        // Actually, getChildren processes the queue.
        
        // Ensure the queue has a request
        provider.refresh({ mode: 'user' });
        
        // Execute getChildren
        await provider.getChildren();

        // Verify that the filter passed to listSessions is UNDEFINED 
        // (because we now handle it client-side to avoid 400 errors)
        assert.strictEqual(capturedFilter, undefined, 'Filter should not be passed to the API as a raw string');
    });
});
