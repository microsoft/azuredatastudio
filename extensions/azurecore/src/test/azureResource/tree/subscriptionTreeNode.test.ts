/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import 'mocha';

import { AzureResourceServicePool } from '../../../azureResource/servicePool';
import { IAzureResourceContextService } from '../../../azureResource/interfaces';
import { IAzureResourceTreeChangeHandler } from '../../../azureResource/tree/treeChangeHandler';
import { AzureResourceSubscription } from '../../../azureResource/models';
import { AzureResourceSubscriptionTreeNode } from '../../../azureResource/tree/subscriptionTreeNode';
import { AzureResourceDatabaseContainerTreeNode } from '../../../azureResource/tree/databaseContainerTreeNode';
import { AzureResourceDatabaseServerContainerTreeNode } from '../../../azureResource/tree/databaseServerContainerTreeNode';
import { AzureResourceItemType } from '../../../azureResource/constants';

// Mock services
const mockServicePool = AzureResourceServicePool.getInstance();

let mockContextService: TypeMoq.IMock<IAzureResourceContextService>;

let mockTreeChangeHandler: TypeMoq.IMock<IAzureResourceTreeChangeHandler>;

// Mock test data
const mockAccount: sqlops.Account = {
	key: {
		accountId: 'mock_account',
		providerId: 'mock_provider'
	},
	displayInfo: {
		displayName: 'mock_account@test.com',
		accountType: 'Microsoft',
		contextualDisplayName: 'test'
	},
	properties: undefined,
	isStale: false
};

const mockSubscription: AzureResourceSubscription = {
	id: 'mock_subscription',
	name: 'mock subscription'
};

describe('AzureResourceSubscriptionTreeNode.info', function(): void {
	beforeEach(() => {
		mockContextService = TypeMoq.Mock.ofType<IAzureResourceContextService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockServicePool.contextService = mockContextService.object;
	});

	it('Should be correct when created.', async function(): Promise<void> {
		const subscriptionTreeNode = new AzureResourceSubscriptionTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);

		should(subscriptionTreeNode.nodePathValue).equal(`subscription_${mockSubscription.id}`);

		const treeItem = await subscriptionTreeNode.getTreeItem();
		should(treeItem.label).equal(mockSubscription.name);
		should(treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);
		should(treeItem.contextValue).equal(AzureResourceItemType.subscription);

		const nodeInfo = subscriptionTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(mockSubscription.name);
		should(nodeInfo.isLeaf).equal(false);
		should(nodeInfo.nodeType).equal(AzureResourceItemType.subscription);
		should(nodeInfo.iconType).equal(AzureResourceItemType.subscription);
	});
});

describe('AzureResourceSubscriptionTreeNode.getChildren', function(): void {
	beforeEach(() => {
		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();
	});

	it('Should load database containers.', async function(): Promise<void> {
		const subscriptionTreeNode = new AzureResourceSubscriptionTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);
		const children = await subscriptionTreeNode.getChildren();

		should(children).Array();
		should(children.length).equal(2);
		should(children[0]).instanceof(AzureResourceDatabaseContainerTreeNode);
		should(children[1]).instanceof(AzureResourceDatabaseServerContainerTreeNode);
	});
});
