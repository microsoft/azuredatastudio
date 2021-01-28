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
import * as constants from '../constants';

/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {
	private autoRefreshState: boolean = false;

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
		vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(link));
	}

	private async onExecute(connection: azdata.IConnectionProfile, fileName: string): Promise<void> {
		// Command to start/stop autorefresh and run the query
		let connectionUri = await azdata.connection.getUriForConnection(connection.id);
		let connectionProvider = azdata.dataprotocol.getProvider<azdata.ConnectionProvider>(connection.providerName, azdata.DataProviderType.ConnectionProvider);
		connectionProvider.changeDatabase(connectionUri, 'tempdb');
		let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(connection.providerName, azdata.DataProviderType.QueryProvider);
		let sqlContent: string = await promises.readFile(path.join(__dirname, '..', 'sql', fileName), { encoding: 'utf8' });
		let seResult = await queryProvider.runQueryAndReturn(connectionUri, sqlContent);
		if (seResult.rowCount > 0 && seResult.rows[0][0].displayValue === '0') {
			vscode.window.showInformationMessage((fileName === 'startEvent.sql') ? constants.XEventsStarted : constants.XEventsStopped);
			this.autoRefreshState = (fileName === 'startEvent.sql') ? true : false;
			vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'type-of-contention', connection.id, this.autoRefreshState);
			vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'metadata-contention', connection.id, this.autoRefreshState);
			vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'allocation-contention', connection.id, this.autoRefreshState);
		} else if (seResult.rowCount > 0 && seResult.rows[0][0].displayValue === '1') {
			vscode.window.showErrorMessage(constants.XEventsNotSupported);
		} else {
			vscode.window.showErrorMessage(constants.XEventsFailed);
		}
	}

	private stopAutoRefresh(connection: azdata.IConnectionProfile): void {
		this.autoRefreshState = !this.autoRefreshState === true;
		vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'type-of-contention', connection.id, this.autoRefreshState);
		vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'metadata-contention', connection.id, this.autoRefreshState);
		vscode.commands.executeCommand('azdata.widget.setAutoRefreshState', 'allocation-contention', connection.id, this.autoRefreshState);
	}
}
