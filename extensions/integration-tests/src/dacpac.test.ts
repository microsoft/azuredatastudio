/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as azdata from 'azdata';
import * as utils from './utils';
import * as path from 'path';
import * as fs from 'fs';
import { context } from './testContext';
import assert = require('assert');
import { getStandaloneServer } from './testConfig';

if (context.RunTest) {
	suite('Dacpac integration test suite', () => {
		suiteSetup(async function () {
			await utils.sleep(5000); // To ensure the providers are registered.
			console.log(`Start dacpac tests`);
		});

		test('Deploy and extract dacpac', async function () {
			let server = await getStandaloneServer();
			await utils.connectToServer(server);

			let nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
			assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

			let index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
			assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);

			let ownerUri = await azdata.connection.getUriForConnection(nodes[index].connectionId);
			let now = new Date();
			let databaseName = 'ADS_deployDacpac_' + now.getTime().toString();

			try {
				let dacfxService = await azdata.dataprotocol.getProvider<azdata.DacFxServicesProvider>('MSSQL', azdata.DataProviderType.DacFxServicesProvider);
				assert(dacfxService, 'DacFx Service Provider is not available');

				// Deploy dacpac
				let deployResult = await dacfxService.deployDacpac(path.join(__dirname, 'testData/Database1.dacpac'), databaseName, false, ownerUri, azdata.TaskExecutionMode.execute);
				await assertDatabaseCreationResult(databaseName, ownerUri);
				assert(deployResult.success === true, 'Deploy dacpac should succeed');
				assert(deployResult.errorMessage === '', `Expected: there should be no error. Actual Error message: "${deployResult.errorMessage}"`);

				// Extract dacpac
				let folderPath = path.join(process.env.APPDATA, 'DacFxTest');
				if (!fs.existsSync(folderPath)) {
					fs.mkdirSync(folderPath);
				}
				let packageFilePath = path.join(folderPath, `${databaseName}.dacpac`);
				let extractResult = await dacfxService.extractDacpac(databaseName, packageFilePath, databaseName, '1.0.0.0', ownerUri, azdata.TaskExecutionMode.execute);
				await assertFileGenerationResult(packageFilePath);

				assert(extractResult.success === true, 'Extract dacpac should succeed');
				assert(extractResult.errorMessage === '', `Expected: there should be no error. Actual Error message: "${extractResult.errorMessage}"`);
			} finally {
				await utils.deleteDB(databaseName, ownerUri);
			}
		});

		test('Import and export bacpac', async function () {
			let server = await getStandaloneServer();
			await utils.connectToServer(server);

			let nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
			assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

			let index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
			assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);

			let ownerUri = await azdata.connection.getUriForConnection(nodes[index].connectionId);
			let now = new Date();
			let databaseName = 'ADS_importBacpac_' + now.getTime().toString();

			try {
				let dacfxService = await azdata.dataprotocol.getProvider<azdata.DacFxServicesProvider>('MSSQL', azdata.DataProviderType.DacFxServicesProvider);
				assert(dacfxService, 'DacFx Service Provider is not available');

				// Import bacpac
				let importResult = await dacfxService.importBacpac(path.join(__dirname, 'testData/Database1.bacpac'), databaseName, ownerUri, azdata.TaskExecutionMode.execute);
				await assertDatabaseCreationResult(databaseName, ownerUri);
				assert(importResult.success === true, 'Import bacpac should succeed');
				assert(importResult.errorMessage === '', `Expected: there should be no error. Actual Error message: "${importResult.errorMessage}"`);

				// Export bacpac
				let folderPath = path.join(process.env.APPDATA, 'DacFxTest');
				if (!fs.existsSync(folderPath)) {
					fs.mkdirSync(folderPath);
				}
				let packageFilePath = path.join(folderPath, `${databaseName}.bacpac`);
				let exportResult = await dacfxService.exportBacpac(databaseName, packageFilePath, ownerUri, azdata.TaskExecutionMode.execute);
				await assertFileGenerationResult(packageFilePath);

				assert(exportResult.success === true, 'Export bacpac should succeed');
				assert(exportResult.errorMessage === '', `Expected: there should be no error. Actual Error message: "${exportResult.errorMessage}"`);
			} finally {
				await utils.deleteDB(databaseName, ownerUri);
			}
		});
	});
}

async function assertDatabaseCreationResult(databaseName: string, ownerUri: string): Promise<void> {
	let retryCount = 20; // database can take a long time to get created
	let result: azdata.SimpleExecuteResult;
	while (retryCount > 0) {
		--retryCount;
		await utils.sleep(5000);

		let query = `BEGIN TRY
				SELECT name FROM master.dbo.sysdatabases WHERE name='${databaseName}'
			END TRY
			BEGIN CATCH
				SELECT ERROR_MESSAGE() AS ErrorMessage;
			END CATCH`;
		result = await utils.runQuery(query, ownerUri);
		if (result.rowCount > 0) {
			break;
		}
	}

	assert(result.rowCount === 1, 'There should be a database created');
}

async function assertFileGenerationResult(filepath: string): Promise<void> {
	let retry = 20; // file can take quite a long time to get created
	let exists = false;
	while (retry > 0 && !exists) {
		exists = fs.existsSync(filepath);
		await utils.sleep(5000);
		--retry;
	}

	assert(exists, `file ${filepath} is expected to be present`);
	assert(fs.readFileSync(filepath).byteLength > 0, 'file should not be empty');
	fs.unlinkSync(filepath);
}