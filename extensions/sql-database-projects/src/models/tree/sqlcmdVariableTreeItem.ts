/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../../common/constants';

import { BaseProjectTreeItem } from './baseTreeItem';
import { IconPathHelper } from '../../common/iconHelper';

/**
 * Folder for containing SQLCMD variable nodes in the tree
 */
export class SqlCmdVariablesTreeItem extends BaseProjectTreeItem {
	private sqlcmdVariableTreeItems: SqlCmdVariableTreeItem[] = [];

	/**
	 * Constructor
	 * @param projectNodeName Name of the project node. Used for creating the relative path of the SQLCMD Variables node to the project
	 * @param sqlprojUri Full URI to the .sqlproj
	 * @param sqlCmdVariables Collection of SQLCMD variables in the project
	 */
	constructor(projectNodeName: string, sqlprojUri: vscode.Uri, sqlCmdVariables: Map<string, string>) {
		super(vscode.Uri.file(path.join(projectNodeName, constants.sqlcmdVariablesNodeName)), sqlprojUri);

		this.construct(sqlCmdVariables);
	}

	private construct(sqlCmdVariables: Map<string, string>) {
		if (!sqlCmdVariables) {
			return;
		}

		for (const sqlCmdVariable of sqlCmdVariables.keys()) {
			this.sqlcmdVariableTreeItems.push(new SqlCmdVariableTreeItem(sqlCmdVariable, this.relativeProjectUri, this.projectFileUri));
		}
	}

	public get children(): SqlCmdVariableTreeItem[] {
		return this.sqlcmdVariableTreeItems;
	}

	public get type(): constants.DatabaseProjectItemType {
		return constants.DatabaseProjectItemType.sqlcmdVariablesRoot;
	}

	public get treeItem(): vscode.TreeItem {
		const sqlCmdVariableFolderItem = new vscode.TreeItem(this.relativeProjectUri, vscode.TreeItemCollapsibleState.Collapsed);
		sqlCmdVariableFolderItem.contextValue = this.type;
		sqlCmdVariableFolderItem.iconPath = IconPathHelper.sqlCmdVariablesGroup;

		return sqlCmdVariableFolderItem;
	}
}

/**
 * Represents a SQLCMD variable in a .sqlproj
 */
export class SqlCmdVariableTreeItem extends BaseProjectTreeItem {
	constructor(private sqlcmdVar: string, sqlCmdNodeRelativeProjectUri: vscode.Uri, sqlprojUri: vscode.Uri,) {
		super(vscode.Uri.file(path.join(sqlCmdNodeRelativeProjectUri.fsPath, sqlcmdVar)), sqlprojUri);
		this.entryKey = this.friendlyName;
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}

	public get type(): constants.DatabaseProjectItemType {
		return constants.DatabaseProjectItemType.sqlcmdVariable;
	}

	public get treeItem(): vscode.TreeItem {
		const sqlcmdVariableItem = new vscode.TreeItem(this.relativeProjectUri, vscode.TreeItemCollapsibleState.None);
		sqlcmdVariableItem.label = this.sqlcmdVar;
		sqlcmdVariableItem.contextValue = this.type;
		sqlcmdVariableItem.iconPath = IconPathHelper.sqlCmdVariable;

		return sqlcmdVariableItem;
	}
}
