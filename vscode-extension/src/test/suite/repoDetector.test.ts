import * as assert from 'assert';
import { RepoDetector } from '../../workspace/repoDetector';

suite('RepoDetector Unit Test Suite', () => {
    // We can't easily mock the entire VS Code extension API for unit tests here
    // But we can test the private parseRemoteUrl if we make it accessible or test it via proxy
    
    // For this demonstration, I'll test the logic itself
    const detector = new RepoDetector({} as any);

    test('parseRemoteUrl handles HTTPS github URLs', () => {
        const url = 'https://github.com/tazztone/jules-studio.git';
        const result = (detector as any).parseRemoteUrl(url);
        assert.deepStrictEqual(result, { owner: 'tazztone', name: 'jules-studio' });
    });

    test('parseRemoteUrl handles HTTPS github URLs without .git', () => {
        const url = 'https://github.com/tazztone/jules-studio';
        const result = (detector as any).parseRemoteUrl(url);
        assert.deepStrictEqual(result, { owner: 'tazztone', name: 'jules-studio' });
    });

    test('parseRemoteUrl handles SSH github URLs', () => {
        const url = 'git@github.com:tazztone/jules-studio.git';
        const result = (detector as any).parseRemoteUrl(url);
        assert.deepStrictEqual(result, { owner: 'tazztone', name: 'jules-studio' });
    });

    test('parseRemoteUrl returns undefined for non-github URLs', () => {
        const url = 'https://gitlab.com/owner/repo.git';
        const result = (detector as any).parseRemoteUrl(url);
        assert.strictEqual(result, undefined);
    });

    test('parseRemoteUrl returns undefined for malformed URLs', () => {
        assert.strictEqual((detector as any).parseRemoteUrl('not-a-url'), undefined);
        assert.strictEqual((detector as any).parseRemoteUrl(''), undefined);
    });
});
