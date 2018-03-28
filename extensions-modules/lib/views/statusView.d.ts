import vscode = require('vscode');
export default class StatusView implements vscode.Disposable {
    private _statusBars;
    private _lastShownStatusBar;
    constructor();
    dispose(): void;
    private createStatusBar(fileUri);
    private destroyStatusBar(fileUri);
    private getStatusBar(fileUri);
    languageServiceStatusChanged(fileUri: string, status: string): void;
    updateStatusMessage(newStatus: string, getCurrentStatus: () => string, updateMessage: (message: string) => void): void;
    private hideLastShownStatusBar();
    private onDidChangeActiveTextEditor(editor);
    private onDidCloseTextDocument(doc);
    private showStatusBarItem(fileUri, statusBarItem);
}
