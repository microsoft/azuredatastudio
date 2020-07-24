/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as should from 'should';
import * as vscode from 'vscode';
import 'mocha';
import { AppContext } from '../../../appContext';
import { CmsResourceItemType } from '../../../cmsResource/constants';
import { RegisteredServerTreeNode } from '../../../cmsResource/tree/registeredServerTreeNode';
import { ICmsResourceTreeChangeHandler } from '../../../cmsResource/tree/treeChangeHandler';
import { cmsResource } from '../../../cmsResource/cms-resource';
import { CmsUtils } from '../../../cmsUtils';

// Mock services
let mockAppContext: AppContext;

let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let mockCmsUtils: TypeMoq.IMock<CmsUtils>;
let mockTreeChangeHandler: TypeMoq.IMock<ICmsResourceTreeChangeHandler>;

let mockResourceTreeDataProvider1: TypeMoq.IMock<cmsResource.ICmsResourceTreeDataProvider>;
let mockResourceProvider1: TypeMoq.IMock<cmsResource.ICmsResourceProvider>;

describe('RegisteredServerTreeNode.info', function(): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockCmsUtils = TypeMoq.Mock.ofType<CmsUtils>();
		mockAppContext = new AppContext(mockExtensionContext.object, mockCmsUtils.object);
		mockTreeChangeHandler = TypeMoq.Mock.ofType<ICmsResourceTreeChangeHandler>();
		mockResourceTreeDataProvider1 = TypeMoq.Mock.ofType<cmsResource.ICmsResourceTreeDataProvider>();
		mockResourceTreeDataProvider1.setup((o) => o.getChildren()).returns(() => Promise.resolve([TypeMoq.Mock.ofType<cmsResource.ICmsResourceNode>().object]));
		mockResourceTreeDataProvider1.setup((o) => o.getTreeItem(TypeMoq.It.isAny())).returns(() => Promise.resolve(TypeMoq.It.isAny()));
		mockResourceProvider1 = TypeMoq.Mock.ofType<cmsResource.ICmsResourceProvider>();
		mockResourceProvider1.setup((o) => o.providerId).returns(() => 'mockResourceProvider1');
		mockResourceProvider1.setup((o) => o.getTreeDataProvider()).returns(() => mockResourceTreeDataProvider1.object);
	});

	it('Should be correct.', async function(): Promise<void> {
		const label = 'test';

		const treeNode = new RegisteredServerTreeNode('test', 'test', 'test_server', 'test_path', 'test_ownerUri', mockAppContext, mockTreeChangeHandler.object, null);

		should(treeNode.relativePath).equal('test_path');

		const treeItem = await treeNode.getTreeItem();
		should(treeItem.label).equal(label);
		should(treeItem.contextValue).equal(CmsResourceItemType.registeredServer);
		should(treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.Collapsed);
		should(treeItem.command).undefined();

		const nodeInfo = treeNode.getNodeInfo();
		should(nodeInfo.isLeaf).false();
		should(nodeInfo.label).equal(label);
		should(nodeInfo.nodeType).equal(CmsResourceItemType.registeredServer);
	});
});
