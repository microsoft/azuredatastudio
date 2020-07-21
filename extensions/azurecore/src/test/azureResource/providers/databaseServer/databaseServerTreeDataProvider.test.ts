/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import 'mocha';

import { azureResource } from '../../../../azureResource/azure-resource';
import { AzureResourceDatabaseServerTreeDataProvider } from '../../../../azureResource/providers/databaseServer/databaseServerTreeDataProvider';
import { AzureResourceItemType } from '../../../../azureResource/constants';
import { IAzureResourceService } from '../../../../azureResource/interfaces';

// Mock services
let mockDatabaseServerService: TypeMoq.IMock<IAzureResourceService<azureResource.AzureResourceDatabaseServer>>;
let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
import settings from '../../../../account-provider/providerSettings';
import { AzureAccount } from '../../../../account-provider/interfaces';

// Mock test data
const mockAccount: AzureAccount = {
	key: {
		accountId: 'mock_account',
		providerId: 'mock_provider'
	},
	displayInfo: {
		displayName: 'mock_account@test.com',
		accountType: 'Microsoft',
		contextualDisplayName: 'test',
		userId: 'test@email.com'
	},
	properties: {
		providerSettings: settings[0].metadata,
		isMsAccount: true,
		tenants: []
	},
	isStale: false
};

const mockTenantId: string = 'mock_tenant';

const mockSubscription: azureResource.AzureResourceSubscription = {
	id: 'mock_subscription',
	name: 'mock subscription',
	tenant: mockTenantId
};


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

const mockToken = {
	token: 'mock_token',
	tokenType: 'Bearer'
};

const mockDatabaseServers: azureResource.AzureResourceDatabaseServer[] = [
	{
		name: 'mock database server 1',
		id: 'mock-id-1',
		fullName: 'mock database server full name 1',
		loginName: 'mock login',
		defaultDatabaseName: 'master'
	},
	{
		name: 'mock database server 2',
		id: 'mock-id-2',
		fullName: 'mock database server full name 2',
		loginName: 'mock login',
		defaultDatabaseName: 'master'
	}
];

describe('AzureResourceDatabaseServerTreeDataProvider.info', function (): void {
	beforeEach(() => {
		mockDatabaseServerService = TypeMoq.Mock.ofType<IAzureResourceService<azureResource.AzureResourceDatabaseServer>>();
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
	});

	it('Should be correct when created.', async function (): Promise<void> {
		const treeDataProvider = new AzureResourceDatabaseServerTreeDataProvider(mockDatabaseServerService.object, mockExtensionContext.object);

		const treeItem = await treeDataProvider.getTreeItem(mockResourceRootNode);
		should(treeItem.id).equal(mockResourceRootNode.treeItem.id);
		should(treeItem.label).equal(mockResourceRootNode.treeItem.label);
		should(treeItem.collapsibleState).equal(mockResourceRootNode.treeItem.collapsibleState);
		should(treeItem.contextValue).equal(mockResourceRootNode.treeItem.contextValue);
	});
});

describe('AzureResourceDatabaseServerTreeDataProvider.getChildren', function (): void {
	beforeEach(() => {
		mockDatabaseServerService = TypeMoq.Mock.ofType<IAzureResourceService<azureResource.AzureResourceDatabaseServer>>();
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();

		sinon.stub(azdata.accounts, 'getAccountSecurityToken').returns(Promise.resolve(mockToken));
		mockDatabaseServerService.setup((o) => o.getResources(mockSubscription, TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(mockDatabaseServers));
		mockExtensionContext.setup((o) => o.asAbsolutePath(TypeMoq.It.isAnyString())).returns(() => TypeMoq.It.isAnyString());
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should return container node when element is undefined.', async function (): Promise<void> {
		const treeDataProvider = new AzureResourceDatabaseServerTreeDataProvider(mockDatabaseServerService.object, mockExtensionContext.object);

		const children = await treeDataProvider.getChildren();

		should(children).Array();
		should(children.length).equal(1);

		const child = children[0];
		should(child.account).undefined();
		should(child.subscription).undefined();
		should(child.tenantId).undefined();
		should(child.treeItem.id).equal('azure.resource.providers.databaseServer.treeDataProvider.databaseServerContainer');
		should(child.treeItem.label).equal('SQL server');
		should(child.treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);
		should(child.treeItem.contextValue).equal('azure.resource.itemType.databaseServerContainer');
	});

	it('Should return resource nodes when it is container node.', async function (): Promise<void> {
		const treeDataProvider = new AzureResourceDatabaseServerTreeDataProvider(mockDatabaseServerService.object, mockExtensionContext.object);

		const children = await treeDataProvider.getChildren(mockResourceRootNode);

		should(children).Array();
		should(children.length).equal(mockDatabaseServers.length);

		for (let ix = 0; ix < children.length; ix++) {
			const child = children[ix];
			const databaseServer = mockDatabaseServers[ix];

			should(child.account).equal(mockAccount);
			should(child.subscription).equal(mockSubscription);
			should(child.tenantId).equal(mockTenantId);
			should(child.treeItem.id).equal(`databaseServer_${databaseServer.id}`);
			should(child.treeItem.label).equal(databaseServer.name);
			should(child.treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);
			should(child.treeItem.contextValue).equal(AzureResourceItemType.databaseServer);
		}
	});
});
