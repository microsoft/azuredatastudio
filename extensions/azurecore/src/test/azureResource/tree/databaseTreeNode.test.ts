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
import { AzureResourceDatabase } from '../../../azureResource/models';
import { AzureResourceItemType } from '../../../azureResource/constants';
import { AzureResourceDatabaseTreeNode } from '../../../azureResource/tree/databaseTreeNode';

// Mock services
const mockServicePool = AzureResourceServicePool.getInstance();

let mockContextService: TypeMoq.IMock<IAzureResourceContextService>;

let mockTreeChangeHandler: TypeMoq.IMock<IAzureResourceTreeChangeHandler>;

// Mock test data
const mockDatabase: AzureResourceDatabase = {
	name: 'mock database 1',
	serverName: 'mock server 1',
	serverFullName: 'mock server 1',
	loginName: 'mock user 1'
};

describe('AzureResourceDatabaseTreeNode.info', function(): void {
	beforeEach(() => {
		mockContextService = TypeMoq.Mock.ofType<IAzureResourceContextService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockServicePool.contextService = mockContextService.object;
	});

	it('Should be correct.', async function(): Promise<void> {
		const databaseTreeNode = new AzureResourceDatabaseTreeNode(mockDatabase, mockTreeChangeHandler.object, undefined);

		const databaseTreeNodeLabel = `${mockDatabase.name} (${mockDatabase.serverName})`;

		should(databaseTreeNode.nodePathValue).equal(`database_${mockDatabase.name}`);

		const treeItem = await databaseTreeNode.getTreeItem();
		should(treeItem.label).equal(databaseTreeNodeLabel);
		should(treeItem.contextValue).equal(AzureResourceItemType.database);
		should(treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.None);

		const nodeInfo = databaseTreeNode.getNodeInfo();
		should(nodeInfo.isLeaf).true();
		should(nodeInfo.label).equal(databaseTreeNodeLabel);
		should(nodeInfo.nodeType).equal(AzureResourceItemType.database);
		should(nodeInfo.iconType).equal(AzureResourceItemType.database);
	});
});
