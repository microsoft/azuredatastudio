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

/**
 * TreeNode root that represents an entire project
 */
export class ProjectRootTreeItem extends BaseProjectTreeItem {
	dataSourceNode: DataSourcesTreeItem;
	fileChildren: { [childName: string]: (fileTree.FolderNode | fileTree.FileNode) } = {};
	project: Project;

	constructor(project: Project) {
		super(vscode.Uri.parse(path.basename(project.projectFile)), undefined);

		this.project = project;
		this.dataSourceNode = new DataSourcesTreeItem(this);

		this.construct();
	}

	public get children(): BaseProjectTreeItem[] {
		const output: BaseProjectTreeItem[] = [];
		output.push(this.dataSourceNode);

		// sort children so that folders come first, then alphabetical
		const sortedChildren = Object.values(this.fileChildren).sort((a: (fileTree.FolderNode | fileTree.FileNode), b: (fileTree.FolderNode | fileTree.FileNode)) => {
			if (a instanceof fileTree.FolderNode && !(b instanceof fileTree.FolderNode)) { return -1; }
			else if (!(a instanceof fileTree.FolderNode) && b instanceof fileTree.FolderNode) { return 1; }
			else { return a.uri.fsPath.localeCompare(b.uri.fsPath); }
		});

		return output.concat(sortedChildren);
	}

	public get treeItem(): vscode.TreeItem {
		return new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.Expanded);
	}

	/**
	 * Processes the list of files in a project file to constructs the tree
	 */
	private construct() {
		for (const entry of this.project.files) {
			const parentNode = this.getEntryParentNode(entry);

			let newNode: fileTree.FolderNode | fileTree.FileNode;

			switch (entry.type) {
				case EntryType.File:
					newNode = new fileTree.FileNode(entry.uri, parentNode);
					break;
				case EntryType.Folder:
					newNode = new fileTree.FolderNode(entry.uri, parentNode);
					break;
				default:
					throw new Error(`Unknown EntryType: '${entry.type}'`);
			}

			parentNode.fileChildren[path.basename(entry.uri.path)] = newNode;
		}
	}

	/**
	 * Gets the immediate parent tree node for an entry in a project file
	 */
	private getEntryParentNode(entry: ProjectEntry): fileTree.FolderNode | ProjectRootTreeItem {
		const relativePathParts = utils.trimChars(utils.trimUri(vscode.Uri.file(this.project.projectFile), entry.uri), '/').split('/').slice(0, -1); // remove the last part because we only care about the parent

		if (relativePathParts.length === 0) {
			return this; // if nothing left after trimming the entry itself, must been root
		}

		let current: fileTree.FolderNode | ProjectRootTreeItem = this;

		for (const part of relativePathParts) {
			if (current.fileChildren[part] === undefined) {
				current.fileChildren[part] = new fileTree.FolderNode(vscode.Uri.file(path.join(path.dirname(this.project.projectFile), part)), current);
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
