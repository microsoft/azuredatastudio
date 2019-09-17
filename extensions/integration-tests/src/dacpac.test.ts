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
import * as os from 'os';
import * as mssql from '../../mssql';
import * as vscode from 'vscode';
import { context } from './testContext';
import { getStandaloneServer } from './testConfig';
import assert = require('assert');

const retryCount = 24; // 2 minutes
const dacpac1: string = path.join(__dirname, '../testData/Database1.dacpac');
const bacpac1: string = path.join(__dirname, '../testData/Database1.bacpac');
if (context.RunTest) {
	suite('Dacpac integration test suite', () => {
		suiteSetup(async function () {
			await utils.sleep(5000); // To ensure the providers are registered.
			console.log(`Start dacpac tests`);
		});

		test('Deploy and extract dacpac', async function () {
			const server = await getStandaloneServer();
			await utils.connectToServer(server);

			const nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
			const index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
			const ownerUri = await azdata.connection.getUriForConnection(nodes[index].connectionId);
			const now = new Date();
			const databaseName = 'ADS_deployDacpac_' + now.getTime().toString();

			try {
				const dacfxService = ((await vscode.extensions.getExtension(mssql.extension.name).activate() as mssql.IExtension)).dacFx;
				assert(dacfxService, 'DacFx Service Provider is not available');

				// Deploy dacpac
				const deployResult = await dacfxService.deployDacpac(dacpac1, databaseName, false, ownerUri, azdata.TaskExecutionMode.execute);
				await utils.assertDatabaseCreationResult(databaseName, ownerUri, retryCount);
				await utils.assertTableCreationResult(databaseName, 'dbo', 'Table1', ownerUri, retryCount);
				await utils.assertTableCreationResult(databaseName, 'dbo', 'Table2', ownerUri, retryCount);
				assert(deployResult.success === true && deployResult.errorMessage === '', `Deploy dacpac should succeed Expected: there should be no error. Actual Error message: "${deployResult.errorMessage}"`);

				// Extract dacpac
				const folderPath = path.join(os.tmpdir(), 'DacFxTest');
				if (!fs.existsSync(folderPath)) {
					fs.mkdirSync(folderPath);
				}
				const packageFilePath = path.join(folderPath, `${databaseName}.dacpac`);
				const extractResult = await dacfxService.extractDacpac(databaseName, packageFilePath, databaseName, '1.0.0.0', ownerUri, azdata.TaskExecutionMode.execute);
				await utils.assertFileGenerationResult(packageFilePath, retryCount);

				assert(extractResult.success === true && extractResult.errorMessage === '', `Extract dacpac should succeed. Expected: there should be no error. Actual Error message: "${extractResult.errorMessage}"`);
			} finally {
				await utils.deleteDB(databaseName, ownerUri);
			}
		});

		test('Import and export bacpac', async function () {
			const server = await getStandaloneServer();
			await utils.connectToServer(server);

			const nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
			const index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
			const ownerUri = await azdata.connection.getUriForConnection(nodes[index].connectionId);
			const now = new Date();
			const databaseName = 'ADS_importBacpac_' + now.getTime().toString();

			try {
				let dacfxService = ((await vscode.extensions.getExtension(mssql.extension.name).activate() as mssql.IExtension)).dacFx;
				assert(dacfxService, 'DacFx Service Provider is not available');

				// Import bacpac
				const importResult = await dacfxService.importBacpac(bacpac1, databaseName, ownerUri, azdata.TaskExecutionMode.execute);
				await utils.assertDatabaseCreationResult(databaseName, ownerUri, retryCount);
				await utils.assertTableCreationResult(databaseName, 'dbo', 'Table1', ownerUri, retryCount, true);
				await utils.assertTableCreationResult(databaseName, 'dbo', 'Table2', ownerUri, retryCount, true);
				assert(importResult.success === true && importResult.errorMessage === '', `Expected: Import bacpac should succeed and there should be no error. Actual Error message: "${importResult.errorMessage}"`);

				// Export bacpac
				const folderPath = path.join(os.tmpdir(), 'DacFxTest');
				if (!fs.existsSync(folderPath)) {
					fs.mkdirSync(folderPath);
				}
				const packageFilePath = path.join(folderPath, `${databaseName}.bacpac`);
				const exportResult = await dacfxService.exportBacpac(databaseName, packageFilePath, ownerUri, azdata.TaskExecutionMode.execute);
				await utils.assertFileGenerationResult(packageFilePath, retryCount);
				assert(exportResult.success === true && exportResult.errorMessage === '', `Expected: Export bacpac should succeed and there should be no error. Actual Error message: "${exportResult.errorMessage}"`);
			} finally {
				await utils.deleteDB(databaseName, ownerUri);
			}
		});
	});
}
