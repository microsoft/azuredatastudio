/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as loc from '../../localizedConstants';
import { TreeNode } from './treeNode';

/**
 * A placeholder TreeNode to display when credentials weren't entered
 */
export class RefreshTreeNode extends TreeNode {

	constructor(private _parent: TreeNode) {
		super(loc.refreshToEnterCredentials, vscode.TreeItemCollapsibleState.None, 'refresh');
	}

	public command: vscode.Command = {
		command: 'arc.refresh',
		title: loc.refreshToEnterCredentials,
		arguments: [this._parent]
	};
}
