/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as vscode from 'vscode';
import 'mocha';

import { AzureResourceItemType } from '../../../azureResource/constants';
import { AzureResourceAccountNotSignedInTreeNode } from '../../../azureResource/tree/accountNotSignedInTreeNode';

describe('AzureResourceAccountNotSignedInTreeNode.info', function(): void {
	it('Should be correct.', async function(): Promise<void> {
		const label = 'Sign in to Azure...';

		const treeNode = new AzureResourceAccountNotSignedInTreeNode();

		should(treeNode.nodePathValue).equal('message_accountNotSignedIn');

		const treeItem = await treeNode.getTreeItem();
		should(treeItem.label).equal(label);
		should(treeItem.contextValue).equal(AzureResourceItemType.message);
		should(treeItem.collapsibleState).equal(vscode.TreeItemCollapsibleState.None);
		should(treeItem.command).not.undefined();
		should(treeItem.command.title).equal(label);
		should(treeItem.command.command).equal('azure.resource.signin');

		const nodeInfo = treeNode.getNodeInfo();
		should(nodeInfo.isLeaf).true();
		should(nodeInfo.label).equal(label);
		should(nodeInfo.nodeType).equal(AzureResourceItemType.message);
		should(nodeInfo.iconType).equal(AzureResourceItemType.message);
	});
});
