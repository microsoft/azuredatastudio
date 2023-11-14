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
import { AppContext } from '../../../appContext';

import {
	IAzureResourceCacheService,
	IAzureResourceSubscriptionService,
	IAzureResourceSubscriptionFilterService,
	IAzureResourceTenantFilterService,
} from '../../../azureResource/interfaces';
import { IAzureResourceTreeChangeHandler } from '../../../azureResource/tree/treeChangeHandler';
import { AzureResourceAccountTreeNode } from '../../../azureResource/tree/accountTreeNode';
import { AzureResourceSubscriptionTreeNode } from '../../../azureResource/tree/subscriptionTreeNode';
import { AzureResourceItemType, AzureResourceServiceNames } from '../../../azureResource/constants';
import { AzureResourceMessageTreeNode } from '../../../azureResource/messageTreeNode';
import { generateGuid } from '../../../azureResource/utils';
import { AzureAccount, azureResource } from 'azurecore';
import allSettings from '../../../account-provider/providerSettings';
import { AzureResourceTenantTreeNode } from '../../../azureResource/tree/tenantTreeNode';

// Mock services
let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let mockCacheService: TypeMoq.IMock<IAzureResourceCacheService>;
let mockSubscriptionService: TypeMoq.IMock<IAzureResourceSubscriptionService>;
let mockSubscriptionFilterService: TypeMoq.IMock<IAzureResourceSubscriptionFilterService>;
let mockTenantFilterService: TypeMoq.IMock<IAzureResourceTenantFilterService>;
let mockAppContext: AppContext;
let mockTreeChangeHandler: TypeMoq.IMock<IAzureResourceTreeChangeHandler>;

// Mock test data
const mockTenantId = 'mock_tenant_id';
const mockTenant = {
	id: mockTenantId,
	displayName: 'Mock Tenant'
};
const mockTenantAlternative = {
	id: 'mock_tenant_id_alt',
	displayName: 'Mock Tenant Alternative'
};

const mockTenants = [mockTenant, mockTenantAlternative];

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
		tenants: mockTenants,
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

const mockFilteredTenants = [mockTenant];

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
		mockSubscriptionService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionService>();
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount)).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService = TypeMoq.Mock.ofType<IAzureResourceSubscriptionFilterService>();
		mockTenantFilterService = TypeMoq.Mock.ofType<IAzureResourceTenantFilterService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockSubscriptionCache = [];

		mockAppContext = new AppContext(mockExtensionContext.object);
		mockAppContext.registerService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService, mockCacheService.object);
		mockAppContext.registerService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService, mockSubscriptionService.object);
		mockAppContext.registerService<IAzureResourceSubscriptionFilterService>(AzureResourceServiceNames.subscriptionFilterService, mockSubscriptionFilterService.object);
		mockAppContext.registerService<IAzureResourceTenantFilterService>(AzureResourceServiceNames.tenantFilterService, mockTenantFilterService.object);

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

	it('Should be correct when created.', async function (): Promise<void> {
		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const accountTreeNodeId = `account_${mockAccount.key.accountId}`;

		should(accountTreeNode.nodePathValue).equal(accountTreeNodeId);

		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.id).equal(accountTreeNodeId);
		should(treeItem.label).equal(mockAccount.displayInfo.displayName);
		should(treeItem.contextValue).equal(AzureResourceItemType.multipleTenantAccount);
		should(treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(mockAccount.displayInfo.displayName);
		should(nodeInfo.isLeaf).false();
		should(nodeInfo.nodeType).equal(AzureResourceItemType.account);
		should(nodeInfo.iconType).equal(AzureResourceItemType.account);
	});

	it('Should be correct when there are tenants available.', async function (): Promise<void> {
		mockTenantFilterService.setup((o) => o.getSelectedTenants(mockAccount)).returns(() => Promise.resolve(mockFilteredTenants));
		sinon.stub(azdata.accounts, 'getAccountSecurityToken').resolves(mockToken);

		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockFilteredTenants.length} / ${mockTenants.length} tenants)`;

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const tenantNodes = await accountTreeNode.getChildren();

		should(tenantNodes).Array();
		should(tenantNodes.length).equal(mockFilteredTenants.length);

		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.label).equal(accountTreeNodeLabel);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(accountTreeNodeLabel);
	});

	it('Should be correct when there are subscriptions listed.', async function (): Promise<void> {
		mockTenantFilterService.setup((o) => o.getSelectedTenants(mockAccount)).returns(() => Promise.resolve(mockFilteredTenants));
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, TypeMoq.It.isAny())).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount, mockTenant)).returns(() => Promise.resolve([]));
		sinon.stub(azdata.accounts, 'getAccountSecurityToken').resolves(mockToken);

		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockFilteredTenants.length} / ${mockTenants.length} tenants)`;
		const tenantTreeNodeLabel = `${mockTenant.displayName} (${mockSubscriptions.length} / ${mockSubscriptions.length} subscriptions)`;

		// Validate account tree node
		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);
		const tenantNodes = await accountTreeNode.getChildren();

		should(tenantNodes).Array();
		should(tenantNodes.length).equal(mockFilteredTenants.length);

		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.label).equal(accountTreeNodeLabel);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(accountTreeNodeLabel);

		// Validate tenant tree node
		const tenantTreeNode = tenantNodes[0];
		const subscriptions = await tenantTreeNode.getChildren();

		should(subscriptions).Array();
		should(subscriptions.length).equal(mockSubscriptions.length);

		const subTreeItem = await tenantTreeNode.getTreeItem();
		should(subTreeItem.label).equal(tenantTreeNodeLabel);

		const subNodeInfo = tenantTreeNode.getNodeInfo();
		should(subNodeInfo.label).equal(tenantTreeNodeLabel);
	});

	it('Should only show subscriptions with valid tokens.', async function (): Promise<void> {
		mockTenantFilterService.setup((o) => o.getSelectedTenants(mockAccount)).returns(() => Promise.resolve(mockTenants));
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, TypeMoq.It.isAny())).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount, mockTenant)).returns(() => Promise.resolve(mockSubscriptions));
		sinon.stub(azdata.accounts, 'getAccountSecurityToken').onFirstCall().resolves(mockToken);

		const tenantTreeNodeLabel = `${mockTenant.displayName} (${mockSubscriptions.length} / ${mockSubscriptions.length} subscriptions)`;
		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockTenants.length} / ${mockTenants.length} tenants)`;

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);
		const tenantTreeNode = (await accountTreeNode.getChildren())[0];
		const subscriptionNodes = await tenantTreeNode.getChildren();

		// Validate account tree node
		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.label).equal(accountTreeNodeLabel);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(accountTreeNodeLabel);

		// Validate tenant tree node
		const tenantTreeItem = await tenantTreeNode.getTreeItem();
		should(tenantTreeItem.label).equal(tenantTreeNodeLabel);

		const tenantNodeInfo = tenantTreeNode.getNodeInfo();
		should(tenantNodeInfo.label).equal(tenantTreeNodeLabel);

		should(subscriptionNodes).Array();
		should(subscriptionNodes.length).equal(mockSubscriptions.length);

	});

	it('Should be correct when there are subscriptions filtered.', async function (): Promise<void> {
		mockTenantFilterService.setup((o) => o.getSelectedTenants(mockAccount)).returns(() => Promise.resolve(mockFilteredTenants));
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, TypeMoq.It.isAny())).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount, mockTenant)).returns(() => Promise.resolve(mockFilteredSubscriptions));
		sinon.stub(azdata.accounts, 'getAccountSecurityToken').resolves(mockToken);

		const tenantTreeNodeLabel = `${mockTenant.displayName} (${mockFilteredSubscriptions.length} / ${mockSubscriptions.length} subscriptions)`;
		const accountTreeNodeLabel = `${mockAccount.displayInfo.displayName} (${mockFilteredTenants.length} / ${mockTenants.length} tenants)`;

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);
		const tenantNodes = await accountTreeNode.getChildren();

		should(tenantNodes).Array();
		should(tenantNodes.length).equal(mockFilteredTenants.length);

		const tenantTreeNode = tenantNodes[0];
		const subscriptionNodes = await tenantTreeNode.getChildren();

		const treeItem = await accountTreeNode.getTreeItem();
		should(treeItem.label).equal(accountTreeNodeLabel);

		const nodeInfo = accountTreeNode.getNodeInfo();
		should(nodeInfo.label).equal(accountTreeNodeLabel);

		should(subscriptionNodes).Array();
		should(subscriptionNodes.length).equal(mockFilteredSubscriptions.length);

		const tenantTreeItem = await tenantTreeNode.getTreeItem();
		should(tenantTreeItem.label).equal(tenantTreeNodeLabel);

		const tenantNodeInfo = tenantTreeNode.getNodeInfo();
		should(tenantNodeInfo.label).equal(tenantTreeNodeLabel);
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
		mockAppContext.registerService<IAzureResourceTenantFilterService>(AzureResourceServiceNames.tenantFilterService, mockTenantFilterService.object);

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

	it('Should load subscriptions from scratch and update cache when it is clearing cache.', async function (): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, TypeMoq.It.isAny())).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount, mockTenant)).returns(() => Promise.resolve([]));

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);
		const tenantTreeNode = new AzureResourceTenantTreeNode(mockAccount, mockTenant, accountTreeNode, mockAppContext, mockTreeChangeHandler.object);
		const children = await tenantTreeNode.getChildren();

		mockSubscriptionService.verify((o) => o.getSubscriptions(mockAccount, TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.exactly(0));
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockSubscriptionFilterService.verify((o) => o.getSelectedSubscriptions(mockAccount, TypeMoq.It.isAny()), TypeMoq.Times.once());

		mockTreeChangeHandler.verify((o) => o.notifyNodeChanged(tenantTreeNode), TypeMoq.Times.once());

		should(tenantTreeNode.totalSubscriptionCount).equal(mockSubscriptions.length);
		should(tenantTreeNode.selectedSubscriptionCount).equal(mockSubscriptions.length);
		should(tenantTreeNode.isClearingCache).false();

		should(children).Array();
		should(children.length).equal(mockSubscriptions.length);
		should(mockSubscriptionCache).deepEqual(mockSubscriptions);

		for (let ix = 0; ix < mockSubscriptions.length; ix++) {
			const child = children[ix];
			const subscription = mockSubscriptions[ix];

			should(child).instanceof(AzureResourceSubscriptionTreeNode);
			should(child.nodePathValue).equal(`account_${mockAccount.key.accountId}.tenant_${mockTenantId}.subscription_${subscription.id}`);
		}
	});

	it('Should load subscriptions from cache when it is not clearing cache.', async function (): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, TypeMoq.It.isAny())).returns(() => Promise.resolve(mockSubscriptions));
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount, mockTenant)).returns(() => Promise.resolve([]));

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const tenants = await accountTreeNode.getChildren();
		await tenants[0].getChildren();
		const children = await tenants[0].getChildren();

		mockSubscriptionService.verify((o) => o.getSubscriptions(mockAccount, TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.once());

		should(children.length).equal(mockSubscriptionCache.length);

		for (let ix = 0; ix < mockSubscriptionCache.length; ix++) {
			should(children[ix].nodePathValue).equal(`account_${mockAccount.key.accountId}.tenant_${mockTenantId}.subscription_${mockSubscriptionCache[ix].id}`);
		}
	});

	it('Should handle when there is no subscriptions.', async function (): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);
		const tenantTreeNode = new AzureResourceTenantTreeNode(mockAccount, mockTenant, accountTreeNode, mockAppContext, mockTreeChangeHandler.object);
		const children = await tenantTreeNode.getChildren();

		should(tenantTreeNode.totalSubscriptionCount).equal(0);

		should(children).Array();
		should(children.length).equal(1);
		should(children[0]).instanceof(AzureResourceMessageTreeNode);
		should(children[0].nodePathValue).startWith('message_');
		should(children[0].getNodeInfo().label).equal('No Subscriptions found.');
	});

	it('Should honor tenant filtering.', async function (): Promise<void> {
		mockTenantFilterService.setup((o) => o.getSelectedTenants(mockAccount)).returns(() => Promise.resolve(mockFilteredTenants));

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);
		const children = await accountTreeNode.getChildren();

		should(accountTreeNode.selectedTenantCount).equal(mockFilteredTenants.length);
		should(children.length).equal(mockFilteredTenants.length);

		for (let ix = 0; ix < mockFilteredTenants.length; ix++) {
			should(children[ix].nodePathValue).equal(`account_${mockAccount.key.accountId}.tenant_${mockTenantId}`);
		}
	});

	it('Should honor subscription filtering.', async function (): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, TypeMoq.It.isAny())).returns(() => Promise.resolve(mockFilteredSubscriptions));

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);
		const tenantTreeNode = new AzureResourceTenantTreeNode(mockAccount, mockTenant, accountTreeNode, mockAppContext, mockTreeChangeHandler.object);
		const subscriptions = await tenantTreeNode.getChildren();

		mockSubscriptionService.verify((o) => o.getSubscriptions(mockAccount, TypeMoq.It.isAny()), TypeMoq.Times.once());

		should(subscriptions.length).equal(mockFilteredSubscriptions.length);
		should(tenantTreeNode.selectedSubscriptionCount).equal(mockFilteredSubscriptions.length);

		for (let ix = 0; ix < mockFilteredSubscriptions.length; ix++) {
			const subscription = mockSubscriptions[ix];
			should(subscriptions[ix].nodePathValue).equal(`account_${mockAccount.key.accountId}.tenant_${mockTenantId}.subscription_${subscription.id}`);
		}
	});

	it('Should handle errors.', async function (): Promise<void> {
		mockSubscriptionService.setup((o) => o.getSubscriptions(mockAccount, TypeMoq.It.isAny())).returns(() => Promise.resolve(mockSubscriptions));

		const mockError = 'Test error';
		mockSubscriptionFilterService.setup((o) => o.getSelectedSubscriptions(mockAccount, mockTenant)).returns(() => { throw new Error(mockError); });

		const accountTreeNode = new AzureResourceAccountTreeNode(mockAccount, mockAppContext, mockTreeChangeHandler.object);

		const tenants = await accountTreeNode.getChildren();
		const children = await tenants[0].getChildren();

		mockSubscriptionService.verify((o) => o.getSubscriptions(mockAccount, TypeMoq.It.isAny()), TypeMoq.Times.once());
		mockSubscriptionFilterService.verify((o) => o.getSelectedSubscriptions(mockAccount, mockTenant), TypeMoq.Times.once());
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
		mockCacheService.setup((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => {
			mockSubscriptionCache = mockSubscriptions;
			return Promise.resolve();
		});
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
