/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../../common/constants';
import { BaseProjectTreeItem, MessageTreeItem } from './baseTreeItem';
import { ProjectRootTreeItem } from './projectTreeItem';

/**
 * Folder for containing references nodes in the tree
 */
export class DatabaseReferencesTreeItem extends BaseProjectTreeItem {
	private references: MessageTreeItem[] = [];

	constructor(project: ProjectRootTreeItem) {
		super(vscode.Uri.file(path.join(project.uri.path, constants.databaseReferencesNodeName)), project);

		this.construct();
	}

	private construct() {
		for (const reference of (this.parent as ProjectRootTreeItem).project.databaseReferences) {
			this.references.push(new MessageTreeItem(reference.databaseName));
		}
	}

	public get children(): BaseProjectTreeItem[] {
		return this.references;
	}

	public get treeItem(): vscode.TreeItem {
		const refFolderItem = new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.Collapsed);
		refFolderItem.contextValue = constants.DatabaseProjectItemType.referencesRoot;
		return refFolderItem;
	}
}
