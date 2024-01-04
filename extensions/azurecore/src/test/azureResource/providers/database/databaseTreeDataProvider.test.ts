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

import { AzureResourceDatabaseTreeDataProvider } from '../../../../azureResource/providers/database/databaseTreeDataProvider';
import { AzureResourceItemType } from '../../../../azureResource/constants';
import { AzureAccount, azureResource } from 'azurecore';
import settings from '../../../../account-provider/providerSettings';
import { DATABASE_PROVIDER_ID } from '../../../../constants';

// Mock services
let mockDatabaseService: TypeMoq.IMock<azureResource.IAzureResourceService>;
let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;

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
		iconPath: undefined,
		collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
		contextValue: 'mock_resource_root_node'
	}
};

const mockToken = {
	token: 'mock_token',
	tokenType: 'Bearer'
};

const mockDatabases: azureResource.AzureResourceDatabase[] = [
	{
		name: 'mock database 1',
		id: 'mock-id-1',
		provider: DATABASE_PROVIDER_ID,
		tenant: 'mockTenantId',
		serverName: 'mock database server 1',
		serverFullName: 'mock database server full name 1',
		loginName: 'mock login',
		subscription: {
			id: 'mock_subscription',
			name: 'mock_subscription'
		},
		resourceGroup: 'rg1'
	},
	{
		name: 'mock database 2',
		id: 'mock-id-2',
		provider: DATABASE_PROVIDER_ID,
		tenant: 'mockTenantId',
		serverName: 'mock database server 2',
		serverFullName: 'mock database server full name 2',
		loginName: 'mock login',
		subscription: {
			id: 'mock_subscription',
			name: 'mock_subscription'
		},
		resourceGroup: 'rg2'
	}
];

describe('AzureResourceDatabaseTreeDataProvider.info', function (): void {
	beforeEach(() => {
		mockDatabaseService = TypeMoq.Mock.ofType<azureResource.IAzureResourceService>();
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

describe('AzureResourceDatabaseTreeDataProvider.getChildren', function (): void {
	beforeEach(() => {
		mockDatabaseService = TypeMoq.Mock.ofType<azureResource.IAzureResourceService>();
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();

		sinon.stub(azdata.accounts, 'getAccountSecurityToken').returns(Promise.resolve(mockToken));
		mockDatabaseService.setup((o) => o.getResources([mockSubscription], TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(mockDatabases));
		mockExtensionContext.setup((o) => o.asAbsolutePath(TypeMoq.It.isAnyString())).returns(() => TypeMoq.It.isAnyString());
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should return container node when element is undefined.', async function (): Promise<void> {
		const treeDataProvider = new AzureResourceDatabaseTreeDataProvider(mockDatabaseService.object, mockExtensionContext.object);

		const child = await treeDataProvider.getRootChild();

		should(child).Object();
		should(child.id).equal('azure.resource.providers.database.treeDataProvider.databaseContainer');
		should(child.label).equal('SQL databases');
		should(child.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);
		should(child.contextValue).equal('azure.resource.itemType.databaseContainer');
	});

	it('Should return resource nodes when it is container node.', async function (): Promise<void> {
		const treeDataProvider = new AzureResourceDatabaseTreeDataProvider(mockDatabaseService.object, mockExtensionContext.object);

		const children = await treeDataProvider.getChildren(mockResourceRootNode);

		should(children).Array();
		should(children.length).equal(mockDatabases.length);

		for (let ix = 0; ix < children.length; ix++) {
			const child = children[ix];
			const database = mockDatabases[ix];

			should(child.account).equal(mockAccount);
			should(child.subscription).equal(mockSubscription);
			should(child.tenantId).equal(mockTenantId);
			should(child.treeItem.id).equal(`database_${mockAccount.key.accountId}${database.tenant}${database.serverFullName}.database_${database.id}`);
			should(child.treeItem.label).equal(`${database.name} (${database.serverName})`);
			should(child.treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);
			should(child.treeItem.contextValue).equal(AzureResourceItemType.database);

			// Authentication type should be empty string by default to support setting 'Sql: Default Authentication Type'.
			should(child.treeItem.payload!.authenticationType).equal('');
		}
	});
});
