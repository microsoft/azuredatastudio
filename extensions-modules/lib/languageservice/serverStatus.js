/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const constants_1 = require("../models/constants");
/*
* The status class which includes the service initialization result.
*/
class ServerInitializationResult {
    constructor(installedBeforeInitializing = false, isRunning = false, serverPath = undefined) {
        this.installedBeforeInitializing = installedBeforeInitializing;
        this.isRunning = isRunning;
        this.serverPath = serverPath;
    }
    Clone() {
        return new ServerInitializationResult(this.installedBeforeInitializing, this.isRunning, this.serverPath);
    }
    WithRunning(isRunning) {
        return new ServerInitializationResult(this.installedBeforeInitializing, isRunning, this.serverPath);
    }
}
exports.ServerInitializationResult = ServerInitializationResult;
/*
* The status class shows service installing progress in UI
*/
class ServerStatusView {
    constructor(constants) {
        this._numberOfSecondsBeforeHidingMessage = 5000;
        this._statusBarItem = undefined;
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        vscode.window.onDidChangeActiveTextEditor((params) => this.onDidChangeActiveTextEditor(params));
        vscode.workspace.onDidCloseTextDocument((params) => this.onDidCloseTextDocument(params));
        this._constants = constants;
    }
    installingService() {
        this._statusBarItem.command = undefined;
        this._statusBarItem.show();
        this.showProgress('$(desktop-download) ' + constants_1.Constants.serviceInstalling);
    }
    updateServiceDownloadingProgress(downloadPercentage) {
        this._statusBarItem.text = '$(cloud-download) ' + `${constants_1.Constants.serviceDownloading} ... ${downloadPercentage}%`;
        this._statusBarItem.show();
    }
    serviceInstalled() {
        this._statusBarItem.command = undefined;
        this._statusBarItem.text = this._constants.serviceInstalled;
        this._statusBarItem.show();
        // Cleat the status bar after 2 seconds
        setTimeout(() => {
            this._statusBarItem.hide();
        }, this._numberOfSecondsBeforeHidingMessage);
    }
    serviceInstallationFailed() {
        this._statusBarItem.command = undefined;
        this._statusBarItem.text = this._constants.serviceInstallationFailed;
        this._statusBarItem.show();
    }
    showProgress(statusText) {
        let index = 0;
        let progressTicks = ['|', '/', '-', '\\'];
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
    dispose() {
        this.destroyStatusBar();
    }
    hideLastShownStatusBar() {
        if (typeof this._statusBarItem !== 'undefined') {
            this._statusBarItem.hide();
        }
    }
    onDidChangeActiveTextEditor(editor) {
        // Hide the most recently shown status bar
        this.hideLastShownStatusBar();
    }
    onDidCloseTextDocument(doc) {
        // Remove the status bar associated with the document
        this.destroyStatusBar();
    }
    destroyStatusBar() {
        if (typeof this._statusBarItem !== 'undefined') {
            this._statusBarItem.dispose();
        }
    }
}
exports.ServerStatusView = ServerStatusView;
//# sourceMappingURL=serverStatus.js.map