/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { BaseProjectTreeItem } from './baseTreeItem';
import * as fileTree from './fileFolderTreeItem';
import { Project } from '../project';
import * as utils from '../../common/utils';
import { DatabaseReferencesTreeItem } from './databaseReferencesTreeItem';
import { DatabaseProjectItemType, RelativeOuterPath, ExternalStreamingJob, sqlprojExtension, CollapseProjectNodesKey } from '../../common/constants';
import { IconPathHelper } from '../../common/iconHelper';
import { FileProjectEntry } from '../projectEntry';
import { EntryType } from 'sqldbproj';
import { DBProjectConfigurationKey } from '../../tools/netcoreTool';
import { SqlCmdVariablesTreeItem } from './sqlcmdVariableTreeItem';

/**
 * TreeNode root that represents an entire project
 */
export class ProjectRootTreeItem extends BaseProjectTreeItem {
	databaseReferencesNode: DatabaseReferencesTreeItem;
	sqlCmdVariablesNode: SqlCmdVariablesTreeItem;
	fileChildren: { [childName: string]: (fileTree.FolderNode | fileTree.FileNode) } = {};
	project: Project;
	fileSystemUri: vscode.Uri;
	projectNodeName: string;

	constructor(project: Project) {
		super(vscode.Uri.parse(path.basename(project.projectFilePath, sqlprojExtension)), vscode.Uri.file(project.projectFilePath), undefined);

		this.project = project;
		this.fileSystemUri = vscode.Uri.file(project.projectFilePath);
		this.projectNodeName = path.basename(project.projectFilePath, sqlprojExtension);

		this.databaseReferencesNode = new DatabaseReferencesTreeItem(this.projectNodeName, this.sqlprojUri, project.databaseReferences, this);
		this.sqlCmdVariablesNode = new SqlCmdVariablesTreeItem(this.projectNodeName, this.sqlprojUri, project.sqlCmdVariables, this);
		this.construct();
	}

	public get children(): BaseProjectTreeItem[] {
		const output: BaseProjectTreeItem[] = [];
		output.push(this.databaseReferencesNode);
		output.push(this.sqlCmdVariablesNode);

		return output.concat(Object.values(this.fileChildren).sort(fileTree.sortFileFolderNodes));
	}

	public get treeItem(): vscode.TreeItem {
		const collapsibleState = vscode.workspace.getConfiguration(DBProjectConfigurationKey)[CollapseProjectNodesKey] ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded;
		const projectItem = new vscode.TreeItem(this.fileSystemUri, collapsibleState);
		projectItem.contextValue = this.project.isSdkStyleProject ? DatabaseProjectItemType.project : DatabaseProjectItemType.legacyProject;
		projectItem.iconPath = IconPathHelper.databaseProject;
		projectItem.label = this.projectNodeName;

		return projectItem;
	}

	/**
	 * Processes the list of files in a project file to constructs the tree
	 */
	private construct() {
		let treeItemList = this.project.files
			.concat(this.project.preDeployScripts)
			.concat(this.project.postDeployScripts)
			.concat(this.project.noneDeployScripts);

		for (const entry of treeItemList) {
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
					if (entry.sqlObjectType === ExternalStreamingJob) {
						newNode = new fileTree.ExternalStreamingJobFileNode(entry.fsUri, this.sqlprojUri, parentNode);
					} else if (entry.containsCreateTableStatement) {
						newNode = new fileTree.TableFileNode(entry.fsUri, this.sqlprojUri, parentNode);
					}
					else {
						newNode = new fileTree.FileNode(entry.fsUri, this.sqlprojUri, parentNode);
					}

					break;
				case EntryType.Folder:
					newNode = new fileTree.FolderNode(entry.fsUri, this.sqlprojUri, parentNode);
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
	private getEntryParentNode(entry: FileProjectEntry): fileTree.FolderNode | ProjectRootTreeItem {
		const relativePathParts = utils.trimChars(utils.trimUri(this.sqlprojUri, entry.fsUri), '/').split('/').slice(0, -1); // remove the last part because we only care about the parent

		if (relativePathParts.length === 0) {
			return this; // if nothing left after trimming the entry itself, must been root
		}

		if (relativePathParts[0] === RelativeOuterPath) {
			return this;
		}

		let current: fileTree.FolderNode | ProjectRootTreeItem = this;

		for (const part of relativePathParts) {
			if (current.fileChildren[part] === undefined) {
				const parentPath = current instanceof ProjectRootTreeItem ? path.dirname(current.fileSystemUri.fsPath) : current.fileSystemUri.fsPath;
				current.fileChildren[part] = new fileTree.FolderNode(vscode.Uri.file(path.join(parentPath, part)), this.sqlprojUri, current);
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
