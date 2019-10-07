/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as Utils from '../utils';
import ControllerBase from './controllerBase';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as openurl from 'openurl';


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
		azdata.tasks.registerTask("tempdb.startEvent", e => this.onExecute(e, 'startEvent.sql'));
		azdata.tasks.registerTask("tempdb.stopEvent", e => this.onExecute(e, 'stopEvent.sql'));
		azdata.tasks.registerTask("tempdb.contention", () => this.openurl('https://aka.ms/tempdbblog'));
		azdata.tasks.registerTask("tempdb.pauseEvent", e => this.stopAutoRefresh(e));

		return Promise.resolve(true);
	}

	private openurl(link: string): void {
		openurl.open(link);
	}

	private onExecute(connection: azdata.IConnectionProfile, fileName: string): void {
		//Command to start/stop autorefresh and run the query
		vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'type-of-contention', connection.id, true);
		vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'metadata-contention', connection.id, true);
		vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'allocation-contention', connection.id, true);
		let sqlContent = fs.readFileSync(path.join(__dirname, '..', 'sql', fileName)).toString();
		vscode.workspace.openTextDocument({ language: 'sql', content: sqlContent }).then(doc => {
			vscode.window.showTextDocument(doc, vscode.ViewColumn.Active, false).then(() => {
				let filePath = doc.uri.toString();
				azdata.queryeditor.connect(filePath, connection.id).then(() => azdata.queryeditor.runQuery(filePath, undefined, false));
			});
		});
	}

	private stopAutoRefresh(connection: azdata.IConnectionProfile) {
		vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'type-of-contention', connection.id, false);
		vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'metadata-contention', connection.id, false);
		vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'allocation-contention', connection.id, false);
	}
}
