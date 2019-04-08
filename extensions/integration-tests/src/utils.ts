/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('assert');
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { TestServerProfile } from './testConfig';

export async function connectToServer(server: TestServerProfile, timeout: number = 3000) {
	let connectionProfile: azdata.IConnectionProfile = {
		serverName: server.serverName,
		databaseName: server.database,
		authenticationType: server.authenticationTypeName,
		providerName: server.providerName,
		connectionName: '',
		userName: server.userName,
		password: server.password,
		savePassword: false,
		groupFullName: undefined,
		saveProfile: true,
		id: undefined,
		groupId: undefined,
		options: {}
	};
	await ensureConnectionViewOpened();
	let result = <azdata.ConnectionResult>await azdata.connection.connect(connectionProfile);
	assert(result.connected, `Failed to connect to "${connectionProfile.serverName}", error code: ${result.errorCode}, error message: ${result.errorMessage}`);

	//workaround
	//wait for OE to load
	await new Promise(c => setTimeout(c, timeout));
}

export async function ensureConnectionViewOpened() {
	await vscode.commands.executeCommand('dataExplorer.servers.focus');
}

export function getConfigValue(name: string): string {
	return process.env[name];
}

export const EnvironmentVariable_BDC_SERVER: string = 'BDC_BACKEND_HOSTNAME';
export const EnvironmentVariable_BDC_USERNAME: string = 'BDC_BACKEND_USERNAME';
export const EnvironmentVariable_BDC_PASSWORD: string = 'BDC_BACKEND_PWD';
export const EnvironmentVariable_STANDALONE_SERVER: string = 'STANDALONE_SQL';
export const EnvironmentVariable_STANDALONE_USERNAME: string = 'STANDALONE_SQL_USERNAME';
export const EnvironmentVariable_STANDALONE_PASSWORD: string = 'STANDALONE_SQL_PWD';
export const EnvironmentVariable_AZURE_SERVER: string = 'AZURE_SQL';
export const EnvironmentVariable_AZURE_USERNAME: string = 'AZURE_SQL_USERNAME';
export const EnvironmentVariable_AZURE_PASSWORD: string = 'AZURE_SQL_PWD';
export const EnvironmentVariable_PYTHON_PATH: string = 'PYTHON_TEST_PATH';
