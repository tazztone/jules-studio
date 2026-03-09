import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock global browser APIs
Object.defineProperty(navigator, 'clipboard', {
    value: {
        writeText: vi.fn().mockResolvedValue(),
    },
    configurable: true
});

window.alert = vi.fn();
window.confirm = vi.fn(() => true);
global.alert = window.alert;
global.confirm = window.confirm;
