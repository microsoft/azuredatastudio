/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../../common/constants';

import { BaseProjectTreeItem } from './baseTreeItem';
import { ProjectRootTreeItem } from './projectTreeItem';

/**
 * Folder for containing SQLCMD variable nodes in the tree
 */
export class SqlCmdVariablesTreeItem extends BaseProjectTreeItem {
	private sqlcmdVariables: SqlCmdVariableTreeItem[] = [];

	constructor(project: ProjectRootTreeItem) {
		super(vscode.Uri.file(path.join(project.projectUri.fsPath, constants.sqlcmdVariablesNodeName)), project);

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
		const sqlCmdVariableFolderItem = new vscode.TreeItem(this.projectUri, vscode.TreeItemCollapsibleState.Collapsed);
		sqlCmdVariableFolderItem.contextValue = constants.DatabaseProjectItemType.sqlcmdVariablesRoot;
		// sqlCmdVariableFolderItem.iconPath = IconPathHelper.referenceGroup; // TODO: needs icon

		return sqlCmdVariableFolderItem;
	}
}

/**
 * Represents a SQLCMD variable in a .sqlproj
 */
export class SqlCmdVariableTreeItem extends BaseProjectTreeItem {
	constructor(private sqlcmdVar: string, sqlcmdVarsTreeItem: SqlCmdVariablesTreeItem) {
		super(vscode.Uri.file(path.join(sqlcmdVarsTreeItem.projectUri.fsPath, sqlcmdVar)), sqlcmdVarsTreeItem);
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}

	public get treeItem(): vscode.TreeItem {
		const sqlcmdVariableItem = new vscode.TreeItem(this.projectUri, vscode.TreeItemCollapsibleState.None);
		sqlcmdVariableItem.label = this.sqlcmdVar;
		sqlcmdVariableItem.contextValue = constants.DatabaseProjectItemType.sqlcmdVariable;
		// sqlcmdVariableItem.iconPath = IconPathHelper.referenceDatabase; // TODO: needs icon

		return sqlcmdVariableItem;
	}
}
