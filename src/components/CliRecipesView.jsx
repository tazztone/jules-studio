import React from 'react';
import { Copy, Loader2, AlertTriangle, Download } from 'lucide-react';

const CliRecipesView = () => {
    const recipes = [
        {
            title: "Data Backup & Sunset Archival",
            desc: "Export all Jules sessions and full activity JSON logs via REST API before the cutoff.",
            code: `export JULES_API_KEY="your-api-key"\n\n# 1. Fetch sessions list\ncurl -s -H "X-Goog-Api-Key: $JULES_API_KEY" \\\n  "https://jules.googleapis.com/v1alpha/sessions?pageSize=100" > sessions.json\n\n# 2. Iterate and save detail + activities\njq -r '.sessions[].name' sessions.json | while read -r sess; do\n  ID=$(basename "$sess")\n  curl -s -H "X-Goog-Api-Key: $JULES_API_KEY" \\\n    "https://jules.googleapis.com/v1alpha/$sess" > "session_\${ID}.json"\n  curl -s -H "X-Goog-Api-Key: $JULES_API_KEY" \\\n    "https://jules.googleapis.com/v1alpha/$sess/activities?pageSize=100" > "activities_\${ID}.json"\ndone`
        },
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
            {/* Deprecation Warning Banner */}
            <div className="p-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-100">
                <div className="flex items-start gap-4">
                    <AlertTriangle className="text-amber-400 mt-1 shrink-0" size={24} />
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold text-white">Jules Deprecation & Sunset Timeline</h3>
                        <p className="text-sm text-amber-200/90 leading-relaxed">
                            Google Jules is winding down on <strong>December 31, 2026</strong>. From <strong>November 11, 2026</strong>, Jules is read-only.
                            Agentic coding development is moving to <strong>Google Antigravity</strong>. Export all data and suggested tasks before the shutdown.
                        </p>
                    </div>
                </div>
            </div>

            <div>
                <h2 className="text-3xl font-bold text-white mb-3">CLI & Integrations</h2>
                <p className="text-gray-400 text-lg">Tools, automation recipes, and archival scripts to manage and export Jules data prior to sunset.</p>
            </div>

            {/* Archival Guidance Card */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Download className="text-blue-400" size={22} />
                    <h3 className="text-xl font-semibold text-white">Sunset Data Extraction Guide</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                    <div className="p-4 bg-gray-950/60 rounded-xl border border-gray-800/80">
                        <span className="font-semibold text-amber-300 block mb-1">Open Suggestions</span>
                        <p className="text-gray-400 text-xs leading-relaxed">
                            No API endpoint exists for open suggested tasks. Manually copy prompt/rationale or start suggestions as sessions before November 11 to generate exportable plans.
                        </p>
                    </div>
                    <div className="p-4 bg-gray-950/60 rounded-xl border border-gray-800/80">
                        <span className="font-semibold text-blue-300 block mb-1">REST API Bulk Export</span>
                        <p className="text-gray-400 text-xs leading-relaxed">
                            Use the official REST API (<code className="text-gray-300">/v1alpha/sessions</code> and <code className="text-gray-300">/v1alpha/sessions/&#123;id&#125;/activities</code>) to backup full session transcripts and patch diffs.
                        </p>
                    </div>
                </div>
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
