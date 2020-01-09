/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { BaseProjectTreeItem } from './baseTreeItem';
import { ProjectRootTreeItem } from './projectTreeItem';
import { Project } from '../project';

export class FolderNode extends BaseProjectTreeItem {
	public fileChildren: { [childName: string]: (FolderNode | FileNode) } = {};
	public fileSystemUri: vscode.Uri;

	constructor(folderPath: vscode.Uri, parent: FolderNode | ProjectRootTreeItem) {
		super(fsPathToProjectUri(folderPath, parent.root as ProjectRootTreeItem), parent);
		this.fileSystemUri = folderPath;
	}

	public get children(): BaseProjectTreeItem[] {
		return Object.values(this.fileChildren).sort();
	}

	public get treeItem(): vscode.TreeItem {
		return new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.Expanded);
	}

	public get project(): Project {
		return (<FolderNode | ProjectRootTreeItem>this.parent).project;
	}
}

export class FileNode extends BaseProjectTreeItem {
	public fileSystemUri: vscode.Uri;

	constructor(filePath: vscode.Uri, parent: FolderNode | ProjectRootTreeItem) {
		super(fsPathToProjectUri(filePath, parent.root as ProjectRootTreeItem), parent);
		this.fileSystemUri = filePath;
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}

	public get treeItem(): vscode.TreeItem {
		return new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.None);
	}
}

function fsPathToProjectUri(fileSystemUri: vscode.Uri, projectNode: ProjectRootTreeItem): vscode.Uri {
	const projBaseDir = path.dirname(projectNode.project.projectFile.fsPath);
	let localUri = '';

	if (fileSystemUri.fsPath.startsWith(projBaseDir)) {
		localUri = fileSystemUri.fsPath.substring(projBaseDir.length);
	}
	else {
		vscode.window.showErrorMessage('Project pointing to file outside of directory');
		throw new Error('Project pointing to file outside of directory');
	}

	return vscode.Uri.file(path.join(projectNode.uri.path, localUri));
}
