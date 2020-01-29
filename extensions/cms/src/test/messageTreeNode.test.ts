/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as vscode from 'vscode';
import 'mocha';

import { CmsResourceItemType } from '../cmsResource/constants';
import { CmsResourceMessageTreeNode } from '../cmsResource/messageTreeNode';

describe('CmsResourceMessageTreeNode.info', function (): void {
	it('Should be correct when created.', async function (): Promise<void> {
		const mockMessage = 'Test message';
		const treeNode = new CmsResourceMessageTreeNode(mockMessage, undefined);

		should(treeNode.nodePathValue).startWith('message_');

		const treeItem = await treeNode.getTreeItem();
		should(treeItem.label).equal(mockMessage);
		should(treeItem.contextValue).equal(CmsResourceItemType.cmsMessageNodeContainer);
		should(treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.None);

		const nodeInfo = treeNode.getNodeInfo();
		should(nodeInfo.isLeaf).true();
		should(nodeInfo.label).equal(mockMessage);
		should(nodeInfo.nodeType).equal(CmsResourceItemType.cmsMessageNodeContainer);
		should(nodeInfo.iconType).equal(CmsResourceItemType.cmsMessageNodeContainer);
	});
});

describe('CmsResourceMessageTreeNode.create', function (): void {
	it('Should create a message node.', async function (): Promise<void> {
		const mockMessage = 'Test messagse';
		const treeNode = CmsResourceMessageTreeNode.create(mockMessage, undefined);
		should(treeNode).instanceof(CmsResourceMessageTreeNode);
	});
});
