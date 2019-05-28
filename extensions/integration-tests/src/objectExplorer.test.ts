/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as azdata from 'azdata';
import { context } from './testContext';
import { getBdcServer, TestServerProfile, getAzureServer, getStandaloneServer } from './testConfig';
import { connectToServer, createDB, deleteDB } from './utils';
import assert = require('assert');
import { stressify } from 'adstest';

if (context.RunTest) {
	suite('Object Explorer integration suite', () => {
		test('BDC instance node label test', async function () {
			await (new ObjectExplorerTester()).bdcNodeLabelTest();
		});
		test('Standard alone instance node label test', async function () {
			await (new ObjectExplorerTester()).standaloneNodeLabelTest();
		});
		test('Azure SQL DB instance node label test', async function () {
			await (new ObjectExplorerTester()).sqlDbNodeLabelTest();
		});
		test('Standard SQL DB context menu test', async function () {
			await (new ObjectExplorerTester()).sqlDbContextMenuTest();
		});
		test('BDC instance context menu test', async function () {
			await (new ObjectExplorerTester()).bdcContextMenuTest();
		});
		test('Azure SQL DB context menu test', async function () {
			await (new ObjectExplorerTester()).sqlDbContextMenuTest();
		});
		test('Stand alone database context menu test', async function () {
			await (new ObjectExplorerTester()).standAloneContextMenuTest();
		});
	});
}

class ObjectExplorerTester {
	private static IterationCount = 20;
	private static ParallelCount = 1;

	@stressify({ dop: ObjectExplorerTester.ParallelCount, iterations: ObjectExplorerTester.IterationCount })
	async bdcNodeLabelTest(): Promise<void> {
		const expectedNodeLabel = ['Databases', 'Security', 'Server Objects', 'Data Services'];
		let server = await getBdcServer();
		await this.verifyOeNode(server, 6000, expectedNodeLabel);
	}

	@stressify({ dop: ObjectExplorerTester.ParallelCount, iterations: ObjectExplorerTester.IterationCount })
	async standaloneNodeLabelTest(): Promise<void> {
		if (process.platform === 'win32') {
			const expectedNodeLabel = ['Databases', 'Security', 'Server Objects'];
			let server = await getStandaloneServer();
			await this.verifyOeNode(server, 3000, expectedNodeLabel);
		}
	}

	@stressify({ dop: ObjectExplorerTester.ParallelCount, iterations: ObjectExplorerTester.IterationCount })
	async sqlDbNodeLabelTest(): Promise<void> {
		const expectedNodeLabel = ['Databases', 'Security'];
		let server = await getAzureServer();
		await this.verifyOeNode(server, 3000, expectedNodeLabel);
	}

	@stressify({ dop: ObjectExplorerTester.ParallelCount, iterations: ObjectExplorerTester.IterationCount })
	async sqlDbContextMenuTest(): Promise<void> {
		let server = await getStandaloneServer();
		let expectedActions: string[];
		// Properties comes from the admin-tool-ext-win extension which is for Windows only, so the item won't show up on non-Win32 platforms
		if (process.platform === 'win32') {
			expectedActions = ['Manage', 'New Query', 'Disconnect', 'Delete Connection', 'Refresh', 'New Notebook', 'Data-tier Application wizard', 'Launch Profiler', 'Properties'];
		}
		else {
			expectedActions = ['Manage', 'New Query', 'Disconnect', 'Delete Connection', 'Refresh', 'New Notebook', 'Data-tier Application wizard', 'Launch Profiler'];
		}
		await this.verifyContextMenu(server, expectedActions);
	}

	@stressify({ dop: ObjectExplorerTester.ParallelCount, iterations: ObjectExplorerTester.IterationCount })
	async standAloneContextMenuTest(): Promise<void> {
		let server = await getStandaloneServer();
		let expectedActions: string[] = [];
		if (process.platform === 'win32') {
			expectedActions = ['Manage', 'New Query', 'Backup', 'Restore', 'Refresh', 'Data-tier Application wizard', 'Schema Compare', 'Import wizard', 'Generate Scripts...', 'Properties'];
		}
		else {
			expectedActions = ['Manage', 'New Query', 'Backup', 'Restore', 'Refresh', 'Data-tier Application wizard', 'Schema Compare', 'Import wizard'];
		}
		await this.verifyDBContextMenu(server, 3000, expectedActions);
	}

	@stressify({ dop: ObjectExplorerTester.ParallelCount, iterations: ObjectExplorerTester.IterationCount })
	async bdcContextMenuTest(): Promise<void> {
		let server = await getBdcServer();
		let expectedActions: string[];
		// Properties comes from the admin-tool-ext-win extension which is for Windows only, so the item won't show up on non-Win32 platforms
		if (process.platform === 'win32') {
			expectedActions = ['Manage', 'New Query', 'Disconnect', 'Delete Connection', 'Refresh', 'New Notebook', 'Data-tier Application wizard', 'Launch Profiler', 'Properties'];
		}
		else {
			expectedActions = ['Manage', 'New Query', 'Disconnect', 'Delete Connection', 'Refresh', 'New Notebook', 'Data-tier Application wizard', 'Launch Profiler'];
		}
		await this.verifyContextMenu(server, expectedActions);
	}

	async verifyContextMenu(server: TestServerProfile, expectedActions: string[]): Promise<void> {
		await connectToServer(server, 3000);
		let nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
		assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

		let index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
		assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);

		let node = nodes[index];
		let actions = await azdata.objectexplorer.getNodeActions(node.connectionId, node.nodePath);

		let expectedString = expectedActions.join(',');
		const actualString = actions.join(',');
		assert(expectedActions.length === actions.length && expectedString === actualString, `Expected actions: "${expectedString}", Actual actions: "${actualString}"`);
	}

	async verifyOeNode(server: TestServerProfile, timeout: number, expectedNodeLabel: string[]): Promise<void> {
		await connectToServer(server, timeout);
		let nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
		assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

		let index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
		assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);
		let actualNodeLabel = [];
		let children = await nodes[index].getChildren();
		assert(children.length === expectedNodeLabel.length, `Expecting node count: ${expectedNodeLabel.length}, Actual: ${children.length}`);

		children.forEach(c => actualNodeLabel.push(c.label));
		assert(expectedNodeLabel.toLocaleString() === actualNodeLabel.toLocaleString(), `Expected node label: "${expectedNodeLabel}", Actual: "${actualNodeLabel}"`);
	}

	async verifyDBContextMenu(server: TestServerProfile, timeoutinMS: number, expectedActions: string[]): Promise<void> {

		await connectToServer(server, timeoutinMS);

		let nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
		assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

		let index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
		assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);

		let ownerUri = await azdata.connection.getUriForConnection(nodes[index].connectionId);
		let dbName: string = 'ads_test_VerifyDBContextMenu_' + new Date().getTime().toString();
		try {
			await createDB(dbName, ownerUri);

			let serverNode = nodes[index];
			let children = await serverNode.getChildren();

			assert(children[0].label.toLocaleLowerCase === 'Databases'.toLocaleLowerCase, `Expected Databases node. Actual ${children[0].label}`);
			let databasesFolder = children[0];

			let databases = await databasesFolder.getChildren();
			assert(databases.length > 2, `No database present, can not test further`); // System Databses folder and at least one database

			let actions = await azdata.objectexplorer.getNodeActions(databases[1].connectionId, databases[1].nodePath);

			const expectedString = expectedActions.join(',');
			const actualString = actions.join(',');
			assert(expectedActions.length === actions.length && expectedString === actualString, `Expected actions: "${expectedString}", Actual actions: "${actualString}"`);
		}
		finally {
			await deleteDB(dbName, ownerUri);
		}
	}
}