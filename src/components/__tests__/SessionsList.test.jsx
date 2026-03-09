import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SessionsList from '../SessionsList';
import { fetchJules } from '../Common';

vi.mock('../Common', async () => {
    const actual = await vi.importActual('../Common');
    return {
        ...actual,
        fetchJules: vi.fn(),
    };
});

const mockSessions = [
    { name: 'sessions/s1', title: 'Test Session', state: 'COMPLETED', createTime: new Date().toISOString() }
];

const mockSources = [
    { name: 'sources/src1', githubRepo: { owner: 'org', name: 'repo', branches: [{ name: 'main' }] } }
];

describe('SessionsList Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock API responses
        fetchJules.mockImplementation((path) => {
            if (path.includes('/sessions')) return Promise.resolve({ sessions: mockSessions, nextPageToken: '' });
            if (path.includes('/sources')) return Promise.resolve({ sources: mockSources });
            return Promise.resolve({});
        });
    });

    it('renders the sessions list correctly', async () => {
        render(<SessionsList apiKey="test-key" onSelectSession={() => {}} />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Session')).toBeInTheDocument();
        });
        expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('handles session deletion', async () => {
        render(<SessionsList apiKey="test-key" onSelectSession={() => {}} />);
        
        await waitFor(() => screen.getByText('Test Session'));
        
        const deleteBtn = screen.getByTitle('Delete Session');
        fireEvent.click(deleteBtn);
        
        const confirmBtn = await screen.findByText('Delete');
        fireEvent.click(confirmBtn);
        
        await waitFor(() => {
            expect(fetchJules).toHaveBeenCalledWith('/v1alpha/sessions/s1', 'DELETE', null, 'test-key');
        });
    });

    it('filters sessions on search/enter', async () => {
        render(<SessionsList apiKey="test-key" onSelectSession={() => {}} />);
        
        const searchInput = screen.getByPlaceholderText(/Filter sessions/);
        fireEvent.change(searchInput, { target: { value: 'bug' } });
        fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });
        
        await waitFor(() => {
            expect(fetchJules).toHaveBeenCalledWith(
                '/v1alpha/sessions', 
                'GET', 
                null, 
                'test-key', 
                expect.objectContaining({ filter: 'bug' })
            );
        });
    });

    it('opens create modal and populates branches', async () => {
        render(<SessionsList apiKey="test-key" onSelectSession={() => {}} />);
        
        const newBtn = screen.getByText(/New Session/);
        fireEvent.click(newBtn);
        // Check for modal details
        expect(screen.getByText('Create New Session')).toBeInTheDocument();
        
        // Check if branch dropdown exists and has 'main'
        await waitFor(() => {
            const select = screen.getByDisplayValue('main');
            expect(select).toBeInTheDocument();
        });
    });

    it('handles automation mode toggle in creation modal', async () => {
        render(<SessionsList apiKey="test-key" onSelectSession={() => {}} />);
        
        fireEvent.click(screen.getByText('New Session'));
        const modeSelect = screen.getByLabelText(/Automation Mode/i);
        
        fireEvent.change(modeSelect, { target: { value: 'FULLY_AUTOMATED' } });
        expect(modeSelect.value).toBe('FULLY_AUTOMATED');
    });

    it('handles Load More pagination', async () => {
        fetchJules.mockResolvedValueOnce({
            sessions: [{ name: 'sess-p1', title: 'Session P1', state: 'COMPLETED' }],
            nextPageToken: 'token-123'
        });

        render(<SessionsList apiKey="test-key" onSelectSession={() => {}} />);
        
        await waitFor(() => expect(screen.getByText('Session P1')).toBeInTheDocument());
        
        const loadMoreBtn = screen.getByText(/Load More Sessions/);
        expect(loadMoreBtn).toBeInTheDocument();

        fetchJules.mockResolvedValueOnce({
            sessions: [{ name: 'sess-p2', title: 'Session P2', state: 'COMPLETED' }]
        });

        fireEvent.click(loadMoreBtn);
        await waitFor(() => expect(screen.getByText('Session P2')).toBeInTheDocument());
        expect(fetchJules).toHaveBeenCalledWith(
            '/v1alpha/sessions', 
            'GET', 
            null, 
            'test-key', 
            expect.objectContaining({ pageToken: 'token-123' })
        );
    });

    it('shows error if required fields are missing during creation', async () => {
        render(<SessionsList apiKey="key" onSelectSession={() => {}} />);
        fireEvent.click(screen.getByText(/New Session/i));
        
        // Try to create without prompt
        fireEvent.click(screen.getByRole('button', { name: /create session/i }));
        expect(await screen.findByText(/required/i)).toBeInTheDocument();
    });

    it('creates a new session via modal and refreshes list', async () => {
        // Mock the two initial GET calls
        fetchJules.mockResolvedValueOnce({ sessions: mockSessions }); // sessions
        fetchJules.mockResolvedValueOnce({ sources: mockSources });   // sources
        
        // Mock the POST call
        fetchJules.mockResolvedValueOnce({ name: 'sessions/new-sess' }); 
        
        // Mock the refresh load
        fetchJules.mockResolvedValueOnce({ sessions: [...mockSessions] }); 
        fetchJules.mockResolvedValueOnce({ sources: mockSources });
        
        render(<SessionsList apiKey="key" onSelectSession={() => {}} />);
        
        fireEvent.click(screen.getByText(/New Session/i));
        
        const titleInput = await screen.findByPlaceholderText(/e\.g\. Implement user login/i);
        const promptInput = screen.getByPlaceholderText(/Describe the coding task/i);
        
        // Wait for sources to be populated
        const sourceSelect = await screen.findByLabelText(/Source Repository/i);
        await waitFor(() => expect(sourceSelect.options.length).toBeGreaterThan(0));
        
        fireEvent.change(titleInput, { target: { value: 'New Test Session' } });
        fireEvent.change(promptInput, { target: { value: 'Test Prompt' } });
        
        fireEvent.click(screen.getByRole('button', { name: /create session/i }));
        
        await waitFor(() => {
            expect(fetchJules).toHaveBeenCalledWith('/v1alpha/sessions', 'POST', expect.objectContaining({
                prompt: 'Test Prompt',
                title: 'New Test Session'
            }), 'key');
        });
    });

    it('handles automation mode toggle in creation modal', async () => {
        render(<SessionsList apiKey="key" onSelectSession={() => {}} />);
        fireEvent.click(screen.getByText(/New Session/i));
        
        const select = await screen.findByLabelText(/Automation Mode/i);
        fireEvent.change(select, { target: { value: 'FULLY_AUTOMATED' } });
        expect(select.value).toBe('FULLY_AUTOMATED');
        
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);
        expect(checkbox.checked).toBe(false);
    });

    it('triggers search on Enter key in filter input', async () => {
        render(<SessionsList apiKey="key" onSelectSession={() => {}} />);
        const input = screen.getByPlaceholderText(/Filter sessions/i);
        
        fireEvent.change(input, { target: { value: 'bug' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        
        await waitFor(() => {
            expect(fetchJules).toHaveBeenCalledWith('/v1alpha/sessions', 'GET', null, 'key', expect.objectContaining({
                filter: 'bug'
            }));
        });
    });

    it('loads more sessions when Load More is clicked', async () => {
        fetchJules.mockResolvedValueOnce({ sessions: mockSessions, nextPageToken: 'token123' });
        render(<SessionsList apiKey="key" onSelectSession={() => {}} />);
        
        const loadMoreBtn = await screen.findByText(/Load More Sessions/i);
        fetchJules.mockResolvedValueOnce({ sessions: [] });
        fireEvent.click(loadMoreBtn);
        
        await waitFor(() => {
            expect(fetchJules).toHaveBeenCalledWith('/v1alpha/sessions', 'GET', null, 'key', expect.objectContaining({
                pageToken: 'token123'
            }));
        });
    });

    it('shows empty state when no sessions are returned', async () => {
        fetchJules.mockResolvedValueOnce({ sessions: [] });
        render(<SessionsList apiKey="test-key" onSelectSession={() => {}} />);
        
        await waitFor(() => {
            expect(screen.getByText(/No sessions found/i)).toBeInTheDocument();
        });
    });

    it('shows loading spinner while fetching', async () => {
        let resolveFetch;
        const fetchPromise = new Promise(resolve => { resolveFetch = resolve; });
        fetchJules.mockReturnValueOnce(fetchPromise);
        
        render(<SessionsList apiKey="test-key" onSelectSession={() => {}} />);
        
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
        
        await act(async () => {
            resolveFetch({ sessions: [] });
        });
        await waitFor(() => expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument());
    });

    it('handles multi-session selection and bulk delete', async () => {
        const manySessions = [
            { name: 'sessions/s1', title: 'S1', state: 'COMPLETED' },
            { name: 'sessions/s2', title: 'S2', state: 'COMPLETED' }
        ];
        fetchJules.mockImplementation((path) => {
            if (path.includes('/sessions')) return Promise.resolve({ sessions: manySessions });
            if (path.includes('/sources')) return Promise.resolve({ sources: mockSources });
            return Promise.resolve({});
        });
        
        render(<SessionsList apiKey="test-key" onSelectSession={() => {}} />);
        
        await screen.findByText('S1');
        
        // Click select all
        const selectAll = screen.getByLabelText(/Select All/i);
        fireEvent.click(selectAll);
        
        expect(screen.getByText(/2 session\(s\) selected/i)).toBeInTheDocument();
        
        const bulkDeleteBtn = screen.getByText(/Delete Selected/i);
        fireEvent.click(bulkDeleteBtn);
        
        const confirmBtn = await screen.findByText('Delete');
        fireEvent.click(confirmBtn);
        
        await waitFor(() => {
            expect(fetchJules).toHaveBeenCalledWith('/v1alpha/sessions/s1', 'DELETE', null, 'test-key');
            expect(fetchJules).toHaveBeenCalledWith('/v1alpha/sessions/s2', 'DELETE', null, 'test-key');
        });
    });
});
