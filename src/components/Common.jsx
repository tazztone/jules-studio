import React from 'react';

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
        const errText = await response.text();
        throw new Error(`API Error (${response.status}): ${errText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
};
