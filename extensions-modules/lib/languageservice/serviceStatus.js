/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
class ServiceStatus {
    constructor(_serviceName) {
        this._serviceName = _serviceName;
        this._statusBarItem = undefined;
        this.durationStatusInMs = 1500;
        // These need localization
        this._serviceStartingMessage = `Starting ${this._serviceName}`;
        this._serviceStartedMessage = `${this._serviceName} started`;
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }
    showServiceLoading() {
        return this === undefined ?
            Promise.resolve() :
            Promise.resolve(this.updateStatusView(this._serviceStartingMessage, true));
    }
    showServiceLoaded() {
        return this === undefined ?
            Promise.resolve() :
            Promise.resolve(this.updateStatusView(this._serviceStartedMessage, false, this.durationStatusInMs));
    }
    //TODO: This can be merged with the serverStatus code
    showProgress(statusText) {
        let index = 0;
        let progressTicks = ['.', '..', '...', '....'];
        this._progressTimerId = setInterval(() => {
            index = (index + 1) % progressTicks.length;
            let progressTick = progressTicks[index];
            if (this._statusBarItem.text !== this._serviceStartedMessage) {
                this._statusBarItem.text = statusText + ' ' + progressTick;
                this._statusBarItem.show();
            }
        }, 400);
    }
    updateStatusView(message, showAsProgress = false, disposeAfter = -1) {
        return new Promise((resolve, reject) => {
            if (showAsProgress) {
                this.showProgress(message);
            }
            else {
                this._statusBarItem.text = message;
                this._statusBarItem.show();
                if (this._progressTimerId !== undefined) {
                    clearInterval(this._progressTimerId);
                }
            }
            if (disposeAfter !== -1) {
                setInterval(() => {
                    this._statusBarItem.hide();
                }, disposeAfter);
            }
            resolve();
        });
    }
    dispose() {
        if (this._progressTimerId !== undefined) {
            clearInterval(this._progressTimerId);
        }
        this._statusBarItem.dispose();
    }
}
exports.default = ServiceStatus;
//# sourceMappingURL=serviceStatus.js.map