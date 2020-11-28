/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as Utils from '../utils';
import ControllerBase from './controllerBase';
import { promises } from 'fs';
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
		azdata.tasks.registerTask('tempdb.startEvent', e => this.onExecute(e, 'startEvent.sql'));
		azdata.tasks.registerTask('tempdb.stopEvent', e => this.onExecute(e, 'stopEvent.sql'));
		azdata.tasks.registerTask('tempdb.contention', () => this.openurl('https://aka.ms/tempdbblog'));
		azdata.tasks.registerTask('tempdb.pauseEvent', e => this.stopAutoRefresh(e));

		return Promise.resolve(true);
	}

	private openurl(link: string): void {
		openurl.open(link);
	}

	private async onExecute(connection: azdata.IConnectionProfile, fileName: string): Promise<void> {
		// Command to start/stop autorefresh and run the query
		let connectionUri = await azdata.connection.getUriForConnection(connection.id);
		let connectionProvider = azdata.dataprotocol.getProvider<azdata.ConnectionProvider>(connection.providerName, azdata.DataProviderType.ConnectionProvider);
		connectionProvider.changeDatabase(connectionUri, 'tempdb');
		let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(connection.providerName, azdata.DataProviderType.QueryProvider);
		let sqlContent: string = await promises.readFile(path.join(__dirname, '..', 'sql', fileName), {encoding: 'utf8'});
		let seResult = await queryProvider.runQueryAndReturn(connectionUri, sqlContent);
		if (seResult.rowCount > 0 && seResult.rows[0][0].displayValue === '0') {
			vscode.window.showInformationMessage(seResult.rows[0][1].displayValue);
			let setRefreshState = ( fileName === 'startEvent.sql' ) ? true : false;
			vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'type-of-contention', connection.id, setRefreshState);
			vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'metadata-contention', connection.id, setRefreshState);
			vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'allocation-contention', connection.id, setRefreshState);
		} else if (seResult.rowCount > 0 && seResult.rows[0][0].displayValue === '1') {
			vscode.window.showErrorMessage(seResult.rows[0][1].displayValue);
		} else {
			vscode.window.showErrorMessage('Something has gone wrong, better error msg here.');
		}
	}

	private stopAutoRefresh(connection: azdata.IConnectionProfile): void {
		vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'type-of-contention', connection.id, false);
		vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'metadata-contention', connection.id, false);
		vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'allocation-contention', connection.id, false);
	}
}
