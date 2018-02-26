"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const vscode = require("vscode");
const utils_1 = require("../models/utils");
// Status bar element for each file in the editor
class FileStatusBar {
}
class StatusView {
    constructor() {
        this._statusBars = {};
        vscode.window.onDidChangeActiveTextEditor((params) => this.onDidChangeActiveTextEditor(params));
        vscode.workspace.onDidCloseTextDocument((params) => this.onDidCloseTextDocument(params));
    }
    dispose() {
        for (let bar in this._statusBars) {
            if (this._statusBars.hasOwnProperty(bar)) {
                this._statusBars[bar].statusConnection.dispose();
                this._statusBars[bar].statusQuery.dispose();
                this._statusBars[bar].statusLanguageService.dispose();
                clearInterval(this._statusBars[bar].progressTimerId);
                delete this._statusBars[bar];
            }
        }
    }
    // Create status bar item if needed
    createStatusBar(fileUri) {
        let bar = new FileStatusBar();
        bar.statusConnection = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        bar.statusQuery = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        bar.statusLanguageService = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        this._statusBars[fileUri] = bar;
    }
    destroyStatusBar(fileUri) {
        let bar = this._statusBars[fileUri];
        if (bar) {
            if (bar.statusConnection) {
                bar.statusConnection.dispose();
            }
            if (bar.statusQuery) {
                bar.statusQuery.dispose();
            }
            if (bar.statusLanguageService) {
                bar.statusLanguageService.dispose();
            }
            if (bar.progressTimerId) {
                clearInterval(bar.progressTimerId);
            }
            delete this._statusBars[fileUri];
        }
    }
    getStatusBar(fileUri) {
        if (!(fileUri in this._statusBars)) {
            // Create it if it does not exist
            this.createStatusBar(fileUri);
        }
        let bar = this._statusBars[fileUri];
        if (bar.progressTimerId) {
            clearInterval(bar.progressTimerId);
        }
        return bar;
    }
    languageServiceStatusChanged(fileUri, status) {
        let bar = this.getStatusBar(fileUri);
        bar.currentLanguageServiceStatus = status;
        this.updateStatusMessage(status, () => { return bar.currentLanguageServiceStatus; }, (message) => {
            bar.statusLanguageService.text = message;
            this.showStatusBarItem(fileUri, bar.statusLanguageService);
        });
    }
    updateStatusMessage(newStatus, getCurrentStatus, updateMessage) {
    }
    hideLastShownStatusBar() {
        if (typeof this._lastShownStatusBar !== 'undefined') {
            this._lastShownStatusBar.statusConnection.hide();
            this._lastShownStatusBar.statusQuery.hide();
            this._lastShownStatusBar.statusLanguageService.hide();
        }
    }
    onDidChangeActiveTextEditor(editor) {
        // Hide the most recently shown status bar
        this.hideLastShownStatusBar();
        // Change the status bar to match the open file
        if (typeof editor !== 'undefined') {
            const fileUri = editor.document.uri.toString();
            const bar = this._statusBars[fileUri];
            if (bar) {
                this.showStatusBarItem(fileUri, bar.statusConnection);
                this.showStatusBarItem(fileUri, bar.statusLanguageService);
            }
        }
    }
    onDidCloseTextDocument(doc) {
        // Remove the status bar associated with the document
        this.destroyStatusBar(doc.uri.toString());
    }
    showStatusBarItem(fileUri, statusBarItem) {
        let currentOpenFile = utils_1.Utils.getActiveTextEditorUri();
        // Only show the status bar if it matches the currently open file and is not empty
        if (fileUri === currentOpenFile && !utils_1.Utils.isEmpty(statusBarItem.text)) {
            statusBarItem.show();
            if (fileUri in this._statusBars) {
                this._lastShownStatusBar = this._statusBars[fileUri];
            }
        }
        else {
            statusBarItem.hide();
        }
    }
}
exports.default = StatusView;
//# sourceMappingURL=statusView.js.map