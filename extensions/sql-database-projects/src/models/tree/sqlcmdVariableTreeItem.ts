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
import { IDatabaseReferenceProjectEntry } from 'sqldbproj';

/**
 * Folder for containing sqlcmd variable nodes in the tree
 */
export class SqlCmdVariablesTreeItem extends BaseProjectTreeItem {
	private sqlcmdVariables: SqlCmdVariableTreeItem[] = [];

	constructor(project: ProjectRootTreeItem) {
		super(vscode.Uri.file(path.join(project.projectUri.fsPath, constants.databaseReferencesNodeName)), project);

		this.construct();
	}

	private construct() {
		for (const reference of (this.parent as ProjectRootTreeItem).project.databaseReferences) {
			this.sqlcmdVariables.push(new SqlCmdVariableTreeItem(reference, this));
		}
	}

	public get children(): SqlCmdVariableTreeItem[] {
		return this.sqlcmdVariables;
	}

	public get treeItem(): vscode.TreeItem {
		const refFolderItem = new vscode.TreeItem(this.projectUri, vscode.TreeItemCollapsibleState.Collapsed);
		refFolderItem.contextValue = constants.DatabaseProjectItemType.referencesRoot;
		refFolderItem.iconPath = IconPathHelper.referenceGroup;

		return refFolderItem;
	}
}

export class SqlCmdVariableTreeItem extends BaseProjectTreeItem {
	constructor(private reference: IDatabaseReferenceProjectEntry, referencesTreeItem: SqlCmdVariableTreeItem) {
		super(vscode.Uri.file(path.join(referencesTreeItem.projectUri.fsPath, reference.databaseName)), referencesTreeItem);
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}

	public get treeItem(): vscode.TreeItem {
		const refItem = new vscode.TreeItem(this.projectUri, vscode.TreeItemCollapsibleState.None);
		refItem.label = this.reference.databaseName;
		refItem.contextValue = constants.DatabaseProjectItemType.reference;
		refItem.iconPath = IconPathHelper.referenceDatabase;

		return refItem;
	}
}
