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
import { TokenCredentials } from 'ms-rest';
import { AppContext } from '../../../appContext';

import { azureResource } from '../../../azureResource/azure-resource';
import { IAzureResourceTreeChangeHandler } from '../../../azureResource/tree/treeChangeHandler';
import { AzureResourceAccountTreeNode } from '../../../azureResource/tree/accountTreeNode';
import { AzureResourceItemType, AzureResourceServiceNames } from '../../../azureResource/constants';
import { ApiWrapper } from '../../../apiWrapper';
import { generateGuid } from '../../../azureResource/utils';

// Mock services
let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
let mockAppContext: AppContext;

let mockTreeChangeHandler: TypeMoq.IMock<IAzureResourceTreeChangeHandler>;

// Mock test data
const mockTenantId = 'mock_tenant_id';

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
	name: 'mock subscription 1'
};

const mockSubscription2: azureResource.AzureResourceSubscription = {
	id: 'mock_subscription_2',
	name: 'mock subscription 2'
};

const mockSubscriptions = [mockSubscription1, mockSubscription2];

const mockFilteredSubscriptions = [mockSubscription1];

const mockTokens = {};
mockTokens[mockTenantId] = {
	token: 'mock_token',
	tokenType: 'Bearer'
};

const mockCredential = new TokenCredentials(mockTokens[mockTenantId].token, mockTokens[mockTenantId].tokenType);

let mockSubscriptionCache: azureResource.AzureResourceSubscription[] = [];

describe('AzureResourceAccountTreeNode.info', function(): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();


		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockSubscriptionCache = [];

		mockAppContext = new AppContext(mockExtensionContext.object, mockApiWrapper.object);


		mockApiWrapper.setup((o) => o.getSecurityToken(mockAccount, sqlops.AzureResource.ResourceManagement)).returns(() => Promise.resolve(mockTokens));

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


		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockAccount.key.accountId}) (${mockSubscriptions.length} / ${mockSubscriptions.length} subscriptions)`;

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const subscriptionNodes = await accountTreeNode.getChildren();

		should(subscriptionNodes).Array();
		should(subscriptionNodes.length).equal(mockSubscriptions.length);

		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.label).equal(accountTreeNodeLabel);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(accountTreeNodeLabel);
	});

	it('Should be correct when there are subscriptions filtered.', async function(): Promise<void> {


		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockAccount.key.accountId}) (${mockFilteredSubscriptions.length} / ${mockSubscriptions.length} subscriptions)`;

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

describe('AzureResourceAccountTreeNode.getChildren', function(): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockSubscriptionCache = [];

		mockAppContext = new AppContext(mockExtensionContext.object, mockApiWrapper.object);


		mockApiWrapper.setup((o) => o.getSecurityToken(mockAccount, sqlops.AzureResource.ResourceManagement)).returns(() => Promise.resolve(mockTokens));

	});

	it('Should load subscriptions from scratch and update cache when it is clearing cache.', async function(): Promise<void> {


		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const children = await accountTreeNode.getChildren();

		mockApiWrapper.verify((o) => o.getSecurityToken(mockAccount, sqlops.AzureResource.ResourceManagement), TypeMoq.Times.once());


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
		}
	});

	it('Should load subscriptions from cache when it is not clearing cache.', async function(): Promise<void> {


		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		await accountTreeNode.getChildren();
		const children = await accountTreeNode.getChildren();

		mockApiWrapper.verify((o) => o.getSecurityToken(mockAccount, sqlops.AzureResource.ResourceManagement), TypeMoq.Times.once());


		should(children.length).equal(mockSubscriptionCache.length);

		for (let ix = 0; ix < mockSubscriptionCache.length; ix++) {
			should(children[ix].nodePathValue).equal(`account_${mockAccount.key.accountId}.subscription_${mockSubscriptionCache[ix].id}.tenant_${mockTenantId}`);
		}
	});

	it('Should handle when there is no subscriptions.', async function(): Promise<void> {

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const children = await accountTreeNode.getChildren();

		should(accountTreeNode.totalSubscriptionCount).equal(0);

		should(children).Array();
		should(children.length).equal(1);
		should(children[0].nodePathValue).startWith('message_');
		should(children[0].getNodeInfo().label).equal('No Subscriptions found.');
	});

	it('Should honor subscription filtering.', async function(): Promise<void> {

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const children = await accountTreeNode.getChildren();

		should(accountTreeNode.selectedSubscriptionCount).equal(mockFilteredSubscriptions.length);
		should(children.length).equal(mockFilteredSubscriptions.length);

		for (let ix = 0; ix < mockFilteredSubscriptions.length; ix++) {
			should(children[ix].nodePathValue).equal(`account_${mockAccount.key.accountId}.subscription_${mockFilteredSubscriptions[ix].id}.tenant_${mockTenantId}`);
		}
	});

	it('Should handle errors.', async function(): Promise<void> {

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const children = await accountTreeNode.getChildren();

		mockApiWrapper.verify((o) => o.getSecurityToken(mockAccount, sqlops.AzureResource.ResourceManagement), TypeMoq.Times.once());

		should(children).Array();

	});
});

describe('AzureResourceAccountTreeNode.clearCache', function() : void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();


		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockSubscriptionCache = [];

		mockAppContext = new AppContext(mockExtensionContext.object, mockApiWrapper.object);


		mockApiWrapper.setup((o) => o.getSecurityToken(mockAccount, sqlops.AzureResource.ResourceManagement)).returns(() => Promise.resolve(mockTokens));

	});

	it('Should clear cache.', async function(): Promise<void> {
		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);
		accountTreeNode.clearCache();
		should(accountTreeNode.isClearingCache).true();
	});
});