/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import * as vscode from 'vscode';
import 'mocha';

import { AzureResourceItemType } from '../../azureResource/constants';
import { AzureResourceMessageTreeNode } from '../../azureResource/messageTreeNode';

describe('AzureResourceMessageTreeNode.info', function(): void {
	it('Should be correct when created.', async function(): Promise<void> {
		const mockMessage = 'Test messagse';
		const treeNode = new AzureResourceMessageTreeNode(mockMessage, undefined);

		should(treeNode.nodePathValue).startWith('message_');

		const treeItem = await treeNode.getTreeItem();
		should(treeItem.label).equal(mockMessage);
		should(treeItem.contextValue).equal(AzureResourceItemType.message);
		should(treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.None);

		const nodeInfo = treeNode.getNodeInfo();
		should(nodeInfo.isLeaf).true();
		should(nodeInfo.label).equal(mockMessage);
		should(nodeInfo.nodeType).equal(AzureResourceItemType.message);
		should(nodeInfo.iconType).equal(AzureResourceItemType.message);
	});
});

describe('AzureResourceMessageTreeNode.create', function(): void {
	it('Should create a message node.', async function(): Promise<void> {
		const mockMessage = 'Test messagse';
		const treeNode = AzureResourceMessageTreeNode.create(mockMessage, undefined);
		should(treeNode).instanceof(AzureResourceMessageTreeNode);
	});
});
