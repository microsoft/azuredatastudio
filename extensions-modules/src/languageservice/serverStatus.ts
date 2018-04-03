/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IStatusView } from './interfaces';
import vscode = require('vscode');
import { IExtensionConstants } from '../models/contracts/contracts';
import { Constants } from '../models/constants';

/*
* The status class which includes the service initialization result.
*/
export class ServerInitializationResult {

    public constructor(
        public installedBeforeInitializing: Boolean = false,
        public isRunning: Boolean = false,
        public serverPath: string = undefined
    ) {

    }

    public Clone(): ServerInitializationResult  {
        return new ServerInitializationResult(this.installedBeforeInitializing, this.isRunning, this.serverPath);
    }

    public WithRunning(isRunning: Boolean): ServerInitializationResult  {
        return new ServerInitializationResult(this.installedBeforeInitializing, isRunning, this.serverPath);
    }
}

/*
* The status class shows service installing progress in UI
*/
export class ServerStatusView implements IStatusView, vscode.Disposable  {
    private _numberOfSecondsBeforeHidingMessage = 5000;
    private _statusBarItem: vscode.StatusBarItem = undefined;
    private _progressTimerId: NodeJS.Timer;
    private _constants: IExtensionConstants;

    constructor(constants: IExtensionConstants) {
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        vscode.window.onDidChangeActiveTextEditor((params) => this.onDidChangeActiveTextEditor(params));
        vscode.workspace.onDidCloseTextDocument((params) => this.onDidCloseTextDocument(params));
        this._constants = constants;
    }

    public installingService(): void {
        this._statusBarItem.command = undefined;
        this._statusBarItem.show();

        this.showProgress('$(desktop-download) ' + Constants.serviceInstalling);
    }

    public updateServiceDownloadingProgress(downloadPercentage: number): void {
        this._statusBarItem.text = '$(cloud-download) ' + `${Constants.serviceDownloading} ... ${downloadPercentage}%`;
        this._statusBarItem.show();
    }

    public serviceInstalled(): void {

        this._statusBarItem.command = undefined;
        this._statusBarItem.text = this._constants.serviceInstalled;
        this._statusBarItem.show();
        // Cleat the status bar after 2 seconds
        setTimeout(() => {
            this._statusBarItem.hide();
        }, this._numberOfSecondsBeforeHidingMessage);
    }

    public serviceInstallationFailed(): void {
        this._statusBarItem.command = undefined;
        this._statusBarItem.text = this._constants.serviceInstallationFailed;
        this._statusBarItem.show();
    }

    private showProgress(statusText: string): void {
        let index = 0;
        let progressTicks = [ '|', '/', '-', '\\'];


        this._progressTimerId = setInterval(() => {
            index++;
            if (index > 3) {
                index = 0;
            }

            let progressTick = progressTicks[index];
            if (this._statusBarItem.text !== this._constants.serviceInstalled) {
                this._statusBarItem.text = statusText + ' ' + progressTick;
                this._statusBarItem.show();
            }
        }, 200);
    }

    dispose(): void {
        this.destroyStatusBar();
    }

    private hideLastShownStatusBar(): void {
        if (typeof this._statusBarItem !== 'undefined') {
            this._statusBarItem.hide();
        }
    }

    private onDidChangeActiveTextEditor(editor: vscode.TextEditor): void {
        // Hide the most recently shown status bar
        this.hideLastShownStatusBar();
    }

    private onDidCloseTextDocument(doc: vscode.TextDocument): void {
        // Remove the status bar associated with the document
        this.destroyStatusBar();
    }

    private destroyStatusBar(): void {
        if (typeof this._statusBarItem !== 'undefined') {
            this._statusBarItem.dispose();
        }
    }
}

