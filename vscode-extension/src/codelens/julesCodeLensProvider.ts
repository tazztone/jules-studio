import * as vscode from 'vscode';

export class JulesCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    constructor() {
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        if (!vscode.workspace.getConfiguration('jules').get('codeLens.enabled', true)) {
            return [];
        }

        // Use DocumentSymbolProvider to find functions/classes
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            document.uri
        );

        if (!symbols) {
            return [];
        }

        const lenses: vscode.CodeLens[] = [];
        this.parseSymbols(document, symbols, lenses);
        
        // Limit for performance
        return lenses.slice(0, 50);
    }

    private parseSymbols(document: vscode.TextDocument, symbols: vscode.DocumentSymbol[], lenses: vscode.CodeLens[]) {
        for (const symbol of symbols) {
            if (
                symbol.kind === vscode.SymbolKind.Function ||
                symbol.kind === vscode.SymbolKind.Method ||
                symbol.kind === vscode.SymbolKind.Class
            ) {
                const range = new vscode.Range(symbol.range.start, symbol.range.start);
                
                lenses.push(new vscode.CodeLens(range, {
                    title: '🐙 Jules: Write Tests',
                    command: 'jules.codeLensAction',
                    arguments: [document.uri, symbol, 'test']
                }));

                lenses.push(new vscode.CodeLens(range, {
                    title: '🐙 Jules: Refactor',
                    command: 'jules.codeLensAction',
                    arguments: [document.uri, symbol, 'refactor']
                }));
            }

            if (symbol.children && symbol.children.length > 0) {
                this.parseSymbols(document, symbol.children, lenses);
            }
        }
    }
}
