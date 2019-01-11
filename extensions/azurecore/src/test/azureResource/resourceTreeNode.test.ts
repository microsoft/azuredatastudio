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

import { azureResource } from '../../azureResource/azure-resource';
import { AzureResourceService } from '../../azureResource/resourceService';
import { AzureResourceResourceTreeNode } from '../../azureResource/resourceTreeNode';

const resourceService = AzureResourceService.getInstance();

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

const mockSubscription: azureResource.AzureResourceSubscription = {
	id: 'mock_subscription',
	name: 'mock subscription'
};

const mockTenantId: string = 'mock_tenant';

const mockResourceProviderId: string = 'mock_resource_provider';

const mockResourceRootNode: azureResource.IAzureResourceNode = {
	account: mockAccount,
	subscription: mockSubscription,
	tenantId: mockTenantId,
	treeItem: {
		id: 'mock_resource_root_node',
		label: 'mock resource root node',
		iconPath: undefined,
		collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
		contextValue: 'mock_resource_root_node'
	}
};

const mockResourceNode1: azureResource.IAzureResourceNode = {
	account: mockAccount,
	subscription: mockSubscription,
	tenantId: mockTenantId,
	treeItem: {
		id: 'mock_resource_node_1',
		label: 'mock resource node 1',
		iconPath: undefined,
		collapsibleState: vscode.TreeItemCollapsibleState.None,
		contextValue: 'mock_resource_node'
	}
};

const mockResourceNode2: azureResource.IAzureResourceNode = {
	account: mockAccount,
	subscription: mockSubscription,
	tenantId: mockTenantId,
	treeItem: {
		id: 'mock_resource_node_2',
		label: 'mock resource node 2',
		iconPath: undefined,
		collapsibleState: vscode.TreeItemCollapsibleState.None,
		contextValue: 'mock_resource_node'
	}
};

const mockResourceNodes: azureResource.IAzureResourceNode[] = [mockResourceNode1, mockResourceNode2];

let mockResourceTreeDataProvider: TypeMoq.IMock<azureResource.IAzureResourceTreeDataProvider>;
let mockResourceProvider: TypeMoq.IMock<azureResource.IAzureResourceProvider>;

describe('AzureResourceResourceTreeNode.info', function(): void {
	beforeEach(() => {
		mockResourceTreeDataProvider = TypeMoq.Mock.ofType<azureResource.IAzureResourceTreeDataProvider>();
		mockResourceTreeDataProvider.setup((o) => o.getTreeItem(mockResourceRootNode)).returns(() => mockResourceRootNode.treeItem);
		mockResourceTreeDataProvider.setup((o) => o.getChildren(mockResourceRootNode)).returns(() => Promise.resolve(mockResourceNodes));

		mockResourceProvider = TypeMoq.Mock.ofType<azureResource.IAzureResourceProvider>();
		mockResourceProvider.setup((o) => o.providerId).returns(() => mockResourceProviderId);
		mockResourceProvider.setup((o) => o.getTreeDataProvider()).returns(() => mockResourceTreeDataProvider.object);

		resourceService.clearResourceProviders();
		resourceService.registerResourceProvider(mockResourceProvider.object);

		resourceService.areResourceProvidersLoaded = true;
	});

	it('Should be correct when created.', async function(): Promise<void> {
		const resourceTreeNode = new AzureResourceResourceTreeNode({
			resourceProviderId: mockResourceProviderId,
			resourceNode: mockResourceRootNode
		}, undefined);

		should(resourceTreeNode.nodePathValue).equal(mockResourceRootNode.treeItem.id);

		const treeItem = await resourceTreeNode.getTreeItem();
		should(treeItem.id).equal(mockResourceRootNode.treeItem.id);
		should(treeItem.label).equal(mockResourceRootNode.treeItem.label);
		should(treeItem.collapsibleState).equal(mockResourceRootNode.treeItem.collapsibleState);
		should(treeItem.contextValue).equal(mockResourceRootNode.treeItem.contextValue);

		const nodeInfo = resourceTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(mockResourceRootNode.treeItem.label);
		should(nodeInfo.isLeaf).equal(mockResourceRootNode.treeItem.collapsibleState === vscode.TreeItemCollapsibleState.None);
		should(nodeInfo.nodeType).equal(mockResourceRootNode.treeItem.contextValue);
		should(nodeInfo.iconType).equal(mockResourceRootNode.treeItem.contextValue);
	});
});

describe('AzureResourceResourceTreeNode.getChildren', function(): void {
	beforeEach(() => {
		mockResourceTreeDataProvider = TypeMoq.Mock.ofType<azureResource.IAzureResourceTreeDataProvider>();
		mockResourceTreeDataProvider.setup((o) => o.getChildren(mockResourceRootNode)).returns(() => Promise.resolve(mockResourceNodes));

		mockResourceProvider = TypeMoq.Mock.ofType<azureResource.IAzureResourceProvider>();
		mockResourceProvider.setup((o) => o.providerId).returns(() => mockResourceProviderId);
		mockResourceProvider.setup((o) => o.getTreeDataProvider()).returns(() => mockResourceTreeDataProvider.object);

		resourceService.clearResourceProviders();
		resourceService.registerResourceProvider(mockResourceProvider.object);

		resourceService.areResourceProvidersLoaded = true;
	});

	it('Should return resource nodes when it is container node.', async function(): Promise<void> {
		const resourceTreeNode = new AzureResourceResourceTreeNode({
			resourceProviderId: mockResourceProviderId,
			resourceNode: mockResourceRootNode
		}, undefined);

		const children = await resourceTreeNode.getChildren();

		mockResourceTreeDataProvider.verify((o) => o.getChildren(mockResourceRootNode), TypeMoq.Times.once());

		should(children).Array();
		should(children.length).equal(mockResourceNodes.length);

		for (let ix = 0; ix < children.length; ix++) {
			const child = children[ix];

			should(child).instanceOf(AzureResourceResourceTreeNode);

			const childNode = (child as AzureResourceResourceTreeNode).resourceNodeWithProviderId;
			should(childNode.resourceProviderId).equal(mockResourceProviderId);
			should(childNode.resourceNode.account).equal(mockAccount);
			should(childNode.resourceNode.subscription).equal(mockSubscription);
			should(childNode.resourceNode.tenantId).equal(mockTenantId);
			should(childNode.resourceNode.treeItem.id).equal(mockResourceNodes[ix].treeItem.id);
			should(childNode.resourceNode.treeItem.label).equal(mockResourceNodes[ix].treeItem.label);
			should(childNode.resourceNode.treeItem.collapsibleState).equal(mockResourceNodes[ix].treeItem.collapsibleState);
			should(childNode.resourceNode.treeItem.contextValue).equal(mockResourceNodes[ix].treeItem.contextValue);
		}
	});

	it('Should return empty when it is leaf node.', async function(): Promise<void> {
		const resourceTreeNode = new AzureResourceResourceTreeNode({
			resourceProviderId: mockResourceProviderId,
			resourceNode: mockResourceNode1
		}, undefined);

		const children = await resourceTreeNode.getChildren();

		mockResourceTreeDataProvider.verify((o) => o.getChildren(), TypeMoq.Times.exactly(0));

		should(children).Array();
		should(children.length).equal(0);
	});
});
