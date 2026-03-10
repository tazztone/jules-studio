import * as assert from 'assert';
import { JulesClient } from '../../api/julesClient';

suite('JulesClient Test Suite', function () {
    this.timeout(10000); // Suite-level timeout
    
    test('Retry logic handles 429 errors', async function () {
        let attempts = 0;
        
        // Mock global fetch
        const originalFetch = global.fetch;
        try {
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
        } finally {
            global.fetch = originalFetch;
        }
    });

    test('Error parsing handles JSON errors', async () => {
        const originalFetch = global.fetch;
        try {
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
        } finally {
            global.fetch = originalFetch;
        }
    });

    test('listSessions builds correct URL', async () => {
        let capturedUrl = '';
        const originalFetch = global.fetch;
        try {
            (global as any).fetch = async (url: string) => {
                capturedUrl = url;
                return {
                    status: 200,
                    ok: true,
                    text: async () => JSON.stringify({ sessions: [] })
                };
            };

            const client = new JulesClient('test-key');
            await client.listSessions(15);
            
            assert.ok(capturedUrl.includes('pageSize=15'), 'URL should include pageSize=15');
            assert.ok(capturedUrl.includes('sessions'), 'URL should include sessions endpoint');
        } finally {
            global.fetch = originalFetch;
        }
    });

    test('handles empty response body', async () => {
        const originalFetch = global.fetch;
        try {
            (global as any).fetch = async () => {
                return {
                    status: 200,
                    ok: true,
                    text: async () => '' // Empty body
                };
            };

            const client = new JulesClient('test-key');
            const result = await client.listSessions();
            assert.deepStrictEqual(result, {}, 'Should return empty object for empty body');
        } finally {
            global.fetch = originalFetch;
        }
    });
});
