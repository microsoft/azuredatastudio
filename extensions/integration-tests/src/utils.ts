import assert = require('assert');
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { TestServerProfile, AuthenticationType } from './testConfig';

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

export async function connectToServer(server: TestServerProfile) {
	let connectionProfile: sqlops.IConnectionProfile = {
		serverName: server.ServerName,
		databaseName: server.Database,
		authenticationType: server.AuthenticationType === AuthenticationType.Windows ? 'Integrated' : 'SqlLogin',
		providerName: server.Provider,
		connectionName: '',
		userName: server.UserName,
		password: server.Password,
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