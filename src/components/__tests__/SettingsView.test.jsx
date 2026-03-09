import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsView from '../SettingsView';

describe('SettingsView Component', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('renders with existing API key and correctly updates', () => {
        const setApiKey = vi.fn();
        render(<SettingsView apiKey="initial-key" setApiKey={setApiKey} />);
        
        const input = screen.getByPlaceholderText('AIzaSy...');
        expect(input.value).toBe('initial-key');
        
        fireEvent.change(input, { target: { value: 'new-key' } });
        expect(setApiKey).toHaveBeenCalledWith('new-key');
        expect(localStorage.getItem('jules_api_key')).toBe('new-key');
    });

    it('shows Demo Mode warning when API key is empty', () => {
        render(<SettingsView apiKey="" setApiKey={() => {}} />);
        
        expect(screen.getByText('Demo Mode Active')).toBeInTheDocument();
        expect(screen.getByText(/viewing mock data/i)).toBeInTheDocument();
    });

    it('hides Demo Mode warning when API key is present', () => {
        render(<SettingsView apiKey="key-123" setApiKey={() => {}} />);
        
        expect(screen.queryByText('Demo Mode Active')).not.toBeInTheDocument();
    });
});
