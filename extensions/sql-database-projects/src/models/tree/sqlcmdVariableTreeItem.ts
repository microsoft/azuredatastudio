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

/**
 * Folder for containing sqlcmd variable nodes in the tree
 */
export class SqlCmdVariablesTreeItem extends BaseProjectTreeItem {
	private sqlcmdVariables: SqlCmdVariableTreeItem[] = [];

	constructor(project: ProjectRootTreeItem) {
		super(vscode.Uri.file(path.join(project.projectUri.fsPath, 'SqlCmd Variables')), project);

		this.construct();
	}

	private construct() {
		for (const sqlCmdVariable of Object.keys((this.parent as ProjectRootTreeItem).project.sqlCmdVariables)) {
			this.sqlcmdVariables.push(new SqlCmdVariableTreeItem(sqlCmdVariable, this));
		}
	}

	public get children(): SqlCmdVariableTreeItem[] {
		return this.sqlcmdVariables;
	}

	public get treeItem(): vscode.TreeItem {
		const refFolderItem = new vscode.TreeItem(this.projectUri, vscode.TreeItemCollapsibleState.Collapsed);
		refFolderItem.contextValue = constants.DatabaseProjectItemType.sqlcmdVariablesRoot;
		refFolderItem.iconPath = IconPathHelper.referenceGroup; // TODO: needs icon

		return refFolderItem;
	}
}

export class SqlCmdVariableTreeItem extends BaseProjectTreeItem {
	constructor(private sqlcmdVar: string, sqlcmdVarsTreeItem: SqlCmdVariablesTreeItem) {
		super(vscode.Uri.file(path.join(sqlcmdVarsTreeItem.projectUri.fsPath, sqlcmdVar)), sqlcmdVarsTreeItem);
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}

	public get treeItem(): vscode.TreeItem {
		const refItem = new vscode.TreeItem(this.projectUri, vscode.TreeItemCollapsibleState.None);
		refItem.label = this.sqlcmdVar;
		refItem.contextValue = constants.DatabaseProjectItemType.sqlcmdVariable;
		refItem.iconPath = IconPathHelper.referenceDatabase; // TODO: needs icon

		return refItem;
	}
}
