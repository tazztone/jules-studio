import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SessionDetailView from '../SessionDetailView';
import { fetchJules } from '../Common';

vi.mock('../Common', async () => {
    const actual = await vi.importActual('../Common');
    return {
        ...actual,
        fetchJules: vi.fn(),
    };
});

// Mock Notification API
global.Notification = {
    requestPermission: vi.fn(() => Promise.resolve('granted')),
    permission: 'default',
};
const MockNotification = vi.fn();
global.Notification = MockNotification;
MockNotification.requestPermission = vi.fn(() => Promise.resolve('granted'));
MockNotification.permission = 'granted';

const mockSession = {
    name: 'sessions/sess-1',
    title: 'Test Session',
    state: 'AWAITING_PLAN_APPROVAL',
    sourceContext: { source: 'sources/src1', githubRepoContext: { startingBranch: 'main' } },
    createTime: new Date().toISOString(),
    outputs: []
};

const mockActivities = [
    { name: 'sessions/sess-1/activities/a1', type: 'planGenerated', planGenerated: { plan: { steps: [{ index: 1, title: 'Step 1' }] } }, createTime: new Date().toISOString() }
];

describe('SessionDetailView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchJules.mockImplementation((path) => {
            if (path.includes('/activities')) return Promise.resolve({ activities: mockActivities });
            return Promise.resolve(mockSession);
        });
    });

    it('renders session details and activity timeline', async () => {
        render(<SessionDetailView session={mockSession} onBack={() => {}} apiKey="key" />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Session')).toBeInTheDocument();
        });
        
        // Ensure activities are loaded (since it defaults to 'plan' tab now)
        await waitFor(() => {
            expect(screen.getByText(/Step 1/)).toBeInTheDocument();
        });
    });

    it('handles plan approval', async () => {
        render(<SessionDetailView session={mockSession} onBack={() => {}} apiKey="key" />);
        
        // Wait for plan to render
        await waitFor(() => expect(screen.queryByText('Approve Plan')).toBeInTheDocument());
        const approveBtn = screen.getByText('Approve Plan');
        fireEvent.click(approveBtn);
        
        await waitFor(() => {
            expect(fetchJules).toHaveBeenCalledWith('/v1alpha/sessions/sess-1:approvePlan', 'POST', {}, 'key');
        });
    });

    it('handles rate limiting with exponential backoff', async () => {
        vi.useFakeTimers();
        fetchJules.mockRejectedValue(new Error('API Error (429): Rate limited'));
        
        // Use QUEUED state so it actually triggers polling in resetPolling
        const pollingSession = { ...mockSession, state: 'QUEUED' };
        
        await act(async () => {
            render(<SessionDetailView session={pollingSession} onBack={() => {}} apiKey="key" />);
        });
        
        // Initial load effort (loadActivities called on mount)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100); 
        });
        expect(fetchJules).toHaveBeenCalled(); 
        const initialCalls = fetchJules.mock.calls.length;
        
        // After failure, it should wait pollTime (5s) before NEXT poll
        // But retryCount increased, so pollTime is now 10s
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        // Total should still be same as initial
        expect(fetchJules).toHaveBeenCalledTimes(initialCalls); 

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        // Now it should call again
        expect(fetchJules.mock.calls.length).toBeGreaterThan(initialCalls); 
        
        vi.useRealTimers();
    });

    it('focuses chat input when Suggest Changes is clicked', async () => {
        render(<SessionDetailView session={mockSession} onBack={() => {}} apiKey="key" />);
        
        await waitFor(() => expect(screen.getByText('Suggest Changes')).toBeInTheDocument());
        const suggestBtn = screen.getByText('Suggest Changes');
        const input = screen.getByPlaceholderText(/Send a message/);
        
        fireEvent.click(suggestBtn);
        expect(document.activeElement).toBe(input);
    });

    it('displays the correct local CLI pull command and handles copying', async () => {
        render(<SessionDetailView session={mockSession} onBack={() => {}} apiKey="key" />);
        
        // Switch to artifacts tab
        const tab = screen.getByText('Artifacts & Code');
        fireEvent.click(tab);
        
        await waitFor(() => expect(screen.getByText(/Local Integration/i)).toBeInTheDocument());
        expect(screen.getByText(/jules remote pull --session sess-1/i)).toBeInTheDocument();
        
        const copyBtn = screen.getByText('Copy Command');
        fireEvent.click(copyBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('jules remote pull'));
    });

    it('renders BashOutput and Media artifacts', async () => {
        const complexActivities = [
            ...mockActivities,
            { 
                name: 'a-combined', type: 'outputs', 
                artifacts: [
                    { type: 'BashOutput', bashOutput: { command: 'ls -la', stdout: 'total 0', exitCode: 0 } },
                    { type: 'Media', media: { mimeType: 'image/png', data: 'placeholder' } }
                ],
                createTime: new Date().toISOString()
            }
        ];
        fetchJules.mockImplementation((path) => {
            if (path.includes('/activities')) return Promise.resolve({ activities: complexActivities });
            return Promise.resolve(mockSession);
        });
        
        render(<SessionDetailView session={mockSession} onBack={() => {}} apiKey="key" />);
        
        // Wait for data to load
        await screen.findByText('View Plan');
        
        // Switch to artifacts tab
        await act(async () => {
            fireEvent.click(screen.getByText('Artifacts & Code'));
        });
        
        expect(await screen.findByText(/ls -la/)).toBeInTheDocument();
        expect(screen.getByText('total 0')).toBeInTheDocument();
        // Check for artifact header
        expect(screen.getByText('Media')).toBeInTheDocument();
        // Use correct alt text
        expect(screen.getByAltText('Generated Media')).toBeInTheDocument();
    });

    it('switches tabs from timeline deep-links', async () => {
        render(<SessionDetailView session={mockSession} onBack={() => {}} apiKey="key" />);
        
        const viewPlanBtn = await screen.findByText('View Plan');
        fireEvent.click(viewPlanBtn);
        expect(await screen.findByText(/Step 1:/)).toBeInTheDocument();
    });

    it('alerts user on generic API failure', async () => {
        fetchJules.mockImplementation((path) => {
            if (path.includes('/activities')) return Promise.reject(new Error('Internal Server Error'));
            return Promise.resolve(mockSession);
        });
        render(<SessionDetailView session={mockSession} onBack={() => {}} apiKey="key" />);
        
        await waitFor(() => {
            expect(screen.getByText(/Internal Server Error/i)).toBeInTheDocument();
        });
    });

    it('sends messages correctly and clears input', async () => {
        const mockSess = { ...mockSession, state: 'COMPLETED' };
        fetchJules.mockResolvedValueOnce(mockSess); // detail fetch
        fetchJules.mockResolvedValueOnce({ activities: [] }); // initial activities
        fetchJules.mockResolvedValueOnce({ name: 'act-new' }); // send message response
        fetchJules.mockResolvedValueOnce({ activities: [{ type: 'userMessaged', userMessaged: { message: 'Hello' } }] }); // refresh activities
        
        render(<SessionDetailView session={mockSess} onBack={() => {}} apiKey="key" />);
        
        const input = await screen.findByPlaceholderText(/Send a message to Jules/i);
        fireEvent.change(input, { target: { value: 'Hello Jules' } });
        
        const sendBtn = screen.getByTitle(/Send Message/i);
        fireEvent.click(sendBtn);
        
        await waitFor(() => {
            expect(fetchJules).toHaveBeenCalledWith(
                expect.stringContaining(':sendMessage'), 
                'POST', 
                { message: 'Hello Jules' },
                'key'
            );
        });
        
        expect(input.value).toBe('');
    });

    it('uses MOCK_ACTIVITIES when no API key is provided', async () => {
        render(<SessionDetailView session={mockSession} onBack={() => {}} apiKey={null} />);
        expect(await screen.findByText(/BobaComponent/i)).toBeInTheDocument();
    });

    it('renders ChangeSet artifacts in DiffViewer', async () => {
        const patch = '--- a/file\n+++ b/file\n@@ -1,1 +1,1 @@\n-oldline\n+newline';
        const changeSetActivity = {
            name: 'act-diff',
            type: 'progressUpdated',
            artifacts: [{ type: 'ChangeSet', changeSet: { unidiffPatch: patch } }],
            createTime: new Date().toISOString()
        };
        fetchJules.mockResolvedValueOnce({ ...mockSession });
        fetchJules.mockResolvedValueOnce({ activities: [changeSetActivity] });

        render(<SessionDetailView session={mockSession} onBack={() => {}} apiKey="key" />);
        fireEvent.click(await screen.findByText('Artifacts & Code'));
        
        // Wait for artifact header to ensure tab switched
        expect(await screen.findByText('ChangeSet')).toBeInTheDocument();
        
        expect(screen.getByText(/oldline/)).toHaveClass('text-red-400');
        expect(screen.getByText(/newline/)).toHaveClass('text-green-400');
    });

    it('renders PR links from session outputs', async () => {
        const sessionWithPR = {
            ...mockSession,
            outputs: [{ pullRequest: { url: 'https://github.com/pr/1' } }]
        };
        fetchJules.mockResolvedValue(sessionWithPR);
        fetchJules.mockResolvedValueOnce({ activities: [] });

        render(<SessionDetailView session={sessionWithPR} onBack={() => {}} apiKey="key" />);
        
        const prLink = await screen.findByText(/View Pull Request/i);
        expect(prLink).toHaveAttribute('href', 'https://github.com/pr/1');
    });

    it('deletes session with API key after confirmation', async () => {
        const onBack = vi.fn();
        window.confirm = vi.fn().mockReturnValue(true);
        fetchJules.mockResolvedValueOnce(mockSession);
        fetchJules.mockResolvedValueOnce({ activities: [] });
        fetchJules.mockResolvedValueOnce({}); // DELETE response

        render(<SessionDetailView session={mockSession} onBack={onBack} apiKey="key" />);
        
        const deleteBtn = await screen.findByTitle(/Delete Session/i);
        fireEvent.click(deleteBtn);
        
        const confirmBtn = await screen.findByText('Delete Permanently');
        fireEvent.click(confirmBtn);
        
        await waitFor(() => {
            expect(fetchJules).toHaveBeenCalledWith('/v1alpha/sessions/sess-1', 'DELETE', null, 'key');
            expect(onBack).toHaveBeenCalled();
        });
    });
});
