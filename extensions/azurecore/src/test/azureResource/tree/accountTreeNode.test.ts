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
import { TokenCredentials } from '@azure/ms-rest-js';
import { AppContext } from '../../../appContext';

import { azureResource } from '../../../azureResource/azure-resource';
import {
	IAzureResourceCacheService,
	IAzureResourceSubscriptionService,
	IAzureResourceSubscriptionFilterService,
} from '../../../azureResource/interfaces';
import { IAzureResourceTreeChangeHandler } from '../../../azureResource/tree/treeChangeHandler';
import { AzureResourceAccountTreeNode } from '../../../azureResource/tree/accountTreeNode';
import { AzureResourceSubscriptionTreeNode } from '../../../azureResource/tree/subscriptionTreeNode';
import { AzureResourceItemType, AzureResourceServiceNames } from '../../../azureResource/constants';
import { AzureResourceMessageTreeNode } from '../../../azureResource/messageTreeNode';
import { generateGuid } from '../../../azureResource/utils';

// Mock services
let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let mockCacheService: TypeMoq.IMock<IAzureResourceCacheService>;
let mockSubscriptionService: TypeMoq.IMock<IAzureResourceSubscriptionService>;
let mockSubscriptionFilterService: TypeMoq.IMock<IAzureResourceSubscriptionFilterService>;
let mockAppContext: AppContext;
let getSecurityTokenStub: sinon.SinonStub;
let mockTreeChangeHandler: TypeMoq.IMock<IAzureResourceTreeChangeHandler>;

// Mock test data
const mockTenantId = 'mock_tenant_id';

const mockAccount: azdata.Account = {
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
			{
				id: mockTenantId
			}
		]
	},
	isStale: false
};

const mockSubscription1: azureResource.AzureResourceSubscription = {
	id: 'mock_subscription_1',
	name: 'mock subscription 1',
	tenant: mockTenantId
};

const mockSubscription2: azureResource.AzureResourceSubscription = {
	id: 'mock_subscription_2',
	name: 'mock subscription 2',
	tenant: mockTenantId
};

const mockSubscriptions = [mockSubscription1, mockSubscription2];

const mockFilteredSubscriptions = [mockSubscription1];

const mockToken = {
	token: 'mock_token',
	tokenType: 'Bearer'
};


const mockCredential = new TokenCredentials(mockToken.token, mockToken.tokenType);

let mockSubscriptionCache: azureResource.AzureResourceSubscription[] = [];

describe('AzureResourceAccountTreeNode.info', function (): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockCacheService = TypeMoq.Mock.ofType<IAzureResourceCacheService>();
		mockSubscriptionService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionService>();
		mockSubscriptionFilterService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionFilterService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockSubscriptionCache = [];

		mockAppContext = new AppContext(mockExtensionContext.object);
		mockAppContext.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, mockCacheService.object);
		mockAppContext.registerService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService, mockSubscriptionService.object);
		mockAppContext.registerService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService, mockSubscriptionFilterService.object);

		getSecurityTokenStub = sinon.stub(azdata.accounts, 'getAccountSecurityToken').returns(Promise.resolve(mockToken));
		mockCacheService.setup((o) => o.generateKey(TypeMoq.It.isAnyString())).returns(() => generateGuid());
		mockCacheService.setup((o) => o.get(TypeMoq.It.isAnyString())).returns(() => mockSubscriptionCache);
		mockCacheService.setup((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => mockSubscriptionCache = mockSubscriptions);
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should be correct when created.', async function (): Promise<void> {
		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

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

	it('Should be correct when there are subscriptions listed.', async function (): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential, mockTenantId)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => Promise.resolve(undefined));

		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockSubscriptions.length} / ${mockSubscriptions.length} subscriptions)`;

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const subscriptionNodes = await accountTreeNode.getChildren();

		should(subscriptionNodes).Array();
		should(subscriptionNodes.length).equal(mockSubscriptions.length);

		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.label).equal(accountTreeNodeLabel);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(accountTreeNodeLabel);
	});

	it('Should be correct when there are subscriptions filtered.', async function (): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential, mockTenantId)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => Promise.resolve(mockFilteredSubscriptions));

		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockFilteredSubscriptions.length} / ${mockSubscriptions.length} subscriptions)`;

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

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
		mockSubscriptionService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionService>();
		mockSubscriptionFilterService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionFilterService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockSubscriptionCache = [];

		mockAppContext = new AppContext(mockExtensionContext.object);
		mockAppContext.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, mockCacheService.object);
		mockAppContext.registerService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService, mockSubscriptionService.object);
		mockAppContext.registerService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService, mockSubscriptionFilterService.object);

		sinon.stub(azdata.accounts, 'getAccountSecurityToken').returns(Promise.resolve(mockToken));
		mockCacheService.setup((o) => o.generateKey(TypeMoq.It.isAnyString())).returns(() => generateGuid());
		mockCacheService.setup((o) => o.get(TypeMoq.It.isAnyString())).returns(() => mockSubscriptionCache);
		mockCacheService.setup((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => mockSubscriptionCache = mockSubscriptions);
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should load subscriptions from scratch and update cache when it is clearing cache.', async function (): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential, mockTenantId)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => Promise.resolve([]));

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const children = await accountTreeNode.getChildren();

		mockSubscriptionService.verify((o) => o.getSubscriptions(mockAccount, mockCredential, mockTenantId), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.exactly(0));
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockSubscriptionFilterService.verify((o) => o.getSelectedSubscriptions(mockAccount), TypeMoq.Times.once());

		mockTreeChangeHandler.verify((o) => o.notifyNodeChanged(accountTreeNode), TypeMoq.Times.once());

		should(accountTreeNode.totalSubscriptionCount).equal(mockSubscriptions.length);
		should(accountTreeNode.selectedSubscriptionCount).equal(mockSubscriptions.length);
		should(accountTreeNode.isClearingCache).false();

		should(children).Array();
		should(children.length).equal(mockSubscriptions.length);

		should(mockSubscriptionCache).deepEqual(mockSubscriptions);

		for (let ix = 0; ix < mockSubscriptions.length; ix++) {
			const child = children[ix];
			const subscription = mockSubscriptions[ix];

			should(child).instanceof(AzureResourceSubscriptionTreeNode);
			should(child.nodePathValue).equal(`account_${mockAccount.key.accountId}.subscription_${subscription.id}.tenant_${mockTenantId}`);
		}
	});

	it('Should load subscriptions from cache when it is not clearing cache.', async function (): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential, mockTenantId)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => Promise.resolve(undefined));

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		await accountTreeNode.getChildren();
		const children = await accountTreeNode.getChildren();


		mockSubscriptionService.verify((o) => o.getSubscriptions(mockAccount, mockCredential, mockTenantId), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.once());

		should(children.length).equal(mockSubscriptionCache.length);

		for (let ix = 0; ix < mockSubscriptionCache.length; ix++) {
			should(children[ix].nodePathValue).equal(`account_${mockAccount.key.accountId}.subscription_${mockSubscriptionCache[ix].id}.tenant_${mockTenantId}`);
		}
	});

	it('Should handle when there is no subscriptions.', async function (): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential, mockTenantId)).returns(() => Promise.resolve(undefined));

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const children = await accountTreeNode.getChildren();

		should(accountTreeNode.totalSubscriptionCount).equal(0);

		should(children).Array();
		should(children.length).equal(1);
		should(children[0]).instanceof(AzureResourceMessageTreeNode);
		should(children[0].nodePathValue).startWith('message_');
		should(children[0].getNodeInfo().label).equal('No Subscriptions found.');
	});

	it('Should honor subscription filtering.', async function (): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential, mockTenantId)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => Promise.resolve(mockFilteredSubscriptions));

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const children = await accountTreeNode.getChildren();

		mockSubscriptionFilterService.verify((o) => o.getSelectedSubscriptions(mockAccount), TypeMoq.Times.once());

		should(accountTreeNode.selectedSubscriptionCount).equal(mockFilteredSubscriptions.length);
		should(children.length).equal(mockFilteredSubscriptions.length);

		for (let ix = 0; ix < mockFilteredSubscriptions.length; ix++) {
			should(children[ix].nodePathValue).equal(`account_${mockAccount.key.accountId}.subscription_${mockFilteredSubscriptions[ix].id}.tenant_${mockTenantId}`);
		}
	});

	it('Should handle errors.', async function (): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential, mockTenantId)).returns(() => Promise.resolve(mockSubscriptions));

		const mockError = 'Test error';
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => { throw new Error(mockError); });

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const children = await accountTreeNode.getChildren();

		should(getSecurityTokenStub.calledTwice).be.true('getSecurityToken should have been called exactly twice - once per subscription');
		mockSubscriptionService.verify((o) => o.getSubscriptions(mockAccount, mockCredential, mockTenantId), TypeMoq.Times.once());
		mockSubscriptionFilterService.verify((o) => o.getSelectedSubscriptions(mockAccount), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.never());
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.once());

		should(children).Array();
		should(children.length).equal(1);
		should(children[0]).instanceof(AzureResourceMessageTreeNode);
		should(children[0].nodePathValue).startWith('message_');
		should(children[0].getNodeInfo().label).equal(`Error: ${mockError}`);
	});
});

describe('AzureResourceAccountTreeNode.clearCache', function (): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockCacheService = TypeMoq.Mock.ofType<IAzureResourceCacheService>();
		mockSubscriptionService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionService>();
		mockSubscriptionFilterService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionFilterService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockSubscriptionCache = [];

		mockAppContext = new AppContext(mockExtensionContext.object);
		mockAppContext.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, mockCacheService.object);
		mockAppContext.registerService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService, mockSubscriptionService.object);
		mockAppContext.registerService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService, mockSubscriptionFilterService.object);

		sinon.stub(azdata.accounts, 'getAccountSecurityToken').returns(Promise.resolve(mockToken));
		mockCacheService.setup((o) => o.generateKey(TypeMoq.It.isAnyString())).returns(() => generateGuid());
		mockCacheService.setup((o) => o.get(TypeMoq.It.isAnyString())).returns(() => mockSubscriptionCache);
		mockCacheService.setup((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => mockSubscriptionCache = mockSubscriptions);
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should clear cache.', async function (): Promise<void> {
		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);
		accountTreeNode.clearCache();
		should(accountTreeNode.isClearingCache).true();
	});
});
