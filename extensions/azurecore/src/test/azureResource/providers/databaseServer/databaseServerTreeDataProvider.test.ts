/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import 'mocha';

import { AzureResourceDatabaseServerTreeDataProvider } from '../../../../azureResource/providers/databaseServer/databaseServerTreeDataProvider';
import { AzureResourceItemType } from '../../../../azureResource/constants';

// Mock services
let mockDatabaseServerService: TypeMoq.IMock<azureResource.IAzureResourceService>;
let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
import settings from '../../../../account-provider/providerSettings';
import { AzureAccount, azureResource } from 'azurecore';
import { DATABASE_SERVER_PROVIDER_ID } from '../../../../constants';

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
		owningTenant: {
			id: 'tenantId',
			displayName: 'tenantDisplayName',
		},
		tenants: []
	},
	isStale: false
};

const mockTenantId: string = 'mock_tenant';
const mockSubscriptionId = 'mock_subscription';
const mockSubscription: azureResource.AzureResourceSubscription = {
	id: mockSubscriptionId,
	name: 'mock subscription',
	tenant: mockTenantId
};


const mockResourceRootNode: azureResource.IAzureResourceNode = {
	account: mockAccount,
	subscription: mockSubscription,
	tenantId: mockTenantId,
	resourceProviderId: 'mock_resource_provider',
	treeItem: {
		id: 'mock_resource_root_node',
		label: 'mock resource root node',
		iconPath: '',
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
		provider: DATABASE_SERVER_PROVIDER_ID,
		tenant: 'mockTenantId',
		fullName: 'mock database server full name 1',
		loginName: 'mock login',
		defaultDatabaseName: 'master',
		subscription: {
			id: 'mock_subscription',
			name: 'mock_subscription'
		},
		resourceGroup: 'rg1'
	},
	{
		name: 'mock database server 2',
		id: 'mock-id-2',
		provider: DATABASE_SERVER_PROVIDER_ID,
		tenant: 'mockTenantId',
		fullName: 'mock database server full name 2',
		loginName: 'mock login',
		defaultDatabaseName: 'master',
		subscription: {
			id: 'mock_subscription',
			name: 'mock_subscription'
		},
		resourceGroup: 'rg2'
	}
];

describe('AzureResourceDatabaseServerTreeDataProvider.info', function (): void {
	beforeEach(() => {
		mockDatabaseServerService = TypeMoq.Mock.ofType<azureResource.IAzureResourceService>();
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
	});

	it('Should be correct when created.', async function (): Promise<void> {
		const treeItem = mockResourceRootNode.treeItem;
		should(treeItem.id).equal(mockResourceRootNode.treeItem.id);
		should(treeItem.label).equal(mockResourceRootNode.treeItem.label);
		should(treeItem.collapsibleState).equal(mockResourceRootNode.treeItem.collapsibleState);
		should(treeItem.contextValue).equal(mockResourceRootNode.treeItem.contextValue);
	});
});

describe('AzureResourceDatabaseServerTreeDataProvider.getChildren', function (): void {
	beforeEach(() => {
		mockDatabaseServerService = TypeMoq.Mock.ofType<azureResource.IAzureResourceService>();
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();

		sinon.stub(azdata.accounts, 'getAccountSecurityToken').returns(Promise.resolve(mockToken));
		mockDatabaseServerService.setup((o) => o.getResources([mockSubscription], TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(mockDatabaseServers));
		mockExtensionContext.setup((o) => o.asAbsolutePath(TypeMoq.It.isAnyString())).returns(() => TypeMoq.It.isAnyString());
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should return container node when element is undefined.', async function (): Promise<void> {
		const treeDataProvider = new AzureResourceDatabaseServerTreeDataProvider(mockDatabaseServerService.object, mockExtensionContext.object);

		const child = await treeDataProvider.getRootChild();

		should(child).Object();
		should(child.id).equal('azure.resource.providers.databaseServer.treeDataProvider.databaseServerContainer');
		should(child.label).equal('SQL servers');
		should(child.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);
		should(child.contextValue).equal('azure.resource.itemType.databaseServerContainer');
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
			should(child.treeItem.id).equal(`databaseServer_${mockAccount.key.accountId}${databaseServer.tenant}${databaseServer.id}`);
			should(child.treeItem.label).equal(databaseServer.name);
			should(child.treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);
			should(child.treeItem.contextValue).equal(AzureResourceItemType.databaseServer);

			// Authentication type should be empty string by default to support setting 'Sql: Default Authentication Type'.
			should(child.treeItem.payload!.authenticationType).equal('');
		}
	});
});
