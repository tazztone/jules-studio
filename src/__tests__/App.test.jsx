import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Mock the API calls
vi.mock('../components/Common', async () => {
    const actual = await vi.importActual('../components/Common');
    return {
        ...actual,
        fetchJules: vi.fn().mockResolvedValue({ sessions: [], sources: [] }),
    };
});

describe('App Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders sidebar and main content', async () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <App />
            </MemoryRouter>
        );

        expect(screen.getByText('Jules Studio')).toBeInTheDocument();
        expect(screen.getByText(/Active Sessions/i)).toBeInTheDocument();
        
        fireEvent.click(screen.getByRole('link', { name: /CLI & Integrations/i }));
        expect(screen.getAllByText(/CLI & Integrations/i).length).toBeGreaterThan(0);
    });

    it('navigates to Sources page', async () => {
        render(
            <MemoryRouter initialEntries={['/sources']}>
                <App />
            </MemoryRouter>
        );

        expect(screen.getByText('Connected Repositories')).toBeInTheDocument();
    });

    it('navigates to Settings page', async () => {
        render(
            <MemoryRouter initialEntries={['/settings']}>
                <App />
            </MemoryRouter>
        );

        expect(screen.getByText('Settings & Authentication')).toBeInTheDocument();
    });

    it('loads apiKey from localStorage on mount', () => {
        const spy = vi.spyOn(Storage.prototype, 'getItem');
        spy.mockReturnValue('stored-key');
        
        render(
            <MemoryRouter>
                <App />
            </MemoryRouter>
        );
        
        expect(spy).toHaveBeenCalledWith('jules_api_key');
        spy.mockRestore();
    });

    it('renders SessionDetailWrapper for session routes', async () => {
        render(
            <MemoryRouter initialEntries={['/sessions/sess-999']}>
                <App />
            </MemoryRouter>
        );

        // SessionDetailWrapper renders SessionDetailView with specific session name
        expect(await screen.findByText('Activity Timeline')).toBeInTheDocument();
        expect(screen.getByText('Untitled Session')).toBeInTheDocument();
    });
});
