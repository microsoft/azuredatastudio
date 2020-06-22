/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../common/constants';
import * as dataSources from '../models/dataSources/dataSources';
import * as mssql from '../../../mssql';
import * as path from 'path';
import * as utils from '../common/utils';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as templates from '../templates/templates';
import * as xmldom from 'xmldom';

import { Uri, QuickPickItem, WorkspaceFolder, extensions, Extension } from 'vscode';
import { IConnectionProfile, TaskExecutionMode } from 'azdata';
import { promises as fs } from 'fs';
import { ApiWrapper } from '../common/apiWrapper';
import { DeployDatabaseDialog } from '../dialogs/deployDatabaseDialog';
import { Project, DatabaseReferenceLocation, SystemDatabase, TargetPlatform } from '../models/project';
import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { FolderNode } from '../models/tree/fileFolderTreeItem';
import { IDeploymentProfile, IGenerateScriptProfile, PublishSettings } from '../models/IDeploymentProfile';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';
import { ImportDataModel } from '../models/api/import';
import { NetCoreTool, DotNetCommandOptions } from '../tools/netcoreTool';
import { BuildHelper } from '../tools/buildHelper';

// TODO: use string enums
export enum ExtractTarget {
	dacpac = 0,
	file = 1,
	flat = 2,
	objectType = 3,
	schema = 4,
	schemaObjectType = 5
}

/**
 * Controller for managing project lifecycle
 */
export class ProjectsController {
	private projectTreeViewProvider: SqlDatabaseProjectTreeViewProvider;
	private netCoreTool: NetCoreTool;
	private buildHelper: BuildHelper;

	projects: Project[] = [];

	constructor(private apiWrapper: ApiWrapper, projTreeViewProvider: SqlDatabaseProjectTreeViewProvider) {
		this.projectTreeViewProvider = projTreeViewProvider;
		this.netCoreTool = new NetCoreTool();
		this.buildHelper = new BuildHelper();
	}

	public refreshProjectsTree() {
		this.projectTreeViewProvider.load(this.projects);
	}

	public async openProject(projectFile: Uri): Promise<Project> {
		for (const proj of this.projects) {
			if (proj.projectFilePath === projectFile.fsPath) {
				this.apiWrapper.showInformationMessage(constants.projectAlreadyOpened(projectFile.fsPath));
				return proj;
			}
		}

		const newProject = new Project(projectFile.fsPath);

		try {
			// Read project file
			await newProject.readProjFile();
			this.projects.push(newProject);

			// Update for round tripping as needed
			await this.updateProjectForRoundTrip(newProject);

			// Read datasources.json (if present)
			const dataSourcesFilePath = path.join(path.dirname(projectFile.fsPath), constants.dataSourcesFileName);

			newProject.dataSources = await dataSources.load(dataSourcesFilePath);
		}
		catch (err) {
			if (err instanceof dataSources.NoDataSourcesFileError) {
				// TODO: prompt to create new datasources.json; for now, swallow
			}
			else {
				throw err;
			}
		}

		this.refreshProjectsTree();

		return newProject;
	}

	public async focusProject(project?: Project): Promise<void> {
		if (project && this.projects.includes(project)) {
			await this.apiWrapper.executeCommand('sqlDatabaseProjectsView.focus');
			await this.projectTreeViewProvider.focus(project);
		}
	}

	public async createNewProject(newProjName: string, folderUri: Uri, projectGuid?: string): Promise<string> {
		if (projectGuid && !UUID.isUUID(projectGuid)) {
			throw new Error(`Specified GUID is invalid: '${projectGuid}'`);
		}

		const macroDict: Record<string, string> = {
			'PROJECT_NAME': newProjName,
			'PROJECT_GUID': projectGuid ?? UUID.generateUuid().toUpperCase()
		};

		let newProjFileContents = this.macroExpansion(templates.newSqlProjectTemplate, macroDict);

		let newProjFileName = newProjName;

		if (!newProjFileName.toLowerCase().endsWith(constants.sqlprojExtension)) {
			newProjFileName += constants.sqlprojExtension;
		}

		const newProjFilePath = path.join(folderUri.fsPath, newProjFileName);

		let fileExists = false;
		try {
			await fs.access(newProjFilePath);
			fileExists = true;
		}
		catch { } // file doesn't already exist

		if (fileExists) {
			throw new Error(constants.projectAlreadyExists(newProjFileName, folderUri.fsPath));
		}

		await fs.mkdir(path.dirname(newProjFilePath), { recursive: true });
		await fs.writeFile(newProjFilePath, newProjFileContents);

		return newProjFilePath;
	}

	public closeProject(treeNode: BaseProjectTreeItem) {
		const project = ProjectsController.getProjectFromContext(treeNode);
		this.projects = this.projects.filter((e) => { return e !== project; });
		this.refreshProjectsTree();
	}

	/**
	 * Builds a project, producing a dacpac
	 * @param treeNode a treeItem in a project's hierarchy, to be used to obtain a Project
	 * @returns path of the built dacpac
	 */
	public async buildProject(treeNode: BaseProjectTreeItem): Promise<string>;
	/**
	 * Builds a project, producing a dacpac
	 * @param project Project to be built
	 * @returns path of the built dacpac
	 */
	public async buildProject(project: Project): Promise<string>;
	public async buildProject(context: Project | BaseProjectTreeItem): Promise<string | undefined> {
		const project: Project = ProjectsController.getProjectFromContext(context);

		// Check mssql extension for project dlls (tracking issue #10273)
		await this.buildHelper.createBuildDirFolder();

		const options: DotNetCommandOptions = {
			commandTitle: 'Build',
			workingDirectory: project.projectFolderPath,
			argument: this.buildHelper.constructBuildArguments(project.projectFilePath, this.buildHelper.extensionBuildDirPath)
		};
		try {
			await this.netCoreTool.runDotnetCommand(options);

			return path.join(project.projectFolderPath, 'bin', 'Debug', `${project.projectFileName}.dacpac`);
		}
		catch (err) {
			this.apiWrapper.showErrorMessage(constants.projBuildFailed(utils.getErrorMessage(err)));
			return undefined;
		}
	}

	/**
	 * Builds and deploys a project
	 * @param treeNode a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async deployProject(treeNode: BaseProjectTreeItem): Promise<DeployDatabaseDialog>;
	/**
	 * Builds and deploys a project
	 * @param project Project to be built and deployed
	 */
	public async deployProject(project: Project): Promise<DeployDatabaseDialog>;
	public async deployProject(context: Project | BaseProjectTreeItem): Promise<DeployDatabaseDialog> {
		const project: Project = ProjectsController.getProjectFromContext(context);
		let deployDatabaseDialog = this.getDeployDialog(project);

		deployDatabaseDialog.deploy = async (proj, prof) => await this.executionCallback(proj, prof);
		deployDatabaseDialog.generateScript = async (proj, prof) => await this.executionCallback(proj, prof);
		deployDatabaseDialog.readPublishProfile = async (profileUri) => await this.readPublishProfile(profileUri);

		deployDatabaseDialog.openDialog();

		return deployDatabaseDialog;
	}

	public async executionCallback(project: Project, profile: IDeploymentProfile | IGenerateScriptProfile): Promise<mssql.DacFxResult | undefined> {
		const dacpacPath = await this.buildProject(project);

		if (!dacpacPath) {
			return undefined; // buildProject() handles displaying the error
		}

		const dacFxService = await ProjectsController.getDaxFxService();

		if ((<IDeploymentProfile>profile).upgradeExisting) {
			return await dacFxService.deployDacpac(dacpacPath, profile.databaseName, (<IDeploymentProfile>profile).upgradeExisting, profile.connectionUri, TaskExecutionMode.execute, profile.sqlCmdVariables);
		}
		else {
			return await dacFxService.generateDeployScript(dacpacPath, profile.databaseName, profile.connectionUri, TaskExecutionMode.script, profile.sqlCmdVariables);
		}
	}

	public async readPublishProfile(profileUri: Uri): Promise<PublishSettings> {
		const profileText = await fs.readFile(profileUri.fsPath);
		const profileXmlDoc = new xmldom.DOMParser().parseFromString(profileText.toString());

		// read target database name
		let targetDbName: string = '';
		let targetDatabaseNameCount = profileXmlDoc.documentElement.getElementsByTagName(constants.targetDatabaseName).length;
		if (targetDatabaseNameCount > 0) {
			// if there is more than one TargetDatabaseName nodes, SSDT uses the name in the last one so we'll do the same here
			targetDbName = profileXmlDoc.documentElement.getElementsByTagName(constants.targetDatabaseName)[targetDatabaseNameCount - 1].textContent;
		}

		// get all SQLCMD variables to include from the profile
		let sqlCmdVariables = utils.readSqlCmdVariables(profileXmlDoc);

		return {
			databaseName: targetDbName,
			sqlCmdVariables: sqlCmdVariables
		};
	}

	public async schemaCompare(treeNode: BaseProjectTreeItem): Promise<void> {
		// check if schema compare extension is installed
		if (this.apiWrapper.getExtension(constants.schemaCompareExtensionId)) {
			// build project
			await this.buildProject(treeNode);

			// start schema compare with the dacpac produced from build
			const project = ProjectsController.getProjectFromContext(treeNode);
			const dacpacPath = path.join(project.projectFolderPath, 'bin', 'Debug', `${project.projectFileName}.dacpac`);

			// check that dacpac exists
			if (await utils.exists(dacpacPath)) {
				this.apiWrapper.executeCommand('schemaCompare.start', dacpacPath);
			} else {
				this.apiWrapper.showErrorMessage(constants.buildDacpacNotFound);
			}
		} else {
			this.apiWrapper.showErrorMessage(constants.schemaCompareNotInstalled);
		}
	}

	public async addFolderPrompt(treeNode: BaseProjectTreeItem) {
		const project = ProjectsController.getProjectFromContext(treeNode);
		const newFolderName = await this.promptForNewObjectName(new templates.ProjectScriptType(templates.folder, constants.folderFriendlyName, ''), project);

		if (!newFolderName) {
			return; // user cancelled
		}

		const relativeFolderPath = path.join(this.getRelativePath(treeNode), newFolderName);

		await project.addFolderItem(relativeFolderPath);

		this.refreshProjectsTree();
	}

	public async addItemPromptFromNode(treeNode: BaseProjectTreeItem, itemTypeName?: string) {
		await this.addItemPrompt(ProjectsController.getProjectFromContext(treeNode), this.getRelativePath(treeNode), itemTypeName);
	}

	public async addItemPrompt(project: Project, relativePath: string, itemTypeName?: string) {
		if (!itemTypeName) {
			const items: QuickPickItem[] = [];

			for (const itemType of templates.projectScriptTypes()) {
				items.push({ label: itemType.friendlyName });
			}

			itemTypeName = (await this.apiWrapper.showQuickPick(items, {
				canPickMany: false
			}))?.label;

			if (!itemTypeName) {
				return; // user cancelled
			}
		}

		const itemType = templates.projectScriptTypeMap()[itemTypeName.toLocaleLowerCase()];
		let itemObjectName = await this.promptForNewObjectName(itemType, project);

		itemObjectName = itemObjectName?.trim();

		if (!itemObjectName) {
			return; // user cancelled
		}

		// TODO: file already exists?

		const newFileText = this.macroExpansion(itemType.templateScript, { 'OBJECT_NAME': itemObjectName });
		const relativeFilePath = path.join(relativePath, itemObjectName + constants.sqlFileExtension);

		const newEntry = await project.addScriptItem(relativeFilePath, newFileText);

		this.apiWrapper.executeCommand('vscode.open', newEntry.fsUri);

		this.refreshProjectsTree();
	}

	/**
	 * Adds a database reference to the project
	 * @param treeNode a treeItem in a project's hierarchy, to be used to obtain a Project
	 */
	public async addDatabaseReference(context: Project | BaseProjectTreeItem): Promise<void> {
		const project = ProjectsController.getProjectFromContext(context);

		try {
			// choose if reference is to master or a dacpac
			const databaseReferenceType = await this.getDatabaseReferenceType();

			// if master is selected, we know which dacpac needs to be added
			if (databaseReferenceType === constants.systemDatabase) {
				const systemDatabase = await this.getSystemDatabaseName(project);
				await project.addSystemDatabaseReference(systemDatabase);
			} else {
				// get other information needed to add a reference to the dacpac
				const dacpacFileLocation = await this.getDacpacFileLocation();
				const databaseLocation = await this.getDatabaseLocation();

				if (databaseLocation === DatabaseReferenceLocation.differentDatabaseSameServer) {
					const databaseName = await this.getDatabaseName(dacpacFileLocation);
					await project.addDatabaseReference(dacpacFileLocation, databaseLocation, databaseName);
				} else {
					await project.addDatabaseReference(dacpacFileLocation, databaseLocation);
				}
			}

			this.refreshProjectsTree();
		} catch (err) {
			this.apiWrapper.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	private async getDatabaseReferenceType(): Promise<string> {
		let databaseReferenceOptions: QuickPickItem[] = [
			{
				label: constants.systemDatabase
			},
			{
				label: constants.dacpac
			}
		];

		let input = await this.apiWrapper.showQuickPick(databaseReferenceOptions, {
			canPickMany: false,
			placeHolder: constants.addDatabaseReferenceInput
		});

		if (!input) {
			throw new Error(constants.databaseReferenceTypeRequired);
		}

		return input.label;
	}

	public async getSystemDatabaseName(project: Project): Promise<SystemDatabase> {
		let databaseReferenceOptions: QuickPickItem[] = [
			{
				label: constants.master
			}
		];

		// Azure dbs can only reference master
		if (project.getProjectTargetPlatform() !== TargetPlatform.SqlAzureV12) {
			databaseReferenceOptions.push(
				{
					label: constants.msdb
				});
		}

		let input = await this.apiWrapper.showQuickPick(databaseReferenceOptions, {
			canPickMany: false,
			placeHolder: constants.systemDatabaseReferenceInput
		});

		if (!input) {
			throw new Error(constants.systemDatabaseReferenceRequired);
		}

		return input.label === constants.master ? SystemDatabase.master : SystemDatabase.msdb;
	}

	private async getDacpacFileLocation(): Promise<Uri> {
		let fileUris = await this.apiWrapper.showOpenDialog(
			{
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				defaultUri: this.apiWrapper.workspaceFolders() ? (this.apiWrapper.workspaceFolders() as WorkspaceFolder[])[0].uri : undefined,
				openLabel: constants.selectString,
				filters: {
					[constants.dacpacFiles]: ['dacpac'],
				}
			}
		);

		if (!fileUris || fileUris.length === 0) {
			throw new Error(constants.dacpacFileLocationRequired);
		}

		return fileUris[0];
	}

	private async getDatabaseLocation(): Promise<DatabaseReferenceLocation> {
		let databaseReferenceOptions: QuickPickItem[] = [
			{
				label: constants.databaseReferenceSameDatabase
			},
			{
				label: constants.databaseReferenceDifferentDabaseSameServer
			}
		];

		let input = await this.apiWrapper.showQuickPick(databaseReferenceOptions, {
			canPickMany: false,
			placeHolder: constants.databaseReferenceLocation
		});

		if (input === undefined) {
			throw new Error(constants.databaseLocationRequired);
		}

		const location = input?.label === constants.databaseReferenceSameDatabase ? DatabaseReferenceLocation.sameDatabase : DatabaseReferenceLocation.differentDatabaseSameServer;
		return location;
	}

	private async getDatabaseName(dacpac: Uri): Promise<string | undefined> {
		const dacpacName = path.parse(dacpac.toString()).name;
		let databaseName = await this.apiWrapper.showInputBox({
			prompt: constants.databaseReferenceDatabaseName,
			value: `${dacpacName}`
		});

		if (!databaseName) {
			throw new Error(constants.databaseNameRequired);
		}

		databaseName = databaseName?.trim();
		return databaseName;
	}

	//#region Helper methods

	public getDeployDialog(project: Project): DeployDatabaseDialog {
		return new DeployDatabaseDialog(this.apiWrapper, project);
	}

	public async updateProjectForRoundTrip(project: Project) {
		if (project.importedTargets.includes(constants.NetCoreTargets) && !project.containsSSDTOnlySystemDatabaseReferences()) {
			return;
		}

		if (!project.importedTargets.includes(constants.NetCoreTargets)) {
			const result = await this.apiWrapper.showWarningMessage(constants.updateProjectForRoundTrip, constants.yesString, constants.noString);
			if (result === constants.yesString) {
				await project.updateProjectForRoundTrip();
				await project.updateSystemDatabaseReferencesInProjFile();
			}
		} else if (project.containsSSDTOnlySystemDatabaseReferences()) {
			const result = await this.apiWrapper.showWarningMessage(constants.updateProjectDatabaseReferencesForRoundTrip, constants.yesString, constants.noString);
			if (result === constants.yesString) {
				await project.updateSystemDatabaseReferencesInProjFile();
			}
		}
	}

	private static getProjectFromContext(context: Project | BaseProjectTreeItem) {
		if (context instanceof Project) {
			return context;
		}

		if (context.root instanceof ProjectRootTreeItem) {
			return (<ProjectRootTreeItem>context.root).project;
		}
		else {
			throw new Error(constants.unexpectedProjectContext(context.uri.path));
		}
	}

	private static async getDaxFxService(): Promise<mssql.IDacFxService> {
		const ext: Extension<any> = extensions.getExtension(mssql.extension.name)!;

		await ext.activate();
		return (ext.exports as mssql.IExtension).dacFx;
	}

	private macroExpansion(template: string, macroDict: Record<string, string>): string {
		const macroIndicator = '@@';
		let output = template;

		for (const macro in macroDict) {
			// check if value contains the macroIndicator, which could break expansion for successive macros
			if (macroDict[macro].includes(macroIndicator)) {
				throw new Error(`Macro value ${macroDict[macro]} is invalid because it contains ${macroIndicator}`);
			}

			output = output.replace(new RegExp(macroIndicator + macro + macroIndicator, 'g'), macroDict[macro]);
		}

		return output;
	}

	private async promptForNewObjectName(itemType: templates.ProjectScriptType, _project: Project): Promise<string | undefined> {
		// TODO: ask project for suggested name that doesn't conflict
		const suggestedName = itemType.friendlyName.replace(new RegExp('\s', 'g'), '') + '1';

		const itemObjectName = await this.apiWrapper.showInputBox({
			prompt: constants.newObjectNamePrompt(itemType.friendlyName),
			value: suggestedName,
		});

		return itemObjectName;
	}

	private getRelativePath(treeNode: BaseProjectTreeItem): string {
		return treeNode instanceof FolderNode ? utils.trimUri(treeNode.root.uri, treeNode.uri) : '';
	}

	/**
	 * Imports a new SQL database project from the existing database,
	 * prompting the user for a name, file path location and extract target
	 */
	public async importNewDatabaseProject(context: any): Promise<void> {
		let model = <ImportDataModel>{};

		// TODO: Refactor code
		try {
			let profile = context ? <IConnectionProfile>context.connectionProfile : undefined;
			//TODO: Prompt for new connection addition and get database information if context information isn't provided.
			if (profile) {
				model.serverId = profile.id;
				model.database = profile.databaseName;
			}
			else {
				const connectionId = (await this.apiWrapper.openConnectionDialog()).connectionId;

				const databaseList = await this.apiWrapper.listDatabases(connectionId);
				const database = (await this.apiWrapper.showQuickPick(databaseList.map(dbName => { return { label: dbName }; })))?.label;

				if (!database) {
					throw new Error(constants.databaseSelectionRequired);
				}

				model.serverId = connectionId;
				model.database = database;
			}

			// Get project name
			let newProjName = await this.getProjectName(model.database);
			if (!newProjName) {
				throw new Error(constants.projectNameRequired);
			}
			model.projName = newProjName;

			// Get extractTarget
			let extractTarget: mssql.ExtractTarget = await this.getExtractTarget();
			model.extractTarget = extractTarget;

			// Get folder location for project creation
			let newProjUri = await this.getFolderLocation(model.extractTarget);
			if (!newProjUri) {
				throw new Error(constants.projectLocationRequired);
			}

			// Set project folder/file location
			let newProjFolderUri;
			if (extractTarget === mssql.ExtractTarget['file']) {
				// Get folder info, if extractTarget = File
				newProjFolderUri = Uri.file(path.dirname(newProjUri.fsPath));
			} else {
				newProjFolderUri = newProjUri;
			}

			// Check folder is empty
			let isEmpty: boolean = await this.isDirEmpty(newProjFolderUri.fsPath);
			if (!isEmpty) {
				throw new Error(constants.projectLocationNotEmpty);
			}
			// TODO: what if the selected folder is outside the workspace?
			model.filePath = newProjUri.fsPath;

			//Set model version
			model.version = '1.0.0.0';

			// Call ExtractAPI in DacFx Service
			await this.importApiCall(model);
			// TODO: Check for success

			// Create and open new project
			const newProjFilePath = await this.createNewProject(newProjName as string, newProjFolderUri as Uri);
			const project = await this.openProject(Uri.file(newProjFilePath));

			//Create a list of all the files and directories to be added to project
			let fileFolderList: string[] = await this.generateList(model.filePath);

			// Add generated file structure to the project
			await project.addToProject(fileFolderList);

			//Refresh project to show the added files
			this.refreshProjectsTree();

			await this.focusProject(project);
		}
		catch (err) {
			this.apiWrapper.showErrorMessage(utils.getErrorMessage(err));
		}
	}

	private async getProjectName(dbName: string): Promise<string | undefined> {
		let projName = await this.apiWrapper.showInputBox({
			prompt: constants.newDatabaseProjectName,
			value: `DatabaseProject${dbName}`
		});

		projName = projName?.trim();

		return projName;
	}

	private mapExtractTargetEnum(inputTarget: any): mssql.ExtractTarget {
		if (inputTarget) {
			switch (inputTarget) {
				case 'File': return mssql.ExtractTarget['file'];
				case 'Flat': return mssql.ExtractTarget['flat'];
				case 'ObjectType': return mssql.ExtractTarget['objectType'];
				case 'Schema': return mssql.ExtractTarget['schema'];
				case 'SchemaObjectType': return mssql.ExtractTarget['schemaObjectType'];
				default: throw new Error(`Invalid input: ${inputTarget}`);
			}
		} else {
			throw new Error(constants.extractTargetRequired);
		}
	}

	private async getExtractTarget(): Promise<mssql.ExtractTarget> {
		let extractTarget: mssql.ExtractTarget;

		let extractTargetOptions: QuickPickItem[] = [];

		let keys: string[] = Object.keys(ExtractTarget).filter(k => typeof ExtractTarget[k as any] === 'number');

		// TODO: Create a wrapper class to handle the mapping
		keys.forEach((targetOption: string) => {
			if (targetOption !== 'dacpac') {		//Do not present the option to create Dacpac
				let pascalCaseTargetOption: string = utils.toPascalCase(targetOption);	// for better readability
				extractTargetOptions.push({ label: pascalCaseTargetOption });
			}
		});

		let input = await this.apiWrapper.showQuickPick(extractTargetOptions, {
			canPickMany: false,
			placeHolder: constants.extractTargetInput
		});
		let extractTargetInput = input?.label;

		extractTarget = this.mapExtractTargetEnum(extractTargetInput);

		return extractTarget;
	}

	private async getFolderLocation(extractTarget: mssql.ExtractTarget): Promise<Uri | undefined> {
		let selectionResult;
		let projUri;

		if (extractTarget !== mssql.ExtractTarget.file) {
			selectionResult = await this.apiWrapper.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: constants.selectString,
				defaultUri: this.apiWrapper.workspaceFolders() ? (this.apiWrapper.workspaceFolders() as WorkspaceFolder[])[0].uri : undefined
			});
			if (selectionResult) {
				projUri = (selectionResult as Uri[])[0];
			}
		} else {
			// Get filename
			selectionResult = await this.apiWrapper.showSaveDialog(
				{
					defaultUri: this.apiWrapper.workspaceFolders() ? (this.apiWrapper.workspaceFolders() as WorkspaceFolder[])[0].uri : undefined,
					saveLabel: constants.selectString,
					filters: {
						'SQL files': ['sql'],
						'All files': ['*']
					}
				}
			);
			if (selectionResult) {
				projUri = selectionResult as unknown as Uri;
			}
		}

		return projUri;
	}

	private async isDirEmpty(newProjFolderUri: string): Promise<boolean> {
		return (await fs.readdir(newProjFolderUri)).length === 0;
	}

	private async importApiCall(model: ImportDataModel): Promise<void> {
		let ext = this.apiWrapper.getExtension(mssql.extension.name)!;

		const service = (await ext.activate() as mssql.IExtension).dacFx;
		const ownerUri = await this.apiWrapper.getUriForConnection(model.serverId);

		await service.importDatabaseProject(model.database, model.filePath, model.projName, model.version, ownerUri, model.extractTarget, TaskExecutionMode.execute);
	}

	/**
	 * Generate a flat list of all files and folder under a folder.
	 */
	public async generateList(absolutePath: string): Promise<string[]> {
		let fileFolderList: string[] = [];

		if (!await utils.exists(absolutePath)) {
			if (await utils.exists(absolutePath + constants.sqlFileExtension)) {
				absolutePath += constants.sqlFileExtension;
			} else {
				await this.apiWrapper.showErrorMessage(constants.cannotResolvePath(absolutePath));
				return fileFolderList;
			}
		}

		const files = [absolutePath];
		do {
			const filepath = files.pop();

			if (filepath) {
				const stat = await fs.stat(filepath);

				if (stat.isDirectory()) {
					fileFolderList.push(filepath);
					(await fs
						.readdir(filepath))
						.forEach((f: string) => files.push(path.join(filepath, f)));
				}
				else if (stat.isFile()) {
					fileFolderList.push(filepath);
				}
			}

		} while (files.length !== 0);

		return fileFolderList;
	}

	//#endregion
}
