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
 * Folder for containing references nodes in the tree
 */
export class DatabaseReferencesTreeItem extends BaseProjectTreeItem {
	private references: DatabaseReferenceTreeItem[] = [];

	/**
	 * Constructor
	 * @param projectNodeName Name of the project node. Used for creating the relative path of the Database References node to the project
	 * @param sqlprojUri Full URI to the .sqlproj
	 * @param databaseReferences Array of database references in the project
	 * @param project
	 */
	constructor(projectNodeName: string, sqlprojUri: vscode.Uri, databaseReferences: IDatabaseReferenceProjectEntry[], project: ProjectRootTreeItem) {
		super(vscode.Uri.file(path.join(projectNodeName, constants.databaseReferencesNodeName)), sqlprojUri, project);

		this.construct(databaseReferences);
	}

	private construct(databaseReferences: IDatabaseReferenceProjectEntry[]) {
		if (!databaseReferences) {
			return;
		}

		for (const reference of databaseReferences) {
			this.references.push(new DatabaseReferenceTreeItem(reference, this.relativeProjectUri, this.projectFileUri, this));
		}
	}

	public get children(): DatabaseReferenceTreeItem[] {
		return this.references;
	}

	public get treeItem(): vscode.TreeItem {
		const refFolderItem = new vscode.TreeItem(this.relativeProjectUri, vscode.TreeItemCollapsibleState.Collapsed);
		refFolderItem.contextValue = constants.DatabaseProjectItemType.referencesRoot;
		refFolderItem.iconPath = IconPathHelper.referenceGroup;

		return refFolderItem;
	}
}

export class DatabaseReferenceTreeItem extends BaseProjectTreeItem {
	constructor(private reference: IDatabaseReferenceProjectEntry, referencesNodeRelativeProjectUri: vscode.Uri, sqlprojUri: vscode.Uri, referencesTreeItem: DatabaseReferencesTreeItem) {
		super(vscode.Uri.file(path.join(referencesNodeRelativeProjectUri.fsPath, reference.databaseName)), sqlprojUri, referencesTreeItem);
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}

	public get treeItem(): vscode.TreeItem {
		const refItem = new vscode.TreeItem(this.relativeProjectUri, vscode.TreeItemCollapsibleState.None);
		refItem.label = this.reference.databaseName;
		refItem.contextValue = constants.DatabaseProjectItemType.reference;
		refItem.iconPath = IconPathHelper.referenceDatabase;

		return refItem;
	}
}
