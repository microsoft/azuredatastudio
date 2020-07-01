/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as templates from '../templates/templates';
import * as constants from '../common/constants';
import * as path from 'path';

import { Uri, Disposable, ExtensionContext, WorkspaceFolder } from 'vscode';
import { ApiWrapper } from '../common/apiWrapper';
import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { getErrorMessage } from '../common/utils';
import { ProjectsController } from './projectController';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { NetCoreTool } from '../tools/netcoreTool';
import { Project } from '../models/project';
import { FileNode, FolderNode } from '../models/tree/fileFolderTreeItem';

const SQL_DATABASE_PROJECTS_VIEW_ID = 'sqlDatabaseProjectsView';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements Disposable {
	protected dbProjectTreeViewProvider: SqlDatabaseProjectTreeViewProvider = new SqlDatabaseProjectTreeViewProvider();
	protected projectsController: ProjectsController;
	protected netcoreTool: NetCoreTool;

	public constructor(private context: ExtensionContext, private apiWrapper: ApiWrapper) {
		this.projectsController = new ProjectsController(apiWrapper, this.dbProjectTreeViewProvider);
		this.netcoreTool = new NetCoreTool();
	}

	public get extensionContext(): ExtensionContext {
		return this.context;
	}

	public deactivate(): void {
	}

	public async activate(): Promise<void> {
		await this.initializeDatabaseProjects();
	}

	private async initializeDatabaseProjects(): Promise<void> {
		// init commands
		this.apiWrapper.registerCommand('sqlDatabaseProjects.new', async () => { await this.createNewProject(); });
		this.apiWrapper.registerCommand('sqlDatabaseProjects.open', async () => { await this.openProjectFromFile(); });
		this.apiWrapper.registerCommand('sqlDatabaseProjects.close', (node: BaseProjectTreeItem) => { this.projectsController.closeProject(node); });
		this.apiWrapper.registerCommand('sqlDatabaseProjects.properties', async (node: BaseProjectTreeItem) => { await this.apiWrapper.showErrorMessage(`Properties not yet implemented: ${node.uri.path}`); }); // TODO

		this.apiWrapper.registerCommand('sqlDatabaseProjects.build', async (node: BaseProjectTreeItem) => { await this.projectsController.buildProject(node); });
		this.apiWrapper.registerCommand('sqlDatabaseProjects.deploy', async (node: BaseProjectTreeItem) => { await this.projectsController.deployProject(node); });
		this.apiWrapper.registerCommand('sqlDatabaseProjects.schemaCompare', async (node: BaseProjectTreeItem) => { await this.projectsController.schemaCompare(node); });
		this.apiWrapper.registerCommand('sqlDatabaseProjects.importDatabase', async (profile: azdata.IConnectionProfile) => { await this.projectsController.importNewDatabaseProject(profile); });

		this.apiWrapper.registerCommand('sqlDatabaseProjects.newScript', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.script); });
		this.apiWrapper.registerCommand('sqlDatabaseProjects.newTable', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.table); });
		this.apiWrapper.registerCommand('sqlDatabaseProjects.newView', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.view); });
		this.apiWrapper.registerCommand('sqlDatabaseProjects.newStoredProcedure', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.storedProcedure); });
		this.apiWrapper.registerCommand('sqlDatabaseProjects.newItem', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPromptFromNode(node); });
		this.apiWrapper.registerCommand('sqlDatabaseProjects.newFolder', async (node: BaseProjectTreeItem) => { await this.projectsController.addFolderPrompt(node); });

		this.apiWrapper.registerCommand('sqlDatabaseProjects.addDatabaseReference', async (node: BaseProjectTreeItem) => { await this.projectsController.addDatabaseReference(node); });
		this.apiWrapper.registerCommand('sqlDatabaseProjects.delete', async (node: BaseProjectTreeItem) => { await this.projectsController.delete(node); });
		this.apiWrapper.registerCommand('sqlDatabaseProjects.exclude', async (node: FileNode | FolderNode) => { await this.projectsController.exclude(node); });

		// init view
		const treeView = this.apiWrapper.createTreeView(SQL_DATABASE_PROJECTS_VIEW_ID, { treeDataProvider: this.dbProjectTreeViewProvider });
		this.dbProjectTreeViewProvider.setTreeView(treeView);

		this.extensionContext.subscriptions.push(treeView);

		await templates.loadTemplates(path.join(this.context.extensionPath, 'resources', 'templates'));

		// ensure .net core is installed
		this.netcoreTool.findOrInstallNetCore();
	}

	/**
	 * Prompts the user to select a .sqlproj file to open
	 * TODO: define behavior once projects are automatically opened from workspace
	 */
	public async openProjectFromFile(): Promise<void> {
		try {
			let filter: { [key: string]: string[] } = {};

			filter[constants.sqlDatabaseProject] = ['sqlproj'];

			let files: Uri[] | undefined = await this.apiWrapper.showOpenDialog({ filters: filter });

			if (files) {
				for (const file of files) {
					await this.projectsController.openProject(file);
				}
			}
		}
		catch (err) {
			this.apiWrapper.showErrorMessage(getErrorMessage(err));
		}
	}

	/**
	 * Creates a new SQL database project from a template, prompting the user for a name and location
	 */
	public async createNewProject(): Promise<Project | undefined> {
		try {
			let newProjName = await this.apiWrapper.showInputBox({
				prompt: constants.newDatabaseProjectName,
				value: `DatabaseProject${this.projectsController.projects.length + 1}`
				// TODO: Smarter way to suggest a name.  Easy if we prompt for location first, but that feels odd...
			});

			newProjName = newProjName?.trim();

			if (!newProjName) {
				// TODO: is this case considered an intentional cancellation (shouldn't warn) or an error case (should warn)?
				this.apiWrapper.showErrorMessage(constants.projectNameRequired);
				return undefined;
			}

			let selectionResult = await this.apiWrapper.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: this.apiWrapper.workspaceFolders() ? (this.apiWrapper.workspaceFolders() as WorkspaceFolder[])[0].uri : undefined
			});

			if (!selectionResult) {
				this.apiWrapper.showErrorMessage(constants.projectLocationRequired);
				return undefined;
			}

			// TODO: what if the selected folder is outside the workspace?

			const newProjFolderUri = (selectionResult as Uri[])[0];
			const newProjFilePath = await this.projectsController.createNewProject(<string>newProjName, newProjFolderUri, true);
			const proj = await this.projectsController.openProject(Uri.file(newProjFilePath));

			return proj;
		}
		catch (err) {
			this.apiWrapper.showErrorMessage(getErrorMessage(err));
			return undefined;
		}
	}

	public dispose(): void {
		this.deactivate();
	}
}
