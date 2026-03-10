import * as assert from 'assert';
import { SessionTreeItem } from '../../views/sessionsTreeProvider';

suite('SessionsTreeProvider Helper Test Suite', () => {
    const mockSession = (state: string) => ({
        id: '123',
        name: 'sessions/123',
        prompt: 'test prompt',
        state: state,
        updateTime: new Date().toISOString(),
        sourceContext: { source: 'owner/repo' }
    }) as any;

    test('getStateLabel returns correct mapping', () => {
        // We can't instantiate SessionTreeItem easily without VS Code, but we can test the logic
        // For testing purposes, I'll extract the logic or test it via prototype
        const item = new SessionTreeItem(mockSession('COMPLETED'));
        
        // Accessing private method for testing
        assert.strictEqual((item as any).getStateLabel('COMPLETED'), 'Completed');
        assert.strictEqual((item as any).getStateLabel('AWAITING_PLAN_APPROVAL'), 'Needs Approval');
        assert.strictEqual((item as any).getStateLabel('FAILED'), 'Failed');
        assert.strictEqual((item as any).getStateLabel('UNKNOWN'), 'UNKNOWN');
    });

    test('getTimeAgo handles different durations', () => {
        const item = new SessionTreeItem(mockSession('QUEUED'));
        const now = new Date();
        
        assert.strictEqual((item as any).getTimeAgo(new Date(now.getTime() - 10000)), 'just now');
        assert.strictEqual((item as any).getTimeAgo(new Date(now.getTime() - 120000)), '2m ago');
        assert.strictEqual((item as any).getTimeAgo(new Date(now.getTime() - 7200000)), '2h ago');
    });

    test('getApplyAction returns correct tip per state', () => {
        const item = new SessionTreeItem(mockSession('QUEUED'));
        
        assert.ok((item as any).getApplyAction('COMPLETED').includes('Apply Changes'));
        assert.ok((item as any).getApplyAction('AWAITING_PLAN_APPROVAL').includes('Approve Plan'));
        assert.ok((item as any).getApplyAction('PLANNING').includes('Wait'));
    });
});
