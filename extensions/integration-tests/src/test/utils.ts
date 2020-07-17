/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { TestServerProfile, TestConnectionInfo } from './testConfig';
import { isNullOrUndefined, promisify } from 'util';

// default server connection timeout
export const DefaultConnectTimeoutInMs: number = 10000;

/**
 * @param connectionInfo test connection profile
 * @param timeout optional timeout parameter
 * Returns connection id for a new connection
 */
export async function connectToServer(connectionInfo: TestConnectionInfo, timeout: number = DefaultConnectTimeoutInMs): Promise<string> {
	let connectionProfile: azdata.IConnectionProfile = {
		serverName: connectionInfo.serverName,
		databaseName: connectionInfo.database,
		authenticationType: connectionInfo.authenticationTypeName,
		providerName: connectionInfo.providerName,
		connectionName: '',
		userName: connectionInfo.userName,
		password: connectionInfo.password,
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
	await pollTimeout(async () => {
		const nodes = await azdata.objectexplorer.getActiveConnectionNodes();
		let found = nodes.some(node => {
			return node.connectionId === result.connectionId;
		});
		if (found === undefined) {
			found = false;
		}
		return found;
	}, 1000, timeout);

	return result.connectionId;
}

export class PromiseCancelledError extends Error { }
/**
 * Wait for a promise to resolve but timeout after a certain amount of time.
 * It will throw CancelledError when it fails.
 * @param p promise to wait on
 * @param timeout time to wait
 */
export async function asyncTimeout<T>(p: Thenable<T>, timeout: number): Promise<(T | undefined)> {
	const timeoutPromise = new Promise<T>((done, reject) => {
		setTimeout(() => {
			reject(new PromiseCancelledError('Promise did not resolve in time'));
		}, timeout);
	});

	return Promise.race([p, timeoutPromise]);
}

export async function pollTimeout(predicate: () => Thenable<boolean>, intervalDelay: number, timeoutTime: number): Promise<boolean> {
	let interval: NodeJS.Timer;
	return new Promise(pollOver => {
		const complete = (success = false) => {
			clearInterval(interval);
			pollOver(success);
		};
		interval = setInterval(async () => {
			const predResult = await predicate();
			if (predResult) {
				complete(true);
			}
		}, intervalDelay);
		setTimeout(complete, timeoutTime);
	});
}

export async function ensureConnectionViewOpened() {
	await vscode.commands.executeCommand('dataExplorer.servers.focus');
}

export async function sleep(ms: number): Promise<{}> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export async function createDB(dbName: string, ownerUri: string): Promise<void> {
	let query = `BEGIN TRY
			CREATE DATABASE ${dbName}
			SELECT 1 AS NoError
		END TRY
		BEGIN CATCH
			SELECT ERROR_MESSAGE() AS ErrorMessage;
		END CATCH`;

	let dbCreatedResult = await runQuery(query, ownerUri);
	assert(dbCreatedResult.columnInfo[0].columnName !== 'ErrorMessage', 'DB creation threw error');
}

/**
 * Attempts to delete a database, throwing an exception if it fails.
 * @param server The server information
 * @param dbName The name of the DB to delete
 * @param ownerUri The ownerUri of the connection used to run the query
 */
export async function deleteDB(server: TestServerProfile, dbName: string, ownerUri: string): Promise<void> {
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

	ownerUri = await ensureServerConnected(server, ownerUri);
	let dbDeleteResult = await runQuery(query, ownerUri);
	assert(dbDeleteResult.columnInfo[0].columnName !== 'ErrorMessage', `Error deleting db ${dbName} : ${dbDeleteResult.rows[0][0]}`);
}

/**
 * Attempts to delete a database, returning true if successful and false if not.
 * @param server The server information
 * @param dbName The name of the DB to delete
 * @param ownerUri The ownerUri of the connection used to run the query
 */
export async function tryDeleteDB(server: TestServerProfile, dbName: string, ownerUri: string): Promise<boolean> {
	try {
		deleteDB(server, dbName, ownerUri);
		return true;
	} catch (err) {
		console.warn(err);
		return false;
	}
}

async function ensureServerConnected(server: TestServerProfile, ownerUri: string): Promise<string> {
	try {
		// The queries might fail if connection is removed
		// Check if connection is present - if not create new connection and use OwnerUri from there
		let connection = await azdata.connection.getConnection(ownerUri);
		if (isNullOrUndefined(connection)) {
			let connectionId = await connectToServer(server);
			return azdata.connection.getUriForConnection(connectionId);
		}
	}
	catch (ex) {
		console.error('utils.ensureServerConnected : Failed to get or create connection');
		console.error(ex); // not throwing here because it is a safety net and actual query will throw if failed.
	}
	return ownerUri;
}


export async function runQuery(query: string, ownerUri: string): Promise<azdata.SimpleExecuteResult> {
	try {
		let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>('MSSQL', azdata.DataProviderType.QueryProvider);
		let result = await queryProvider.runQueryAndReturn(ownerUri, query);
		return result;
	}
	catch (ex) {
		console.error('utils.runQuery : Failed to run query');
		console.error(ex);
		throw ex;
	}

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
		// add state=0 to the query to make sure the database is online
		const query = `BEGIN TRY
				SELECT name FROM sys.databases WHERE name='${databaseName}' AND state=0
			END TRY
			BEGIN CATCH
				SELECT ERROR_MESSAGE() AS ErrorMessage;
			END CATCH`;
		try {
			result = await runQuery(query, ownerUri);
			if (result.rowCount > 0) {
				break;
			}
		}
		catch {
			// exception will be thrown by the SQL Tools Service if no results is returned
			// ignore it.
		}

		await sleep(5000);
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
		exists = await promisify(fs.exists)(filepath);
		await sleep(5000);
	}

	assert(exists, `File ${filepath} is expected to be present`);
	assert((await fs.promises.readFile(filepath)).byteLength > 0, 'File ${filepath} should not be empty');
	await fs.promises.unlink(filepath);
}

/**
 *
 * @param tableName table to look for
 * @param schema schema to look for
 * @param ownerUri owner uri
 * @param retryCount number of times to retry with a 5 second wait between each try
 * @param checkForData whether or not to check if the table has data
 * Checks for table existing
 */
export async function assertTableCreationResult(schema: string, tableName: string, ownerUri: string, retryCount: number, checkForData?: boolean): Promise<void> {
	let result: azdata.SimpleExecuteResult;
	while (retryCount > 0) {
		--retryCount;
		let query = `BEGIN TRY
				SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${tableName}'
			END TRY
			BEGIN CATCH
				SELECT ERROR_MESSAGE() AS ErrorMessage;
			END CATCH`;
		result = await runQuery(query, ownerUri);
		if (result.rowCount > 0) {
			break;
		}
		await sleep(5000);
	}

	assert(result.rowCount === 1, `Table ${tableName} should be created. ${result.rowCount} rows were found`);
	assert(result.columnInfo[0].columnName !== 'ErrorMessage', `Checking for table creation threw error ${result.rows[0][0].displayValue}`);

	if (checkForData) {
		while (retryCount > 0) {
			let query = `BEGIN TRY
					SELECT * FROM ${tableName}
				END TRY
				BEGIN CATCH
					SELECT ERROR_MESSAGE() AS ErrorMessage;
				END CATCH`;
			result = await runQuery(query, ownerUri);
			if (result.rowCount > 0) {
				break;
			}
			await sleep(5000);
		}

		assert(result.rowCount > 0, `Table ${tableName} should have at least one row of data. ${result.rowCount} rows were found`);
		assert(result.columnInfo[0].columnName !== 'ErrorMessage', `Checking for table creation threw error ${result.rows[0][0].displayValue}`);
	}
}

export function testServerProfileToIConnectionProfile(serverProfile: TestServerProfile): azdata.IConnectionProfile {
	return {
		serverName: serverProfile.serverName,
		databaseName: serverProfile.database,
		authenticationType: serverProfile.authenticationTypeName,
		providerName: serverProfile.providerName,
		connectionName: '',
		userName: serverProfile.userName,
		password: serverProfile.password,
		savePassword: false,
		groupFullName: undefined,
		saveProfile: true,
		id: undefined,
		groupId: undefined,
		options: {}
	};
}
