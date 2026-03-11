import * as assert from 'assert';
import { SessionTreeItem, SessionsTreeProvider } from '../../views/sessionsTreeProvider';

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

    test('SessionTreeItem - UI elements', () => {
        const item = new SessionTreeItem(mockSession('COMPLETED'));
        
        // Icon
        const icon = (item as any).getStateIcon('COMPLETED');
        assert.strictEqual(icon.id, 'check');

        // Tooltip
        const tooltip = (item as any).createTooltip(mockSession('COMPLETED'));
        assert.ok(tooltip.value.includes('**Session:** 123'));
        assert.ok(tooltip.value.includes('Completed'));
    });

    // Note: We can only test the state tracking part of handleStateChanges 
    // without mocking the entire VS Code notification system (e.g. via Sinon)
    test('handleStateChanges - state tracking', () => {
        const provider = new SessionsTreeProvider(null!, null!);
        const session = mockSession('PLANNING');
        
        // Initial state
        (provider as any).handleStateChanges([session]);
        assert.strictEqual((provider as any)._previousStates.get('123'), 'PLANNING');

        // State change
        const updatedSession = mockSession('COMPLETED');
        (provider as any).handleStateChanges([updatedSession]);
        assert.strictEqual((provider as any)._previousStates.get('123'), 'COMPLETED');
    });
});
