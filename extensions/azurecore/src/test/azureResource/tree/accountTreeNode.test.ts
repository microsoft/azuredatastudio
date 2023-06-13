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
import { AppContext } from '../../../appContext';

import {
	IAzureResourceCacheService,
	IAzureResourceSubscriptionService,
	IAzureResourceSubscriptionFilterService,
} from '../../../azureResource/interfaces';
import { IAzureResourceTreeChangeHandler } from '../../../azureResource/tree/treeChangeHandler';
import { AzureResourceAccountTreeNode } from '../../../azureResource/tree/accountTreeNode';
import { AzureResourceItemType, AzureResourceServiceNames } from '../../../azureResource/constants';
import { generateGuid } from '../../../azureResource/utils';
import { AzureAccount, azureResource } from 'azurecore';
import allSettings from '../../../account-provider/providerSettings';

// Mock services
let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let mockCacheService: TypeMoq.IMock<IAzureResourceCacheService>;
let mockSubscriptionServiceMSAL: TypeMoq.IMock<IAzureResourceSubscriptionService>;
let mockSubscriptionFilterService: TypeMoq.IMock<IAzureResourceSubscriptionFilterService>;
let mockAppContextMSAL: AppContext;
let mockTreeChangeHandler: TypeMoq.IMock<IAzureResourceTreeChangeHandler>;

// Mock test data
const mockTenantId = 'mock_tenant_id';
const mockTenant = {
	id: mockTenantId,
	displayName: 'Mock Tenant'
};
const mockAccount: AzureAccount = {
	key: {
		accountId: '97915f6d-84fa-4926-b60c-38db64327ad7',
		providerId: 'mock_provider'
	},
	displayInfo: {
		displayName: 'mock_account@test.com',
		accountType: 'Microsoft',
		contextualDisplayName: 'test',
		userId: 'test@email.com',
		email: '97915f6d-84fa-4926-b60c-38db64327ad7'
	},
	properties: {
		tenants: [
			mockTenant
		],
		owningTenant: mockTenant,
		providerSettings: {
			settings: allSettings[0].metadata.settings,
			id: 'azure',
			displayName: 'Azure'
		},
		isMsAccount: true
	},
	isStale: false
};

const mock_subscription_id_1 = 'mock_subscription_1';
const mockSubscription1: azureResource.AzureResourceSubscription = {
	id: mock_subscription_id_1,
	name: 'mock subscription 1',
	tenant: mockTenantId
};

const mock_subscription_id_2 = 'mock_subscription_2';
const mockSubscription2: azureResource.AzureResourceSubscription = {
	id: mock_subscription_id_2,
	name: 'mock subscription 2',
	tenant: mockTenantId
};

const mockSubscriptions = [mockSubscription1, mockSubscription2];

const mockFilteredSubscriptions = [mockSubscription1];

const mockToken = {
	token: 'mock_token',
	tokenType: 'Bearer'
};

let mockSubscriptionCache: azureResource.AzureResourceSubscription[] = [];

describe('AzureResourceAccountTreeNode.info', function (): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockCacheService = TypeMoq.Mock.ofType<IAzureResourceCacheService>();
		mockSubscriptionServiceMSAL = TypeMoq.Mock.ofType<IAzureResourceSubscriptionService>();
		mockSubscriptionServiceMSAL.setup((o) => o.getSubscriptions(mockAccount)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionFilterService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockSubscriptionCache = [];

		mockAppContextMSAL = new AppContext(mockExtensionContext.object);
		mockAppContextMSAL.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, mockCacheService.object);
		mockAppContextMSAL.registerService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService, mockSubscriptionServiceMSAL.object);
		mockAppContextMSAL.registerService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService, mockSubscriptionFilterService.object);

		mockCacheService.setup((o) => o.generateKey(TypeMoq.It.isAnyString())).returns(() => generateGuid());
		mockCacheService.setup((o) => o.get(TypeMoq.It.isAnyString())).returns(() => mockSubscriptionCache);
		mockCacheService.setup((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => {
			mockSubscriptionCache = mockSubscriptions;
			return Promise.resolve();
		});
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should be correct when created for MSAL.', async function (): Promise<void> {
		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContextMSAL, mockTreeChangeHandler.object);

		const accountTreeNodeId = `account_${mockAccount.key.accountId}`;

		should(accountTreeNode.nodePathValue).equal(accountTreeNodeId);

		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.id).equal(accountTreeNodeId);
		should(treeItem.label).equal(mockAccount.displayInfo.displayName);
		should(treeItem.contextValue).equal(AzureResourceItemType.account);
		should(treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(mockAccount.displayInfo.displayName);
		should(nodeInfo.isLeaf).false();
		should(nodeInfo.nodeType).equal(AzureResourceItemType.account);
		should(nodeInfo.iconType).equal(AzureResourceItemType.account);
	});

	it('Should be correct when there are subscriptions listed for MSAL.', async function (): Promise<void> {
		mockSubscriptionServiceMSAL.setup((o) => o.getSubscriptions(mockAccount, TypeMoq.It.isAny())).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => Promise.resolve([]));
		sinon.stub(azdata.accounts, 'getAccountSecurityToken').resolves(mockToken);

		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockSubscriptions.length} / ${mockSubscriptions.length} subscriptions)`;

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContextMSAL, mockTreeChangeHandler.object);

		const subscriptionNodes = await accountTreeNode.getChildren();

		should(subscriptionNodes).Array();
		should(subscriptionNodes.length).equal(mockSubscriptions.length);

		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.label).equal(accountTreeNodeLabel);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(accountTreeNodeLabel);
	});

	it('Should only show subscriptions with valid tokens for MSAL.', async function (): Promise<void> {
		mockSubscriptionServiceMSAL.setup((o) => o.getSubscriptions(mockAccount)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => Promise.resolve(mockFilteredSubscriptions));
		sinon.stub(azdata.accounts, 'getAccountSecurityToken').onFirstCall().resolves(mockToken);
		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockFilteredSubscriptions.length} / ${mockSubscriptions.length} subscriptions)`;

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContextMSAL, mockTreeChangeHandler.object);

		const subscriptionNodes = await accountTreeNode.getChildren();

		should(subscriptionNodes).Array();
		should(subscriptionNodes.length).equal(1);

		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.label).equal(accountTreeNodeLabel);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(accountTreeNodeLabel);
	});

	it('Should be correct when there are subscriptions filtered for MSAL.', async function (): Promise<void> {
		mockSubscriptionServiceMSAL.setup((o) => o.getSubscriptions(mockAccount)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => Promise.resolve(mockFilteredSubscriptions));
		sinon.stub(azdata.accounts, 'getAccountSecurityToken').resolves(mockToken);
		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockFilteredSubscriptions.length} / ${mockSubscriptions.length} subscriptions)`;

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContextMSAL, mockTreeChangeHandler.object);

		const subscriptionNodes = await accountTreeNode.getChildren();

		should(subscriptionNodes).Array();
		should(subscriptionNodes.length).equal(mockFilteredSubscriptions.length);

		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.label).equal(accountTreeNodeLabel);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(accountTreeNodeLabel);
	});
});

describe('AzureResourceAccountTreeNode.getChildren', function (): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockCacheService = TypeMoq.Mock.ofType<IAzureResourceCacheService>();
		mockSubscriptionServiceMSAL = TypeMoq.Mock.ofType<IAzureResourceSubscriptionService>();
		mockSubscriptionFilterService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionFilterService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockSubscriptionCache = [];

		mockAppContextMSAL = new AppContext(mockExtensionContext.object);
		mockAppContextMSAL.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, mockCacheService.object);
		mockAppContextMSAL.registerService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService, mockSubscriptionServiceMSAL.object);
		mockAppContextMSAL.registerService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService, mockSubscriptionFilterService.object);

		sinon.stub(azdata.accounts, 'getAccountSecurityToken').resolves(mockToken);
		mockCacheService.setup((o) => o.generateKey(TypeMoq.It.isAnyString())).returns(() => generateGuid());
		mockCacheService.setup((o) => o.get(TypeMoq.It.isAnyString())).returns(() => mockSubscriptionCache);
		mockCacheService.setup((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => {
			mockSubscriptionCache = mockSubscriptions;
			return Promise.resolve();
		});
	});

	afterEach(function (): void {
		sinon.restore();
	});
});

