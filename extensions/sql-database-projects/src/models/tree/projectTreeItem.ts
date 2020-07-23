/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { DataSourcesTreeItem } from './dataSourceTreeItem';
import { BaseProjectTreeItem } from './baseTreeItem';
import * as fileTree from './fileFolderTreeItem';
import { Project, ProjectEntry, EntryType } from '../project';
import * as utils from '../../common/utils';
import { DatabaseReferencesTreeItem } from './databaseReferencesTreeItem';
import { DatabaseProjectItemType, RelativeOuterPath } from '../../common/constants';
import { IconPathHelper } from '../../common/iconHelper';

/**
 * TreeNode root that represents an entire project
 */
export class ProjectRootTreeItem extends BaseProjectTreeItem {
	dataSourceNode: DataSourcesTreeItem;
	databaseReferencesNode: DatabaseReferencesTreeItem;
	fileChildren: { [childName: string]: (fileTree.FolderNode | fileTree.FileNode) } = {};
	project: Project;
	fileSystemUri: vscode.Uri;

	constructor(project: Project) {
		super(vscode.Uri.parse(path.basename(project.projectFilePath)), undefined);

		this.project = project;
		this.fileSystemUri = vscode.Uri.file(project.projectFilePath);
		this.dataSourceNode = new DataSourcesTreeItem(this);
		this.databaseReferencesNode = new DatabaseReferencesTreeItem(this);

		this.construct();
	}

	public get children(): BaseProjectTreeItem[] {
		const output: BaseProjectTreeItem[] = [];
		output.push(this.dataSourceNode);
		output.push(this.databaseReferencesNode);

		return output.concat(Object.values(this.fileChildren).sort(fileTree.sortFileFolderNodes));
	}

	public get treeItem(): vscode.TreeItem {
		const projectItem = new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.Expanded);
		projectItem.contextValue = DatabaseProjectItemType.project;
		projectItem.iconPath = IconPathHelper.databaseProject;

		return projectItem;
	}

	/**
	 * Processes the list of files in a project file to constructs the tree
	 */
	private construct() {
		for (const entry of this.project.files) {
			if (entry.type !== EntryType.File && entry.relativePath.startsWith(RelativeOuterPath)) {
				continue;
			}

			const parentNode = this.getEntryParentNode(entry);

			if (Object.keys(parentNode.fileChildren).includes(path.basename(entry.fsUri.path))) {
				continue; // ignore duplicate entries
			}

			let newNode: fileTree.FolderNode | fileTree.FileNode;

			switch (entry.type) {
				case EntryType.File:
					newNode = new fileTree.FileNode(entry.fsUri, parentNode);
					break;
				case EntryType.Folder:
					newNode = new fileTree.FolderNode(entry.fsUri, parentNode);
					break;
				default:
					throw new Error(`Unknown EntryType: '${entry.type}'`);
			}

			parentNode.fileChildren[path.basename(entry.fsUri.path)] = newNode;
		}
	}

	/**
	 * Gets the immediate parent tree node for an entry in a project file
	 */
	private getEntryParentNode(entry: ProjectEntry): fileTree.FolderNode | ProjectRootTreeItem {
		const relativePathParts = utils.trimChars(utils.trimUri(vscode.Uri.file(this.project.projectFilePath), entry.fsUri), '/').split('/').slice(0, -1); // remove the last part because we only care about the parent

		if (relativePathParts.length === 0) {
			return this; // if nothing left after trimming the entry itself, must been root
		}

		if (relativePathParts[0] === RelativeOuterPath) {
			return this;
		}

		let current: fileTree.FolderNode | ProjectRootTreeItem = this;

		for (const part of relativePathParts) {
			if (current.fileChildren[part] === undefined) {
				current.fileChildren[part] = new fileTree.FolderNode(vscode.Uri.file(path.join(path.dirname(this.project.projectFilePath), part)), current);
			}

			if (current.fileChildren[part] instanceof fileTree.FileNode) {
				return current;
			}
			else {
				current = current.fileChildren[part] as fileTree.FolderNode | ProjectRootTreeItem;
			}
		}

		return current;
	}
}
