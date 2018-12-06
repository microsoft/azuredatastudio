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

import { ApiWrapper } from '../../../../apiWrapper';
import { IAzureResourceDatabaseServerService } from '../../../../azureResource/providers/databaseServer/interfaces';
import { AzureResourceDatabaseServerTreeDataProvider } from '../../../../azureResource/providers/databaseServer/databaseServerTreeDataProvider';

// Mock services
let mockDatabaseServerService: TypeMoq.IMock<IAzureResourceDatabaseServerService>;
let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;


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

const mockSubscription: sqlops.azureResource.AzureResourceSubscription = {
	id: 'mock_subscription',
	name: 'mock subscription'
};

const mockTenantId: string = 'mock_tenant';

const mockResourceRootNode: sqlops.azureResource.IAzureResourceNode = {
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

const mockResourceNode1: sqlops.azureResource.IAzureResourceNode = {
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

const mockResourceNode2: sqlops.azureResource.IAzureResourceNode = {
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

const mockResourceNodes: sqlops.azureResource.IAzureResourceNode[] = [mockResourceNode1, mockResourceNode2];

describe('AzureResourceDatabaseServerTreeDataProvider.info', function(): void {
	beforeEach(() => {
		mockDatabaseServerService = TypeMoq.Mock.ofType<IAzureResourceDatabaseServerService>();
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
	});

	it('Should be correct when created.', async function(): Promise<void> {
		const treeDataProvider = new AzureResourceDatabaseServerTreeDataProvider(mockDatabaseServerService.object, mockApiWrapper.object, mockExtensionContext.object);

		const treeItem = await treeDataProvider.getTreeItem(mockResourceRootNode);
		should(treeItem.id).equal(mockResourceRootNode.treeItem.id);
		should(treeItem.label).equal(mockResourceRootNode.treeItem.label);
		should(treeItem.collapsibleState).equal(mockResourceRootNode.treeItem.collapsibleState);
		should(treeItem.contextValue).equal(mockResourceRootNode.treeItem.contextValue);
	});
});

describe('AzureResourceDatabaseServerTreeDataProvider.getChildren', function(): void {
	beforeEach(() => {
		mockDatabaseServerService = TypeMoq.Mock.ofType<IAzureResourceDatabaseServerService>();
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
	});

	it('Should return container node when element is undefined.', async function(): Promise<void> {
		const treeDataProvider = new AzureResourceDatabaseServerTreeDataProvider(mockDatabaseServerService.object, mockApiWrapper.object, mockExtensionContext.object);

		const children = await treeDataProvider.getChildren();

		should(children).Array();
		should(children.length).equal(1);

		const child = children[0];
		should(child.account).null();
		should(child.subscription).null();
		should(child.tenantId).null();
		should(child.treeItem.id).equal('azure.resource.providers.databaseServer.treeDataProvider.databaseServerContainer');
		should(child.treeItem.label).equal('SQL Servers');
		should(child.treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);
		should(child.treeItem.contextValue).equal('azure.resource.itemType.databaseServerContainer');
	});

	it('Should return resource nodes when it is container node.', async function(): Promise<void> {
		const treeDataProvider = new AzureResourceDatabaseServerTreeDataProvider(mockDatabaseServerService.object, mockApiWrapper.object, mockExtensionContext.object);

		const children = await treeDataProvider.getChildren(mockResourceRootNode);

		should(children).Array();
		should(children.length).equal(mockResourceNodes.length);

		for (let ix = 0; ix < children.length; ix++) {
			const child = children[ix];
			should(child.account).equal(mockAccount);
			should(child.subscription).equal(mockSubscription);
			should(child.tenantId).equal(mockTenantId);
			should(child.treeItem.id).equal(mockResourceNodes[ix].treeItem.id);
			should(child.treeItem.label).equal(mockResourceNodes[ix].treeItem.label);
			should(child.treeItem.collapsibleState).equal(mockResourceNodes[ix].treeItem.collapsibleState);
			should(child.treeItem.contextValue).equal(mockResourceNodes[ix].treeItem.contextValue);
		}
	});
});
