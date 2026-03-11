import { ClientManager } from '../api/clientManager';
import { CreateSessionPanel } from '../views/createSessionPanel';

export async function createSessionCommand(clientManager: ClientManager, refresh: () => void, initialContext?: string) {
    CreateSessionPanel.createOrShow(clientManager, refresh, initialContext);
}
