/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as constants from '../constants';
import * as sqlops from 'sqlops';
import ControllerBase from './controllerBase';
import * as vscode from 'vscode';
import { flatFileWizard } from '../wizard/flatFileWizard';
import { ServiceClient } from '../services/serviceClient';
import { SqlOpsDataClient } from 'dataprotocol-client';
import { managerInstance, ApiType } from '../services/serviceApiManager';
import { FlatFileProvider } from '../services/contracts';

/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
		console.log('Main controller deactivated');
	}

	public activate(): Promise<boolean> {
		const outputChannel = vscode.window.createOutputChannel(constants.serviceName);
		new ServiceClient(outputChannel).startService(this._context);

		managerInstance.onRegisteredApi<FlatFileProvider>(ApiType.FlatFileProvider)(provider => {
			this.initializeFlatFileProvider(provider);
		});

		return Promise.resolve(true);
	}

	private initializeFlatFileProvider(provider: FlatFileProvider) {
		sqlops.tasks.registerTask('flatFileImport.start', e => flatFileWizard(provider));

		sqlops.tasks.registerTask('flatFileImport.listDatabases', async () => {
			let activeConnections = await sqlops.connection.getActiveConnections();
			let selection = await vscode.window.showQuickPick(activeConnections.map(c => c.options.server));
			let chosenConnection = activeConnections.find(c => c.options.server === selection);
			let databases = await sqlops.connection.listDatabases(chosenConnection.connectionId);
			let databaseName = await vscode.window.showQuickPick(databases);
			let connectionUri = await sqlops.connection.getUriForConnection(chosenConnection.connectionId);
			let queryProvider = sqlops.dataprotocol.getProvider<sqlops.QueryProvider>(chosenConnection.providerName, sqlops.DataProviderType.QueryProvider);
			let query = `USE ${databaseName}; SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`;
			let results = await queryProvider.runQueryAndReturn(connectionUri, query);
			let tableNames = results.rows.map(row => row[0].displayValue);
			vscode.window.showQuickPick(tableNames);
		});

		sqlops.tasks.registerTask('flatFileImport.importFlatFile', () => {
			vscode.window.showInputBox({
				prompt: 'Flat file path?'
			}).then(filePath => {
				provider.sendPROSEDiscoveryRequest({ filePath: filePath }).then(response => {
					vscode.window.showInformationMessage('Metadata: ' + response.columnsInfo);
					vscode.window.showInformationMessage('Data: ' + response.dataPreview);
				});
			});
		});

		// sqlops.tasks.registerTask('flatFileImport.helloWorld', () => {
		// 	vscode.window.showInputBox({
		// 		prompt: 'What is your name?'
		// 	}).then(name => {
		// 		provider.sendHelloWorldRequest({ name: name }).then(response => {
		// 			vscode.window.showInformationMessage('Response: ' + response.response);
		// 		});
		// 	});
		// });
	}
}
