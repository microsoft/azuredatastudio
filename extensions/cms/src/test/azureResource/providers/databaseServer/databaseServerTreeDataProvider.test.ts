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

import { azureResource } from '../../../../azureResource/azure-resource';
import { ApiWrapper } from '../../../../apiWrapper';
import { IAzureResourceDatabaseServerService } from '../../../../azureResource/providers/databaseServer/interfaces';
import { AzureResourceDatabaseServerTreeDataProvider } from '../../../../azureResource/providers/databaseServer/databaseServerTreeDataProvider';
import { AzureResourceDatabaseServer } from '../../../../azureResource/providers/databaseServer/models';
import { AzureResourceItemType } from '../../../../azureResource/constants';

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

const mockSubscription: azureResource.AzureResourceSubscription = {
	id: 'mock_subscription',
	name: 'mock subscription'
};

const mockTenantId: string = 'mock_tenant';

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

const mockTokens = {};
mockTokens[mockTenantId] = {
	token: 'mock_token',
	tokenType: 'Bearer'
};

const mockDatabaseServers: AzureResourceDatabaseServer[] = [
	{
		name: 'mock database server 1',
		fullName: 'mock database server full name 1',
		loginName: 'mock login',
		defaultDatabaseName: 'master'
	},
	{
		name: 'mock database server 2',
		fullName: 'mock database server full name 2',
		loginName: 'mock login',
		defaultDatabaseName: 'master'
	}
];

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

		mockApiWrapper.setup((o) => o.getSecurityToken(mockAccount, sqlops.AzureResource.ResourceManagement)).returns(() => Promise.resolve(mockTokens));
		mockDatabaseServerService.setup((o) => o.getDatabaseServers(mockSubscription, TypeMoq.It.isAny())).returns(() => Promise.resolve(mockDatabaseServers));
		mockExtensionContext.setup((o) => o.asAbsolutePath(TypeMoq.It.isAnyString())).returns(() => TypeMoq.It.isAnyString());
	});

	it('Should return container node when element is undefined.', async function(): Promise<void> {
		const treeDataProvider = new AzureResourceDatabaseServerTreeDataProvider(mockDatabaseServerService.object, mockApiWrapper.object, mockExtensionContext.object);

		const children = await treeDataProvider.getChildren();

		should(children).Array();
		should(children.length).equal(1);

		const child = children[0];
		should(child.account).undefined();
		should(child.subscription).undefined();
		should(child.tenantId).undefined();
		should(child.treeItem.id).equal('azure.resource.providers.databaseServer.treeDataProvider.databaseServerContainer');
		should(child.treeItem.label).equal('SQL Servers');
		should(child.treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);
		should(child.treeItem.contextValue).equal('azure.resource.itemType.databaseServerContainer');
	});

	it('Should return resource nodes when it is container node.', async function(): Promise<void> {
		const treeDataProvider = new AzureResourceDatabaseServerTreeDataProvider(mockDatabaseServerService.object, mockApiWrapper.object, mockExtensionContext.object);

		const children = await treeDataProvider.getChildren(mockResourceRootNode);

		should(children).Array();
		should(children.length).equal(mockDatabaseServers.length);

		for (let ix = 0; ix < children.length; ix++) {
			const child = children[ix];
			const databaseServer = mockDatabaseServers[ix];

			should(child.account).equal(mockAccount);
			should(child.subscription).equal(mockSubscription);
			should(child.tenantId).equal(mockTenantId);
			should(child.treeItem.id).equal(`databaseServer_${databaseServer.name}`);
			should(child.treeItem.label).equal(databaseServer.name);
			should(child.treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.None);
			should(child.treeItem.contextValue).equal(AzureResourceItemType.databaseServer);
		}
	});
});
