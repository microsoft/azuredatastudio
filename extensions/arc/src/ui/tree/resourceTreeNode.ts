/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ResourceModel } from '../../models/resourceModel';
import { TreeNode } from './treeNode';

/**
 * A TreeNode belonging to a child of a Controller
 */
export abstract class ResourceTreeNode<M extends ResourceModel> extends TreeNode {
	constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, resourceType: string, public model: M) {
		super(label, collapsibleState, resourceType);
	}
}
