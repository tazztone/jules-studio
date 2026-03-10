import * as vscode from 'vscode';
import { JulesClient } from '../api/julesClient';

export class RepoDetector {
    constructor(private readonly client: JulesClient) {}

    async getMatchingSource(): Promise<string | undefined> {
        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
        if (!gitExtension) {
            return undefined;
        }

        const api = gitExtension.getAPI(1);
        const repo = api.repositories[0];
        if (!repo) {
            return undefined;
        }

        const remotes = repo.state.remotes;
        const origin = remotes.find((r: any) => r.name === 'origin') || remotes[0];
        if (!origin || !origin.fetchUrl) {
            return undefined;
        }

        const repoPath = this.parseRemoteUrl(origin.fetchUrl);
        if (!repoPath) {
            return undefined;
        }

        try {
            const { sources } = await this.client.listSources();
            const matched = sources.find(s => 
                s.githubRepo && 
                s.githubRepo.owner.toLowerCase() === repoPath.owner.toLowerCase() &&
                s.githubRepo.repo.toLowerCase() === repoPath.name.toLowerCase()
            );
            return matched?.name;
        } catch (err) {
            console.error('Error matching source:', err);
            return undefined;
        }
    }

    private parseRemoteUrl(url: string): { owner: string, name: string } | undefined {
        // Matches:
        // https://github.com/owner/repo.git
        // git@github.com:owner/repo.git
        const regex = /(?:github\.com[:/])([^/]+)\/([^.]+)(?:\.git)?$/;
        const match = url.match(regex);
        if (match) {
            return { owner: match[1], name: match[2] };
        }
        return undefined;
    }
}
