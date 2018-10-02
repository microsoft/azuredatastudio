/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import 'mocha';

import { AzureResourceServicePool } from '../../../azureResource/servicePool';
import { IAzureResourceContextService } from '../../../azureResource/interfaces';
import { IAzureResourceTreeChangeHandler } from '../../../azureResource/tree/treeChangeHandler';
import { AzureResourceDatabaseServer } from '../../../azureResource/models';
import { AzureResourceItemType } from '../../../azureResource/constants';
import { AzureResourceDatabaseServerTreeNode } from '../../../azureResource/tree/databaseServerTreeNode';

// Mock services
const mockServicePool = AzureResourceServicePool.getInstance();

let mockContextService: TypeMoq.IMock<IAzureResourceContextService>;

let mockTreeChangeHandler: TypeMoq.IMock<IAzureResourceTreeChangeHandler>;

// Mock test data
const mockDatabaseServer: AzureResourceDatabaseServer = {
	name: 'mock database 1',
	fullName: 'mock server 1',
	loginName: 'mock user 1',
	defaultDatabaseName: 'master'
};

describe('AzureResourceDatabaseServerTreeNode.info', function(): void {
	beforeEach(() => {
		mockContextService = TypeMoq.Mock.ofType<IAzureResourceContextService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockServicePool.contextService = mockContextService.object;
	});

	it('Should be correct when created.', async function(): Promise<void> {
		const databaseServerTreeNode = new AzureResourceDatabaseServerTreeNode(mockDatabaseServer, mockTreeChangeHandler.object, undefined);

		const databaseServerTreeNodeLabel = mockDatabaseServer.name;

		should(databaseServerTreeNode.nodePathValue).equal(`databaseServer_${mockDatabaseServer.name}`);

		const treeItem = await databaseServerTreeNode.getTreeItem();
		should(treeItem.label).equal(databaseServerTreeNodeLabel);
		should(treeItem.contextValue).equal(AzureResourceItemType.databaseServer);
		should(treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.None);

		const nodeInfo = databaseServerTreeNode.getNodeInfo();
		should(nodeInfo.isLeaf).true();
		should(nodeInfo.label).equal(databaseServerTreeNodeLabel);
		should(nodeInfo.nodeType).equal(AzureResourceItemType.databaseServer);
		should(nodeInfo.iconType).equal(AzureResourceItemType.databaseServer);
	});
});
