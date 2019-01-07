/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as sqlops from 'sqlops';
import 'mocha';
import { fail } from 'assert';

import { azureResource } from '../../azureResource/azure-resource';
import { AzureResourceService } from '../../azureResource/resourceService';

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

let mockResourceTreeDataProvider1: TypeMoq.IMock<azureResource.IAzureResourceTreeDataProvider>;
let mockResourceProvider1: TypeMoq.IMock<azureResource.IAzureResourceProvider>;

let mockResourceTreeDataProvider2: TypeMoq.IMock<azureResource.IAzureResourceTreeDataProvider>;
let mockResourceProvider2: TypeMoq.IMock<azureResource.IAzureResourceProvider>;

const resourceService: AzureResourceService = AzureResourceService.getInstance();

describe('AzureResourceService.listResourceProviderIds', function(): void {
	beforeEach(() => {
		mockResourceTreeDataProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceTreeDataProvider>();
		mockResourceTreeDataProvider1.setup((o) => o.getChildren()).returns(() => Promise.resolve([TypeMoq.Mock.ofType<azureResource.IAzureResourceNode>().object]));
		mockResourceTreeDataProvider1.setup((o) => o.getTreeItem(TypeMoq.It.isAny())).returns(() => Promise.resolve(TypeMoq.It.isAny()));
		mockResourceProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceProvider>();
		mockResourceProvider1.setup((o) => o.providerId).returns(() => 'mockResourceProvider1');
		mockResourceProvider1.setup((o) => o.getTreeDataProvider()).returns(() => mockResourceTreeDataProvider1.object);

		mockResourceTreeDataProvider2 = TypeMoq.Mock.ofType<azureResource.IAzureResourceTreeDataProvider>();
		mockResourceTreeDataProvider2.setup((o) => o.getChildren()).returns(() => Promise.resolve([TypeMoq.Mock.ofType<azureResource.IAzureResourceNode>().object]));
		mockResourceTreeDataProvider2.setup((o) => o.getTreeItem(TypeMoq.It.isAny())).returns(() => Promise.resolve(TypeMoq.It.isAny()));
		mockResourceProvider2 = TypeMoq.Mock.ofType<azureResource.IAzureResourceProvider>();
		mockResourceProvider2.setup((o) => o.providerId).returns(() => 'mockResourceProvider2');
		mockResourceProvider2.setup((o) => o.getTreeDataProvider()).returns(() => mockResourceTreeDataProvider2.object);

		resourceService.clearResourceProviders();
		resourceService.areResourceProvidersLoaded = true;
	});

	it('Should be correct when registering providers.', async function(): Promise<void> {
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

describe('AzureResourceService.getRootChildren', function(): void {
	beforeEach(() => {
		mockResourceTreeDataProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceTreeDataProvider>();
		mockResourceTreeDataProvider1.setup((o) => o.getChildren()).returns(() => Promise.resolve([TypeMoq.Mock.ofType<azureResource.IAzureResourceNode>().object]));
		mockResourceTreeDataProvider1.setup((o) => o.getTreeItem(TypeMoq.It.isAny())).returns(() => Promise.resolve(TypeMoq.It.isAny()));
		mockResourceProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceProvider>();
		mockResourceProvider1.setup((o) => o.providerId).returns(() => 'mockResourceProvider1');
		mockResourceProvider1.setup((o) => o.getTreeDataProvider()).returns(() => mockResourceTreeDataProvider1.object);

		resourceService.clearResourceProviders();
		resourceService.registerResourceProvider(mockResourceProvider1.object);
		resourceService.areResourceProvidersLoaded = true;
	});

	it('Should be correct when provider id is correct.', async function(): Promise<void> {
		const children = await resourceService.getRootChildren(mockResourceProvider1.object.providerId, mockAccount, mockSubscription, mockTenantId);

		should(children).Array();
	});

	it('Should throw exceptions when provider id is incorrect.', async function(): Promise<void> {
		const providerId = 'non_existent_provider_id';
		try {
			await resourceService.getRootChildren(providerId, mockAccount, mockSubscription, mockTenantId);
		} catch (error) {
			should(error.message).equal(`Azure resource provider doesn't exist. Id: ${providerId}`);
			return;
		}

		fail();
	});
});

describe('AzureResourceService.getChildren', function(): void {
	beforeEach(() => {
		mockResourceTreeDataProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceTreeDataProvider>();
		mockResourceTreeDataProvider1.setup((o) => o.getChildren()).returns(() => Promise.resolve([TypeMoq.Mock.ofType<azureResource.IAzureResourceNode>().object]));
		mockResourceTreeDataProvider1.setup((o) => o.getChildren(TypeMoq.It.isAny())).returns(() => Promise.resolve([TypeMoq.Mock.ofType<azureResource.IAzureResourceNode>().object]));
		mockResourceTreeDataProvider1.setup((o) => o.getTreeItem(TypeMoq.It.isAny())).returns(() => Promise.resolve(TypeMoq.It.isAny()));
		mockResourceProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceProvider>();
		mockResourceProvider1.setup((o) => o.providerId).returns(() => 'mockResourceProvider1');
		mockResourceProvider1.setup((o) => o.getTreeDataProvider()).returns(() => mockResourceTreeDataProvider1.object);

		resourceService.clearResourceProviders();
		resourceService.registerResourceProvider(mockResourceProvider1.object);
		resourceService.areResourceProvidersLoaded = true;
	});

	it('Should be correct when provider id is correct.', async function(): Promise<void> {
		const children = await resourceService.getChildren(mockResourceProvider1.object.providerId, TypeMoq.It.isAny());
		should(children).Array();
	});

	it('Should throw exceptions when provider id is incorrect.', async function(): Promise<void> {
		const providerId = 'non_existent_provider_id';
		try {
			await resourceService.getRootChildren(providerId, mockAccount, mockSubscription, mockTenantId);
		} catch (error) {
			should(error.message).equal(`Azure resource provider doesn't exist. Id: ${providerId}`);
			return;
		}

		fail();
	});
});

describe('AzureResourceService.getTreeItem', function(): void {
	beforeEach(() => {
		mockResourceTreeDataProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceTreeDataProvider>();
		mockResourceTreeDataProvider1.setup((o) => o.getChildren()).returns(() => Promise.resolve([TypeMoq.Mock.ofType<azureResource.IAzureResourceNode>().object]));
		mockResourceTreeDataProvider1.setup((o) => o.getChildren(TypeMoq.It.isAny())).returns(() => Promise.resolve([TypeMoq.Mock.ofType<azureResource.IAzureResourceNode>().object]));
		mockResourceTreeDataProvider1.setup((o) => o.getTreeItem(TypeMoq.It.isAny())).returns(() => Promise.resolve(TypeMoq.It.isAny()));
		mockResourceProvider1 = TypeMoq.Mock.ofType<azureResource.IAzureResourceProvider>();
		mockResourceProvider1.setup((o) => o.providerId).returns(() => 'mockResourceProvider1');
		mockResourceProvider1.setup((o) => o.getTreeDataProvider()).returns(() => mockResourceTreeDataProvider1.object);

		resourceService.clearResourceProviders();
		resourceService.registerResourceProvider(mockResourceProvider1.object);
		resourceService.areResourceProvidersLoaded = true;
	});

	it('Should be correct when provider id is correct.', async function(): Promise<void> {
		const treeItem = await resourceService.getTreeItem(mockResourceProvider1.object.providerId, TypeMoq.It.isAny());
		should(treeItem).Object();
	});

	it('Should throw exceptions when provider id is incorrect.', async function(): Promise<void> {
		const providerId = 'non_existent_provider_id';
		try {
			await resourceService.getRootChildren(providerId, mockAccount, mockSubscription, mockTenantId);
		} catch (error) {
			should(error.message).equal(`Azure resource provider doesn't exist. Id: ${providerId}`);
			return;
		}

		fail();
	});
});