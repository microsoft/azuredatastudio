/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as xmldom from '@xmldom/xmldom';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import * as xmlFormat from 'xml-formatter';
import * as os from 'os';
import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import * as mssql from 'mssql';

import { Uri, window } from 'vscode';
import { EntryType, IDatabaseReferenceProjectEntry, ISqlProject, ItemType, SqlTargetPlatform } from 'sqldbproj';
import { promises as fs } from 'fs';
import { DataSource } from './dataSources/dataSources';
import { ISystemDatabaseReferenceSettings, IDacpacReferenceSettings, IProjectReferenceSettings } from './IDatabaseReferenceSettings';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';
import { DacpacReferenceProjectEntry, FileProjectEntry, SqlProjectReferenceProjectEntry, SystemDatabaseReferenceProjectEntry } from './projectEntry';
import { GetFoldersResult, GetScriptsResult, SystemDatabase } from 'mssql';
import { ResultStatus } from 'azdata';
import { BaseProjectTreeItem } from './tree/baseTreeItem';
import { PostDeployNode, PreDeployNode, SqlObjectFileNode } from './tree/fileFolderTreeItem';
import { ProjectType } from 'mssql';

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

	private projFileXmlDoc: Document | undefined = undefined;

	constructor(projectFilePath: string) {
		this._projectFilePath = projectFilePath;
		this._projectFileName = path.basename(projectFilePath, '.sqlproj');
	}

	/**
	 * Open and load a .sqlproj file
	 */
	public static async openProject(projectFilePath: string, promptIfNeedsUpdating: boolean = false): Promise<Project> {
		const proj = new Project(projectFilePath);

		proj.sqlProjService = await utils.getSqlProjectsService();
		await proj.readProjFile();

		if (!proj.isCrossPlatformCompatible && promptIfNeedsUpdating) {
			const result = await window.showWarningMessage(constants.updateProjectForRoundTrip(proj.projectFileName), constants.yesString, constants.noString);

			if (result === constants.yesString) {
				await proj.updateProjectForRoundTrip();
			}
		}

		return proj;
	}

	/**
	 * Reads the project setting and contents from the file
	 */
	public async readProjFile(): Promise<void> {
		this.resetProject();

		const projFileText = await fs.readFile(this._projectFilePath);
		this.projFileXmlDoc = new xmldom.DOMParser().parseFromString(projFileText.toString());

		await this.readProjectProperties();
		await this.readSqlCmdVariables();
		await this.readDatabaseReferences();

		// get pre and post deploy scripts specified in the sqlproj
		await this.readPreDeployScripts();
		await this.readPostDeployScripts();
		await this.readNoneScripts();

		await this.readFilesInProject(); // get SQL object scripts
		await this.readFolders(); // get folders

		await this.readPublishProfiles(); // get publish profiles specified in the sqlproj
	}

	//#region Reader helpers

	private async readProjectProperties(): Promise<void> {
		const props = await this.sqlProjService.getProjectProperties(this.projectFilePath);

		this._projectGuid = props.projectGuid;

		switch (props.configuration.toLowerCase()) {
			case Configuration.Debug.toString().toLowerCase():
				this._configuration = Configuration.Debug;
				break;
			case Configuration.Release.toString().toLowerCase():
				this._configuration = Configuration.Release;
				break;
			default:
				this._configuration = Configuration.Output; // if the configuration doesn't match release or debug, the dacpac will get created in ./bin/Output
		}

		this._outputPath = props.outputPath;
		this._databaseSource = props.databaseSource ?? '';
		this._defaultCollation = props.defaultCollation;
		this._databaseSchemaProvider = 'Microsoft.Data.Tools.Schema.Sql.Sql160DatabaseSchemaProvider'; // TODO: replace this stub once latest Tools Service is brought over
		this._sqlProjStyle = props.projectStyle;

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
				folderEntries.push(this.createFileProjectEntry(folderPath, EntryType.Folder));
			}
		}

		this._folders = folderEntries;
	}

	private async readPreDeployScripts(): Promise<void> {
		var result: GetScriptsResult = await this.sqlProjService.getPreDeploymentScripts(this.projectFilePath);
		this.throwIfFailed(result);

		const preDeploymentScriptEntries: FileProjectEntry[] = [];

		if (result.scripts?.length > 0) { // empty array from SqlToolsService is deserialized as null
			for (var scriptPath of result.scripts) {
				preDeploymentScriptEntries.push(this.createFileProjectEntry(scriptPath, EntryType.File));
			}
		}

		if (preDeploymentScriptEntries.length > 1) {
			void window.showWarningMessage(constants.prePostDeployCount, constants.okString);
		}

		this._preDeployScripts = preDeploymentScriptEntries;
	}

	private async readPostDeployScripts(): Promise<void> {
		var result: GetScriptsResult = await this.sqlProjService.getPostDeploymentScripts(this.projectFilePath);
		this.throwIfFailed(result);

		const postDeploymentScriptEntries: FileProjectEntry[] = [];

		if (result.scripts?.length > 0) { // empty array from SqlToolsService is deserialized as null
			for (var scriptPath of result.scripts) {
				postDeploymentScriptEntries.push(this.createFileProjectEntry(scriptPath, EntryType.File));
			}
		}

		if (postDeploymentScriptEntries.length > 1) {
			void window.showWarningMessage(constants.prePostDeployCount, constants.okString);
		}

		this._postDeployScripts = postDeploymentScriptEntries;
	}

	private async readNoneScripts(): Promise<void> {
		var result: GetScriptsResult = await this.sqlProjService.getNoneItems(this.projectFilePath);
		this.throwIfFailed(result);

		const noneItemEntries: FileProjectEntry[] = [];

		if (result.scripts?.length > 0) { // empty array from SqlToolsService is deserialized as null
			for (var path of result.scripts) {
				noneItemEntries.push(this.createFileProjectEntry(path, EntryType.File));
			}
		}

		this._noneDeployScripts = noneItemEntries.filter(f => !utils.isPublishProfile(f.relativePath));
	}

	/**
	 *
	 * @returns all the publish profiles (ending with *.publish.xml) specified as <None Include="file.publish.xml" /> in the sqlproj
	 */
	private async readPublishProfiles(): Promise<void> {
		var result: GetScriptsResult = await this.sqlProjService.getNoneItems(this.projectFilePath);
		this.throwIfFailed(result);

		const noneItemEntries: FileProjectEntry[] = [];

		if (result.scripts?.length > 0) { // empty array from SqlToolsService is deserialized as null
			for (var path of result.scripts) {
				noneItemEntries.push(this.createFileProjectEntry(path, EntryType.File));
			}
		}

		this._publishProfiles = noneItemEntries.filter(f => utils.isPublishProfile(f.relativePath));
	}

	private async readDatabaseReferences(): Promise<void> {
		this._databaseReferences = [];
		const databaseReferencesResult = await this.sqlProjService.getDatabaseReferences(this.projectFilePath);

		for (const dacpacReference of databaseReferencesResult.dacpacReferences) {
			this._databaseReferences.push(new DacpacReferenceProjectEntry({
				dacpacFileLocation: Uri.file(dacpacReference.dacpacPath),
				databaseName: dacpacReference.dacpacPath,
				suppressMissingDependenciesErrors: dacpacReference.suppressMissingDependencies
			}));
		}

		for (const projectReference of databaseReferencesResult.sqlProjectReferences) {
			this._databaseReferences.push(new SqlProjectReferenceProjectEntry({
				projectRelativePath: Uri.file(utils.getPlatformSafeFileEntryPath(projectReference.projectPath)),
				projectName: path.basename(utils.getPlatformSafeFileEntryPath(projectReference.projectPath), constants.sqlprojExtension),
				projectGuid: projectReference.projectGuid ?? '',
				suppressMissingDependenciesErrors: projectReference.suppressMissingDependencies
			}));
		}

		for (const systemDbReference of databaseReferencesResult.systemDatabaseReferences) {
			this._databaseReferences.push(new SystemDatabaseReferenceProjectEntry(
				Uri.file(''),
				Uri.file(''), // TODO: remove these after add and delete are swapped - DacFx handles adding and removing system dacpacs, so we don't need to keep track of the paths here
				systemDbReference.systemDb === mssql.SystemDatabase.Master ? constants.master : constants.msdb,
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
		this.projFileXmlDoc = undefined;
		this._outputPath = '';
		this._configuration = Configuration.Debug;
	}

	public async updateProjectForRoundTrip(): Promise<void> {
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

	public async addFolder2(relativeFolderPath: string): Promise<void> {
		const result = await this.sqlProjService.addFolder(this.projectFileName, relativeFolderPath);
		this.throwIfFailed(result);

		await this.readFolders();
	}

	public async deleteFolder(relativeFolderPath: string): Promise<void> {
		const result = await this.sqlProjService.deleteFolder(this.projectFileName, relativeFolderPath);
		this.throwIfFailed(result);

		await this.readFolders();
	}

	//#endregion

	//#region SQL object scripts

	public async addSqlObjectScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.addSqlObjectScript(this.projectFileName, relativePath);
		this.throwIfFailed(result);

		await this.readFilesInProject();
	}

	public async deleteSqlObjectScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.deleteSqlObjectScript(this.projectFileName, relativePath);
		this.throwIfFailed(result);

		await this.readFilesInProject();
	}

	public async excludeSqlObjectScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.excludeSqlObjectScript(this.projectFileName, relativePath);
		this.throwIfFailed(result);

		await this.readFilesInProject();
	}

	//#endregion

	//#region Pre-deployment scripts

	public async addPreDeploymentScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.addPreDeploymentScript(this.projectFileName, relativePath);
		this.throwIfFailed(result);

		await this.readPreDeployScripts();
		await this.readNoneScripts();
	}

	public async deletePreDeploymentScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.deletePreDeploymentScript(this.projectFileName, relativePath);
		this.throwIfFailed(result);

		await this.readPreDeployScripts();
	}

	public async excludePreDeploymentScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.excludePreDeploymentScript(this.projectFileName, relativePath);
		this.throwIfFailed(result);

		await this.readPreDeployScripts();
	}

	//#endregion

	//#region Post-deployment scripts

	public async addPostDeploymentScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.addPreDeploymentScript(this.projectFileName, relativePath);
		this.throwIfFailed(result);

		await this.readPostDeployScripts();
		await this.readNoneScripts();
	}

	public async deletePostDeploymentScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.deletePostDeploymentScript(this.projectFileName, relativePath);
		this.throwIfFailed(result);

		await this.readPostDeployScripts();
	}

	public async excludePostDeploymentScript(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.excludePostDeploymentScript(this.projectFileName, relativePath);
		this.throwIfFailed(result);

		await this.readPostDeployScripts();
	}

	//#endregion

	//#region None items

	public async addNoneItem(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.addNoneItem(this.projectFileName, relativePath);
		this.throwIfFailed(result);

		await this.readPostDeployScripts();
		await this.readNoneScripts();
	}

	public async deleteNoneItem(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.deleteNoneItem(this.projectFileName, relativePath);
		this.throwIfFailed(result);

		await this.readPostDeployScripts();
	}

	public async excludeNoneItem(relativePath: string): Promise<void> {
		const result = await this.sqlProjService.excludeNoneItem(this.projectFileName, relativePath);
		this.throwIfFailed(result);

		await this.readPostDeployScripts();
	}

	//#endregion

	//#endregion

	/**
	 * Adds a folder to the project, and saves the project file
	 * TODO: delete once replaced with addFolder2
	 * @param relativeFolderPath Relative path of the folder
	 */
	public async addFolder(relativeFolderPath: string): Promise<FileProjectEntry> {
		const result = await this.sqlProjService.addFolder(this.projectFilePath, relativeFolderPath);
		this.throwIfFailed(result);

		return this.createFileProjectEntry(utils.ensureTrailingSlash(relativeFolderPath), EntryType.Folder);
	}

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

		// Add the new script
		let result: ResultStatus;

		switch (itemType) {
			case ItemType.preDeployScript:
				result = await this.sqlProjService.addPreDeploymentScript(this.projectFilePath, relativeFilePath);
				await this.readPreDeployScripts();
				await this.readNoneScripts();
				break;
			case ItemType.postDeployScript:
				result = await this.sqlProjService.addPostDeploymentScript(this.projectFilePath, relativeFilePath);
				await this.readPostDeployScripts();
				await this.readNoneScripts();
				break;
			default:
				result = await this.sqlProjService.addSqlObjectScript(this.projectFilePath, relativeFilePath);
				await this.readFilesInProject();
				break;
		}

		await this.readFolders();

		this.throwIfFailed(result);

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
			result = await this.sqlProjService.addSqlObjectScript(this.projectFilePath, filePath)
			await this.readFilesInProject();
		} else {
			result = await this.sqlProjService.addNoneItem(this.projectFilePath, filePath);
			await this.readNoneScripts();
		}

		this.throwIfFailed(result);

		return this.createFileProjectEntry(normalizedRelativeFilePath, EntryType.File);
	}

	public async exclude(entry: FileProjectEntry): Promise<void> {
		entry.type
		entry.type
		//const toExclude: FileProjectEntry[] = this._files.concat(this._preDeployScripts).concat(this._postDeployScripts).concat(this._noneDeployScripts).concat(this._publishProfiles).filter(x => x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
		//await this.removeFromProjFile(toExclude);

		this._files = this._files.filter(x => !x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
		this._preDeployScripts = this._preDeployScripts.filter(x => !x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
		this._postDeployScripts = this._postDeployScripts.filter(x => !x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
		this._noneDeployScripts = this._noneDeployScripts.filter(x => !x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
		this._publishProfiles = this._publishProfiles.filter(x => !x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
	}

	public async deleteFileFolder(entry: FileProjectEntry): Promise<void> {
		// compile a list of folder contents to delete; if entry is a file, contents will contain only itself
		const toDeleteFiles: FileProjectEntry[] = this._files.concat(this._preDeployScripts).concat(this._postDeployScripts).concat(this._noneDeployScripts).concat(this._publishProfiles).filter(x => x.fsUri.fsPath.startsWith(entry.fsUri.fsPath) && x.type === EntryType.File);
		const toDeleteFolders: FileProjectEntry[] = this._files.filter(x => x.fsUri.fsPath.startsWith(entry.fsUri.fsPath) && x.type === EntryType.Folder);

		await Promise.all(toDeleteFiles.map(x => fs.unlink(x.fsUri.fsPath)));
		await Promise.all(toDeleteFolders.map(x => fs.rm(x.fsUri.fsPath, { recursive: true, force: true })));

		await this.exclude(entry);
	}

	public async deleteDatabaseReference(entry: IDatabaseReferenceProjectEntry): Promise<void> {
		//await this.removeFromProjFile(entry);
		this._databaseReferences = this._databaseReferences.filter(x => x !== entry);
	}

	public async deleteSqlCmdVariable(variableName: string): Promise<azdataType.ResultStatus> {
		return this.sqlProjService.deleteSqlCmdVariable(this.projectFilePath, variableName);
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
	 * Adds reference to the appropriate system database dacpac to the project
	 */
	public async addSystemDatabaseReference(settings: ISystemDatabaseReferenceSettings): Promise<void> {
		// check if reference to this database already exists
		if (this.databaseReferences.find(r => r.databaseName === settings.databaseName)) {
			throw new Error(constants.databaseReferenceAlreadyExists);
		}

		const systemDb = <unknown>settings.systemDb as mssql.SystemDatabase;
		const result = await this.sqlProjService.addSystemDatabaseReference(this.projectFilePath, systemDb, settings.suppressMissingDependenciesErrors, settings.databaseName);

		if (!result.success && result.errorMessage) {
			const systemDbName = settings.systemDb === SystemDatabase.Master ? constants.master : constants.msdb;
			throw new Error(constants.errorAddingDatabaseReference(systemDbName, result.errorMessage));
		}
	}

	public getSystemDacpacUri(dacpac: string): Uri {
		const versionFolder = this.getSystemDacpacFolderName();
		const systemDacpacLocation = this.sqlProjStyle === ProjectType.SdkStyle ? '$(SystemDacpacsLocation)' : '$(NETCoreTargetsPath)';
		return Uri.parse(path.join(systemDacpacLocation, 'SystemDacpacs', versionFolder, dacpac));
	}

	public getSystemDacpacSsdtUri(dacpac: string): Uri {
		const versionFolder = this.getSystemDacpacFolderName();
		return Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', versionFolder, 'SqlSchemas', dacpac));
	}

	public getSystemDacpacFolderName(): string {
		const version = this.getProjectTargetVersion();

		// DW is special because the target version is DW, but the folder name for system dacpacs is AzureDW in SSDT
		// the other target versions have the same version name and folder name
		return version === constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlDW) ? constants.AzureDwFolder : version;
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
	}
	/**
	 * Adds a SQLCMD variable to the project
	 * @param name name of the variable
	 * @param defaultValue
	 */
	public async addSqlCmdVariable(name: string, defaultValue: string): Promise<void> {
		await this.sqlProjService.addSqlCmdVariable(this.projectFilePath, name, defaultValue);
	}

	/**
	 * Updates a SQLCMD variable in the project
	 * @param name name of the variable
	 * @param defaultValue
	 */
	public async updateSqlCmdVariable(name: string, defaultValue: string): Promise<void> {
		await this.sqlProjService.updateSqlCmdVariable(this.projectFilePath, name, defaultValue);
	}

	/**
	 * Appends given database source to the DatabaseSource property element.
	 * If property element does not exist, then new one will be created.
	 *
	 * @param databaseSource Source of the database to add
	 */
	public async addDatabaseSource(databaseSource: string): Promise<void> {
		const sources: string[] = this._databaseSource.split(';');
		const index = sources.findIndex(x => x === databaseSource);

		if (index !== -1) {
			return;
		}

		sources.push(databaseSource);
		await this.sqlProjService.setDatabaseSource(this.projectFilePath, sources.join(';'));
	}

	/**
	 * Removes database source from the DatabaseSource property element.
	 * If no sources remain, then property element will be removed from the project file.
	 *
	 * @param databaseSource Source of the database to remove
	 */
	public async removeDatabaseSource(databaseSource: string): Promise<void> {
		const sources: string[] = this._databaseSource.split(';');
		const index = sources.findIndex(x => x === databaseSource);

		if (index === -1) {
			return;
		}

		sources.splice(index, 1);
		await this.sqlProjService.setDatabaseSource(this.projectFilePath, sources.join(';'));
	}

	/**
	 * Gets an array of all database sources specified in the project.
	 *
	 * @returns Array of all database sources
	 */
	public getDatabaseSourceValues(): string[] {
		return this._databaseSource.split(';');
	}

	/**
	 * Adds publish profile to the project
	 *
	 * @param relativeFilePath Relative path of the file
	 */
	public async addPublishProfileToProjFile(absolutePublishProfilePath: string): Promise<FileProjectEntry> {
		const relativePublishProfilePath = (utils.trimUri(Uri.file(this.projectFilePath), Uri.file(absolutePublishProfilePath)));

		const result = await this.sqlProjService.addNoneItem(this.projectFilePath, relativePublishProfilePath);
		this.throwIfFailed(result);

		const fileEntry = this.createFileProjectEntry(relativePublishProfilePath, EntryType.File);
		this._publishProfiles.push(fileEntry);

		return fileEntry;
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

	/**
	 * Deletes a node from the project file similar to <Compile Include="{includeString}" />
	 * @param includeString Path of the file that matches the Include portion of the node
	 * @param nodes The collection of XML nodes to search from
	 * @param undoRemove When true, will remove a node similar to <Compile Remove="{includeString}" />
	 * @returns True when a node has been removed, false otherwise.
	 */
	private removeNode(includeString: string, nodes: HTMLCollectionOf<Element>, undoRemove: boolean = false): boolean {
		// Default function behavior removes nodes like <Compile Include="..." />
		// However when undoRemove is true, this function removes <Compile Remove="..." />
		const xmlAttribute = undoRemove ? constants.Remove : constants.Include;
		for (let i = 0; i < nodes.length; i++) {
			const parent = nodes[i].parentNode;

			if (parent) {
				if (nodes[i].getAttribute(xmlAttribute) === utils.convertSlashesForSqlProj(includeString)) {
					parent.removeChild(nodes[i]);

					// delete ItemGroup if this was the only entry
					// only want element nodes, not text nodes
					const otherChildren = Array.from(parent.childNodes).filter((c: ChildNode) => c.childNodes);

					if (otherChildren.length === 0) {
						parent.parentNode?.removeChild(parent);
					}

					return true;
				}
			}
		}

		return false;
	}

	private removeDatabaseReferenceFromProjFile(databaseReferenceEntry: IDatabaseReferenceProjectEntry): void {
		const elementTag = databaseReferenceEntry instanceof SqlProjectReferenceProjectEntry ? constants.ProjectReference : constants.ArtifactReference;
		const artifactReferenceNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(elementTag);
		const deleted = this.removeNode(databaseReferenceEntry.pathForSqlProj(), artifactReferenceNodes);

		// also delete SSDT reference if it's a system db reference
		if (databaseReferenceEntry instanceof SystemDatabaseReferenceProjectEntry) {
			const ssdtPath = databaseReferenceEntry.ssdtPathForSqlProj();
			this.removeNode(ssdtPath, artifactReferenceNodes);
		}

		if (!deleted) {
			throw new Error(constants.unableToFindDatabaseReference(databaseReferenceEntry.databaseName));
		}
	}

	private databaseReferenceExists(entry: IDatabaseReferenceProjectEntry): boolean {
		const found = this._databaseReferences.find(reference => reference.pathForSqlProj() === entry.pathForSqlProj()) !== undefined;
		return found;
	}

	public containsSSDTOnlySystemDatabaseReferences(): boolean {
		for (let r = 0; r < this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ArtifactReference).length; r++) {
			const currentNode = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ArtifactReference)[r];
			if (currentNode.getAttribute(constants.Condition) !== constants.NetCoreCondition && currentNode.getAttribute(constants.Condition) !== constants.NotNetCoreCondition
				&& currentNode.getAttribute(constants.Include)?.includes(constants.DacpacRootPath)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Update system db references to have the ADS and SSDT paths to the system dacpacs
	 */
	public async updateSystemDatabaseReferencesInProjFile(): Promise<void> {
		// find all system database references
		for (let r = 0; r < this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ArtifactReference).length; r++) {
			const currentNode = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ArtifactReference)[r];
			if (!currentNode.getAttribute(constants.Condition) && currentNode.getAttribute(constants.Include)?.includes(constants.DacpacRootPath)) {
				// get name of system database
				const systemDb = currentNode.getAttribute(constants.Include)?.includes(constants.master) ? SystemDatabase.Master : SystemDatabase.Msdb;

				// get name
				const nameNodes = currentNode.getElementsByTagName(constants.DatabaseVariableLiteralValue);
				const databaseVariableName = nameNodes[0].childNodes[0]?.nodeValue!;

				// get suppressMissingDependenciesErrors
				const suppressMissingDependenciesErrorNode = currentNode.getElementsByTagName(constants.SuppressMissingDependenciesErrors);
				const suppressMissingDependences = suppressMissingDependenciesErrorNode[0].childNodes[0].nodeValue === constants.True;

				// TODO Two issues here :
				// 1. If there are multiple ItemGroups with ArtifactReference items then we won't clean up until all items are removed
				// 2. If the ItemGroup has other non-ArtifactReference items in it then those will be deleted
				// Right now we assume that this ItemGroup is not manually edited so it's safe to ignore these
				if (this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ArtifactReference).length === 1) {
					// delete entire ItemGroup if there aren't any other children
					this.projFileXmlDoc!.documentElement.removeChild(currentNode.parentNode!);
				} else {
					this.projFileXmlDoc!.documentElement.removeChild(currentNode);
				}

				// remove from database references because it'll get added again later
				this._databaseReferences.splice(this._databaseReferences.findIndex(n => n.databaseName === (systemDb === SystemDatabase.Master ? constants.master : constants.msdb)), 1);

				await this.addSystemDatabaseReference({ databaseName: databaseVariableName, systemDb: systemDb, suppressMissingDependenciesErrors: suppressMissingDependences });
			}
		}

		TelemetryReporter.createActionEvent(TelemetryViews.ProjectController, TelemetryActions.updateSystemDatabaseReferencesInProjFile)
			.withAdditionalMeasurements({ referencesCount: this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ArtifactReference).length })
			.send();
	}

	private async serializeToProjFile(projFileContents: Document): Promise<void> {
		let xml = new xmldom.XMLSerializer().serializeToString(projFileContents);
		xml = xmlFormat(xml, <xmlFormat.Options>{
			collapseContent: true,
			indentation: '  ',
			lineSeparator: os.EOL,
			whiteSpaceAtEndOfSelfclosingTag: true
		});

		await fs.writeFile(this._projectFilePath, xml);

		// update projFileXmlDoc since the file was updated
		this.projFileXmlDoc = new xmldom.DOMParser().parseFromString(xml);
	}

	/**
	 * Adds the list of sql files and directories to the project, and saves the project file
	 *
	 * @param list list of files and folder Uris. Files and folders must already exist. No files or folders will be added if any do not exist.
	 */
	public async addToProject(list: Uri[]): Promise<void> {
		// verify all files/folders exist. If not all exist, none will be added
		for (let file of list) {
			const exists = await utils.exists(file.fsPath);

			if (!exists) {
				throw new Error(constants.fileOrFolderDoesNotExist(file.fsPath));
			}
		}

		for (let file of list) {
			const relativePath = utils.trimChars(utils.trimUri(Uri.file(this._projectFilePath), file), '/');

			if (relativePath.length > 0) {
				const fileStat = await fs.stat(file.fsPath);

				if (fileStat.isFile() && file.fsPath.toLowerCase().endsWith(constants.sqlFileExtension)) {
					await this.addSqlObjectScript(relativePath);
				} else if (fileStat.isDirectory()) {
					await this.addFolder2(relativePath);
				}
			}
		}
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
		}
		// TODO add support for renaming none scripts after those are added in STS
		// TODO add support for renaming publish profiles when support is added in DacFx
		else {
			result = { success: false, errorMessage: constants.unhandledMoveNode }
		}

		return result;
	}
}

export const reservedProjectFolders = ['Properties', 'Data Sources', 'Database References'];
