import React from 'react';
import { Copy, Loader2 } from 'lucide-react';

const CliRecipesView = () => {
    const recipes = [
        {
            title: "Batch Issue Delegation",
            desc: "Read a local TODO.md and spin up a Jules session for each line automatically.",
            code: `cat TODO.md | while read -r task; do\n  jules remote new --repo . --session "$task"\ndone`
        },
        {
            title: "Triage with GitHub CLI",
            desc: "Pipe the title of your first GitHub issue directly into a new Jules session.",
            code: `gh issue list --assignee @me --limit 1 --json title \\ \n  | jq -r '.[0].title' \\ \n  | jules remote new --repo .`
        },
        {
            title: "Gemini-Powered Triage",
            desc: "Use Gemini to find the most tedious issue and delegate it to Jules.",
            code: `gemini -p "find the most tedious issue, print it verbatim\\n$(gh issue list --assignee @me)" \\ \n  | jules remote new --repo .`
        }
    ];

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto pb-12">
            <div>
                <h2 className="text-3xl font-bold text-white mb-3">CLI & Integrations</h2>
                <p className="text-gray-400 text-lg">Bridge your cloud sessions with your local development environment using the <code className="bg-gray-800 px-2 py-0.5 rounded text-blue-300 font-mono">jules</code> CLI.</p>
            </div>

            {/* Setup Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Loader2 size={80} className="text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <span className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-xs">1</span>
                        Install Globally
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">Get the latest version of Jules Tools from the npm registry.</p>
                    <div className="relative">
                        <pre className="bg-gray-950 p-4 rounded-xl text-sm font-mono text-blue-300 border border-gray-800">npm install -g @google/jules</pre>
                        <button onClick={() => navigator.clipboard.writeText('npm install -g @google/jules')} className="absolute top-2 right-2 p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                            <Copy size={16} />
                        </button>
                    </div>
                </div>

                <div className="bg-purple-600/10 border border-purple-500/20 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Loader2 size={80} className="text-purple-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <span className="w-7 h-7 bg-purple-500 rounded-full flex items-center justify-center text-xs">2</span>
                        Authenticate
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">Connect your local machine to your Jules account via Google OAuth.</p>
                    <div className="relative">
                        <pre className="bg-gray-950 p-4 rounded-xl text-sm font-mono text-purple-300 border border-gray-800">jules login</pre>
                        <button onClick={() => navigator.clipboard.writeText('jules login')} className="absolute top-2 right-2 p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                            <Copy size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* TUI Callout */}
            <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2">The Interactive Dashboard (TUI)</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">Launch a full-screen Terminal User Interface to manage sessions, review diffs, and approve changes without leaving your console.</p>
                    <code className="bg-black/50 px-3 py-1.5 rounded-lg text-green-400 font-mono text-sm border border-gray-800">jules</code>
                </div>
                <div className="w-full md:w-64 aspect-video bg-gray-950 rounded-lg border border-gray-800 flex items-center justify-center p-4">
                    <div className="text-center font-mono text-[10px] text-gray-600">
                        [ Jules TUI Dashboard ]<br/>
                        {">"} sessions/list<br/>
                        {">"} session/abc123 [PENDING]<br/>
                        [A] Approve [R] Reject
                    </div>
                </div>
            </div>

            {/* Recipes Section */}
            <div>
                <h3 className="text-xl font-semibold text-white mb-6">Automation Recipes</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {recipes.map((r, i) => (
                        <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-2xl p-6 hover:border-gray-500 transition-all group">
                            <h3 className="text-lg font-medium text-white mb-2">{r.title}</h3>
                            <p className="text-sm text-gray-400 mb-6 leading-relaxed">{r.desc}</p>
                            <div className="relative">
                                <pre className="bg-gray-950 p-4 rounded-xl text-xs font-mono text-green-400/90 overflow-x-auto border border-gray-800/50">{r.code}</pre>
                                <button
                                    onClick={() => navigator.clipboard.writeText(r.code)}
                                    className="absolute top-2 right-2 p-2 bg-gray-900/80 text-gray-500 hover:text-white rounded-lg border border-gray-800 transition-colors"
                                    title="Copy to clipboard"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CliRecipesView;
