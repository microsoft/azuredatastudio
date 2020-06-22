/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { getResourceTypeIcon } from '../../common/utils';

/**
 * The base class for a TreeNode to be displayed in the TreeView
 */
export abstract class TreeNode extends vscode.TreeItem {
	constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, private resourceType?: string) {
		super(label, collapsibleState);
	}

	public async getChildren(): Promise<TreeNode[]> {
		return [];
	}

	public async openDashboard(): Promise<void> { }

	iconPath = getResourceTypeIcon(this.resourceType);
	contextValue = this.resourceType;
}
