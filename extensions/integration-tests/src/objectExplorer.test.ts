/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as azdata from 'azdata';
import { context } from './testContext';
import { getBdcServer, TestServerProfile, getAzureServer, getStandaloneServer } from './testConfig';
import { connectToServer } from './utils';
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
	});
}

class ObjectExplorerTester {
	private static ParallelCount = 1;

	@stressify({ dop: ObjectExplorerTester.ParallelCount })
	async bdcNodeLabelTest(): Promise<void> {
		const expectedNodeLabel = ['Databases', 'Security', 'Server Objects', 'Data Services'];
		const server = await getBdcServer();
		await this.verifyOeNode(server, 6000, expectedNodeLabel);
	}

	@stressify({ dop: ObjectExplorerTester.ParallelCount })
	async standaloneNodeLabelTest(): Promise<void> {
		if (process.platform === 'win32') {
			const expectedNodeLabel = ['Databases', 'Security', 'Server Objects'];
			const server = await getStandaloneServer();
			await this.verifyOeNode(server, 3000, expectedNodeLabel);
		}
	}

	@stressify({ dop: ObjectExplorerTester.ParallelCount })
	async sqlDbNodeLabelTest(): Promise<void> {
		const expectedNodeLabel = ['Databases', 'Security'];
		const server = await getAzureServer();
		await this.verifyOeNode(server, 3000, expectedNodeLabel);
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
}
