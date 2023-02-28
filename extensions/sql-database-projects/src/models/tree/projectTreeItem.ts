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
		super(vscode.Uri.parse(path.basename(project.projectFilePath, sqlprojExtension)), vscode.Uri.file(project.projectFilePath));

		this.project = project;
		this.fileSystemUri = vscode.Uri.file(project.projectFilePath);
		this.projectNodeName = path.basename(project.projectFilePath, sqlprojExtension);

		this.databaseReferencesNode = new DatabaseReferencesTreeItem(this.projectNodeName, this.projectFileUri, project.databaseReferences);
		this.sqlCmdVariablesNode = new SqlCmdVariablesTreeItem(this.projectNodeName, this.projectFileUri, project.sqlCmdVariables);
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
		// pre deploy scripts
		for (const preDeployEntry of this.project.preDeployScripts) {
			const newNode = new fileTree.PreDeployNode(preDeployEntry.fsUri, this.projectFileUri);
			this.addNode(newNode, preDeployEntry);
		}

		// post deploy scripts
		for (const postDeployEntry of this.project.postDeployScripts) {
			const newNode = new fileTree.PostDeployNode(postDeployEntry.fsUri, this.projectFileUri);
			this.addNode(newNode, postDeployEntry);
		}

		// none scripts
		for (const noneEntry of this.project.noneDeployScripts) {
			const newNode = new fileTree.NoneNode(noneEntry.fsUri, this.projectFileUri);
			this.addNode(newNode, noneEntry);
		}

		// publish profiles
		for (const publishProfile of this.project.publishProfiles) {
			const newNode = new fileTree.PublishProfileNode(publishProfile.fsUri, this.projectFileUri);
			this.addNode(newNode, publishProfile);
		}

		// sql object scripts and folders
		for (const entry of this.project.files) {
			let newNode: fileTree.FolderNode | fileTree.FileNode;

			switch (entry.type) {
				case EntryType.File:
					if (entry.sqlObjectType === ExternalStreamingJob) {
						newNode = new fileTree.ExternalStreamingJobFileNode(entry.fsUri, this.projectFileUri);
					} else if (entry.containsCreateTableStatement) {
						newNode = new fileTree.TableFileNode(entry.fsUri, this.projectFileUri);
					}
					else {
						newNode = new fileTree.SqlObjectFileNode(entry.fsUri, this.projectFileUri);
					}

					break;
				case EntryType.Folder:
					newNode = new fileTree.FolderNode(entry.fsUri, this.projectFileUri);
					break;
				default:
					throw new Error(`Unknown EntryType: '${entry.type}'`);
			}

			this.addNode(newNode, entry);
		}
	}

	private addNode(newNode: fileTree.FileNode | fileTree.FolderNode, entry: FileProjectEntry): void {
		// Don't add external folders
		if (entry.type !== EntryType.File && entry.relativePath.startsWith(RelativeOuterPath)) {
			return;
		}

		const parentNode = this.getEntryParentNode(entry);

		if (Object.keys(parentNode.fileChildren).includes(path.basename(entry.fsUri.path))) {
			return; // ignore duplicate entries
		}

		parentNode.fileChildren[path.basename(entry.fsUri.path)] = newNode;
	}

	/**
	 * Gets the immediate parent tree node for an entry in a project file
	 */
	private getEntryParentNode(entry: FileProjectEntry): fileTree.FolderNode | ProjectRootTreeItem {
		const relativePathParts = utils.trimChars(utils.trimUri(this.projectFileUri, entry.fsUri), '/').split('/').slice(0, -1); // remove the last part because we only care about the parent

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
				current.fileChildren[part] = new fileTree.FolderNode(vscode.Uri.file(path.join(parentPath, part)), this.projectFileUri);
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
