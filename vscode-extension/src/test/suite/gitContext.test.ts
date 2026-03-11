import * as assert from 'assert';
import { GitContextManager } from '../../workspace/gitContext';

suite('GitContext Test Suite', () => {
    const mockOutputChannel = {
        appendLine: () => {}
    } as any;

    const manager = new GitContextManager(mockOutputChannel);

    test('parseGithubUrl - valid HTTPS', () => {
        const url = 'https://github.com/google/jules-studio.git';
        const result = (manager as any).parseGithubUrl(url);
        assert.deepStrictEqual(result, { owner: 'google', name: 'jules-studio' });
    });

    test('parseGithubUrl - valid SSH', () => {
        const url = 'git@github.com:google/jules-studio.git';
        const result = (manager as any).parseGithubUrl(url);
        assert.deepStrictEqual(result, { owner: 'google', name: 'jules-studio' });
    });

    test('parseGithubUrl - HTTPS without .git', () => {
        const url = 'https://github.com/google/jules-studio';
        const result = (manager as any).parseGithubUrl(url);
        assert.deepStrictEqual(result, { owner: 'google', name: 'jules-studio' });
    });

    test('parseGithubUrl - throws on invalid URL', () => {
        assert.throws(() => (manager as any).parseGithubUrl('https://gitlab.com/google/jules'), /Could not parse Git Remote URL/);
        assert.throws(() => (manager as any).parseGithubUrl('not-a-url'), /Could not parse Git Remote URL/);
    });

    test('parseGitError - friendly messages', () => {
        const networkError = { message: 'Failed to connect to github.com port 443: Connection refused' };
        assert.ok((manager as any).parseGitError(networkError).includes('No network connection'));

        const authError = { message: 'remote: Password authentication is temporarily disabled.\nfatal: Authentication failed for ...' };
        assert.ok((manager as any).parseGitError(authError).includes('Authentication error'));

        const rejectedError = { message: 'error: failed to push some refs to ...\nhint: Updates were rejected because the remote contains work that you do not have locally.' };
        assert.ok((manager as any).parseGitError(rejectedError).includes('Remote has changes'));

        const genericError = { message: 'Some random git error occurred' };
        assert.ok((manager as any).parseGitError(genericError).includes('Git operation failed: some random git error'));
    });
});
