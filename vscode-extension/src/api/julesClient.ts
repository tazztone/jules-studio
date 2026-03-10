import { 
    Session, ListSessionsResponse, 
    ListActivitiesResponse, 
    ListSourcesResponse,
    AutomationMode
} from './types';

export class JulesClient {
    private readonly baseUrl = 'https://jules.googleapis.com/v1alpha';

    constructor(private readonly apiKey: string) {}

    private async fetch<T>(path: string, options: RequestInit = {}, queryParams: Record<string, string | number | undefined> = {}): Promise<T> {
        const url = new URL(`${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`);
        
        Object.entries(queryParams).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
                url.searchParams.append(key, String(value));
            }
        });

        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string> || {})
        };
        headers['x-goog-api-key'] = this.apiKey;
        if (options.body) {
            headers['Content-Type'] = 'application/json';
        }

        const executeRequest = async (attempt: number = 0): Promise<T> => {
            const response = await fetch(url.toString(), { ...options, headers });

            if (response.status === 429 && attempt < 5) {
                const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return executeRequest(attempt + 1);
            }

            if (!response.ok) {
                let errText = await response.text();
                try {
                    const errJson = JSON.parse(errText);
                    errText = errJson.error?.message || errText;
                } catch (e) {}
                throw new Error(`Jules API Error (${response.status}): ${errText}`);
            }

            const text = await response.text();
            return text ? JSON.parse(text) : ({} as T);
        };

        return executeRequest();
    }

    async listSessions(pageSize?: number, pageToken?: string, filter?: string): Promise<ListSessionsResponse> {
        return this.fetch<ListSessionsResponse>('sessions', {}, { pageSize, pageToken, filter });
    }

    async getSession(sessionId: string): Promise<Session> {
        return this.fetch<Session>(`sessions/${sessionId}`);
    }


    async createSession(prompt: string, sourceContext?: any, title?: string, requirePlanApproval: boolean = false, automationMode?: AutomationMode): Promise<Session> {
        return this.fetch<Session>('sessions', {
            method: 'POST',
            body: JSON.stringify({
                prompt,
                sourceContext,
                title,
                requirePlanApproval,
                automationMode
            })
        });
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.fetch<void>(`sessions/${sessionId}`, { method: 'DELETE' });
    }

    async sendMessage(sessionId: string, message: string): Promise<any> {
        return this.fetch<any>(`sessions/${sessionId}:sendMessage`, {
            method: 'POST',
            body: JSON.stringify({ userMessage: message })
        });
    }

    async approvePlan(sessionId: string): Promise<any> {
        return this.fetch<any>(`sessions/${sessionId}:approvePlan`, { method: 'POST' });
    }

    async listActivities(sessionId: string, pageSize?: number, pageToken?: string): Promise<ListActivitiesResponse> {
        return this.fetch<ListActivitiesResponse>(`sessions/${sessionId}/activities`, {}, { pageSize, pageToken });
    }

    async listSources(pageSize?: number, pageToken?: string, filter?: string): Promise<ListSourcesResponse> {
        return this.fetch<ListSourcesResponse>('sources', {}, { pageSize, pageToken, filter });
    }
}
