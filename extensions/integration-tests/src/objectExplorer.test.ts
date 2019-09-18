/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as azdata from 'azdata';
import { context } from './testContext';
import { getBdcServer, TestServerProfile, getAzureServer, getStandaloneServer } from './testConfig';
import { connectToServer, createDB, deleteDB, DefaultConnectTimeoutInMs } from './utils';
import assert = require('assert');
import { stressify } from 'adstest';

if (context.RunTest) {
	suite('Object Explorer integration suite', () => {
		test('BDC instance node label test', async function () {
			await (new ObjectExplorerTester()).bdcNodeLabelTest();
		});
		test('Standalone instance node label test', async function () {
			await (new ObjectExplorerTester()).standaloneNodeLabelTest();
		});
		test('Azure SQL DB instance node label test', async function () {
			await (new ObjectExplorerTester()).sqlDbNodeLabelTest();
		});
		test('BDC instance context menu test', async function () {
			await (new ObjectExplorerTester()).bdcContextMenuTest();
		});
		test('Azure SQL DB context menu test', async function () {
			await (new ObjectExplorerTester()).sqlDbContextMenuTest();
		});
		test('Standalone database context menu test', async function () {
			await (new ObjectExplorerTester()).standaloneContextMenuTest();
		});
	});
}

class ObjectExplorerTester {
	private static ParallelCount = 1;

	@stressify({ dop: ObjectExplorerTester.ParallelCount })
	async bdcNodeLabelTest(): Promise<void> {
		const expectedNodeLabel = ['Databases', 'Security', 'Server Objects', 'Data Services'];
		const server = await getBdcServer();
		await this.verifyOeNode(server, DefaultConnectTimeoutInMs, expectedNodeLabel);
	}

	@stressify({ dop: ObjectExplorerTester.ParallelCount })
	async standaloneNodeLabelTest(): Promise<void> {
		if (process.platform === 'win32') {
			const expectedNodeLabel = ['Databases', 'Security', 'Server Objects'];
			const server = await getStandaloneServer();
			await this.verifyOeNode(server, DefaultConnectTimeoutInMs, expectedNodeLabel);
		}
	}

	@stressify({ dop: ObjectExplorerTester.ParallelCount })
	async sqlDbNodeLabelTest(): Promise<void> {
		const expectedNodeLabel = ['Databases', 'Security'];
		const server = await getAzureServer();
		await this.verifyOeNode(server, DefaultConnectTimeoutInMs, expectedNodeLabel);
	}

	@stressify({ dop: ObjectExplorerTester.ParallelCount })
	async sqlDbContextMenuTest(): Promise<void> {
		const server = await getAzureServer();
		const expectedActions = ['Manage', 'New Query', 'New Notebook', 'Disconnect', 'Delete Connection', 'Refresh', 'Data-tier Application wizard', 'Launch Profiler'];
		await this.verifyContextMenu(server, expectedActions);
	}

	@stressify({ dop: ObjectExplorerTester.ParallelCount })
	async standaloneContextMenuTest(): Promise<void> {
		const server = await getStandaloneServer();
		let expectedActions: string[] = [];
		// Generate Scripts and Properties come from the admin-tool-ext-win extension which is for Windows only, so the item won't show up on non-Win32 platforms
		if (process.platform === 'win32') {
			expectedActions = ['Manage', 'New Query', 'New Notebook', 'Refresh', 'Backup', 'Restore', 'Data-tier Application wizard', 'Schema Compare', 'Import wizard', 'Generate Scripts...', 'Properties'];
		}
		else {
			expectedActions = ['Manage', 'New Query', 'New Notebook', 'Refresh', 'Backup', 'Restore', 'Data-tier Application wizard', 'Schema Compare', 'Import wizard'];
		}
		await this.verifyDBContextMenu(server, DefaultConnectTimeoutInMs, expectedActions);
	}

	@stressify({ dop: ObjectExplorerTester.ParallelCount })
	async bdcContextMenuTest(): Promise<void> {
		const server = await getBdcServer();
		let expectedActions: string[];
		// Properties comes from the admin-tool-ext-win extension which is for Windows only, so the item won't show up on non-Win32 platforms
		if (process.platform === 'win32') {
			expectedActions = ['Manage', 'New Query', 'New Notebook', 'Disconnect', 'Delete Connection', 'Refresh', 'Data-tier Application wizard', 'Launch Profiler', 'Properties'];
		}
		else {
			expectedActions = ['Manage', 'New Query', 'New Notebook', 'Disconnect', 'Delete Connection', 'Refresh', 'Data-tier Application wizard', 'Launch Profiler'];
		}
		await this.verifyContextMenu(server, expectedActions);
	}

	async verifyContextMenu(server: TestServerProfile, expectedActions: string[]): Promise<void> {
		await connectToServer(server, DefaultConnectTimeoutInMs);
		const nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
		assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

		const index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
		assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);

		const node = nodes[index];
		const actions = await azdata.objectexplorer.getNodeActions(node.connectionId, node.nodePath);

		const expectedString = expectedActions.join(',');
		const actualString = actions.join(',');
		assert(expectedActions.length === actions.length && expectedString === actualString, `Expected actions: "${expectedString}", Actual actions: "${actualString}"`);
	}

	async verifyOeNode(server: TestServerProfile, timeout: number, expectedNodeLabel: string[]): Promise<void> {
		await connectToServer(server, timeout);
		const nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
		assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

		const index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
		assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);
		const actualNodeLabel = [];
		const children = await nodes[index].getChildren();
		assert(children.length === expectedNodeLabel.length, `Expecting node count: ${expectedNodeLabel.length}, Actual: ${children.length}`);

		children.forEach(c => actualNodeLabel.push(c.label));
		assert(expectedNodeLabel.toLocaleString() === actualNodeLabel.toLocaleString(), `Expected node label: "${expectedNodeLabel}", Actual: "${actualNodeLabel}"`);
	}

	async verifyDBContextMenu(server: TestServerProfile, timeoutinMS: number, expectedActions: string[]): Promise<void> {

		await connectToServer(server, timeoutinMS);

		const nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
		assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

		const index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
		assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);

		const ownerUri = await azdata.connection.getUriForConnection(nodes[index].connectionId);
		const dbName: string = 'ads_test_VerifyDBContextMenu_' + new Date().getTime().toString();
		try {
			await createDB(dbName, ownerUri);

			const serverNode = nodes[index];
			const children = await serverNode.getChildren();

			assert(children[0].label.toLocaleLowerCase === 'Databases'.toLocaleLowerCase, `Expected Databases node. Actual ${children[0].label}`);
			const databasesFolder = children[0];

			const databases = await databasesFolder.getChildren();
			assert(databases.length > 2, `No database present, can not test further`); // System Databses folder and at least one database

			const actions = await azdata.objectexplorer.getNodeActions(databases[1].connectionId, databases[1].nodePath);

			const expectedString = expectedActions.join(',');
			const actualString = actions.join(',');
			assert(expectedActions.length === actions.length && expectedString === actualString, `Expected actions: "${expectedString}", Actual actions: "${actualString}"`);
		}
		finally {
			await deleteDB(dbName, ownerUri);
		}
	}
}
