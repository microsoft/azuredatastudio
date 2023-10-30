/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as loc from '../../localizedConstants';
import { TreeNode } from './treeNode';
import { refreshActionId } from '../../constants';

/**
 * A placeholder TreeNode to display when credentials weren't entered
 */
export class RefreshTreeNode extends TreeNode {

	constructor(private _parent: TreeNode) {
		super(loc.refreshToEnterCredentials, vscode.TreeItemCollapsibleState.None, '');
	}

	public override command: vscode.Command = {
		command: refreshActionId,
		title: loc.refreshToEnterCredentials,
		arguments: [this._parent]
	};
}
