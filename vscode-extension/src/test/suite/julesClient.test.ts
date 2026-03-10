import * as assert from 'assert';
import { JulesClient } from '../../api/julesClient';

suite('JulesClient Test Suite', () => {
    test('Retry logic handles 429 errors', async () => {
        let attempts = 0;
        
        // Mock global fetch
        const originalFetch = global.fetch;
        (global as any).fetch = async () => {
            attempts++;
            if (attempts < 3) {
                return {
                    status: 429,
                    ok: false,
                    text: async () => 'Rate limit exceeded'
                };
            }
            return {
                status: 200,
                ok: true,
                text: async () => JSON.stringify({ id: 'success' })
            };
        };

        const client = new JulesClient('test-key');
        
        // Use a small fixed delay or mock the setTimeout to speed up tests
        // But for a unit test, we just want to see it completes
        const result: any = await client.getSession('test-id');
        
        assert.strictEqual(attempts, 3, 'Should have attempted 3 times before success');
        assert.strictEqual(result.id, 'success');

        global.fetch = originalFetch;
    });

    test('Error parsing handles JSON errors', async () => {
        const originalFetch = global.fetch;
        (global as any).fetch = async () => {
            return {
                status: 400,
                ok: false,
                text: async () => JSON.stringify({ error: { message: 'Semantic error' } })
            };
        };

        const client = new JulesClient('test-key');
        
        try {
            await client.getSession('test-id');
            assert.fail('Should have thrown an error');
        } catch (err: any) {
            assert.ok(err.message.includes('Semantic error'), `Error message should be parsed: ${err.message}`);
        }

        global.fetch = originalFetch;
    });
});
