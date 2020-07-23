/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { BaseProjectTreeItem } from './baseTreeItem';
import { ProjectRootTreeItem } from './projectTreeItem';
import { Project } from '../project';
import { DatabaseProjectItemType } from '../../common/constants';
import * as utils from '../../common/utils';

/**
 * Node representing a folder in a project
 */
export class FolderNode extends BaseProjectTreeItem {
	public fileChildren: { [childName: string]: (FolderNode | FileNode) } = {};
	public fileSystemUri: vscode.Uri;

	constructor(folderPath: vscode.Uri, parent: FolderNode | ProjectRootTreeItem) {
		super(fsPathToProjectUri(folderPath, parent.root as ProjectRootTreeItem), parent);
		this.fileSystemUri = folderPath;
	}

	public get children(): BaseProjectTreeItem[] {
		return Object.values(this.fileChildren).sort(sortFileFolderNodes);
	}

	public get treeItem(): vscode.TreeItem {
		const folderItem = new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.Expanded);
		folderItem.contextValue = DatabaseProjectItemType.folder;
		return folderItem;
	}

	public get project(): Project {
		return (<FolderNode | ProjectRootTreeItem>this.parent).project;
	}
}

/**
 * Node representing a file in a project
 */
export class FileNode extends BaseProjectTreeItem {
	public fileSystemUri: vscode.Uri;

	constructor(filePath: vscode.Uri, parent: FolderNode | ProjectRootTreeItem) {
		super(fsPathToProjectUri(filePath, parent.root as ProjectRootTreeItem, true), parent);
		this.fileSystemUri = filePath;
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}

	public get treeItem(): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.None);

		treeItem.command = {
			title: 'Open file',
			command: 'vscode.open',
			arguments: [this.fileSystemUri]
		};

		treeItem.contextValue = DatabaseProjectItemType.file;

		return treeItem;
	}
}

/**
 * Compares two folder/file tree nodes so that folders come before files, then alphabetically
 * @param a a folder or file tree node
 * @param b another folder or file tree node
 */
export function sortFileFolderNodes(a: (FolderNode | FileNode), b: (FolderNode | FileNode)): number {
	if (a instanceof FolderNode && !(b instanceof FolderNode)) {
		return -1;
	}
	else if (!(a instanceof FolderNode) && b instanceof FolderNode) {
		return 1;
	}
	else {
		return a.uri.fsPath.localeCompare(b.uri.fsPath);
	}
}

/**
 * Converts a full filesystem URI to a project-relative URI that's compatible with the project tree
 */
function fsPathToProjectUri(fileSystemUri: vscode.Uri, projectNode: ProjectRootTreeItem, isFile?: boolean): vscode.Uri {
	const projBaseDir = projectNode.project.projectFolderPath;
	let localUri = '';

	if (fileSystemUri.fsPath.startsWith(projBaseDir)) {
		localUri = fileSystemUri.fsPath.substring(projBaseDir.length);
	}
	else if (isFile) {
		// if file is outside the folder add add at top level in tree
		// this is not true for folders otherwise the outside files will not be directly inside the top level
		let parts = utils.getPlatformSafeFileEntryPath(fileSystemUri.fsPath).split('/');
		localUri = parts[parts.length - 1];
	}

	return vscode.Uri.file(path.join(projectNode.uri.path, localUri));
}
