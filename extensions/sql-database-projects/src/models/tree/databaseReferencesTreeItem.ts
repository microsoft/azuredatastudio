/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../../common/constants';

import { BaseProjectTreeItem } from './baseTreeItem';
import { IconPathHelper } from '../../common/iconHelper';
import { IDatabaseReferenceProjectEntry } from 'sqldbproj';
import { SqlProjectReferenceProjectEntry } from '../projectEntry';

/**
 * Folder for containing references nodes in the tree
 */
export class DatabaseReferencesTreeItem extends BaseProjectTreeItem {
	private references: DatabaseReferenceTreeItem[] = [];

	/**
	 * Constructor
	 * @param projectNodeName Name of the project node. Used for creating the relative path of the Database References node to the project
	 * @param sqlprojUri Full URI to the .sqlproj
	 * @param databaseReferences Array of database references in the project
	 */
	constructor(projectNodeName: string, sqlprojUri: vscode.Uri, databaseReferences: IDatabaseReferenceProjectEntry[]) {
		super(vscode.Uri.file(path.join(projectNodeName, constants.databaseReferencesNodeName)), sqlprojUri);
		this.construct(databaseReferences);
	}

	private construct(databaseReferences: IDatabaseReferenceProjectEntry[]) {
		if (!databaseReferences) {
			return;
		}

		for (const reference of databaseReferences) {
			this.references.push(reference instanceof SqlProjectReferenceProjectEntry
				? new SqlProjectReferenceTreeItem(reference, this.relativeProjectUri, this.projectFileUri)
				: new DatabaseReferenceTreeItem(reference, this.relativeProjectUri, this.projectFileUri));
		}
	}

	public get children(): DatabaseReferenceTreeItem[] {
		return this.references;
	}

	public get type(): constants.DatabaseProjectItemType {
		return constants.DatabaseProjectItemType.referencesRoot;
	}

	public get treeItem(): vscode.TreeItem {
		const refFolderItem = new vscode.TreeItem(this.relativeProjectUri, vscode.TreeItemCollapsibleState.Collapsed);
		refFolderItem.contextValue = this.type;
		refFolderItem.iconPath = IconPathHelper.referenceGroup;

		return refFolderItem;
	}
}

export class DatabaseReferenceTreeItem extends BaseProjectTreeItem {
	constructor(public readonly reference: IDatabaseReferenceProjectEntry, referencesNodeRelativeProjectUri: vscode.Uri, sqlprojUri: vscode.Uri) {
		super(vscode.Uri.file(path.join(referencesNodeRelativeProjectUri.fsPath, reference.referenceName)), sqlprojUri);
		this.entryKey = this.friendlyName;
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}

	public get type(): constants.DatabaseProjectItemType {
		return constants.DatabaseProjectItemType.reference;
	}

	public get treeItem(): vscode.TreeItem {
		const refItem = new vscode.TreeItem(this.relativeProjectUri, vscode.TreeItemCollapsibleState.None);
		refItem.label = this.reference.referenceName;
		refItem.contextValue = this.type;
		refItem.iconPath = IconPathHelper.referenceDatabase;

		return refItem;
	}
}

export class SqlProjectReferenceTreeItem extends DatabaseReferenceTreeItem {
	public override get type(): constants.DatabaseProjectItemType {
		return constants.DatabaseProjectItemType.sqlProjectReference;
	}
}
