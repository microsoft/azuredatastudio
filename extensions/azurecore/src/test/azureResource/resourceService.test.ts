/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import 'mocha';
import { fail } from 'assert';
import * as azdata from 'azdata';
import * as vscode from 'vscode';

import { AzureResourceService } from '../../azureResource/resourceService';
import { AzureAccount, azureResource } from 'azurecore';
import settings from '../../account-provider/providerSettings';

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

let mockResourceTreeDataProvider1: TypeMoq.IMock<azureResource.IAzureResourceTreeDataProvider>;
let mockResourceProvider1: TypeMoq.IMock<azureResource.IAzureResourceProvider>;

let mockResourceTreeDataProvider2: TypeMoq.IMock<azureResource.IAzureResourceTreeDataProvider>;
let mockResourceProvider2: TypeMoq.IMock<azureResource.IAzureResourceProvider>;

const mockResourceProviderId1: string = 'mock_resource_provider';
const mockResourceNode1: azureResource.IAzureResourceNode = {
	account: mockAccount,
	subscription: mockSubscription,
	tenantId: mockTenantId,
	resourceProviderId: mockResourceProviderId1,
	treeItem: {
		id: 'mock_resource_node_1',
		label: 'mock resource node 1',
		iconPath: undefined,
		collapsibleState: vscode.TreeItemCollapsibleState.None,
		contextValue: 'mock_resource_node'
	}
};

let resourceService: AzureResourceService;

describe('AzureResourceService.listResourceProviderIds', function (): void {
	beforeEach(() => {
		mockResourceTreeDataProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceTreeDataProvider>();
		mockResourceTreeDataProvider1.setup((o) => o.getRootChild()).returns(() => Promise.resolve(TypeMoq.Mock.ofType<azdata.TreeItem>().object));
		mockResourceProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceProvider>();
		mockResourceProvider1.setup((o) => o.providerId).returns(() => 'mockResourceProvider1');
		mockResourceProvider1.setup((o) => o.getTreeDataProvider()).returns(() => mockResourceTreeDataProvider1.object);

		mockResourceTreeDataProvider2 = TypeMoq.Mock.ofType<azureResource.IAzureResourceTreeDataProvider>();
		mockResourceTreeDataProvider2.setup((o) => o.getRootChild()).returns(() => Promise.resolve(TypeMoq.Mock.ofType<azdata.TreeItem>().object));
		mockResourceProvider2 = TypeMoq.Mock.ofType<azureResource.IAzureResourceProvider>();
		mockResourceProvider2.setup((o) => o.providerId).returns(() => 'mockResourceProvider2');
		mockResourceProvider2.setup((o) => o.getTreeDataProvider()).returns(() => mockResourceTreeDataProvider2.object);

		resourceService = new AzureResourceService();
		resourceService.clearResourceProviders();
		resourceService.areResourceProvidersLoaded = true;
	});

	it('Should be correct when registering providers.', async function (): Promise<void> {
		resourceService.registerResourceProvider(mockResourceProvider1.object);
		let providerIds = await resourceService.listResourceProviderIds();
		should(providerIds).Array();
		should(providerIds.length).equal(1);
		should(providerIds[0]).equal(mockResourceProvider1.object.providerId);

		resourceService.registerResourceProvider(mockResourceProvider2.object);
		providerIds = await resourceService.listResourceProviderIds();
		should(providerIds).Array();
		should(providerIds.length).equal(2);
		should(providerIds[0]).equal(mockResourceProvider1.object.providerId);
		should(providerIds[1]).equal(mockResourceProvider2.object.providerId);
	});
});

describe('AzureResourceService.getRootChildren', function (): void {
	beforeEach(() => {
		mockResourceTreeDataProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceTreeDataProvider>();
		mockResourceTreeDataProvider1.setup((o) => o.getRootChild()).returns(() => Promise.resolve(mockResourceNode1.treeItem));
		mockResourceProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceProvider>();
		mockResourceProvider1.setup((o) => o.providerId).returns(() => mockResourceProviderId1);
		mockResourceProvider1.setup((o) => o.getTreeDataProvider()).returns(() => mockResourceTreeDataProvider1.object);

		resourceService.clearResourceProviders();
		resourceService.registerResourceProvider(mockResourceProvider1.object);
		resourceService.areResourceProvidersLoaded = true;
	});

	it('Should be correct when provider id is correct.', async function (): Promise<void> {
		const child = await resourceService.getRootChild(mockResourceProvider1.object.providerId, mockAccount, mockSubscription);
		should(child).Object();
	});

	it('Should throw exceptions when provider id is incorrect.', async function (): Promise<void> {
		const providerId = 'non_existent_provider_id';
		try {
			await resourceService.getRootChild(providerId, mockAccount, mockSubscription);
		} catch (error) {
			should(error.message).equal(`Azure resource provider doesn't exist. Id: ${providerId}`);
			return;
		}

		fail();
	});
});

describe('AzureResourceService.getChildren', function (): void {
	beforeEach(() => {
		mockResourceTreeDataProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceTreeDataProvider>();
		mockResourceTreeDataProvider1.setup((o) => o.getRootChild()).returns(() => Promise.resolve(TypeMoq.Mock.ofType<azdata.TreeItem>().object));
		mockResourceTreeDataProvider1.setup((o) => o.getChildren(TypeMoq.It.isAny())).returns(() => Promise.resolve([TypeMoq.Mock.ofType<azureResource.IAzureResourceNode>().object]));
		mockResourceProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceProvider>();
		mockResourceProvider1.setup((o) => o.providerId).returns(() => 'mockResourceProvider1');
		mockResourceProvider1.setup((o) => o.getTreeDataProvider()).returns(() => mockResourceTreeDataProvider1.object);

		resourceService.clearResourceProviders();
		resourceService.registerResourceProvider(mockResourceProvider1.object);
		resourceService.areResourceProvidersLoaded = true;
	});

	it('Should be correct when provider id is correct.', async function (): Promise<void> {
		const children = await resourceService.getChildren(mockResourceProvider1.object.providerId, TypeMoq.It.isAny());
		should(children).Array();
	});

	it('Should throw exceptions when provider id is incorrect.', async function (): Promise<void> {
		const providerId = 'non_existent_provider_id';
		try {
			await resourceService.getRootChild(providerId, mockAccount, mockSubscription);
		} catch (error) {
			should(error.message).equal(`Azure resource provider doesn't exist. Id: ${providerId}`);
			return;
		}

		fail();
	});
});
