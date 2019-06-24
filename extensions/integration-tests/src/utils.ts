/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('assert');
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { TestServerProfile } from './testConfig';

/**
 * @param server test connection profile
 * @param timeout optional timeout parameter
 * Returns connection id for a new connection
 */
export async function connectToServer(server: TestServerProfile, timeout: number = 3000): Promise<string> {
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
	return result.connectionId;
}

export async function ensureConnectionViewOpened() {
	await vscode.commands.executeCommand('dataExplorer.servers.focus');
}

export async function sleep(ms: number): Promise<{}> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export async function createDB(dbName: string, ownerUri: string): Promise<void> {
	let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>('MSSQL', azdata.DataProviderType.QueryProvider);
	let query = `BEGIN TRY
			CREATE DATABASE ${dbName}
			SELECT 1 AS NoError
		END TRY
		BEGIN CATCH
			SELECT ERROR_MESSAGE() AS ErrorMessage;
		END CATCH`;

	let dbcreatedResult = await queryProvider.runQueryAndReturn(ownerUri, query);
	assert(dbcreatedResult.columnInfo[0].columnName !== 'ErrorMessage', 'DB creation threw error');
}

export async function deleteDB(dbName: string, ownerUri: string): Promise<void> {
	let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>('MSSQL', azdata.DataProviderType.QueryProvider);
	let query = `BEGIN TRY
			ALTER DATABASE ${dbName}
			SET OFFLINE
			WITH ROLLBACK IMMEDIATE
			DROP DATABASE ${dbName}
			SELECT 1 AS NoError
		END TRY
		BEGIN CATCH
			SELECT ERROR_MESSAGE() AS ErrorMessage;
		END CATCH`;

	await queryProvider.runQueryAndReturn(ownerUri, query);
}

export async function runQuery(query: string, ownerUri: string): Promise<azdata.SimpleExecuteResult> {
	let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>('MSSQL', azdata.DataProviderType.QueryProvider);
	let result = await queryProvider.runQueryAndReturn(ownerUri, query);
	return result;
}

export async function assertThrowsAsync(fn: () => Promise<any>, msg: string): Promise<void> {
	let f = () => {
		// Empty
	};
	try {
		await fn();
	} catch (e) {
		f = () => { throw e; };
	} finally {
		assert.throws(f, msg);
	}
}

/**
 *
 * @param databaseName name of database to check for
 * @param ownerUri owner uri
 * @param retryCount number of times to retry with a 5 second wait between each try
 * Checks for database getting created for operations that have async database creation
 */
export async function assertDatabaseCreationResult(databaseName: string, ownerUri: string, retryCount: number): Promise<void> {
	let result: azdata.SimpleExecuteResult;
	while (retryCount > 0) {
		--retryCount;
		await sleep(5000);

		let query = `BEGIN TRY
				SELECT name FROM master.dbo.sysdatabases WHERE name='${databaseName}'
			END TRY
			BEGIN CATCH
				SELECT ERROR_MESSAGE() AS ErrorMessage;
			END CATCH`;
		result = await runQuery(query, ownerUri);
		if (result.rowCount > 0) {
			break;
		}
	}

	assert(result.rowCount === 1, `Database ${databaseName} should be created`);
	assert(result.columnInfo[0].columnName !== 'ErrorMessage', 'Checking for db creation threw error');
}

/**
 *
 * @param filepath File path to check for
 * @param retryCount number of times to retry with a 5 second wait between each try
 * Checks for file getting created for async file generation and deletes file
 */
export async function assertFileGenerationResult(filepath: string, retryCount: number): Promise<void> {
	let exists = false;
	while (retryCount > 0 && !exists) {
		--retryCount;
		exists = fs.existsSync(filepath);
		await sleep(5000);
	}

	assert(exists, `File ${filepath} is expected to be present`);
	assert(fs.readFileSync(filepath).byteLength > 0, 'File should not be empty');
	fs.unlinkSync(filepath);
}