/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as data from 'sqlops';
import { ApiWrapper } from './apiWrapper';

/**
 * The main controller class that initializes the extension
 */
export class MainController  {
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

        this._apiWrapper.registerWebviewProvider('data-management-spark', webview => {
            webview.html = '<div>1</div>';
            // this.createTabForPort(webview, '30004');
        });
        this._apiWrapper.registerWebviewProvider('data-management-hadoop', webview => {
            webview.html = '<div>2</div>';
          //  this.createTabForPort(webview, '31000');
        });
        this._apiWrapper.registerWebviewProvider('data-management-hdfs', webview => {
            webview.html = '<div>3</div>';

          //  this.createTabForPort(webview, '30001');
        });
    }


    // private createTabForPort(webview: data.DashboardWebview, port: string): void {
    //     let self = this;

    //     // TODO need profile access to detect correct IP for connection
    //     // for now, assume active connection is correct
    //     // long term, should be able to query DMV for all endpoints and use those instead
    //     data.connection.getCurrentConnection()
    //         .then(connection => {
    //             if (connection.providerName === 'MSSQL' && connection.options['server']) {
    //                 // Strip TDS port number from the server URI
    //                 let serverName: string = connection.options['server'].split(',')[0];

    //                 // Put together the template variables and render the template
    //                 let templateValues = {
    //                     url: `http://${serverName}:${port}`,
    //                     timeNow: new Date().getTime()
    //                 };

    //                 return Utils.renderTemplateHtml(self._context.extensionPath, 'clusterWebTab.html', templateValues);
    //             } else {
    //                 let templateValues = {
    //                     message: LocalizedConstants.msgMissingSqlConnection
    //                 };
    //                 return Utils.renderTemplateHtml(self._context.extensionPath, 'emptyTab.html', templateValues);
    //             }
    //         })
    //         .then(html => { webview.html = html; });
    // }
}
