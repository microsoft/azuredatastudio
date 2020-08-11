/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import 'mocha';
import { AppContext } from '../../../appContext';

import { azureResource } from '../../../azureResource/azure-resource';
import { IAzureResourceTreeChangeHandler } from '../../../azureResource/tree/treeChangeHandler';
import { AzureResourceSubscriptionTreeNode } from '../../../azureResource/tree/subscriptionTreeNode';
import { AzureResourceItemType, AzureResourceServiceNames } from '../../../azureResource/constants';
import { AzureResourceService } from '../../../azureResource/resourceService';
import { AzureResourceResourceTreeNode } from '../../../azureResource/resourceTreeNode';
import { IAzureResourceCacheService } from '../../../azureResource/interfaces';
import { generateGuid } from '../../../azureResource/utils';

// Mock services
let appContext: AppContext;

let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let mockCacheService: TypeMoq.IMock<IAzureResourceCacheService>;

let mockTreeChangeHandler: TypeMoq.IMock<IAzureResourceTreeChangeHandler>;

// Mock test data
const mockAccount: azdata.Account = {
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
	properties: undefined,
	isStale: false
};

const mockTenantId: string = 'mock_tenant';

const mockSubscription: azureResource.AzureResourceSubscription = {
	id: 'mock_subscription',
	name: 'mock subscription',
	tenant: mockTenantId
};

let mockResourceTreeDataProvider1: TypeMoq.IMock<azureResource.IAzureResourceTreeDataProvider>;
let mockResourceProvider1: TypeMoq.IMock<azureResource.IAzureResourceProvider>;

let mockResourceTreeDataProvider2: TypeMoq.IMock<azureResource.IAzureResourceTreeDataProvider>;
let mockResourceProvider2: TypeMoq.IMock<azureResource.IAzureResourceProvider>;

const resourceService: AzureResourceService = new AzureResourceService();

describe('AzureResourceSubscriptionTreeNode.info', function(): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockCacheService = TypeMoq.Mock.ofType<IAzureResourceCacheService>();

		mockCacheService.setup((o) => o.generateKey(TypeMoq.It.isAnyString())).returns(() => generateGuid());

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

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
		resourceService.registerResourceProvider(mockResourceProvider1.object);
		resourceService.registerResourceProvider(mockResourceProvider2.object);
		resourceService.areResourceProvidersLoaded = true;

		appContext = new AppContext(mockExtensionContext.object);
		appContext.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, mockCacheService.object);
		appContext.registerService(AzureResourceServiceNames.resourceService, resourceService);

	});

	it('Should be correct when created.', async function(): Promise<void> {
		const subscriptionTreeNode = new AzureResourceSubscriptionTreeNode(mockAccount, mockSubscription, mockTenantId, appContext, mockTreeChangeHandler.object, undefined);

		should(subscriptionTreeNode.nodePathValue).equal(`account_${mockAccount.key.accountId}.subscription_${mockSubscription.id}.tenant_${mockTenantId}`);

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
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockCacheService = TypeMoq.Mock.ofType<IAzureResourceCacheService>();

		mockCacheService.setup((o) => o.generateKey(TypeMoq.It.isAnyString())).returns(() => generateGuid());

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

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
		resourceService.registerResourceProvider(mockResourceProvider1.object);
		resourceService.registerResourceProvider(mockResourceProvider2.object);
		resourceService.areResourceProvidersLoaded = true;

		appContext = new AppContext(mockExtensionContext.object);
		appContext.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, mockCacheService.object);
		appContext.registerService(AzureResourceServiceNames.resourceService, resourceService);

	});

	it('Should return resource containers.', async function(): Promise<void> {
		const subscriptionTreeNode = new AzureResourceSubscriptionTreeNode(mockAccount, mockSubscription, mockTenantId, appContext, mockTreeChangeHandler.object, undefined);
		const children = await subscriptionTreeNode.getChildren();

		mockResourceTreeDataProvider1.verify((o) => o.getChildren(), TypeMoq.Times.once());

		mockResourceTreeDataProvider2.verify((o) => o.getChildren(), TypeMoq.Times.once());

		const expectedChildren = await resourceService.listResourceProviderIds();

		should(children).Array();
		should(children.length).equal(expectedChildren.length);
		for (const child of children) {
			should(child).instanceOf(AzureResourceResourceTreeNode);
		}
	});
});
