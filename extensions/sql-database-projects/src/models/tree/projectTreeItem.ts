/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { BaseProjectTreeItem } from './baseTreeItem';
import * as fileTree from './fileFolderTreeItem';
import { Project } from '../project';
import * as utils from '../../common/utils';
import * as mssql from 'mssql';
import * as vscodeMssql from 'vscode-mssql';
import { DatabaseReferencesTreeItem } from './databaseReferencesTreeItem';
import { DatabaseProjectItemType, RelativeOuterPath, ExternalStreamingJob, sqlprojExtension, CollapseProjectNodesKey, errorPrefix } from '../../common/constants';
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
		projectItem.contextValue = this.type;
		projectItem.iconPath = IconPathHelper.databaseProject;
		projectItem.label = this.projectNodeName;

		return projectItem;
	}

	public get type(): DatabaseProjectItemType {
		let projectType;
		if (utils.getAzdataApi()) {
			projectType = this.project.sqlProjStyle === mssql.ProjectType.SdkStyle ? DatabaseProjectItemType.project : DatabaseProjectItemType.legacyProject;
		} else {
			projectType = this.project.sqlProjStyle === vscodeMssql.ProjectType.SdkStyle ? DatabaseProjectItemType.project : DatabaseProjectItemType.legacyProject;
		}
		return projectType;
	}

	/**
	 * Processes the list of files in a project file to constructs the tree
	 */
	private construct() {
		// folders
		// Note: folders must be sorted to ensure that parent folders come before their children
		for (const folder of this.project.folders.sort((a, b) => a.relativePath < b.relativePath ? -1 : (a.relativePath > b.relativePath ? 1 : 0))) {
			const newNode = new fileTree.FolderNode(folder.fsUri, this.projectFileUri, folder.relativePath);
			this.addNode(newNode, folder);
		}

		// pre deploy scripts
		for (const preDeployEntry of this.project.preDeployScripts) {
			const newNode = new fileTree.PreDeployNode(preDeployEntry.fsUri, this.projectFileUri, preDeployEntry.relativePath);
			this.addNode(newNode, preDeployEntry);
		}

		// post deploy scripts
		for (const postDeployEntry of this.project.postDeployScripts) {
			const newNode = new fileTree.PostDeployNode(postDeployEntry.fsUri, this.projectFileUri, postDeployEntry.relativePath);
			this.addNode(newNode, postDeployEntry);
		}

		// none scripts
		for (const noneEntry of this.project.noneDeployScripts) {
			const newNode = new fileTree.NoneNode(noneEntry.fsUri, this.projectFileUri, noneEntry.relativePath);
			this.addNode(newNode, noneEntry);
		}

		// publish profiles
		for (const publishProfile of this.project.publishProfiles) {
			const newNode = new fileTree.PublishProfileNode(publishProfile.fsUri, this.projectFileUri, publishProfile.relativePath);
			this.addNode(newNode, publishProfile);
		}

		// sql object scripts
		for (const entry of this.project.sqlObjectScripts) {
			let newNode: fileTree.FileNode;

			if (entry.sqlObjectType === ExternalStreamingJob) {
				newNode = new fileTree.ExternalStreamingJobFileNode(entry.fsUri, this.projectFileUri, entry.relativePath);
			} else if (entry.containsCreateTableStatement) {
				newNode = new fileTree.TableFileNode(entry.fsUri, this.projectFileUri, entry.relativePath);
			} else {
				newNode = new fileTree.SqlObjectFileNode(entry.fsUri, this.projectFileUri, entry.relativePath);
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

		if (relativePathParts[0] === RelativeOuterPath) { // scripts external to the project folder are always parented by the project root node because external folders aren't supported
			return this;
		}

		let current: fileTree.FolderNode | ProjectRootTreeItem = this; // start with the Project root node

		for (const part of relativePathParts) { // iterate from the project root, down the path to the entry in question
			if (current.fileChildren[part] === undefined) {
				// DacFx.Projects populates the list of folders with those implicitly included via parentage.
				// e.g. <Folder Include="MySchema\Tables"> and <Build Include="MySchema\SomeScript.sql"> both result in the "MySchema" folder being automatically added,
				// even if there's no <Folder Include="MySchema"> entry.
				// Project tree unit tests need to explicitly include parent folders because they bypass DacFx's logic, or they'll hit this error.
				throw new Error(errorPrefix(`All parent nodes for ${relativePathParts} should have already been added.`));
			}

			if (current.fileChildren[part] instanceof fileTree.FileNode) {
				return current; // if we've made it to the node in question, we're done
			}
			else {
				current = current.fileChildren[part] as fileTree.FolderNode; // otherwise, shift the current node down, and repeat
			}
		}

		return current;
	}
}
