import assert = require('assert');
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export async function waitForCompletion(thenable: Thenable<any>): Promise<any> {
	return new Promise((resolve, reject) => {
		thenable.then((val) => {
			resolve(val);
		}, (reason) => {
			reject(reason);
		});
	});
}

export async function connectToServer() {
	let connectionProfile: sqlops.IConnectionProfile = {
		serverName: 'sqltools2017-3',
		databaseName: 'master',
		authenticationType: 'Integrated',
		providerName: 'MSSQL',
		connectionName: '',
		userName: '',
		password: '',
		savePassword: false,
		groupFullName: undefined,
		saveProfile: true,
		id: undefined,
		groupId: undefined,
		options: {}
	};
	await ensureConnectionViewOpened();
	let result = <sqlops.ConnectionResult>await waitForCompletion(sqlops.connection.connect(connectionProfile));
	assert(result.connected, `Failed to connect to "${connectionProfile.serverName}", error code: ${result.errorCode}, error message: ${result.errorMessage}`);

	//workaround
	//wait for OE to load
	await new Promise(c => setTimeout(c, 3000));
}

export async function ensureConnectionViewOpened() {
	await waitForCompletion(vscode.commands.executeCommand('workbench.view.connections'));
}