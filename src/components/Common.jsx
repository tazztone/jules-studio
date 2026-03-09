import { X, AlertCircle } from 'lucide-react';

export const Badge = ({ children, color = 'blue' }) => {
    const colors = {
        blue: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
        green: 'bg-green-900/50 text-green-300 border-green-700/50',
        yellow: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50',
        red: 'bg-red-900/50 text-red-300 border-red-700/50',
        gray: 'bg-gray-800 text-gray-300 border-gray-600',
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[color] || colors.gray}`}>
            {children}
        </span>
    );
};

export const StateBadge = ({ state }) => {
    const map = {
        'QUEUED': { color: 'gray', label: 'Queued' },
        'PLANNING': { color: 'blue', label: 'Planning' },
        'AWAITING_PLAN_APPROVAL': { color: 'yellow', label: 'Needs Approval' },
        'AWAITING_USER_FEEDBACK': { color: 'yellow', label: 'Waiting for You' },
        'IN_PROGRESS': { color: 'blue', label: 'In Progress' },
        'PAUSED': { color: 'gray', label: 'Paused' },
        'COMPLETED': { color: 'green', label: 'Completed' },
        'FAILED': { color: 'red', label: 'Failed' },
    };
    const stringState = String(state || 'Unknown');
    const config = map[stringState] || { color: 'gray', label: stringState };
    return <Badge color={config.color}>{String(config.label)}</Badge>;
};

export const Alert = ({ message, type = 'error', onClose }) => {
    if (!message) return null;
    const styles = {
        error: 'bg-red-900/20 border-red-900/50 text-red-400',
        warning: 'bg-yellow-900/20 border-yellow-900/50 text-yellow-400'
    };
    return (
        <div className={`p-4 rounded-lg border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${styles[type] || styles.error}`}>
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">{message}</div>
            {onClose && (
                <button onClick={onClose} className="hover:opacity-70 transition-opacity">
                    <X size={18} />
                </button>
            )}
        </div>
    );
};

export const ConfirmDialog = ({ open, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', variant = 'danger' }) => {
    if (!open) return null;
    const variantStyles = {
        danger: 'bg-red-600 hover:bg-red-700',
        primary: 'bg-blue-600 hover:bg-blue-700'
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-gray-400 text-sm mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
                    <button onClick={onConfirm} className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${variantStyles[variant] || variantStyles.primary}`}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const parseSessionId = (name) => name?.split('/').pop() || '';

export const parseRepoName = (source, sources = []) => {
    if (!source) return '';
    const found = sources.find(s => s.name === source);
    if (found?.githubRepo) {
        return `${found.githubRepo.owner}/${found.githubRepo.name}`;
    }
    return source.split('/').pop() || '';
};

export const BASE_URL = ''; // Now handled by Vite proxy

export const fetchJules = async (path, method = 'GET', body = null, apiKey, queryParams = null) => {
    if (!apiKey) throw new Error("API Key is missing");
    
    let url = path;
    if (queryParams) {
        const filteredParams = Object.fromEntries(Object.entries(queryParams).filter(([_, v]) => v != null && v !== ''));
        if (Object.keys(filteredParams).length > 0) {
            const searchParams = new URLSearchParams(filteredParams);
            url += `?${searchParams.toString()}`;
        }
    }

    const headers = {
        'x-goog-api-key': apiKey,
        ...(body && { 'Content-Type': 'application/json' })
    };
    
    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
        let errText = await response.text();
        try {
            const errJson = JSON.parse(errText);
            errText = errJson.error?.message || errText;
        } catch (e) {}
        throw new Error(`API Error (${response.status}): ${errText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
};
