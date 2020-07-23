/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../../common/constants';

import { BaseProjectTreeItem } from './baseTreeItem';
import { ProjectRootTreeItem } from './projectTreeItem';
import { IconPathHelper } from '../../common/iconHelper';
import { DatabaseReferenceProjectEntry } from '../../models/project';

/**
 * Folder for containing references nodes in the tree
 */
export class DatabaseReferencesTreeItem extends BaseProjectTreeItem {
	private references: DatabaseReferenceTreeItem[] = [];

	constructor(project: ProjectRootTreeItem) {
		super(vscode.Uri.file(path.join(project.uri.path, constants.databaseReferencesNodeName)), project);

		this.construct();
	}

	private construct() {
		for (const reference of (this.parent as ProjectRootTreeItem).project.databaseReferences) {
			this.references.push(new DatabaseReferenceTreeItem(reference, this));
		}
	}

	public get children(): DatabaseReferenceTreeItem[] {
		return this.references;
	}

	public get treeItem(): vscode.TreeItem {
		const refFolderItem = new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.Collapsed);
		refFolderItem.contextValue = constants.DatabaseProjectItemType.referencesRoot;
		refFolderItem.iconPath = IconPathHelper.referenceGroup;

		return refFolderItem;
	}
}

export class DatabaseReferenceTreeItem extends BaseProjectTreeItem {
	constructor(private reference: DatabaseReferenceProjectEntry, referencesTreeItem: DatabaseReferencesTreeItem) {
		super(vscode.Uri.file(path.join(referencesTreeItem.uri.path, reference.databaseName)), referencesTreeItem);
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}

	public get treeItem(): vscode.TreeItem {
		const refItem = new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.None);
		refItem.label = this.reference.databaseName;
		refItem.contextValue = constants.DatabaseProjectItemType.reference;
		refItem.iconPath = IconPathHelper.referenceDatabase;

		return refItem;
	}
}
