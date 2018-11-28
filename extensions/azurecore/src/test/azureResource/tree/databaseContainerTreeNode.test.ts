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
	IAzureResourceDatabaseService
} from '../../../azureResource/interfaces';
import { IAzureResourceTreeChangeHandler } from '../../../azureResource/tree/treeChangeHandler';
import { AzureResourceSubscription, AzureResourceDatabase } from '../../../azureResource/models';
import { AzureResourceItemType } from '../../../azureResource/constants';
import { AzureResourceMessageTreeNode } from '../../../azureResource/tree/messageTreeNode';
import { AzureResourceDatabaseContainerTreeNode } from '../../../azureResource/tree/databaseContainerTreeNode';
import { AzureResourceDatabaseTreeNode } from '../../../azureResource/tree/databaseTreeNode';

// Mock services
const mockServicePool = AzureResourceServicePool.getInstance();

let mockCacheService: TypeMoq.IMock<IAzureResourceCacheService>;
let mockContextService: TypeMoq.IMock<IAzureResourceContextService>;
let mockCredentialService: TypeMoq.IMock<IAzureResourceCredentialService>;
let mockDatabaseService: TypeMoq.IMock<IAzureResourceDatabaseService>;

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

const mockDatabase1: AzureResourceDatabase = {
	name: 'mock database 1',
	serverName: 'mock server 1',
	serverFullName: 'mock server 1',
	loginName: 'mock user 1'
};
const mockDatabase2: AzureResourceDatabase = {
	name: 'mock database 2',
	serverName: 'mock server 2',
	serverFullName: 'mock server 2',
	loginName: 'mock user 2'
};
const mockDatabases = [mockDatabase1, mockDatabase2];

let mockDatabaseContainerCache: { databases: { [subscriptionId: string]: AzureResourceDatabase[] } };

describe('AzureResourceDatabaseContainerTreeNode.info', function(): void {
	beforeEach(() => {
		mockContextService = TypeMoq.Mock.ofType<IAzureResourceContextService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockServicePool.contextService = mockContextService.object;
	});

	it('Should be correct when created.', async function(): Promise<void> {
		const databaseContainerTreeNode = new AzureResourceDatabaseContainerTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);

		const databaseContainerTreeNodeLabel = 'SQL Databases';

		should(databaseContainerTreeNode.nodePathValue).equal('databaseContainer');

		const treeItem = await databaseContainerTreeNode.getTreeItem();
		should(treeItem.label).equal(databaseContainerTreeNodeLabel);
		should(treeItem.contextValue).equal(AzureResourceItemType.databaseContainer);
		should(treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);

		const nodeInfo = databaseContainerTreeNode.getNodeInfo();
		should(nodeInfo.isLeaf).false();
		should(nodeInfo.label).equal(databaseContainerTreeNodeLabel);
		should(nodeInfo.nodeType).equal(AzureResourceItemType.databaseContainer);
		should(nodeInfo.iconType).equal(AzureResourceItemType.databaseContainer);
	});
});

describe('AzureResourceDatabaseContainerTreeNode.getChildren', function(): void {
	beforeEach(() => {
		mockCacheService = TypeMoq.Mock.ofType<IAzureResourceCacheService>();
		mockCredentialService = TypeMoq.Mock.ofType<IAzureResourceCredentialService>();
		mockDatabaseService = TypeMoq.Mock.ofType<IAzureResourceDatabaseService>();

		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();

		mockDatabaseContainerCache = { databases: {} };

		mockServicePool.cacheService = mockCacheService.object;
		mockServicePool.credentialService = mockCredentialService.object;
		mockServicePool.databaseService = mockDatabaseService.object;

		mockCredentialService.setup((o) => o.getCredentials(mockAccount, sqlops.AzureResource.ResourceManagement)).returns(() => Promise.resolve(mockCredentials));
		mockCacheService.setup((o) => o.get(TypeMoq.It.isAnyString())).returns(() => mockDatabaseContainerCache);
		mockCacheService.setup((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns(() => mockDatabaseContainerCache.databases[mockSubscription.id] = mockDatabases);
	});

	it('Should load databases from scratch and update cache when it is clearing cache.', async function(): Promise<void> {
		mockDatabaseService.setup((o) => o.getDatabases(mockSubscription, mockCredentials)).returns(() => Promise.resolve(mockDatabases));

		const databaseContainerTreeNode = new AzureResourceDatabaseContainerTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);

		const children = await databaseContainerTreeNode.getChildren();

		mockCredentialService.verify((o) => o.getCredentials(mockAccount, sqlops.AzureResource.ResourceManagement), TypeMoq.Times.once());
		mockDatabaseService.verify((o) => o.getDatabases(mockSubscription, mockCredentials), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.once());

		should(databaseContainerTreeNode.isClearingCache).false();

		should(children).Array();
		should(children.length).equal(mockDatabases.length);

		should(Object.keys(mockDatabaseContainerCache.databases)).deepEqual([mockSubscription.id]);
		should(mockDatabaseContainerCache.databases[mockSubscription.id]).deepEqual(mockDatabases);

		for (let ix = 0; ix < mockDatabases.length; ix++) {
			const child = children[ix];
			const database = mockDatabases[ix];

			should(child).instanceof(AzureResourceDatabaseTreeNode);
			should(child.nodePathValue).equal(`database_${database.name}`);
		}
	});

	it('Should load databases from cache when it is not clearing cache.', async function(): Promise<void> {
		mockDatabaseService.setup((o) => o.getDatabases(mockSubscription, mockCredentials)).returns(() => Promise.resolve(mockDatabases));

		const databaseContainerTreeNode = new AzureResourceDatabaseContainerTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);

		await databaseContainerTreeNode.getChildren();
		const children = await databaseContainerTreeNode.getChildren();

		mockCredentialService.verify((o) => o.getCredentials(mockAccount, sqlops.AzureResource.ResourceManagement), TypeMoq.Times.exactly(1));
		mockDatabaseService.verify((o) => o.getDatabases(mockSubscription, mockCredentials), TypeMoq.Times.exactly(1));
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.exactly(2));
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));

		should(children.length).equal(mockDatabaseContainerCache.databases[mockSubscription.id].length);

		for (let ix = 0; ix < mockDatabaseContainerCache.databases[mockSubscription.id].length; ix++) {
			should(children[ix].nodePathValue).equal(`database_${mockDatabaseContainerCache.databases[mockSubscription.id][ix].name}`);
		}
	});

	it('Should handle when there is no databases.', async function(): Promise<void> {
		mockDatabaseService.setup((o) => o.getDatabases(mockSubscription, mockCredentials)).returns(() => Promise.resolve(undefined));

		const databaseContainerTreeNode = new AzureResourceDatabaseContainerTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);

		const children = await databaseContainerTreeNode.getChildren();

		should(children).Array();
		should(children.length).equal(1);
		should(children[0]).instanceof(AzureResourceMessageTreeNode);
		should(children[0].nodePathValue).startWith('message_');
		should(children[0].getNodeInfo().label).equal('No SQL Databases found.');
	});

	it('Should handle errors.', async function(): Promise<void> {
		const mockError = 'Test error';
		mockDatabaseService.setup((o) => o.getDatabases(mockSubscription, mockCredentials)).returns(() => { throw new Error(mockError); });

		const databaseContainerTreeNode = new AzureResourceDatabaseContainerTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);
		const children = await databaseContainerTreeNode.getChildren();

		mockCredentialService.verify((o) => o.getCredentials(mockAccount, sqlops.AzureResource.ResourceManagement), TypeMoq.Times.once());
		mockDatabaseService.verify((o) => o.getDatabases(mockSubscription, mockCredentials), TypeMoq.Times.once());
		mockCacheService.verify((o) => o.get(TypeMoq.It.isAnyString()), TypeMoq.Times.never());
		mockCacheService.verify((o) => o.update(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.never());

		should(children).Array();
		should(children.length).equal(1);
		should(children[0]).instanceof(AzureResourceMessageTreeNode);
		should(children[0].nodePathValue).startWith('message_');
		should(children[0].getNodeInfo().label).equal(`Error: ${mockError}`);
	});
});

describe('AzureResourceDatabaseContainerTreeNode.clearCache', function() : void {
	beforeEach(() => {
		mockTreeChangeHandler = TypeMoq.Mock.ofType<IAzureResourceTreeChangeHandler>();
	});

	it('Should clear cache.', async function(): Promise<void> {
		const databaseContainerTreeNode = new AzureResourceDatabaseContainerTreeNode(mockSubscription, mockAccount, mockTreeChangeHandler.object, undefined);
		databaseContainerTreeNode.clearCache();
		should(databaseContainerTreeNode.isClearingCache).true();
	});
});
