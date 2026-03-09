import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SourcesView from '../SourcesView';
import { fetchJules } from '../Common';

vi.mock('../Common', async () => {
    const actual = await vi.importActual('../Common');
    return {
        ...actual,
        fetchJules: vi.fn(),
    };
});

const mockSources = [
    { 
        name: 'sources/s1', 
        githubRepo: { 
            owner: 'test-org', 
            name: 'test-repo', 
            branches: [{ name: 'main' }, { name: 'dev' }] 
        } 
    }
];

describe('SourcesView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders connected repositories', async () => {
        fetchJules.mockResolvedValueOnce({ sources: mockSources });
        render(<SourcesView apiKey="key" />);
        
        expect(await screen.findByText(/test-org/i)).toBeInTheDocument();
        expect(screen.getByText(/test-repo/i)).toBeInTheDocument();
    });

    it('handles repository disconnection', async () => {
        fetchJules.mockResolvedValueOnce({ sources: mockSources });
        window.confirm = vi.fn(() => true);
        render(<SourcesView apiKey="key" />);
        
        const disconnectBtn = await screen.findByTitle('Disconnect Repository');
        fireEvent.click(disconnectBtn);
        
        await waitFor(() => {
            expect(fetchJules).toHaveBeenCalledWith('/v1alpha/sources/s1', 'DELETE', null, 'key');
        });
    });

    it('loads more repositories when Load More is clicked', async () => {
        fetchJules.mockResolvedValueOnce({ sources: mockSources, nextPageToken: 'next-page' });
        render(<SourcesView apiKey="key" />);
        
        const loadMoreBtn = await screen.findByText(/Load More Repos/i);
        fetchJules.mockResolvedValueOnce({ sources: [] });
        fireEvent.click(loadMoreBtn);
        
        await waitFor(() => {
            expect(fetchJules).toHaveBeenCalledWith('/v1alpha/sources', 'GET', null, 'key', expect.objectContaining({
                pageToken: 'next-page'
            }));
        });
    });

    it('renders error message on API failure', async () => {
        fetchJules.mockRejectedValue(new Error('Connect failed'));
        render(<SourcesView apiKey="key" />);
        expect(await screen.findByText('Connect failed')).toBeInTheDocument();
    });

    it('shows empty state', async () => {
        fetchJules.mockResolvedValueOnce({ sources: [] });
        render(<SourcesView apiKey="key" />);
        expect(await screen.findByText(/No repositories connected yet/i)).toBeInTheDocument();
    });
});
