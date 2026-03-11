import * as assert from 'assert';
import { PromptGenerator } from '../../workspace/promptGenerator';
import { GitStatus } from '../../utils/constants';

suite('PromptGenerator Test Suite', () => {
    const mockOutputChannel = {
        appendLine: () => {}
    } as any;

    const generator = new PromptGenerator(mockOutputChannel);

    test('getGitStatusString returns correct labels', () => {
        assert.strictEqual((generator as any).getGitStatusString(GitStatus.INDEX_MODIFIED), 'Modified (staged)');
        assert.strictEqual((generator as any).getGitStatusString(GitStatus.MODIFIED), 'Modified');
        assert.strictEqual((generator as any).getGitStatusString(GitStatus.INDEX_ADDED), 'Added (staged)');
        assert.strictEqual((generator as any).getGitStatusString(GitStatus.UNTRACKED), 'Untracked');
        assert.strictEqual((generator as any).getGitStatusString(GitStatus.INDEX_DELETED), 'Deleted (staged)');
        assert.strictEqual((generator as any).getGitStatusString(GitStatus.DELETED), 'Deleted');
        assert.strictEqual((generator as any).getGitStatusString(999), 'Changed');
    });

    test('summarizeCurrentIntent - smart summary priority', () => {
        const artifacts = '- [ ] Task 1';
        const activeFile = 'Active File: main.ts';
        const diff = 'Modified: main.ts';
        const smartSummary = 'User is refactoring the auth system';

        const intent = (generator as any).summarizeCurrentIntent(artifacts, activeFile, diff, smartSummary);
        assert.strictEqual(intent, 'User is refactoring the auth system');
    });

    test('summarizeCurrentIntent - task.md extraction', () => {
        const artifacts = '- [x] Done task\n- [ ] Pending task to implement logout';
        const activeFile = 'Active File: main.ts';
        const diff = 'Modified: main.ts';

        const intent = (generator as any).summarizeCurrentIntent(artifacts, activeFile, diff);
        assert.strictEqual(intent, 'Continue working on: Pending task to implement logout');
    });

    test('summarizeCurrentIntent - inference from diff', () => {
        const artifacts = '- [x] All tasks done';
        const activeFile = 'Active File: auth.ts';
        const diff = 'Modified: auth.ts';

        const intent = (generator as any).summarizeCurrentIntent(artifacts, activeFile, diff);
        assert.strictEqual(intent, 'Finish implementation of changes in auth.ts');
    });

    test('summarizeCurrentIntent - placeholder fallback', () => {
        const intent = (generator as any).summarizeCurrentIntent(null, null, null);
        assert.strictEqual(intent, '[Describe your task here...]');
    });

    test('assemblePrompt - section ordering and budget', () => {
        const errors = 'Error at line 10';
        const artifacts = 'Task: Fix bug';
        const diff = 'diff content';
        const activeFile = 'File: app.ts';
        const openFiles = ['app.ts', 'utils.ts'];
        const smartSummary = 'Fixing auth';

        const prompt = (generator as any).assemblePrompt(errors, artifacts, diff, activeFile, openFiles, smartSummary);
        
        assert.ok(prompt.includes('<active_editor>'), 'Should include active editor');
        assert.ok(prompt.includes('<artifacts>'), 'Should include artifacts');
        assert.ok(prompt.includes('<active_errors>'), 'Should include errors');
        assert.ok(prompt.includes('<git_diff>'), 'Should include diff');
        assert.ok(prompt.includes('<open_files>'), 'Should include open files');
        assert.ok(prompt.includes('<mission_brief>Fixing auth</mission_brief>'));
    });

    test('assemblePrompt - truncation', () => {
        // Create a massive diff to trigger truncation
        const massiveDiff = 'x'.repeat(60000);
        const prompt = (generator as any).assemblePrompt(null, null, massiveDiff, null, [], 'Big task');
        
        assert.ok(prompt.length <= 50000, 'Prompt should be truncated to fit budget');
        assert.ok(prompt.includes('[... Truncated ...]'), 'Should contain truncation marker');
        assert.ok(prompt.includes('</git_diff>'), 'Should still have closing tag');
    });

    test('assemblePrompt - partial budget handling', () => {
        // Test where some sections fit but others are dropped
        const smallDiff = 'small diff';
        const mediumArtifacts = 'a'.repeat(20000);
        const mediumErrors = 'e'.repeat(20000);
        const bigOpenFiles = 'f'.repeat(20000);

        const prompt = (generator as any).assemblePrompt(mediumErrors, mediumArtifacts, smallDiff, null, [bigOpenFiles], 'Task');
        
        // Active Editor (null) -> 0
        // Artifacts (20k) -> Fits
        // Active Errors (20k) -> Fits
        // Git Diff (small) -> Fits
        // Open Files (20k) -> Truncated
        
        assert.ok(prompt.includes('<artifacts>'), 'Artifacts should be included');
        assert.ok(prompt.includes('<active_errors>'), 'Errors should be included');
        assert.ok(prompt.includes('<git_diff>'), 'Diff should be included');
        assert.ok(prompt.includes('<open_files>'), 'Open files should be included (truncated)');
        assert.ok(prompt.includes('[... Truncated ...]'));
    });
});
