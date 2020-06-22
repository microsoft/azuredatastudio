/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as loc from '../../localizedConstants';
import { TreeNode } from './treeNode';

/**
 * A placeholder TreeNode to display while we're loading the initial set of stored nodes
 */
export class LoadingControllerNode extends TreeNode {

	constructor() {
		super(loc.loading, vscode.TreeItemCollapsibleState.None, 'loading');
	}
}
