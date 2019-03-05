/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as azdata from 'azdata';
import { context } from './testContext';
import { getDefaultTestingServer, getBdcServer, TestServerProfile } from './testConfig';
import { connectToServer } from './utils';
import assert = require('assert');

if (context.RunTest) {
	suite('Object Explorer integration suite', () => {
		test('BDC instance node label test', async function () {
			const expectedNodeLabel = ['Databases', 'Security', 'Server Objects', 'Data Services'];
			let server = await getBdcServer();
			await VerifyOeNode(server, 6000, expectedNodeLabel);
		});
		test('Standard alone instance node label test', async function () {
			const expectedNodeLabel = ['Databases', 'Security', 'Server Objects'];
			let server = await getDefaultTestingServer();
			await VerifyOeNode(server, 3000, expectedNodeLabel);
		});
		test('context menu test', async function () {
			let server = await getDefaultTestingServer();
			await connectToServer(server, 3000);
			let nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
			assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

			let index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
			assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);

			let node = nodes[index];
			let actions = await azdata.objectexplorer.getNodeActions(node.connectionId, node.nodePath);
			const expectedActions = ['Manage', 'New Query', 'Disconnect', 'Delete Connection', 'Refresh', 'New Notebook', 'Launch Profiler'];

			const expectedString = expectedActions.join(',');
			const actualString = actions.join(',');
			assert(expectedActions.length === actions.length && expectedString === actualString, `Expected actions: "${expectedString}", Actual actions: "${actualString}"`);
		});
	});
}
async function VerifyOeNode(server: TestServerProfile, timeout: number,expectedNodeLable: string[]) {
	await connectToServer(server, timeout);
	let nodes = <azdata.objectexplorer.ObjectExplorerNode[]>await azdata.objectexplorer.getActiveConnectionNodes();
	assert(nodes.length > 0, `Expecting at least one active connection, actual: ${nodes.length}`);

	let index = nodes.findIndex(node => node.nodePath.includes(server.serverName));
	assert(index !== -1, `Failed to find server: "${server.serverName}" in OE tree`);
	let actualNodeLable = [];
	let childeren = await nodes[index].getChildren();
	assert(childeren.length === expectedNodeLable.length, `Expecting node count: ${expectedNodeLable.length}, Actual: ${childeren.length}`);

	childeren.forEach(c => actualNodeLable.push(c.label));
	assert(expectedNodeLable.toLocaleString() === actualNodeLable.toLocaleString(), `Expected node label: "$'${expectedNodeLable}", Actual: "${actualNodeLable}"`);
}

