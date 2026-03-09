import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CliRecipesView from '../CliRecipesView';

describe('CliRecipesView Component', () => {
    it('renders the core sections', () => {
        render(<CliRecipesView />);
        
        expect(screen.getByText('CLI & Integrations')).toBeInTheDocument();
        expect(screen.getByText('Install Globally')).toBeInTheDocument();
        expect(screen.getByText('Authenticate')).toBeInTheDocument();
        expect(screen.getByText(/npm install -g @google\/jules/i)).toBeInTheDocument();
        expect(screen.getByText(/jules login/i)).toBeInTheDocument();
    });

    it('contains recipe code snippets', () => {
        render(<CliRecipesView />);
        
        // Check for common CLI snippets
        expect(screen.getAllByText(/jules remote new/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/gh issue list/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/gemini -p/i).length).toBeGreaterThan(0);
    });

    it('copies install command to clipboard', () => {
        render(<CliRecipesView />);
        
        const copyBtns = screen.getAllByRole('button');
        const installCopyBtn = copyBtns[0]; // First button is install
        
        fireEvent.click(installCopyBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('npm install -g @google/jules');
    });
});
