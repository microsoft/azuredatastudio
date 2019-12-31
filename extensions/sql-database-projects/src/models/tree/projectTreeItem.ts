/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { DataSourcesTreeItem } from './dataSourceTreeItem';
import { BaseProjectTreeItem } from './baseTreeItem';
import * as fileTree from './fileFolderTreeItem';

export class ProjectRootTreeItem extends BaseProjectTreeItem {
	dataSourceNode: DataSourcesTreeItem;
	fileChildren: (fileTree.FolderNode | fileTree.FileNode)[] = [];
	projectFile: vscode.Uri;

	constructor(projectFile: vscode.Uri) {
		super(vscode.Uri.parse(path.basename(projectFile.fsPath)), undefined);

		this.projectFile = projectFile;
		this.dataSourceNode = new DataSourcesTreeItem(this);
	}

	public get children(): BaseProjectTreeItem[] {
		const output: BaseProjectTreeItem[] = [];
		output.push(this.dataSourceNode);

		// sort children so that folders come first, then alphabetical
		this.fileChildren.sort((a: (fileTree.FolderNode | fileTree.FileNode), b: (fileTree.FolderNode | fileTree.FileNode)) => {
			if (a instanceof fileTree.FolderNode && !(b instanceof fileTree.FolderNode)) { return -1; }
			else if (!(a instanceof fileTree.FolderNode) && b instanceof fileTree.FolderNode) { return 1; }
			else { return a.uri.fsPath.localeCompare(b.uri.fsPath); }
		});

		return output.concat(this.fileChildren);
	}

	public get treeItem(): vscode.TreeItem {
		return new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.Expanded);
	}

	public async construct(): Promise<void> {
		this.fileChildren = await fileTree.constructFileSystemChildNodes(this);
	}
}
