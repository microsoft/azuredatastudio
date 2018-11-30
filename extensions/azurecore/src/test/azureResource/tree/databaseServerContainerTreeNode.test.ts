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

import { AzureResourceServicePool } from '../../../azureResource/servicePool';
import {
	IAzureResourceCacheService,
	IAzureResourceContextService,
	IAzureResourceCredentialService,
	IAzureResourceDatabaseServerService
} from '../../../azureResource/interfaces';
import { IAzureResourceTreeChangeHandler } from '../../../azureResource/tree/treeChangeHandler';
import { AzureResourceSubscription, AzureResourceDatabaseServer } from '../../../azureResource/models';
import { AzureResourceItemType } from '../../../azureResource/constants';
import { AzureResourceMessageTreeNode } from '../../../azureResource/tree/messageTreeNode';
import { AzureResourceDatabaseServerContainerTreeNode } from '../../../azureResource/tree/databaseServerContainerTreeNode';
import { AzureResourceDatabaseServerTreeNode } from '../../../azureResource/tree/databaseServerTreeNode';

// Mock services
const mockServicePool = AzureResourceServicePool.getInstance();

let mockCacheService: TypeMoq.IMock<IAzureResourceCacheService>;
let mockContextService: TypeMoq.IMock<IAzureResourceContextService>;
let mockCredentialService: TypeMoq.IMock<IAzureResourceCredentialService>;
let mockDatabaseServerService: TypeMoq.IMock<IAzureResourceDatabaseServerService>;

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
const mockCredentials = [mockCredential];

const mockSubscription: AzureResourceSubscription = {
	id: 'mock_subscription',
	name: 'mock subscription'
};

const mockDatabaseServer1: AzureResourceDatabaseServer = {
	name: 'mock server 1',
	fullName: 'mock server 1',
	loginName: 'mock user 1',
	defaultDatabaseName: 'master'
};
const mockDatabaseServer2: AzureResourceDatabaseServer = {
	name: 'mock server 2',
	fullName: 'mock server 2',
	loginName: 'mock user 2',
	defaultDatabaseName: 'master'
};
const mockDatabaseServers = [mockDatabaseServer1, mockDatabaseServer2];

let mockDatabaseServerContainerCache: { databaseServers: { [subscriptionId: string]: AzureResourceDatabaseServer[] } };

describe('AzureResourceDatabaseServerContainerTreeNode.info', function(): void {
	beforeEach(() => {
		mockContextService = TypeMoq.Mock.ofType<IAzureResourceContextService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockServicePool.contextService = mockContextService.object;
	});

	it('Should be correct when created.', async function(): Promise<void> {
		const databaseServerContainerTreeNode = new AzureResourceDatabaseServerContainerTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);

		const databaseServerContainerTreeNodeLabel = 'SQL Servers';

		should(databaseServerContainerTreeNode.nodePathValue).equal('databaseServerContainer');

		const treeItem = await databaseServerContainerTreeNode.getTreeItem();
		should(treeItem.label).equal(databaseServerContainerTreeNodeLabel);
		should(treeItem.contextValue).equal(AzureResourceItemType.databaseServerContainer);
		should(treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);

		const nodeInfo = databaseServerContainerTreeNode.getNodeInfo();
		should(nodeInfo.isLeaf).false();
		should(nodeInfo.label).equal(databaseServerContainerTreeNodeLabel);
		should(nodeInfo.nodeType).equal(AzureResourceItemType.databaseServerContainer);
		should(nodeInfo.iconType).equal(AzureResourceItemType.databaseServerContainer);
	});
});

describe('AzureResourceDatabaseServerContainerTreeNode.getChildren', function(): void {
	beforeEach(() => {
		mockCacheService = TypeMoq.Mock.ofType<IAzureResourceCacheService>();
		mockCredentialService = TypeMoq.Mock.ofType<IAzureResourceCredentialService>();
		mockDatabaseServerService = TypeMoq.Mock.ofType<IAzureResourceDatabaseServerService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockDatabaseServerContainerCache = { databaseServers: {} };

		mockServicePool.cacheService = mockCacheService.object;
		mockServicePool.credentialService = mockCredentialService.object;
		mockServicePool.databaseServerService = mockDatabaseServerService.object;

		mockCredentialService.setup((o) => o.getCredentials(mockAccount, sqlops.AzureResource.ResourceManagement)).returns(() => Promise.resolve(mockCredentials));
		mockCacheService.setup((o) => o.get(TypeMoq.It.isAnyString())).returns(() => mockDatabaseServerContainerCache);
		mockCacheService.setup((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => mockDatabaseServerContainerCache.databaseServers[mockSubscription.id] = mockDatabaseServers);
	});

	it('Should load database servers from scratch and update cache when it is clearing cache.', async function(): Promise<void> {
		mockDatabaseServerService.setup((o) => o.getDatabaseServers(mockSubscription, mockCredentials)).returns(() => Promise.resolve(mockDatabaseServers));

		const databaseServerContainerTreeNode = new AzureResourceDatabaseServerContainerTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);

		const children = await databaseServerContainerTreeNode.getChildren();

		mockCredentialService.verify((o) => o.getCredentials(mockAccount, sqlops.AzureResource.ResourceManagement), TypeMoq.Times.once());
		mockDatabaseServerService.verify((o) => o.getDatabaseServers(mockSubscription, mockCredentials), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.once());

		should(databaseServerContainerTreeNode.isClearingCache).false();

		should(children).Array();
		should(children.length).equal(mockDatabaseServers.length);

		should(Object.keys(mockDatabaseServerContainerCache.databaseServers)).deepEqual([mockSubscription.id]);
		should(mockDatabaseServerContainerCache.databaseServers[mockSubscription.id]).deepEqual(mockDatabaseServers);

		for (let ix = 0; ix < mockDatabaseServers.length; ix++) {
			const child = children[ix];
			const databaseServer = mockDatabaseServers[ix];

			should(child).instanceof(AzureResourceDatabaseServerTreeNode);
			should(child.nodePathValue).equal(`databaseServer_${databaseServer.name}`);
		}
	});

	it('Should load database servers from cache when it is not clearing cache.', async function(): Promise<void> {
		mockDatabaseServerService.setup((o) => o.getDatabaseServers(mockSubscription, mockCredentials)).returns(() => Promise.resolve(mockDatabaseServers));

		const databaseServerContainerTreeNode = new AzureResourceDatabaseServerContainerTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);

		await databaseServerContainerTreeNode.getChildren();
		const children = await databaseServerContainerTreeNode.getChildren();

		mockCredentialService.verify((o) => o.getCredentials(mockAccount, sqlops.AzureResource.ResourceManagement), TypeMoq.Times.exactly(1));
		mockDatabaseServerService.verify((o) => o.getDatabaseServers(mockSubscription, mockCredentials), TypeMoq.Times.exactly(1));
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.exactly(2));
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));

		should(children.length).equal(mockDatabaseServerContainerCache.databaseServers[mockSubscription.id].length);

		for (let ix = 0; ix < mockDatabaseServerContainerCache.databaseServers[mockSubscription.id].length; ix++) {
			should(children[ix].nodePathValue).equal(`databaseServer_${mockDatabaseServerContainerCache.databaseServers[mockSubscription.id][ix].name}`);
		}
	});

	it('Should handle when there is no database servers.', async function(): Promise<void> {
		mockDatabaseServerService.setup((o) => o.getDatabaseServers(mockSubscription, mockCredentials)).returns(() => Promise.resolve(undefined));

		const databaseContainerTreeNode = new AzureResourceDatabaseServerContainerTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);

		const children = await databaseContainerTreeNode.getChildren();

		should(children).Array();
		should(children.length).equal(1);
		should(children[0]).instanceof(AzureResourceMessageTreeNode);
		should(children[0].nodePathValue).startWith('message_');
		should(children[0].getNodeInfo().label).equal('No SQL Servers found.');
	});

	it('Should handle errors.', async function(): Promise<void> {
		const mockError = 'Test error';
		mockDatabaseServerService.setup((o) => o.getDatabaseServers(mockSubscription, mockCredentials)).returns(() => { throw new Error(mockError); });

		const databaseServerContainerTreeNode = new AzureResourceDatabaseServerContainerTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);
		const children = await databaseServerContainerTreeNode.getChildren();

		mockCredentialService.verify((o) => o.getCredentials(mockAccount, sqlops.AzureResource.ResourceManagement), TypeMoq.Times.once());
		mockDatabaseServerService.verify((o) => o.getDatabaseServers(mockSubscription, mockCredentials), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.never());
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.never());

		should(children).Array();
		should(children.length).equal(1);
		should(children[0]).instanceof(AzureResourceMessageTreeNode);
		should(children[0].nodePathValue).startWith('message_');
		should(children[0].getNodeInfo().label).equal(`Error: ${mockError}`);
	});
});

describe('AzureResourceDatabaseServerContainerTreeNode.clearCache', function() : void {
	beforeEach(() => {
		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();
	});

	it('Should clear cache.', async function(): Promise<void> {
		const databaseServerContainerTreeNode = new AzureResourceDatabaseServerContainerTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);
		databaseServerContainerTreeNode.clearCache();
		should(databaseServerContainerTreeNode.isClearingCache).true();
	});
});
