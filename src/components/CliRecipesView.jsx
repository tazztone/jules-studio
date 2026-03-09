import React from 'react';
import { Copy } from 'lucide-react';

const CliRecipesView = () => {
    const recipes = [
        {
            title: "Batch Issue Delegation",
            desc: "Read a local TODO.md and spin up a Jules session for each line automatically.",
            code: `cat TODO.md | while read -r task; do\n  jules remote new --repo . --session "$task" --require-approval\ndone`
        },
        {
            title: "Triage with Gemini & Jules",
            desc: "Use GitHub CLI and Gemini to pick the most urgent issue, then delegate it to Jules.",
            code: `ISSUE_TITLE=$(gh issue list --json title | jq -r '.[0].title')\njules remote new --repo . --session "Fix issue: $ISSUE_TITLE" --auto-create-pr`
        },
        {
            title: "Fetch Artifacts to IDE",
            desc: "Pull down the code patches from a completed session into your local working tree.",
            code: `jules remote pull --session "sessions/sess-103" --apply-patch`
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-semibold text-white mb-2">CLI Recipe Builder</h2>
                <p className="text-gray-400 text-sm">Automate Jules locally using the <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">jules</code> CLI combined with standard Unix tools.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {recipes.map((r, i) => (
                    <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-gray-500 transition-colors">
                        <h3 className="text-lg font-medium text-white mb-2">{r.title}</h3>
                        <p className="text-sm text-gray-400 mb-4 h-10">{r.desc}</p>
                        <div className="relative">
                            <pre className="bg-gray-950 p-4 rounded-lg text-sm font-mono text-green-400 overflow-x-auto border border-gray-800">{r.code}</pre>
                            <button
                                onClick={() => navigator.clipboard.writeText(r.code)}
                                className="absolute top-2 right-2 p-1.5 bg-gray-800 text-gray-400 hover:text-white rounded border border-gray-700 transition-colors"
                                title="Copy to clipboard"
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CliRecipesView;
