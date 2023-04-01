/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import * as mssql from 'mssql';

import { Uri, window } from 'vscode';
import { EntryType, IDatabaseReferenceProjectEntry, ISqlProject, ItemType } from 'sqldbproj';
import { DataSource } from './dataSources/dataSources';
import { ISystemDatabaseReferenceSettings, IDacpacReferenceSettings, IProjectReferenceSettings } from './IDatabaseReferenceSettings';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';
import { DacpacReferenceProjectEntry, FileProjectEntry, SqlProjectReferenceProjectEntry, SystemDatabaseReferenceProjectEntry } from './projectEntry';
import { ResultStatus } from 'azdata';
import { BaseProjectTreeItem } from './tree/baseTreeItem';
import { NoneNode, PostDeployNode, PreDeployNode, PublishProfileNode, SqlObjectFileNode } from './tree/fileFolderTreeItem';
import { GetFoldersResult, GetScriptsResult, ProjectType, SystemDatabase } from 'mssql';

/**
 * Represents the configuration based on the Configuration property in the sqlproj
 */
enum Configuration {
	Debug = 'Debug',     // default used if the Configuration property is not specified
	Release = 'Release',
	Output = 'Output'    // if a string besides debug or release is used, then Output is used as the configuration
}

/**
 * Class representing a Project, and providing functions for operating on it
 */
export class Project implements ISqlProject {
	private sqlProjService!: mssql.ISqlProjectsService;

	private _projectFilePath: string;
	private _projectFileName: string;
	private _projectGuid: string | undefined;
	private _files: FileProjectEntry[] = [];
	private _folders: FileProjectEntry[] = [];
	private _dataSources: DataSource[] = [];
	private _databaseReferences: IDatabaseReferenceProjectEntry[] = [];
	private _sqlCmdVariables: Record<string, string> = {};
	private _preDeployScripts: FileProjectEntry[] = [];
	private _postDeployScripts: FileProjectEntry[] = [];
	private _noneDeployScripts: FileProjectEntry[] = [];
	private _sqlProjStyle: ProjectType = ProjectType.SdkStyle;
	private _isCrossPlatformCompatible: boolean = false;
	private _outputPath: string = '';
	private _configuration: Configuration = Configuration.Debug;
	private _databaseSource: string = '';
	private _publishProfiles: FileProjectEntry[] = [];
	private _defaultCollation: string = '';
	private _databaseSchemaProvider: string = '';

	//#endregion

	//#region Public Properties

	public get dacpacOutputPath(): string {
		return path.join(this.outputPath, `${this._projectFileName}.dacpac`);
	}

	public get projectFolderPath() {
		return Uri.file(path.dirname(this._projectFilePath)).fsPath;
	}

	public get projectFilePath(): string {
		return this._projectFilePath;
	}

	public get projectFileName(): string {
		return this._projectFileName;
	}

	public get projectGuid(): string | undefined {
		return this._projectGuid;
	}

	public get files(): FileProjectEntry[] {
		return this._files;
	}

	public get folders(): FileProjectEntry[] {
		return this._folders;
	}

	public get dataSources(): DataSource[] {
		return this._dataSources;
	}

	public get databaseReferences(): IDatabaseReferenceProjectEntry[] {
		return this._databaseReferences;
	}

	public get sqlCmdVariables(): Record<string, string> {
		return this._sqlCmdVariables;
	}

	public get preDeployScripts(): FileProjectEntry[] {
		return this._preDeployScripts;
	}

	public get postDeployScripts(): FileProjectEntry[] {
		return this._postDeployScripts;
	}

	public get noneDeployScripts(): FileProjectEntry[] {
		return this._noneDeployScripts;
	}

	public get sqlProjStyle(): ProjectType {
		return this._sqlProjStyle;
	}

	public get isCrossPlatformCompatible(): boolean {
		return this._isCrossPlatformCompatible;
	}

	public get outputPath(): string {
		return this._outputPath;
	}

	public get configuration(): Configuration {
		return this._configuration;
	}

	public get publishProfiles(): FileProjectEntry[] {
		return this._publishProfiles;
	}

	//#endregion

	constructor(projectFilePath: string) {
		this._projectFilePath = projectFilePath;
		this._projectFileName = path.basename(projectFilePath, '.sqlproj');
	}

	/**
	 * Open and load a .sqlproj file
	 * @param projectFilePath
	 * @param promptIfNeedsUpdating whether or not to prompt the user if the project needs to be updated
	 * @param reload whether to reload the project from the project file
	 * @returns
	 */
	public static async openProject(projectFilePath: string, promptIfNeedsUpdating: boolean = false, reload: boolean = false): Promise<Project> {
		const proj = new Project(projectFilePath);

		proj.sqlProjService = await utils.getSqlProjectsService();

		if (reload) {
			// close the project in STS so that it will reload the project from the .sqlproj, rather than using the cached Project in STS
			await proj.sqlProjService.closeProject(projectFilePath);
		}

		await proj.readProjFile();

		if (promptIfNeedsUpdating) {
			await this.checkPromptCrossPlatStatus(proj, false /* don't block the thread until the  prompt*/);
		}

		return proj;
	}

	/**
	 * If project does not support cross-plat building, prompts the user for whether to update and updates if accepted
	 * @param project
	 * @param blockingPrompt whether to block the thread until the user updates, or to fire and forget
	 * @returns true if the project is updated after return, false if the user rejected the prompt
	 */
	public static async checkPromptCrossPlatStatus(project: Project, blockingPrompt: boolean): Promise<boolean> {
		if (project.isCrossPlatformCompatible) {
			return true;
		}

		if (blockingPrompt) {
			const result = await window.showWarningMessage(constants.updateProjectForCrossPlatform(project.projectFileName), { modal: true }, constants.yesString, constants.noString);

			// const result = await window.showQuickPick([constants.yesString, constants.noString], {
			// 	canPickMany: false,
			// 	ignoreFocusOut: true,
			// 	title: constants.updateProjectForCrossPlatform(project.projectFileName),
			// 	placeHolder: constants.updateProjectForCrossPlatformShort(project.projectFileName)
			// });

			if (result === constants.yesString) {
				await project.updateProjectForCrossPlatform();
			}
		} else {
			// use "void" with a .then() to not block the UI thread while prompting the user
			void window.showErrorMessage(constants.updateProjectForCrossPlatform(project.projectFileName), constants.yesString, constants.noString).then(async (result) => {
				if (result === constants.yesString) {
					await project.updateProjectForCrossPlatform();
				}
			});
		}

		return project.isCrossPlatformCompatible;
	}

	/**
	 * Reads the project setting and contents from the file
	 */
	public async readProjFile(): Promise<void> {
		this.resetProject();

		await this.readProjectProperties();
		await this.readSqlCmdVariables();
		await this.readDatabaseReferences();

		// get pre and post deploy scripts specified in the sqlproj
		await this.readPreDeployScripts(true);
		await this.readPostDeployScripts(true);

		await this.readNoneItems(); // also populates list of publish profiles, determined by file extension

		await this.readFilesInProject(); // get SQL object scripts
		await this.readFolders(); // get folders
	}

	//#region Reader helpers

	private async readProjectProperties(): Promise<void> {
		const result = await this.sqlProjService.getProjectProperties(this.projectFilePath);
		this.throwIfFailed(result);

		this._projectGuid = result.projectGuid;

		switch (result.configuration.toLowerCase()) {
			case Configuration.Debug.toString().toLowerCase():
				this._configuration = Configuration.Debug;
				break;
			case Configuration.Release.toString().toLowerCase():
				this._configuration = Configuration.Release;
				break;
			default:
				this._configuration = Configuration.Output; // if the configuration doesn't match release or debug, the dacpac will get created in ./bin/Output
		}

		this._outputPath = path.isAbsolute(result.outputPath) ? result.outputPath : path.join(this.projectFolderPath, utils.getPlatformSafeFileEntryPath(result.outputPath));
		this._databaseSource = result.databaseSource ?? '';
		this._defaultCollation = result.defaultCollation;
		this._databaseSchemaProvider = result.databaseSchemaProvider;
		this._sqlProjStyle = result.projectStyle;

		await this.readCrossPlatformCompatibility();
	}

	private async readCrossPlatformCompatibility(): Promise<void> {
		const result = await this.sqlProjService.getCrossPlatformCompatibility(this.projectFilePath)
		this.throwIfFailed(result);

		this._isCrossPlatformCompatible = result.isCrossPlatformCompatible;
	}

	private async readSqlCmdVariables(): Promise<void> {
		const sqlcmdVariablesResult = await this.sqlProjService.getSqlCmdVariables(this.projectFilePath);

		if (!sqlcmdVariablesResult.success && sqlcmdVariablesResult.errorMessage) {
			throw new Error(constants.errorReadingProject(constants.sqlCmdVariables, this.projectFilePath, sqlcmdVariablesResult.errorMessage));
		}

		this._sqlCmdVariables = {};

		for (const variable of sqlcmdVariablesResult.sqlCmdVariables) {
			this._sqlCmdVariables[variable.varName] = variable.defaultValue; // store the default value that's specified in the .sqlproj
		}
	}

	/**
	 * Gets all the files specified by <Build Inlude="..."> and removes all the files specified by <Build Remove="...">
	 * and all files included by the default glob of the folder of the sqlproj if it's an sdk style project
	 */
	private async readFilesInProject(): Promise<void> {
		const filesSet: Set<string> = new Set();

		var result: GetScriptsResult = await this.sqlProjService.getSqlObjectScripts(this.projectFilePath);

		this.throwIfFailed(result);

		if (result.scripts?.length > 0) { // empty array from SqlToolsService is deserialized as null
			for (var script of result.scripts) {
				filesSet.add(script);
			}
		}

		// create a FileProjectEntry for each file
		const fileEntries: FileProjectEntry[] = [];
		for (let f of Array.from(filesSet.values())) {

			// read file to check if it has a "Create Table" statement
			const fullPath = path.join(utils.getPlatformSafeFileEntryPath(this.projectFolderPath), utils.getPlatformSafeFileEntryPath(f));
			const containsCreateTableStatement: boolean = await utils.fileContainsCreateTableStatement(fullPath, this.getProjectTargetVersion());

			fileEntries.push(this.createFileProjectEntry(f, EntryType.File, undefined, containsCreateTableStatement));
		}

		this._files = fileEntries;
	}

	private async readFolders(): Promise<void> {
		var result: GetFoldersResult = await this.sqlProjService.getFolders(this.projectFilePath);
		this.throwIfFailed(result);

		const folderEntries: FileProjectEntry[] = [];

		if (result.folders?.length > 0) { // empty array from SqlToolsService is deserialized as null
			for (var folderPath of result.folders) {
				// Don't include folders that aren't supported:
				// 1. Don't add Properties folder since it isn't supported in ADS.In SSDT, it isn't a physical folder, but it's specified in legacy sql projects
				// to display the Properties node in the project tree.
				// 2. Don't add external folders (relative path starts with "..")
				if (folderPath === constants.Properties || folderPath.startsWith(constants.RelativeOuterPath)) {
					continue;
				}

				folderEntries.push(this.createFileProjectEntry(folderPath, EntryType.Folder));
			}
		}

		this._folders = folderEntries;
	}

	private async readPreDeployScripts(warnIfMultiple: boolean = false): Promise<void> {
		var result: GetScriptsResult = await this.sqlProjService.getPreDeploymentScripts(this.projectFilePath);
		this.throwIfFailed(result);

		const preDeploymentScriptEntries: FileProjectEntry[] = [];

		if (result.scripts?.length > 0) { // empty array from SqlToolsService is deserialized as null
			for (var scriptPath of result.scripts) {
				preDeploymentScriptEntries.push(this.createFileProjectEntry(scriptPath, EntryType.File));
			}
		}

		if (preDeploymentScriptEntries.length > 1 && warnIfMultiple) {
			void window.showWarningMessage(constants.prePostDeployCount, constants.okString);
		}

		this._preDeployScripts = preDeploymentScriptEntries;
	}

	private async readPostDeployScripts(warnIfMultiple: boolean = false): Promise<void> {
		var result: GetScriptsResult = await this.sqlProjService.getPostDeploymentScripts(this.projectFilePath);
		this.throwIfFailed(result);

		const postDeploymentScriptEntries: FileProjectEntry[] = [];

		if (result.scripts?.length > 0) { // empty array from SqlToolsService is deserialized as null
			for (var scriptPath of result.scripts) {
				postDeploymentScriptEntries.push(this.createFileProjectEntry(scriptPath, EntryType.File));
			}
		}

		if (postDeploymentScriptEntries.length > 1 && warnIfMultiple) {
			void window.showWarningMessage(constants.prePostDeployCount, constants.okString);
		}

		this._postDeployScripts = postDeploymentScriptEntries;
	}

	private async readNoneItems(): Promise<void> {
		var result: GetScriptsResult = await this.sqlProjService.getNoneItems(this.projectFilePath);
		this.throwIfFailed(result);

		const noneItemEntries: FileProjectEntry[] = [];

		if (result.scripts?.length > 0) { // empty array from SqlToolsService is deserialized as null
			for (var path of result.scripts) {
				noneItemEntries.push(this.createFileProjectEntry(path, EntryType.File));
			}
		}

		this._noneDeployScripts = [];
		this._publishProfiles = [];

		for (const entry of noneItemEntries) {
			if (utils.isPublishProfile(entry.relativePath)) {
				this._publishProfiles.push(entry);
			} else {
				this._noneDeployScripts.push(entry);
			}
		}
	}

	private async readDatabaseReferences(): Promise<void> {
		this._databaseReferences = [];
		const databaseReferencesResult = await this.sqlProjService.getDatabaseReferences(this.projectFilePath);

		for (const dacpacReference of databaseReferencesResult.dacpacReferences) {
			this._databaseReferences.push(new DacpacReferenceProjectEntry({
				dacpacFileLocation: Uri.file(dacpacReference.dacpacPath),
				suppressMissingDependenciesErrors: dacpacReference.suppressMissingDependencies,

				databaseVariableLiteralValue: dacpacReference.databaseVariableLiteralName,
				databaseName: dacpacReference.databaseVariable?.varName,
				databaseVariable: dacpacReference.databaseVariable?.value,
				serverName: dacpacReference.serverVariable?.varName,
				serverVariable: dacpacReference.serverVariable?.value
			}));
		}

		for (const projectReference of databaseReferencesResult.sqlProjectReferences) {
			this._databaseReferences.push(new SqlProjectReferenceProjectEntry({
				projectName: path.basename(utils.getPlatformSafeFileEntryPath(projectReference.projectPath), constants.sqlprojExtension),
				projectGuid: projectReference.projectGuid ?? '',
				suppressMissingDependenciesErrors: projectReference.suppressMissingDependencies,
				projectRelativePath: Uri.file(utils.getPlatformSafeFileEntryPath(projectReference.projectPath)),

				databaseVariableLiteralValue: projectReference.databaseVariableLiteralName,
				databaseName: projectReference.databaseVariable?.varName,
				databaseVariable: projectReference.databaseVariable?.value,
				serverName: projectReference.serverVariable?.varName,
				serverVariable: projectReference.serverVariable?.value
			}));
		}

		for (const systemDbReference of databaseReferencesResult.systemDatabaseReferences) {
			this._databaseReferences.push(new SystemDatabaseReferenceProjectEntry(
				systemDbReference.systemDb === SystemDatabase.Master ? constants.master : constants.msdb,
				systemDbReference.databaseVariableLiteralName,
				systemDbReference.suppressMissingDependencies));
		}
	}

	//#endregion

	private resetProject(): void {
		this._files = [];
		this._databaseReferences = [];
		this._sqlCmdVariables = {};
		this._preDeployScripts = [];
		this._postDeployScripts = [];
		this._noneDeployScripts = [];
		this._outputPath = '';
		this._configuration = Configuration.Debug;
	}

	public async updateProjectForCrossPlatform(): Promise<void> {
		if (this.isCrossPlatformCompatible) {
			return;
		}

		TelemetryReporter.sendActionEvent(TelemetryViews.ProjectController, TelemetryActions.updateProjectForRoundtrip);

		const result = await this.sqlProjService.updateProjectForCrossPlatform(this.projectFilePath);
		this.throwIfFailed(result);

		await this.readCrossPlatformCompatibility();
	}

	//#region Add/Delete/Exclude functions

	//#region Folders

	/**
	 * Adds a folder to the project, and saves the project file
	 * @param relativeFolderPath Relative path of the folder
	 */
	public async addFolder(relativeFolderPath: string): Promise<void> {
		if (relativeFolderPath.endsWith('\\')) {
			relativeFolderPath = relativeFolderPath.slice(0, -1);
		}

		const result = await this.sqlProjService.addFolder(this.projectFilePath, relativeFolderPath);
		this.throwIfFailed(result);

		await this.readFolders();
	}

	public async deleteFolder(relativeFolderPath: string): Promise<void> {
		const result = await this.sqlProjService.deleteFolder(this.projectFilePath, relativeFolderPath);
		this.throwIfFailed(result);

		await this.readFolders();
	}

	//#endregion

	//#region SQL object scripts

	public async addSqlObjectScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.addSqlObjectScript(this.projectFilePath, relativePath);
		this.throwIfFailed(result);

		await this.readFilesInProject();
		await this.readFolders();
	}

	public async addSqlObjectScripts(relativePaths: string[]): Promise<void> {
		for (const path of relativePaths) {
			await this.addSqlObjectScript(path);
		}
	}

	public async deleteSqlObjectScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.deleteSqlObjectScript(this.projectFilePath, relativePath);
		this.throwIfFailed(result);

		await this.readFilesInProject();
		await this.readFolders();
	}

	public async excludeSqlObjectScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.excludeSqlObjectScript(this.projectFilePath, relativePath);
		this.throwIfFailed(result);

		await this.readFilesInProject();
		await this.readFolders();
	}

	//#endregion

	//#region Pre-deployment scripts

	public async addPreDeploymentScript(relativePath: string): Promise<void> {
		if (this.preDeployScripts.length > 0) {
			void vscode.window.showInformationMessage(constants.deployScriptExists(constants.PreDeploy));
		}

		const result = await this.sqlProjService.addPreDeploymentScript(this.projectFilePath, relativePath);
		this.throwIfFailed(result);

		await this.readPreDeployScripts();
		await this.readNoneItems();
		await this.readFolders();
	}

	public async deletePreDeploymentScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.deletePreDeploymentScript(this.projectFilePath, relativePath);
		this.throwIfFailed(result);

		await this.readPreDeployScripts();
		await this.readFolders();
	}

	public async excludePreDeploymentScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.excludePreDeploymentScript(this.projectFilePath, relativePath);
		this.throwIfFailed(result);

		await this.readPreDeployScripts();
		await this.readFolders();
	}

	//#endregion

	//#region Post-deployment scripts

	public async addPostDeploymentScript(relativePath: string): Promise<void> {
		if (this.postDeployScripts.length > 0) {
			void vscode.window.showInformationMessage(constants.deployScriptExists(constants.PostDeploy));
		}

		const result = await this.sqlProjService.addPostDeploymentScript(this.projectFilePath, relativePath);
		this.throwIfFailed(result);

		await this.readPostDeployScripts();
		await this.readNoneItems();
		await this.readFolders();
	}

	public async deletePostDeploymentScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.deletePostDeploymentScript(this.projectFilePath, relativePath);
		this.throwIfFailed(result);

		await this.readPostDeployScripts();
		await this.readFolders();
	}

	public async excludePostDeploymentScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.excludePostDeploymentScript(this.projectFilePath, relativePath);
		this.throwIfFailed(result);

		await this.readPostDeployScripts();
		await this.readFolders();
	}

	//#endregion

	//#region None items

	public async addNoneItem(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.addNoneItem(this.projectFilePath, relativePath);
		this.throwIfFailed(result);

		await this.readNoneItems();
		await this.readFolders();
	}

	public async deleteNoneItem(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.deleteNoneItem(this.projectFilePath, relativePath);
		this.throwIfFailed(result);

		await this.readNoneItems();
		await this.readFolders();
	}

	public async excludeNoneItem(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.excludeNoneItem(this.projectFilePath, relativePath);
		this.throwIfFailed(result);

		await this.readNoneItems();
		await this.readFolders();
	}

	//#endregion

	//#endregion

	/**
	 * Writes a file to disk if contents are provided, adds that file to the project, and writes it to disk
	 *
	 * @param relativeFilePath Relative path of the file
	 * @param contents Contents to be written to the new file
	 * @param itemType Type of the project entry to add. This maps to the build action for the item.
	 */
	public async addScriptItem(relativeFilePath: string, contents?: string, itemType?: string): Promise<FileProjectEntry> {
		// Check if file already has been added to sqlproj
		const normalizedRelativeFilePath = utils.convertSlashesForSqlProj(relativeFilePath);

		const existingEntry = this.files.find(f => f.relativePath.toUpperCase() === normalizedRelativeFilePath.toUpperCase());
		if (existingEntry) {
			return existingEntry;
		}

		// Ensure the file exists // TODO: can be pushed down to DacFx
		const absoluteFilePath = path.join(this.projectFolderPath, relativeFilePath);
		await utils.ensureFileExists(absoluteFilePath, contents);

		switch (itemType) {
			case ItemType.preDeployScript:
				await this.addPreDeploymentScript(relativeFilePath);
				break;
			case ItemType.postDeployScript:
				await this.addPostDeploymentScript(relativeFilePath);
				break;
			default:
				await this.addSqlObjectScript(relativeFilePath);
				break;
		}

		return this.createFileProjectEntry(normalizedRelativeFilePath, EntryType.File);
	}

	/**
	 * Adds a file to the project, and saves the project file
	 *
	 * @param filePath Absolute path of the file
	 */
	public async addExistingItem(filePath: string): Promise<FileProjectEntry> {
		const exists = await utils.exists(filePath);
		if (!exists) {
			throw new Error(constants.noFileExist(filePath));
		}

		const normalizedRelativeFilePath = utils.convertSlashesForSqlProj(path.relative(this.projectFolderPath, filePath));
		let result: ResultStatus;

		if (path.extname(filePath) === constants.sqlFileExtension) {
			result = await this.sqlProjService.addSqlObjectScript(this.projectFilePath, normalizedRelativeFilePath)
			await this.readFilesInProject();
		} else {
			result = await this.sqlProjService.addNoneItem(this.projectFilePath, normalizedRelativeFilePath);
			await this.readNoneItems();
		}

		this.throwIfFailed(result);
		await this.readFolders();

		return this.createFileProjectEntry(normalizedRelativeFilePath, EntryType.File);
	}

	/**
	 * Set the target platform of the project
	 * @param compatLevel compat level of project
	 */
	public async changeTargetPlatform(compatLevel: string): Promise<void> {
		if (this.getProjectTargetVersion() === compatLevel) {
			return;
		}

		TelemetryReporter.createActionEvent(TelemetryViews.ProjectTree, TelemetryActions.changePlatformType)
			.withAdditionalProperties({
				from: this.getProjectTargetVersion(),
				to: compatLevel
			})
			.send();

		this._databaseSchemaProvider = `${constants.MicrosoftDatatoolsSchemaSqlSql}${compatLevel}${constants.databaseSchemaProvider}`;
		const result = await this.sqlProjService.setDatabaseSchemaProvider(this.projectFilePath, this._databaseSchemaProvider);
		this.throwIfFailed(result);
	}

	/**
	 * Gets the project target version specified in the DSP property in the sqlproj
	 */
	public getProjectTargetVersion(): string {
		// Get version from dsp, which is a string like "Microsoft.Data.Tools.Schema.Sql.Sql130DatabaseSchemaProvider"
		// Remove prefix and suffix to only get the actual version number/name. For the example above, the result should be just '130'.
		const version =
			this._databaseSchemaProvider.substring(
				constants.MicrosoftDatatoolsSchemaSqlSql.length,
				this._databaseSchemaProvider.length - constants.databaseSchemaProvider.length);

		// make sure version is valid
		if (!Array.from(constants.targetPlatformToVersion.values()).includes(version)) {
			throw new Error(constants.invalidDataSchemaProvider);
		}

		return version;
	}

	/**
	 * Gets the default database collation set in the project.
	 *
	 * @returns Default collation for the database set in the project.
	 */
	public getDatabaseDefaultCollation(): string {
		return this._defaultCollation;
	}

	//#region Database References

	/**
	 * Adds reference to the appropriate system database dacpac to the project
	 */
	public async addSystemDatabaseReference(settings: ISystemDatabaseReferenceSettings): Promise<void> {
		// check if reference to this database already exists
		if (this.databaseReferences.find(r => r.referenceName === settings.databaseVariableLiteralValue)) {
			throw new Error(constants.databaseReferenceAlreadyExists);
		}

		const systemDb = <unknown>settings.systemDb as SystemDatabase;
		const result = await this.sqlProjService.addSystemDatabaseReference(this.projectFilePath, systemDb, settings.suppressMissingDependenciesErrors, settings.databaseVariableLiteralValue);

		if (!result.success && result.errorMessage) {
			throw new Error(constants.errorAddingDatabaseReference(utils.systemDatabaseToString(settings.systemDb), result.errorMessage));
		}

		await this.readDatabaseReferences();
	}

	/**
	 * Adds reference to a dacpac to the project
	 */
	public async addDatabaseReference(settings: IDacpacReferenceSettings): Promise<void> {
		const databaseReferenceEntry = new DacpacReferenceProjectEntry(settings);
		await this.addUserDatabaseReference(settings, databaseReferenceEntry);
	}

	/**
	 * Adds reference to a another project in the workspace
	 */
	public async addProjectReference(settings: IProjectReferenceSettings): Promise<void> {
		const projectReferenceEntry = new SqlProjectReferenceProjectEntry(settings);
		await this.addUserDatabaseReference(settings, projectReferenceEntry);
	}

	private async addUserDatabaseReference(settings: IProjectReferenceSettings | IDacpacReferenceSettings, reference: SqlProjectReferenceProjectEntry | DacpacReferenceProjectEntry): Promise<void> {
		// check if reference to this database already exists
		if (this.databaseReferenceExists(reference)) {
			throw new Error(constants.databaseReferenceAlreadyExists);
		}

		// create database variable
		if (settings.databaseVariable && settings.databaseName) {
			await this.sqlProjService.addSqlCmdVariable(this.projectFilePath, settings.databaseVariable, settings.databaseName);

			// create server variable - only can be set when there's also a database variable (reference to different database on different server)
			if (settings.serverVariable && settings.serverName) {
				await this.sqlProjService.addSqlCmdVariable(this.projectFilePath, settings.serverVariable, settings.serverName);
			}

			await this.readSqlCmdVariables();
		}

		const databaseLiteral = settings.databaseVariable ? undefined : settings.databaseName;

		let result;
		let referenceName;
		if (reference instanceof SqlProjectReferenceProjectEntry) {
			referenceName = (<IProjectReferenceSettings>settings).projectName;
			result = await this.sqlProjService.addSqlProjectReference(this.projectFilePath, reference.pathForSqlProj(), reference.projectGuid, settings.suppressMissingDependenciesErrors, settings.databaseVariable, settings.serverVariable, databaseLiteral)
		} else { // dacpac
			referenceName = (<IDacpacReferenceSettings>settings).dacpacFileLocation.fsPath;
			result = await this.sqlProjService.addDacpacReference(this.projectFilePath, reference.pathForSqlProj(), settings.suppressMissingDependenciesErrors, settings.databaseVariable, settings.serverVariable, databaseLiteral)
		}

		if (!result.success && result.errorMessage) {
			throw new Error(constants.errorAddingDatabaseReference(referenceName, result.errorMessage));
		}

		await this.readDatabaseReferences();
	}

	private databaseReferenceExists(entry: IDatabaseReferenceProjectEntry): boolean {
		const found = this._databaseReferences.find(reference => reference.pathForSqlProj() === entry.pathForSqlProj()) !== undefined;
		return found;
	}

	public async deleteDatabaseReferenceByEntry(entry: IDatabaseReferenceProjectEntry): Promise<void> {
		await this.deleteDatabaseReference(entry.pathForSqlProj());
	}

	public async deleteDatabaseReference(name: string): Promise<void> {
		const result = await this.sqlProjService.deleteDatabaseReference(this.projectFilePath, name);
		this.throwIfFailed(result);
		await this.readDatabaseReferences();
	}

	//#endregion

	//#region SQLCMD Variables

	/**
	 * Adds a SQLCMD variable to the project
	 * @param name name of the variable
	 * @param defaultValue
	 */
	public async addSqlCmdVariable(name: string, defaultValue: string): Promise<void> {
		await this.sqlProjService.addSqlCmdVariable(this.projectFilePath, name, defaultValue);
		await this.readSqlCmdVariables();
	}

	/**
	 * Updates a SQLCMD variable in the project
	 * @param name name of the variable
	 * @param defaultValue
	 */
	public async updateSqlCmdVariable(name: string, defaultValue: string): Promise<void> {
		await this.sqlProjService.updateSqlCmdVariable(this.projectFilePath, name, defaultValue);
		await this.readSqlCmdVariables();
	}

	public async deleteSqlCmdVariable(variableName: string): Promise<void> {
		const result = await this.sqlProjService.deleteSqlCmdVariable(this.projectFilePath, variableName);
		this.throwIfFailed(result);
		await this.readSqlCmdVariables();
	}

	//#endregion

	/**
	 * Appends given database source to the DatabaseSource property element.
	 * If property element does not exist, then new one will be created.
	 *
	 * @param databaseSource Source of the database to add
	 */
	public async addDatabaseSource(databaseSource: string): Promise<void> {
		if (databaseSource.includes(';')) {
			throw Error(constants.invalidProjectPropertyValueProvided(';'));
		}

		const sources: string[] = this.getDatabaseSourceValues();
		const index = sources.findIndex(x => x === databaseSource);

		if (index !== -1) {
			return;
		}

		sources.push(databaseSource);
		const result = await this.sqlProjService.setDatabaseSource(this.projectFilePath, sources.join(';'));
		this.throwIfFailed(result);

		await this.readProjectProperties();
	}

	/**
	 * Removes database source from the DatabaseSource property element.
	 * If no sources remain, then property element will be removed from the project file.
	 *
	 * @param databaseSource Source of the database to remove
	 */
	public async removeDatabaseSource(databaseSource: string): Promise<void> {
		if (databaseSource.includes(';')) {
			throw Error(constants.invalidProjectPropertyValueProvided(';'));
		}

		const sources: string[] = this.getDatabaseSourceValues();
		const index = sources.findIndex(x => x === databaseSource);

		if (index === -1) {
			return;
		}

		sources.splice(index, 1);

		const result = await this.sqlProjService.setDatabaseSource(this.projectFilePath, sources.join(';'));
		this.throwIfFailed(result);

		await this.readProjectProperties();
	}

	/**
	 * Gets an array of all database sources specified in the project.
	 *
	 * @returns Array of all database sources
	 */
	public getDatabaseSourceValues(): string[] {
		return this._databaseSource.trim() === '' ? [] : this._databaseSource.split(';');
	}

	public createFileProjectEntry(relativePath: string, entryType: EntryType, sqlObjectType?: string, containsCreateTableStatement?: boolean): FileProjectEntry {
		let platformSafeRelativePath = utils.getPlatformSafeFileEntryPath(relativePath);
		return new FileProjectEntry(
			Uri.file(path.join(this.projectFolderPath, platformSafeRelativePath)),
			utils.convertSlashesForSqlProj(relativePath),
			entryType,
			sqlObjectType,
			containsCreateTableStatement);
	}

	private throwIfFailed(result: ResultStatus): void {
		if (!result.success) {
			throw new Error(constants.errorPrefix(result.errorMessage));
		}
	}

	/**
	 * Moves a file to a different location
	 * @param node Node being moved
	 * @param projectFilePath Full file path to .sqlproj
	 * @param destinationRelativePath path of the destination, relative to .sqlproj
	 */
	public async move(node: BaseProjectTreeItem, destinationRelativePath: string): Promise<azdataType.ResultStatus> {
		// trim off the project folder at the beginning of the relative path stored in the tree
		const projectRelativeUri = vscode.Uri.file(path.basename(this.projectFilePath, constants.sqlprojExtension));
		const originalRelativePath = utils.trimUri(projectRelativeUri, node.relativeProjectUri);
		destinationRelativePath = utils.trimUri(projectRelativeUri, vscode.Uri.file(destinationRelativePath));

		if (originalRelativePath === destinationRelativePath) {
			return { success: true, errorMessage: '' };
		}

		let result;

		if (node instanceof SqlObjectFileNode) {
			result = await this.sqlProjService.moveSqlObjectScript(this.projectFilePath, destinationRelativePath, originalRelativePath)
		} else if (node instanceof PreDeployNode) {
			result = await this.sqlProjService.movePreDeploymentScript(this.projectFilePath, destinationRelativePath, originalRelativePath)
		} else if (node instanceof PostDeployNode) {
			result = await this.sqlProjService.movePostDeploymentScript(this.projectFilePath, destinationRelativePath, originalRelativePath)
		} else if (node instanceof NoneNode || node instanceof PublishProfileNode) {
			result = await this.sqlProjService.moveNoneItem(this.projectFilePath, destinationRelativePath, originalRelativePath);
		} else {
			result = { success: false, errorMessage: constants.unhandledMoveNode }
		}

		return result;
	}
}
