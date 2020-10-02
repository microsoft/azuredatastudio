/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as loc from '../../localizedConstants';
import { TreeNode } from './treeNode';

/**
 * A placeholder TreeNode to display when there aren't any child instances available
 */
export class NoInstancesTreeNode extends TreeNode {

	constructor() {
		super(loc.noInstancesAvailable, vscode.TreeItemCollapsibleState.None, '');
	}
}
