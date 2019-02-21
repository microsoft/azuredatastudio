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

import { cmsResource } from '../../../cmsResource/cms-resource';
import { ApiWrapper } from '../../../apiWrapper';
import { ICmsResourceService } from '../../../cmsResource/providers/interfaces';
import { CmsRegisteredServerTreeDataProvider } from '../../../cmsResource/providers/cmsRegisteredServerTreeDataProvider';
import { CmsRegisteredServer } from '../../../cmsResource/providers/models';
import { AzureResourceItemType } from '../../../cmsResource/constants';

// Mock services
let mockDatabaseServerService: TypeMoq.IMock<ICmsResourceService>;
let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;

const mockTenantId: string = 'mock_tenant';

const mockResourceRootNode: cmsResource.ICmsResourceNode = {
	treeItem: {
		id: 'mock_resource_root_node',
		label: 'mock resource root node',
		iconPath: undefined,
		collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
		contextValue: 'mock_resource_root_node'
	}
};

const mockTokens = {};
mockTokens[mockTenantId] = {
	token: 'mock_token',
	tokenType: 'Bearer'
};

const mockDatabaseServers: CmsRegisteredServer[] = [
	{
		name: 'mock database server 1',
		fullName: 'mock database server full name 1',
		loginName: 'mock login',
		defaultDatabaseName: 'master'
	},
	{
		name: 'mock database server 2',
		fullName: 'mock database server full name 2',
		loginName: 'mock login',
		defaultDatabaseName: 'master'
	}
];

describe('AzureResourceDatabaseServerTreeDataProvider.info', function(): void {
	beforeEach(() => {
		mockDatabaseServerService = TypeMoq.Mock.ofType<ICmsResourceService>();
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
	});

	it('Should be correct when created.', async function(): Promise<void> {
		const treeDataProvider = new CmsRegisteredServerTreeDataProvider(mockDatabaseServerService.object, mockApiWrapper.object, mockExtensionContext.object);

		const treeItem = await treeDataProvider.getTreeItem(mockResourceRootNode);
		should(treeItem.id).equal(mockResourceRootNode.treeItem.id);
		should(treeItem.label).equal(mockResourceRootNode.treeItem.label);
		should(treeItem.collapsibleState).equal(mockResourceRootNode.treeItem.collapsibleState);
		should(treeItem.contextValue).equal(mockResourceRootNode.treeItem.contextValue);
	});
});

describe('AzureResourceDatabaseServerTreeDataProvider.getChildren', function(): void {
	beforeEach(() => {
		mockDatabaseServerService = TypeMoq.Mock.ofType<ICmsResourceService>();
		mockApiWrapper = TypeMoq.Mock.ofType<ApiWrapper>();
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockDatabaseServerService.setup((o) => o.getRegisteredServers()).returns(() => Promise.resolve(mockDatabaseServers));
		mockExtensionContext.setup((o) => o.asAbsolutePath(TypeMoq.It.isAnyString())).returns(() => TypeMoq.It.isAnyString());
	});

	it('Should return container node when element is undefined.', async function(): Promise<void> {
		const treeDataProvider = new CmsRegisteredServerTreeDataProvider(mockDatabaseServerService.object, mockApiWrapper.object, mockExtensionContext.object);

		const children = await treeDataProvider.getChildren();

		should(children).Array();
		should(children.length).equal(1);

		const child = children[0];
		should(child.treeItem.id).equal('azure.resource.providers.databaseServer.treeDataProvider.databaseServerContainer');
		should(child.treeItem.label).equal('SQL Servers');
		should(child.treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);
		should(child.treeItem.contextValue).equal('azure.resource.itemType.databaseServerContainer');
	});

	it('Should return resource nodes when it is container node.', async function(): Promise<void> {
		const treeDataProvider = new CmsRegisteredServerTreeDataProvider(mockDatabaseServerService.object, mockApiWrapper.object, mockExtensionContext.object);

		const children = await treeDataProvider.getChildren(mockResourceRootNode);

		should(children).Array();
		should(children.length).equal(mockDatabaseServers.length);

		for (let ix = 0; ix < children.length; ix++) {
			const child = children[ix];
			const databaseServer = mockDatabaseServers[ix];

			should(child.treeItem.id).equal(`databaseServer_${databaseServer.name}`);
			should(child.treeItem.label).equal(databaseServer.name);
			should(child.treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.None);
			should(child.treeItem.contextValue).equal(AzureResourceItemType.serverGroup);
		}
	});
});
