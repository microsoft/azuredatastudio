/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import * as vscodeMssql from 'vscode-mssql';
import * as mssql from 'mssql';
import * as templates from '../templates/templates';
import * as path from 'path';

import { ProjectsController } from './projectController';
import { DBProjectConfigurationKey, DotnetInstallLocationKey, NetCoreInstallLocationKey, NetCoreTool } from '../tools/netcoreTool';
import { IconPathHelper } from '../common/iconHelper';
import { WorkspaceTreeItem } from 'dataworkspace';
import * as constants from '../common/constants';
import { SqlDatabaseProjectProvider } from '../projectProvider/projectProvider';
import { EntryType, GenerateProjectFromOpenApiSpecOptions, ItemType } from 'sqldbproj';
import { FileNode, TableFileNode } from '../models/tree/fileFolderTreeItem';
import { getAzdataApi } from '../common/utils';
import { Project } from '../models/project';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	protected projectsController: ProjectsController;
	protected netcoreTool: NetCoreTool;
	private _outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel(constants.projectsOutputChannel);

	public constructor(private context: vscode.ExtensionContext) {
		this.projectsController = new ProjectsController(this._outputChannel);
		this.netcoreTool = new NetCoreTool(this._outputChannel);
	}

	public get extensionContext(): vscode.ExtensionContext {
		return this.context;
	}

	public get projController(): ProjectsController {
		return this.projectsController;
	}

	public deactivate(): void {
	}

	public async activate(): Promise<SqlDatabaseProjectProvider> {
		// upgrade path from former netCoreSDKLocation setting to dotnetSDK Location setting
		// copy old setting's value to new setting
		const oldNetCoreInstallSetting = vscode.workspace.getConfiguration(DBProjectConfigurationKey)[NetCoreInstallLocationKey];
		if (oldNetCoreInstallSetting && !vscode.workspace.getConfiguration(DBProjectConfigurationKey)[DotnetInstallLocationKey]) {
			await vscode.workspace.getConfiguration(DBProjectConfigurationKey).update(DotnetInstallLocationKey, oldNetCoreInstallSetting, true);
		}

		await this.initializeDatabaseProjects();
		return new SqlDatabaseProjectProvider(this.projectsController);
	}

	private async initializeDatabaseProjects(): Promise<void> {
		// init commands
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.properties', async (node: WorkspaceTreeItem) => { return vscode.window.showErrorMessage(`Properties not yet implemented: ${node.element.uri.path}`); })); // TODO

		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.build', async (node: WorkspaceTreeItem) => { return this.projectsController.buildProject(node, false); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.buildWithCodeAnalysis', async (node: WorkspaceTreeItem) => { return this.projectsController.buildProject(node, true); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.publish', async (node: WorkspaceTreeItem) => { return this.projectsController.publishProject(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.publishDialog', async (node: WorkspaceTreeItem) => { return this.projectsController.publishProject(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.schemaCompare', async (node: WorkspaceTreeItem) => { return this.projectsController.schemaCompare(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.schemaComparePublishProjectChanges', async (operationId: string, projectFilePath: string, folderStructure: mssql.ExtractTarget): Promise<mssql.SchemaComparePublishProjectResult> => { return await this.projectsController.schemaComparePublishProjectChanges(operationId, projectFilePath, folderStructure); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.updateProjectFromDatabase', async (node: azdataType.IConnectionProfile | vscodeMssql.ITreeNodeInfo | WorkspaceTreeItem) => { await this.projectsController.updateProjectFromDatabase(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.createProjectFromDatabase', async (context: azdataType.IConnectionProfile | vscodeMssql.ITreeNodeInfo | undefined) => { return this.projectsController.createProjectFromDatabase(context); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.generateProjectFromOpenApiSpec', async (options?: GenerateProjectFromOpenApiSpecOptions) => { return this.projectsController.generateProjectFromOpenApiSpec(options); }));

		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.newScript', async (node: WorkspaceTreeItem) => { return this.projectsController.addItemPromptFromNode(node, ItemType.script); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.newPreDeploymentScript', async (node: WorkspaceTreeItem) => { return this.projectsController.addItemPromptFromNode(node, ItemType.preDeployScript); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.newPostDeploymentScript', async (node: WorkspaceTreeItem) => { return this.projectsController.addItemPromptFromNode(node, ItemType.postDeployScript); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.newTable', async (node: WorkspaceTreeItem) => { return this.projectsController.addItemPromptFromNode(node, ItemType.table); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.newView', async (node: WorkspaceTreeItem) => { return this.projectsController.addItemPromptFromNode(node, ItemType.view); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.newStoredProcedure', async (node: WorkspaceTreeItem) => { return this.projectsController.addItemPromptFromNode(node, ItemType.storedProcedure); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.newItem', async (node: WorkspaceTreeItem) => { return this.projectsController.addItemPromptFromNode(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.addExistingItem', async (node: WorkspaceTreeItem) => { return this.projectsController.addExistingItemPrompt(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.newFolder', async (node: WorkspaceTreeItem) => { return this.projectsController.addFolderPrompt(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.newPublishProfile', async (node: WorkspaceTreeItem) => { return this.projectsController.addItemPromptFromNode(node, ItemType.publishProfile); }));

		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.addDatabaseReference', async (node: WorkspaceTreeItem) => { return this.projectsController.addDatabaseReference(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.openReferencedSqlProject', async (node: WorkspaceTreeItem) => { return this.projectsController.openReferencedSqlProject(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.openContainingFolder', async (node: WorkspaceTreeItem) => { return this.projectsController.openContainingFolder(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.editProjectFile', async (node: WorkspaceTreeItem) => { return this.projectsController.editProjectFile(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.delete', async (node: WorkspaceTreeItem) => { return this.projectsController.delete(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.exclude', async (node: WorkspaceTreeItem) => { return this.projectsController.exclude(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.rename', async (node: WorkspaceTreeItem) => { return this.projectsController.rename(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.editSqlCmdVariable', async (node: WorkspaceTreeItem) => { return this.projectsController.editSqlCmdVariable(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.addSqlCmdVariable', async (node: WorkspaceTreeItem) => { return this.projectsController.addSqlCmdVariable(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.changeTargetPlatform', async (node: WorkspaceTreeItem) => { return this.projectsController.changeTargetPlatform(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.validateExternalStreamingJob', async (node: WorkspaceTreeItem) => { return this.projectsController.validateExternalStreamingJob(node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.openFileWithWatcher', async (fileSystemUri: vscode.Uri, node: FileNode) => { return this.projectsController.openFileWithWatcher(fileSystemUri, node); }));
		this.context.subscriptions.push(vscode.commands.registerCommand('sqlDatabaseProjects.openInDesigner', async (node: WorkspaceTreeItem) => {
			if (node?.element instanceof TableFileNode) {
				const tableFileNode = node.element as TableFileNode;

				const projectPath = tableFileNode.projectFileUri.fsPath;
				const project = await Project.openProject(projectPath);
				const targetVersion = project.getProjectTargetVersion();
				const filePath = tableFileNode.fileSystemUri.fsPath;

				await getAzdataApi()!.designers.openTableDesigner('MSSQL', {
					title: tableFileNode.friendlyName,
					tooltip: `${projectPath} - ${tableFileNode.friendlyName}`,
					id: filePath,
					isNewTable: false,
					tableScriptPath: filePath,
					projectFilePath: projectPath,
					allScripts: project.sqlObjectScripts.filter(entry => entry.type === EntryType.File && path.extname(entry.fsUri.fsPath).toLowerCase() === constants.sqlFileExtension)
						.map(entry => entry.fsUri.fsPath),
					targetVersion: targetVersion
				}, {
					'ProjectTargetVersion': targetVersion
				});
			}
		}));

		IconPathHelper.setExtensionContext(this.extensionContext);

		await templates.loadTemplates(path.join(this.context.extensionPath, 'resources', 'templates'));
	}

	public dispose(): void {
		this.deactivate();
	}
}
