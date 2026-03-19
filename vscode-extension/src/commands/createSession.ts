import { ClientManager } from '../api/clientManager';
import { CreateSessionPanel } from '../views/createSessionPanel';
import { RepoDetector } from '../workspace/repoDetector';

export async function createSessionCommand(
    clientManager: ClientManager, 
    refresh: () => void, 
    repoDetector?: RepoDetector,
    initialContext?: string
) {
    CreateSessionPanel.createOrShow(clientManager, refresh, repoDetector, initialContext);
}
