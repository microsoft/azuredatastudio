import vscode = require('vscode');
export default class ServiceStatus implements vscode.Disposable {
    private _serviceName;
    private _progressTimerId;
    private _statusBarItem;
    private durationStatusInMs;
    private _serviceStartingMessage;
    private _serviceStartedMessage;
    constructor(_serviceName: string);
    showServiceLoading(): Promise<void>;
    showServiceLoaded(): Promise<void>;
    private showProgress(statusText);
    private updateStatusView(message, showAsProgress?, disposeAfter?);
    dispose(): void;
}
