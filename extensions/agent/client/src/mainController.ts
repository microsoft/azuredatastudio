/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { ApiWrapper } from './apiWrapper';
import { CreateJobDialog } from './dialogs/createJobDialog';

/**
 * The main controller class that initializes the extension
 */
export class MainController {
    protected _apiWrapper: ApiWrapper;
    protected _context: vscode.ExtensionContext;

    // PUBLIC METHODS //////////////////////////////////////////////////////
    public constructor(context: vscode.ExtensionContext, apiWrapper?: ApiWrapper) {
        this._apiWrapper = apiWrapper || new ApiWrapper();
        this._context = context;

        console.log('Got: ' + apiWrapper);
    }

    /**
     * Deactivates the extension
     */
    public deactivate(): void {
    }

    public activate(): void {

        this._apiWrapper.registerWebviewProvider('data-management-agent', webview => {
            webview.html = '<div><h1>SQL Agent</h1></div>';
        });
        vscode.commands.registerCommand('agent.openCreateJobDialog', (ownerUri: string) => {
            let dialog = new CreateJobDialog(ownerUri);
            dialog.showDialog();
        });
    }
}
