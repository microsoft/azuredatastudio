/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as Utils from '../utils';
import ControllerBase from './controllerBase';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
<<<<<<< Updated upstream
=======
import * as openurl from 'openurl';
>>>>>>> Stashed changes


/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {

    public apiWrapper;
    // PUBLIC METHODS //////////////////////////////////////////////////////
    /**
     * Deactivates the extension
     */
    public deactivate(): void {
        Utils.logDebug('Main controller deactivated');
    }

    public activate(): Promise<boolean> {
        sqlops.dashboard.registerWebviewProvider('sp_whoisactive_documentation', webview => {
            let templateValues = {url: 'http://whoisactive.com/docs/'};
            Utils.renderTemplateHtml(path.join(__dirname, '..'), 'templateTab.html', templateValues)
            .then(html => {
                webview.html = html;
            });
        });

<<<<<<< Updated upstream
        sqlops.tasks.registerTask('sp_whoisactive.create', e => this.onCreated(e));
        sqlops.tasks.registerTask('sp_whoisactive.findBlockLeaders', e => this.onExecute(e));
=======
        sqlops.tasks.registerTask('sp_whoisactive.install', e => this.onInstall(e));
        sqlops.tasks.registerTask('sp_whoisactive.findBlockLeaders', e => this.onExecute(e, 'findBlockLeaders.sql'));
        sqlops.tasks.registerTask('sp_whoisactive.getPlans', e => this.onExecute(e, 'getPlans.sql'));
>>>>>>> Stashed changes

        return Promise.resolve(true);
    }

<<<<<<< Updated upstream
    private onCreated(connection: sqlops.IConnectionProfile): void {
        let sqlFile = fs.readFileSync(path.join(__dirname, '..', 'sql', 'who_is_active_v11_30.sql')).toString();
        this.openSQLFileWithContent(sqlFile);
    }

    private onExecute(connection: sqlops.IConnectionProfile): void {
        let sqlFile = fs.readFileSync(path.join(__dirname, '..', 'sql', 'findBlockLeaders.sql')).toString();
=======
    private onInstall(connection: sqlops.IConnectionProfile): void {
        openurl.open('http://whoisactive.com/downloads/');
    }

    private onExecute(connection: sqlops.IConnectionProfile, fileName: string): void {
        let sqlFile = fs.readFileSync(path.join(__dirname, '..', 'sql', fileName)).toString();
>>>>>>> Stashed changes
        this.openSQLFileWithContent(sqlFile);
    }

    private openSQLFileWithContent(content: string): void {
        vscode.workspace.openTextDocument({language: 'sql', content: content}).then(doc => {
            vscode.window.showTextDocument(doc, vscode.ViewColumn.Active, false);
        });
    }

}

