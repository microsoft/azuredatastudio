/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';

import { promises as fs } from 'fs';

export abstract class BaseProjectTreeItem {
	uri: vscode.Uri;
	parent?: BaseProjectTreeItem;

	constructor(uri: vscode.Uri, parent?: BaseProjectTreeItem) {
		this.uri = uri;
		this.parent = parent;
	}

	abstract get children(): BaseProjectTreeItem[];

	abstract get treeItem(): vscode.TreeItem;
}

export class MessageTreeItem extends BaseProjectTreeItem {
	private message: string;

	constructor(message: string) {
		super(vscode.Uri.parse(path.join('message', message)), undefined);
		this.message = message;
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}

	public get treeItem(): vscode.TreeItem {
		return new vscode.TreeItem(this.message, vscode.TreeItemCollapsibleState.None);
	}
}

export class ProjectRootTreeItem extends BaseProjectTreeItem {
	dataSourceNode: DataSourcesTreeItem;
	fileChildren: (FolderNode | FileNode)[] = [];
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
		this.fileChildren.sort((a: (FolderNode | FileNode), b: (FolderNode | FileNode)) => {
			if (a instanceof FolderNode && !(b instanceof FolderNode)) { return -1; }
			else if (!(a instanceof FolderNode) && b instanceof FolderNode) { return 1; }
			else { return a.uri.fsPath.localeCompare(b.uri.fsPath); }
		});

		return output.concat(this.fileChildren);
	}

	public get treeItem(): vscode.TreeItem {
		return new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.Expanded);
	}

	public async construct(): Promise<void> {
		this.fileChildren = await constructFileSystemChildNodes(this);
	}
}

async function constructFileSystemChildNodes(parent: FolderNode | ProjectRootTreeItem): Promise<(FolderNode | FileNode)[]> {
	const parentFolderUri: vscode.Uri = parent instanceof FolderNode ? parent.fileSystemUri : vscode.Uri.file(path.dirname(parent.projectFile.fsPath));

	const output: (FolderNode | FileNode)[] = [];

	let contents = await fs.readdir(parentFolderUri.fsPath);

	for (const entry of contents) {
		const filePath = path.join(parentFolderUri.fsPath, entry);

		if ((await fs.stat(filePath)).isDirectory()) {
			const child = new FolderNode(vscode.Uri.file(filePath), parent);
			await constructFileSystemChildNodes(child);
			output.push(child);
		}
		else {
			output.push(new FileNode(vscode.Uri.file(filePath), parent));
		}
	}

	return output;
}

export class FolderNode extends BaseProjectTreeItem {
	private fileChildren: (FolderNode | FileNode)[] = [];
	public fileSystemUri: vscode.Uri;

	constructor(folderPath: vscode.Uri, parent: FolderNode | ProjectRootTreeItem) {
		super(fsPathToProjectUri(folderPath, parent.projectFile), parent);
		this.fileSystemUri = folderPath;
	}

	public get children(): BaseProjectTreeItem[] {
		return this.fileChildren;
	}

	public get treeItem(): vscode.TreeItem {
		return new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.Expanded);
	}

	public get projectFile(): vscode.Uri {
		return (<FolderNode | ProjectRootTreeItem>this.parent).projectFile;
	}
}

function fsPathToProjectUri(fileSystemUri: vscode.Uri, projectFileUri: vscode.Uri): vscode.Uri {
	const projBaseDir = path.dirname(projectFileUri.fsPath);
	let localUri = '';

	if (fileSystemUri.fsPath.startsWith(projBaseDir)) {
		localUri = fileSystemUri.fsPath.substring(projBaseDir.length);
	}
	else {
		vscode.window.showErrorMessage('Project pointing to file outside of directory');
		throw new Error('Project pointing to file outside of directory');
	}

	return vscode.Uri.parse(localUri); // Not totally sure what I want this output to look like
}

export class FileNode extends BaseProjectTreeItem {
	public fileSystemUri: vscode.Uri;

	constructor(filePath: vscode.Uri, parent: FolderNode | ProjectRootTreeItem) {
		super(fsPathToProjectUri(filePath, parent.projectFile), parent);
		this.fileSystemUri = filePath;
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}

	public get treeItem(): vscode.TreeItem {
		return new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.None);
	}
}

export class DataSourcesTreeItem extends BaseProjectTreeItem {
	private dataSources: DataSourceTreeItem[] = [];

	constructor(project: ProjectRootTreeItem) {
		super(vscode.Uri.parse(path.join(project.uri.path, constants.dataSourcesNodeName)), project);
	}

	public createDataSource(json: string) {
		this.dataSources.push(constructDataSourceTreeItem(json, this));
	}

	public get children(): BaseProjectTreeItem[] {
		return this.dataSources;
	}

	public get treeItem(): vscode.TreeItem {
		return new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.Collapsed);
	}
}

abstract class DataSourceTreeItem extends BaseProjectTreeItem { }

export function constructDataSourceTreeItem(json: string, dataSourcesNode: DataSourcesTreeItem): DataSourceTreeItem {
	// eventual switch statement

	return new SqlConnectionDataSourceTreeItem(json, dataSourcesNode);
}

export class SqlConnectionDataSourceTreeItem extends DataSourceTreeItem {
	constructor(json: string, dataSourcesNode: DataSourcesTreeItem) {
		const name = json; // parse placeholder

		super(vscode.Uri.parse(path.join(dataSourcesNode.uri.path, name)), dataSourcesNode);
	}

	public get treeItem(): vscode.TreeItem {
		return new vscode.TreeItem(this.uri, vscode.TreeItemCollapsibleState.None);
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}
}
