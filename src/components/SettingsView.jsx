import React from 'react';
import { AlertCircle } from 'lucide-react';

const SettingsView = ({ apiKey, setApiKey }) => (
    <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-2xl font-semibold text-white mb-6">Settings & Authentication</h2>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Jules API Key (<code className="text-xs">x-goog-api-key</code>)</label>
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                        const val = e.target.value;
                        setApiKey(val);
                        localStorage.setItem('jules_api_key', val);
                    }}
                    placeholder="AIzaSy..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none font-mono"
                />
                <p className="text-xs text-gray-500 mt-2">Required for actual API calls. If left empty, the app falls back to Demo Mode using mock data.</p>
            </div>
            {!apiKey && (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 flex gap-3">
                    <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={18} />
                    <div>
                        <h4 className="text-blue-300 text-sm font-medium mb-1">Demo Mode Active</h4>
                        <p className="text-xs text-blue-400/80 leading-relaxed">
                            Because no API key is provided, you are currently viewing mock data. Enter your key above to trigger actual live calls to the Jules API endpoints.
                        </p>
                    </div>
                </div>
            )}
        </div>
    </div>
);

export default SettingsView;
