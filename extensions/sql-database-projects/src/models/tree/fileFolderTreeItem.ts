/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as utils from '../../common/utils';
import { BaseProjectTreeItem } from './baseTreeItem';
import { DatabaseProjectItemType, sqlprojExtension } from '../../common/constants';
import { IconPathHelper } from '../../common/iconHelper';

/**
 * Node representing a folder in a project
 */
export class FolderNode extends BaseProjectTreeItem {
	public fileChildren: { [childName: string]: (FolderNode | FileNode) } = {};
	public fileSystemUri: vscode.Uri;

	constructor(folderPath: vscode.Uri, sqlprojUri: vscode.Uri) {
		super(fsPathToProjectUri(folderPath, sqlprojUri), sqlprojUri);
		this.fileSystemUri = folderPath;
	}

	public get children(): BaseProjectTreeItem[] {
		return Object.values(this.fileChildren).sort(sortFileFolderNodes);
	}

	public get treeItem(): vscode.TreeItem {
		const folderItem = new vscode.TreeItem(this.fileSystemUri, vscode.TreeItemCollapsibleState.Collapsed);
		folderItem.contextValue = DatabaseProjectItemType.folder;
		folderItem.iconPath = IconPathHelper.folder;

		return folderItem;
	}
}

/**
 * Node representing a file in a project
 */
export abstract class FileNode extends BaseProjectTreeItem {
	public fileSystemUri: vscode.Uri;

	constructor(filePath: vscode.Uri, sqlprojUri: vscode.Uri) {
		super(fsPathToProjectUri(filePath, sqlprojUri, true), sqlprojUri);
		this.fileSystemUri = filePath;
	}

	public get children(): BaseProjectTreeItem[] {
		return [];
	}

	public get treeItem(): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(this.fileSystemUri, vscode.TreeItemCollapsibleState.None);

		treeItem.command = {
			title: 'Open file with file watcher',
			command: 'sqlDatabaseProjects.openFileWithWatcher',
			arguments: [this.fileSystemUri, this]
		};

		treeItem.contextValue = DatabaseProjectItemType.file;

		return treeItem;
	}
}

export class SqlObjectFileNode extends FileNode {
	public override get treeItem(): vscode.TreeItem {
		const treeItem = super.treeItem;
		treeItem.contextValue = DatabaseProjectItemType.sqlObjectScript;

		return treeItem;
	}
}

export class ExternalStreamingJobFileNode extends SqlObjectFileNode {
	public override get treeItem(): vscode.TreeItem {
		const treeItem = super.treeItem;
		treeItem.contextValue = DatabaseProjectItemType.externalStreamingJob;

		return treeItem;
	}
}

export class TableFileNode extends SqlObjectFileNode {
	public override get treeItem(): vscode.TreeItem {
		const treeItem = super.treeItem;
		treeItem.contextValue = DatabaseProjectItemType.table;

		return treeItem;
	}
}

export class PreDeployNode extends FileNode {
	public override get treeItem(): vscode.TreeItem {
		const treeItem = super.treeItem;
		treeItem.contextValue = DatabaseProjectItemType.preDeploymentScript;

		return treeItem;
	}
}

export class PostDeployNode extends FileNode {
	public override get treeItem(): vscode.TreeItem {
		const treeItem = super.treeItem;
		treeItem.contextValue = DatabaseProjectItemType.postDeploymentScript;

		return treeItem;
	}
}

export class NoneNode extends FileNode {
	public override get treeItem(): vscode.TreeItem {
		const treeItem = super.treeItem;
		treeItem.contextValue = DatabaseProjectItemType.noneFile;

		return treeItem;
	}
}

export class PublishProfileNode extends FileNode {
	public override get treeItem(): vscode.TreeItem {
		const treeItem = super.treeItem;
		treeItem.contextValue = DatabaseProjectItemType.publishProfile;

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
	} else if (!(a instanceof FolderNode) && b instanceof FolderNode) {
		return 1;
	} else {
		return a.relativeProjectUri.fsPath.localeCompare(b.relativeProjectUri.fsPath);
	}
}

/**
 * Converts a full filesystem URI to a project-relative URI that's compatible with the project tree
 */
function fsPathToProjectUri(fileSystemUri: vscode.Uri, sqlprojUri: vscode.Uri, isFile?: boolean): vscode.Uri {
	const projBaseDir = path.dirname(sqlprojUri.fsPath);
	const projectFolderName = path.basename(sqlprojUri.fsPath, sqlprojExtension);
	let localUri = '';

	if (fileSystemUri.fsPath.startsWith(projBaseDir)) {
		localUri = fileSystemUri.fsPath.substring(projBaseDir.length);
	} else if (isFile) {
		// if file is outside the folder add add at top level in tree
		// this is not true for folders otherwise the outside files will not be directly inside the top level
		const parts = utils.getPlatformSafeFileEntryPath(fileSystemUri.fsPath).split('/');
		localUri = parts[parts.length - 1];
	}

	return vscode.Uri.file(path.join(projectFolderName, localUri));
}
