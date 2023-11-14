/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as azdata from 'azdata';
import * as utils from './utils';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as mssql from 'mssql';
import * as vscode from 'vscode';
import { getStandaloneServer } from './testConfig';
import * as assert from 'assert';
import { promisify } from 'util';

const retryCount = 24; // 2 minutes
const dacpac1: string = path.join(__dirname, '../../testData/Database1.dacpac');


suite('Dacpac integration test suite @DacFx@', () => {
	suiteSetup(async function () {
		await utils.sleep(5000); // To ensure the providers are registered.
		console.log(`Start dacpac tests`);
	});

	test('Deploy and extract dacpac @UNSTABLE@', async function () {
		this.timeout(5 * 60 * 1000);
		const server = await getStandaloneServer();
		const connectionId = await utils.connectToServer(server);
		assert(connectionId, `Failed to connect to "${server.serverName}"`);

		const ownerUri = await azdata.connection.getUriForConnection(connectionId);
		const now = new Date();
		const databaseName = 'ADS_deployDacpac_' + now.getTime().toString();

		try {
			const dacfxService = ((await vscode.extensions.getExtension(mssql.extension.name).activate() as mssql.IExtension)).dacFx;
			assert(dacfxService, 'DacFx Service Provider is not available');

			// Deploy dacpac
			const deployResult = await dacfxService.deployDacpac(dacpac1, databaseName, false, ownerUri, azdata.TaskExecutionMode.execute);
			await utils.assertDatabaseCreationResult(databaseName, ownerUri, retryCount);
			const dbConnectionId = await utils.connectToServer({
				serverName: server.serverName,
				database: databaseName,
				userName: server.userName,
				password: server.password,
				authenticationTypeName: server.authenticationTypeName,
				providerName: server.providerName
			});
			const dbConnectionOwnerUri = await azdata.connection.getUriForConnection(dbConnectionId);
			await utils.assertTableCreationResult('dbo', 'Table1', dbConnectionOwnerUri, retryCount);
			await utils.assertTableCreationResult('dbo', 'Table2', dbConnectionOwnerUri, retryCount);
			assert(deployResult.success === true && deployResult.errorMessage === '', `Deploy dacpac should succeed Expected: there should be no error. Actual Error message: "${deployResult.errorMessage}"`);

			// Extract dacpac
			const folderPath = path.join(os.tmpdir(), 'DacFxTest');
			if (!(await promisify(fs.exists)(folderPath))) {
				await fs.promises.mkdir(folderPath);
			}
			const packageFilePath = path.join(folderPath, `${databaseName}.dacpac`);
			const extractResult = await dacfxService.extractDacpac(databaseName, packageFilePath, databaseName, '1.0.0.0', ownerUri, azdata.TaskExecutionMode.execute);
			await utils.assertFileGenerationResult(packageFilePath, retryCount);

			assert(extractResult.success === true && extractResult.errorMessage === '', `Extract dacpac should succeed. Expected: there should be no error. Actual Error message: "${extractResult.errorMessage}"`);
		} finally {
			await utils.tryDeleteDB(server, databaseName, ownerUri);
		}
	});

	const bacpac1: string = path.join(__dirname, '..', '..', 'testData', 'Database1.bacpac');
	test('Import and export bacpac @UNSTABLE@', async function () {
		this.timeout(5 * 60 * 1000);
		const server = await getStandaloneServer();
		await utils.connectToServer(server);

		const connectionId = await utils.connectToServer(server);
		assert(connectionId, `Failed to connect to "${server.serverName}"`);
		const ownerUri = await azdata.connection.getUriForConnection(connectionId);
		const now = new Date();
		const databaseName = 'ADS_importBacpac_' + now.getTime().toString();

		try {
			let dacfxService = ((await vscode.extensions.getExtension(mssql.extension.name).activate() as mssql.IExtension)).dacFx;
			assert(dacfxService, 'DacFx Service Provider is not available');

			// Import bacpac
			const importResult = await dacfxService.importBacpac(bacpac1, databaseName, ownerUri, azdata.TaskExecutionMode.execute);
			await utils.assertDatabaseCreationResult(databaseName, ownerUri, retryCount);
			const dbConnectionId = await utils.connectToServer({
				serverName: server.serverName,
				database: databaseName,
				userName: server.userName,
				password: server.password,
				authenticationTypeName: server.authenticationTypeName,
				providerName: server.providerName
			});
			const dbConnectionOwnerUri = await azdata.connection.getUriForConnection(dbConnectionId);
			await utils.assertTableCreationResult('dbo', 'Table1', dbConnectionOwnerUri, retryCount, true);
			await utils.assertTableCreationResult('dbo', 'Table2', dbConnectionOwnerUri, retryCount, true);
			assert(importResult.success === true && importResult.errorMessage === '', `Expected: Import bacpac should succeed and there should be no error. Actual Error message: "${importResult.errorMessage}"`);

			// Export bacpac
			const folderPath = path.join(os.tmpdir(), 'DacFxTest');
			if (!(await promisify(fs.exists)(folderPath))) {
				await fs.promises.mkdir(folderPath);
			}
			const packageFilePath = path.join(folderPath, `${databaseName}.bacpac`);
			const exportResult = await dacfxService.exportBacpac(databaseName, packageFilePath, ownerUri, azdata.TaskExecutionMode.execute);
			await utils.assertFileGenerationResult(packageFilePath, retryCount);
			assert(exportResult.success === true && exportResult.errorMessage === '', `Expected: Export bacpac should succeed and there should be no error. Actual Error message: "${exportResult.errorMessage}"`);
		} finally {
			await utils.tryDeleteDB(server, databaseName, ownerUri);
		}
	});
});
