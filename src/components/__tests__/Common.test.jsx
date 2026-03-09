import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fetchJules, StateBadge, Badge } from '../Common';

// Mock global fetch
global.fetch = vi.fn();

describe('fetchJules utility', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    it('successfully fetches data with API key', async () => {
        const mockData = { sessions: [] };
        fetch.mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify(mockData),
        });

        const result = await fetchJules('/v1alpha/sessions', 'GET', null, 'test-key');
        
        expect(result).toEqual(mockData);
        expect(fetch).toHaveBeenCalledWith('/v1alpha/sessions', expect.objectContaining({
            headers: expect.objectContaining({
                'x-goog-api-key': 'test-key'
            })
        }));
    });

    it('serializes query parameters correctly', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            text: async () => JSON.stringify({}),
        });

        await fetchJules('/v1alpha/sessions', 'GET', null, 'key', { pageSize: 10, filter: 'name' });
        
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('pageSize=10'),
            expect.anything()
        );
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('filter=name'),
            expect.anything()
        );
    });

    it('throws error on non-ok response', async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 403,
            text: async () => 'Forbidden',
        });

        await expect(fetchJules('/v1alpha/sessions', 'GET', null, 'key'))
            .rejects.toThrow('API Error (403): Forbidden');
    });

    it('throws error when API key is missing', async () => {
        await expect(fetchJules('/v1alpha/sessions', 'GET', null, ''))
            .rejects.toThrow('API Key is missing');
    });

    it('returns empty object for empty response body', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            text: async () => '',
        });

        const result = await fetchJules('/v1alpha/sessions', 'GET', null, 'key');
        expect(result).toEqual({});
    });
});

describe('UI Primitives', () => {
    it('renders Badge with correct children', () => {
        render(<Badge color="blue">Test Badge</Badge>);
        expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });

    it('renders StateBadge with correct status color', () => {
        const { container } = render(<StateBadge state="COMPLETED" />);
        expect(screen.getByText('Completed')).toBeInTheDocument();
        // Check for green-900/50 per Common.jsx
        expect(container.querySelector('.bg-green-900\\/50')).toBeInTheDocument();
    });

    it('renders StateBadge for new PAUSED state', () => {
        render(<StateBadge state="PAUSED" />);
        expect(screen.getByText('Paused')).toBeInTheDocument();
    });
});
