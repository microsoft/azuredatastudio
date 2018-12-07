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
import { ServiceClientCredentials } from 'ms-rest';
import { AppContext } from '../../../appContext';

import {
	IAzureResourceCacheService,
	IAzureResourceSubscriptionService,
	IAzureResourceSubscriptionFilterService
} from '../../../azureResource/interfaces';
import { IAzureResourceTreeChangeHandler } from '../../../azureResource/tree/treeChangeHandler';
import { AzureResourceAccountTreeNode } from '../../../azureResource/tree/accountTreeNode';
import { AzureResourceSubscriptionTreeNode } from '../../../azureResource/tree/subscriptionTreeNode';
import { AzureResourceItemType, AzureResourceServiceNames } from '../../../azureResource/constants';
import { AzureResourceMessageTreeNode } from '../../../azureResource/messageTreeNode';
import { ApiWrapper } from '../../../apiWrapper';

// Mock services
let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
let mockCacheService: TypeMoq.IMock<IAzureResourceCacheService>;
let mockSubscriptionService: TypeMoq.IMock<IAzureResourceSubscriptionService>;
let mockSubscriptionFilterService: TypeMoq.IMock<IAzureResourceSubscriptionFilterService>;
let mockAppContext: AppContext;

let mockTreeChangeHandler: TypeMoq.IMock<IAzureResourceTreeChangeHandler>;

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

const mockCredential = TypeMoq.Mock.ofType<ServiceClientCredentials>().object;

const mockSubscription1: sqlops.azureResource.AzureResourceSubscription = {
	id: 'mock_subscription_1',
	name: 'mock subscription 1'
};
const mockSubscription2: sqlops.azureResource.AzureResourceSubscription = {
	id: 'mock_subscription_2',
	name: 'mock subscription 2'
};
const mockSubscriptions = [mockSubscription1, mockSubscription2];
const mockFilteredSubscriptions = [mockSubscription1];

let mockSubscriptionCache: { subscriptions: { [accountId: string]: sqlops.azureResource.AzureResourceSubscription[]} };

describe('AzureResourceAccountTreeNode.info', function(): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();
		mockCacheService = TypeMoq.Mock.ofType<IAzureResourceCacheService>();
		mockSubscriptionService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionService>();
		mockSubscriptionFilterService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionFilterService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockSubscriptionCache = { subscriptions: {} };

		mockAppContext = new AppContext(mockExtensionContext.object, mockApiWrapper.object);
		mockAppContext.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, mockCacheService.object);
		mockAppContext.registerService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService, mockSubscriptionService.object);
		mockAppContext.registerService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService, mockSubscriptionFilterService.object);

		mockApiWrapper.setup((o) => o.getSecurityToken(mockAccount, sqlops.AzureResource.ResourceManagement)).returns(() => Promise.resolve(mockCredential));
		mockCacheService.setup((o) => o.get(TypeMoq.It.isAnyString())).returns(() => mockSubscriptionCache);
		mockCacheService.setup((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => mockSubscriptionCache.subscriptions[mockAccount.key.accountId] = mockSubscriptions);
	});

	it('Should be correct when created.', async function(): Promise<void> {
		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const accountTreeNodeId = `account_${mockAccount.key.accountId}`;
		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockAccount.key.accountId})`;

		should(accountTreeNode.nodePathValue).equal(accountTreeNodeId);

		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.id).equal(accountTreeNodeId);
		should(treeItem.label).equal(accountTreeNodeLabel);
		should(treeItem.contextValue).equal(AzureResourceItemType.account);
		should(treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(accountTreeNodeLabel);
		should(nodeInfo.isLeaf).false();
		should(nodeInfo.nodeType).equal(AzureResourceItemType.account);
		should(nodeInfo.iconType).equal(AzureResourceItemType.account);
	});

	it('Should be correct when there are subscriptions listed.', async function(): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => Promise.resolve(undefined));

		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockAccount.key.accountId}) (${mockSubscriptions.length} / ${mockSubscriptions.length} subscriptions)`;

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		await accountTreeNode.getChildren();

		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.label).equal(accountTreeNodeLabel);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(accountTreeNodeLabel);
	});

	it('Should be correct when there are subscriptions filtered.', async function(): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => Promise.resolve(mockFilteredSubscriptions));

		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockAccount.key.accountId}) (${mockFilteredSubscriptions.length} / ${mockSubscriptions.length} subscriptions)`;

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		await accountTreeNode.getChildren();

		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.label).equal(accountTreeNodeLabel);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(accountTreeNodeLabel);
	});
});

describe('AzureResourceAccountTreeNode.getChildren', function(): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();
		mockCacheService = TypeMoq.Mock.ofType<IAzureResourceCacheService>();
		mockSubscriptionService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionService>();
		mockSubscriptionFilterService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionFilterService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockSubscriptionCache = { subscriptions: {} };

		mockAppContext = new AppContext(mockExtensionContext.object, mockApiWrapper.object);
		mockAppContext.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, mockCacheService.object);
		mockAppContext.registerService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService, mockSubscriptionService.object);
		mockAppContext.registerService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService, mockSubscriptionFilterService.object);

		mockApiWrapper.setup((o) => o.getSecurityToken(mockAccount, sqlops.AzureResource.ResourceManagement)).returns(() => Promise.resolve(mockCredential));
		mockCacheService.setup((o) => o.get(TypeMoq.It.isAnyString())).returns(() => mockSubscriptionCache);
		mockCacheService.setup((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => mockSubscriptionCache.subscriptions[mockAccount.key.accountId] = mockSubscriptions);
	});

	it('Should load subscriptions from scratch and update cache when it is clearing cache.', async function(): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => Promise.resolve(undefined));

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const children = await accountTreeNode.getChildren();

		mockApiWrapper.verify((o) => o.getSecurityToken(mockAccount, sqlops.AzureResource.ResourceManagement), TypeMoq.Times.once());
		mockSubscriptionService.verify((o) => o.getSubscriptions(mockAccount, mockCredential), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockSubscriptionFilterService.verify((o) => o.getSelectedSubscriptions(mockAccount), TypeMoq.Times.once());

		mockTreeChangeHandler.verify((o) => o.notifyNodeChanged(accountTreeNode), TypeMoq.Times.once());

		should(accountTreeNode.totalSubscriptionCount).equal(mockSubscriptions.length);
		should(accountTreeNode.selectedSubscriptionCount).equal(mockSubscriptions.length);
		should(accountTreeNode.isClearingCache).false();

		should(children).Array();
		should(children.length).equal(mockSubscriptions.length);

		should(Object.keys(mockSubscriptionCache.subscriptions)).deepEqual([mockAccount.key.accountId]);
		should(mockSubscriptionCache.subscriptions[mockAccount.key.accountId]).deepEqual(mockSubscriptions);

		for (let ix = 0; ix < mockSubscriptions.length; ix++) {
			const child = children[ix];
			const subscription = mockSubscriptions[ix];

			should(child).instanceof(AzureResourceSubscriptionTreeNode);
			should(child.nodePathValue).equal(`subscription_${subscription.id}`);
		}
	});

	it('Should load subscriptions from cache when it is not clearing cache.', async function(): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => Promise.resolve(undefined));

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		await accountTreeNode.getChildren();
		const children = await accountTreeNode.getChildren();

		mockApiWrapper.verify((o) => o.getSecurityToken(mockAccount, sqlops.AzureResource.ResourceManagement), TypeMoq.Times.exactly(1));
		mockSubscriptionService.verify((o) => o.getSubscriptions(mockAccount, mockCredential), TypeMoq.Times.exactly(1));
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.exactly(2));
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));

		should(children.length).equal(mockSubscriptionCache.subscriptions[mockAccount.key.accountId].length);

		for (let ix = 0; ix < mockSubscriptionCache.subscriptions[mockAccount.key.accountId].length; ix++) {
			should(children[ix].nodePathValue).equal(`subscription_${mockSubscriptionCache.subscriptions[mockAccount.key.accountId][ix].id}`);
		}
	});

	it('Should handle when there is no subscriptions.', async function(): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential)).returns(() => Promise.resolve(undefined));

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const children = await accountTreeNode.getChildren();

		should(accountTreeNode.totalSubscriptionCount).equal(0);

		should(children).Array();
		should(children.length).equal(1);
		should(children[0]).instanceof(AzureResourceMessageTreeNode);
		should(children[0].nodePathValue).startWith('message_');
		should(children[0].getNodeInfo().label).equal('No Subscriptions found.');
	});

	it('Should honor subscription filtering.', async function(): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount)).returns(() => Promise.resolve(mockFilteredSubscriptions));

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const children = await accountTreeNode.getChildren();

		mockSubscriptionFilterService.verify((o) => o.getSelectedSubscriptions(mockAccount), TypeMoq.Times.once());

		should(accountTreeNode.selectedSubscriptionCount).equal(mockFilteredSubscriptions.length);
		should(children.length).equal(mockFilteredSubscriptions.length);

		for (let ix = 0; ix < mockFilteredSubscriptions.length; ix++) {
			should(children[ix].nodePathValue).equal(`subscription_${mockFilteredSubscriptions[ix].id}`);
		}
	});

	it('Should handle errors.', async function(): Promise<void> {
		const mockError = 'Test error';
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, mockCredential)).returns(() => { throw new Error(mockError); });

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const children = await accountTreeNode.getChildren();

		mockApiWrapper.verify((o) => o.getSecurityToken(mockAccount, sqlops.AzureResource.ResourceManagement), TypeMoq.Times.once());
		mockSubscriptionService.verify((o) => o.getSubscriptions(mockAccount, mockCredential), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.never());
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.never());
		mockSubscriptionFilterService.verify((o) => o.getSelectedSubscriptions(mockAccount), TypeMoq.Times.never());

		should(children).Array();
		should(children.length).equal(1);
		should(children[0]).instanceof(AzureResourceMessageTreeNode);
		should(children[0].nodePathValue).startWith('message_');
		should(children[0].getNodeInfo().label).equal(`Error: ${mockError}`);
	});
});

describe('AzureResourceAccountTreeNode.clearCache', function() : void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();

		mockAppContext = new AppContext(mockExtensionContext.object, mockApiWrapper.object);

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();
	});

	it('Should clear cache.', async function(): Promise<void> {
		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);
		accountTreeNode.clearCache();
		should(accountTreeNode.isClearingCache).true();
	});
});
