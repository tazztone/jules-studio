import { AuthManager } from '../auth/keyManager';

export class GeminiClient {
    private readonly BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    constructor(private authManager: AuthManager) { }

    public async summarizeWork(diff: string | null, errors: string | null, activeFile: string | null): Promise<string | null> {
        if (!diff && !errors && !activeFile) return null;

        // Note: For now we'll assume the Jules key can access Gemini. If not, we might need a separate jules.geminiApiKey setting in the future.
        let apiKey = await this.authManager.getApiKey();
        if (!apiKey) return null;

        const prompt = `You are a developer assistant helping to "handoff" work to an autonomous agent.
Analyze the following workspace state and summarize what the user is currently working on in ONE CONCISE SENTENCE.
The summary will be used as a "mission brief" for the agent.

GIT DIFF SUMMARY:
${diff || 'No changes'}

ACTIVE ERRORS:
${errors || 'No errors'}

ACTIVE FILE:
${activeFile || 'None'}

RESPONSE FORMAT: Just the sentence. No preamble. No "Here is a summary".
EXAMPLE: "Refactoring the login logic in auth.ts to support JWT validation."`;

        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                maxOutputTokens: 100,
                temperature: 0.1
            }
        };

        try {
            const response = await fetch(`${this.BASE_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) return null;

            const data = await response.json() as any;
            const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            return summary ? summary.trim() : null;
        } catch (e) {
            return null;
        }
    }
}
