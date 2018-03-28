import { IStatusView } from './interfaces';
import vscode = require('vscode');
import { IExtensionConstants } from '../models/contracts/contracts';
export declare class ServerInitializationResult {
    installedBeforeInitializing: Boolean;
    isRunning: Boolean;
    serverPath: string;
    constructor(installedBeforeInitializing?: Boolean, isRunning?: Boolean, serverPath?: string);
    Clone(): ServerInitializationResult;
    WithRunning(isRunning: Boolean): ServerInitializationResult;
}
export declare class ServerStatusView implements IStatusView, vscode.Disposable {
    private _numberOfSecondsBeforeHidingMessage;
    private _statusBarItem;
    private _progressTimerId;
    private _constants;
    constructor(constants: IExtensionConstants);
    installingService(): void;
    updateServiceDownloadingProgress(downloadPercentage: number): void;
    serviceInstalled(): void;
    serviceInstallationFailed(): void;
    private showProgress(statusText);
    dispose(): void;
    private hideLastShownStatusBar();
    private onDidChangeActiveTextEditor(editor);
    private onDidCloseTextDocument(doc);
    private destroyStatusBar();
}
