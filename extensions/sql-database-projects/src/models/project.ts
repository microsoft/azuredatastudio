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

import { Uri, window } from 'vscode';
import { EntryType, IDatabaseReferenceProjectEntry, IProjectEntry, ISqlProject, ItemType, SqlTargetPlatform } from 'sqldbproj';
import { promises as fs } from 'fs';
import { DataSource } from './dataSources/dataSources';
import { ISystemDatabaseReferenceSettings, IDacpacReferenceSettings, IProjectReferenceSettings } from './IDatabaseReferenceSettings';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';
import { DacpacReferenceProjectEntry, FileProjectEntry, ProjectEntry, SqlCmdVariableProjectEntry, SqlProjectReferenceProjectEntry, SystemDatabase, SystemDatabaseReferenceProjectEntry } from './projectEntry';
import { GetFoldersResult, GetScriptsResult } from 'mssql';
import { ResultStatus } from 'azdata';
import { BaseProjectTreeItem } from './tree/baseTreeItem';
import { PostDeployNode, PreDeployNode, SqlObjectFileNode } from './tree/fileFolderTreeItem';
import { ISqlProjectsService, ProjectType } from 'mssql';

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

	//#region Private Fields

	private sqlProjService!: ISqlProjectsService;
	private projFileXmlDoc: Document | undefined = undefined;

	private _projectFilePath: string;
	private _projectFileName: string;
	private _projectGuid: string | undefined;
	private _files: FileProjectEntry[] = [];
	private _folders: FileProjectEntry[] = [];
	private _dataSources: DataSource[] = [];
	private _importedTargets: string[] = [];
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

	public get importedTargets(): string[] {
		return this._importedTargets;
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
	 */
	public static async openProject(projectFilePath: string): Promise<Project> {
		const proj = new Project(projectFilePath);

		proj.sqlProjService = await utils.getSqlProjectsService();

		await proj.readProjFile();
		await proj.updateProjectForRoundTrip();

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

		// get pre and post deploy scripts specified in the sqlproj
		this._preDeployScripts = await this.readPreDeployScripts();
		this._postDeployScripts = await this.readPostDeployScripts();
		this._noneDeployScripts = await this.readNoneScripts();

		// get SQL object scripts
		this._files = await this.readFilesInProject();

		// get folders
		this._folders = await this.readFolders();

		this._databaseReferences = this.readDatabaseReferences();
		this._importedTargets = this.readImportedTargets();

		// get publish profiles specified in the sqlproj
		this._publishProfiles = await this.readPublishProfiles();

		// find all SQLCMD variables to include
		try {
			this._sqlCmdVariables = utils.readSqlCmdVariables(this.projFileXmlDoc, false);
		} catch (e) {
			void window.showErrorMessage(constants.errorReadingProject(constants.sqlCmdVariables, this.projectFilePath));
			console.error(utils.getErrorMessage(e));
		}
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

	/**
	 * Gets all the files specified by <Build Inlude="..."> and removes all the files specified by <Build Remove="...">
	 * and all files included by the default glob of the folder of the sqlproj if it's an sdk style project
	 */
	private async readFilesInProject(): Promise<FileProjectEntry[]> {
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

		return fileEntries;
	}

	private async readFolders(): Promise<FileProjectEntry[]> {
		var result: GetFoldersResult = await this.sqlProjService.getFolders(this.projectFilePath);
		this.throwIfFailed(result);

		const folderEntries: FileProjectEntry[] = [];

		if (result.folders?.length > 0) { // empty array from SqlToolsService is deserialized as null
			for (var folderPath of result.folders) {
				folderEntries.push(this.createFileProjectEntry(folderPath, EntryType.Folder));
			}
		}

		return folderEntries;
	}

	private async readPreDeployScripts(): Promise<FileProjectEntry[]> {
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

		return preDeploymentScriptEntries;
	}

	private async readPostDeployScripts(): Promise<FileProjectEntry[]> {
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

		return postDeploymentScriptEntries;
	}

	private async readNoneScripts(): Promise<FileProjectEntry[]> {
		var result: GetScriptsResult = await this.sqlProjService.getNoneItems(this.projectFilePath);
		this.throwIfFailed(result);

		const noneItemEntries: FileProjectEntry[] = [];

		if (result.scripts?.length > 0) { // empty array from SqlToolsService is deserialized as null
			for (var path of result.scripts) {
				noneItemEntries.push(this.createFileProjectEntry(path, EntryType.File));
			}
		}

		return noneItemEntries.filter(f => !utils.isPublishProfile(f.relativePath));
	}

	/**
	 *
	 * @returns all the publish profiles (ending with *.publish.xml) specified as <None Include="file.publish.xml" /> in the sqlproj
	 */
	private async readPublishProfiles(): Promise<FileProjectEntry[]> {
		var result: GetScriptsResult = await this.sqlProjService.getNoneItems(this.projectFilePath);
		this.throwIfFailed(result);

		const noneItemEntries: FileProjectEntry[] = [];

		if (result.scripts?.length > 0) { // empty array from SqlToolsService is deserialized as null
			for (var path of result.scripts) {
				noneItemEntries.push(this.createFileProjectEntry(path, EntryType.File));
			}
		}

		return noneItemEntries.filter(f => utils.isPublishProfile(f.relativePath));
	}

	private readDatabaseReferences(): IDatabaseReferenceProjectEntry[] {
		const databaseReferenceEntries: IDatabaseReferenceProjectEntry[] = [];

		// database(system db and dacpac) references
		const references = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ArtifactReference);
		for (let r = 0; r < references.length; r++) {
			try {
				if (references[r].getAttribute(constants.Condition) !== constants.NotNetCoreCondition) {
					const filepath = references[r].getAttribute(constants.Include);
					if (!filepath) {
						throw new Error(constants.invalidDatabaseReference);
					}

					const nameNodes = references[r].getElementsByTagName(constants.DatabaseVariableLiteralValue);
					const name = nameNodes.length === 1 ? nameNodes[0].childNodes[0].nodeValue! : undefined;

					const suppressMissingDependenciesErrorNode = references[r].getElementsByTagName(constants.SuppressMissingDependenciesErrors);
					const suppressMissingDependencies = suppressMissingDependenciesErrorNode.length === 1 ? (suppressMissingDependenciesErrorNode[0].childNodes[0].nodeValue === constants.True) : false;

					const path = utils.convertSlashesForSqlProj(this.getSystemDacpacUri(`${name}.dacpac`).fsPath);
					if (path.includes(filepath)) {
						databaseReferenceEntries.push(new SystemDatabaseReferenceProjectEntry(
							Uri.file(filepath),
							this.getSystemDacpacSsdtUri(`${name}.dacpac`),
							name,
							suppressMissingDependencies));
					} else {
						databaseReferenceEntries.push(new DacpacReferenceProjectEntry({
							dacpacFileLocation: Uri.file(utils.getPlatformSafeFileEntryPath(filepath)),
							databaseName: name,
							suppressMissingDependenciesErrors: suppressMissingDependencies
						}));
					}
				}
			} catch (e) {
				void window.showErrorMessage(constants.errorReadingProject(constants.DacpacReferenceElement, this.projectFilePath));
				console.error(utils.getErrorMessage(e));
			}
		}

		// project references
		const projectReferences = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ProjectReference);
		for (let r = 0; r < projectReferences.length; r++) {
			try {
				const filepath = projectReferences[r].getAttribute(constants.Include);
				if (!filepath) {
					throw new Error(constants.invalidDatabaseReference);
				}

				const nameNodes = projectReferences[r].getElementsByTagName(constants.Name);
				let name = '';
				try {
					name = nameNodes[0].childNodes[0].nodeValue!;
				} catch (e) {
					void window.showErrorMessage(constants.errorReadingProject(constants.ProjectReferenceNameElement, this.projectFilePath));
					console.error(utils.getErrorMessage(e));
				}

				const suppressMissingDependenciesErrorNode = projectReferences[r].getElementsByTagName(constants.SuppressMissingDependenciesErrors);
				const suppressMissingDependencies = suppressMissingDependenciesErrorNode.length === 1 ? (suppressMissingDependenciesErrorNode[0].childNodes[0].nodeValue === constants.True) : false;

				databaseReferenceEntries.push(new SqlProjectReferenceProjectEntry({
					projectRelativePath: Uri.file(utils.getPlatformSafeFileEntryPath(filepath)),
					projectName: name,
					projectGuid: '', // don't care when just reading project as a reference
					suppressMissingDependenciesErrors: suppressMissingDependencies
				}));
			} catch (e) {
				void window.showErrorMessage(constants.errorReadingProject(constants.ProjectReferenceElement, this.projectFilePath));
				console.error(utils.getErrorMessage(e));
			}
		}

		return databaseReferenceEntries;
	}

	private readImportedTargets(): string[] {
		const imports: string[] = [];

		// find all import statements to include
		try {
			const importElements = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.Import);
			for (let i = 0; i < importElements.length; i++) {
				const importTarget = importElements[i];
				imports.push(importTarget.getAttribute(constants.Project)!);
			}
		} catch (e) {
			void window.showErrorMessage(constants.errorReadingProject(constants.ImportElements, this.projectFilePath));
			console.error(utils.getErrorMessage(e));
		}

		return imports;
	}

	//#endregion

	private resetProject(): void {
		this._files = [];
		this._importedTargets = [];
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
		if (this.sqlProjStyle === ProjectType.SdkStyle) {
			return;
		}

		// TODO: is this check below still relevant?
		// if (this._importedTargets.includes(constants.NetCoreTargets) && !this.containsSSDTOnlySystemDatabaseReferences() // old style project check
		// 	|| this.sqlProjStyle === ProjectType.SdkStyle) { // new style project check
		// 	return;
		// }

		TelemetryReporter.sendActionEvent(TelemetryViews.ProjectController, TelemetryActions.updateProjectForRoundtrip);

		const result = await this.sqlProjService.updateProjectForCrossPlatform(this.projectFilePath);
		this.throwIfFailed(result);

		await this.readCrossPlatformCompatibility();
	}

	//#region Add/Delete/Exclude functions

	//#endregion

	/**
	 * Adds a folder to the project, and saves the project file
	 *
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

		if (contents) {
			// Create the file if contents were passed in and file does not exist yet
			await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true });

			try {
				await fs.writeFile(absoluteFilePath, contents, { flag: 'wx' });
			} catch (error) {
				if (error.code === 'EEXIST') {
					// Throw specialized error, if file already exists
					throw new Error(constants.fileAlreadyExists(path.parse(absoluteFilePath).name));
				}

				throw error;
			}
		} else {
			// If no contents were provided, then check that file already exists
			let exists = await utils.exists(absoluteFilePath);
			if (!exists) {
				throw new Error(constants.noFileExist(absoluteFilePath));
			}
		}

		// Add the new script
		let result: ResultStatus;

		switch (itemType) {
			case ItemType.preDeployScript:
				result = await this.sqlProjService.addPreDeploymentScript(this.projectFilePath, relativeFilePath);
				this._preDeployScripts = await this.readPreDeployScripts();
				this._noneDeployScripts = await this.readNoneScripts();
				break;
			case ItemType.postDeployScript:
				result = await this.sqlProjService.addPostDeploymentScript(this.projectFilePath, relativeFilePath);
				this._postDeployScripts = await this.readPostDeployScripts();
				this._noneDeployScripts = await this.readNoneScripts();
				break;
			default:
				result = await this.sqlProjService.addSqlObjectScript(this.projectFilePath, relativeFilePath);
				this._files = await this.readFilesInProject();
				break;
		}

		this._folders = await this.readFolders();

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
			this._files = await this.readFilesInProject();
		} else {
			result = await this.sqlProjService.addNoneItem(this.projectFilePath, filePath);
			this._noneDeployScripts = await this.readNoneScripts();
		}

		this.throwIfFailed(result);

		return this.createFileProjectEntry(normalizedRelativeFilePath, EntryType.File);
	}

	public async exclude(entry: FileProjectEntry): Promise<void> {
		const toExclude: FileProjectEntry[] = this._files.concat(this._preDeployScripts).concat(this._postDeployScripts).concat(this._noneDeployScripts).concat(this._publishProfiles).filter(x => x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
		await this.removeFromProjFile(toExclude);

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
		await this.removeFromProjFile(entry);
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
		if (this.getProjectTargetVersion() !== compatLevel) {
			TelemetryReporter.createActionEvent(TelemetryViews.ProjectTree, TelemetryActions.changePlatformType)
				.withAdditionalProperties({
					from: this.getProjectTargetVersion(),
					to: compatLevel
				})
				.send();

			const newDSP = `${constants.MicrosoftDatatoolsSchemaSqlSql}${compatLevel}${constants.databaseSchemaProvider}`;
			(this.projFileXmlDoc!.getElementsByTagName(constants.DSP)[0].childNodes[0] as Text).data = newDSP;
			this.projFileXmlDoc!.getElementsByTagName(constants.DSP)[0].childNodes[0].nodeValue = newDSP;

			// update any system db references
			const systemDbReferences = this._databaseReferences.filter(r => r instanceof SystemDatabaseReferenceProjectEntry) as SystemDatabaseReferenceProjectEntry[];
			if (systemDbReferences.length > 0) {
				for (let r of systemDbReferences) {
					// remove old entry in sqlproj
					this.removeDatabaseReferenceFromProjFile(r);

					// update uris to point to the correct dacpacs for the target platform
					r.fsUri = this.getSystemDacpacUri(`${r.databaseName}.dacpac`);
					r.ssdtUri = this.getSystemDacpacSsdtUri(`${r.databaseName}.dacpac`);

					// add updated system db reference to sqlproj
					await this.addDatabaseReferenceToProjFile(r);
				}
			}

			await this.serializeToProjFile(this.projFileXmlDoc!);
		}
	}

	/**
	 * Adds reference to the appropriate system database dacpac to the project
	 */
	public async addSystemDatabaseReference(settings: ISystemDatabaseReferenceSettings): Promise<void> {
		let uri: Uri;
		let ssdtUri: Uri;

		if (settings.systemDb === SystemDatabase.master) {
			uri = this.getSystemDacpacUri(constants.masterDacpac);
			ssdtUri = this.getSystemDacpacSsdtUri(constants.masterDacpac);
		} else {
			uri = this.getSystemDacpacUri(constants.msdbDacpac);
			ssdtUri = this.getSystemDacpacSsdtUri(constants.msdbDacpac);
		}

		const systemDatabaseReferenceProjectEntry = new SystemDatabaseReferenceProjectEntry(uri, ssdtUri, <string>settings.databaseName, settings.suppressMissingDependenciesErrors);

		// check if reference to this database already exists
		if (this.databaseReferenceExists(systemDatabaseReferenceProjectEntry)) {
			throw new Error(constants.databaseReferenceAlreadyExists);
		}

		await this.addToProjFile(systemDatabaseReferenceProjectEntry);
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

		// check if reference to this database already exists
		// if it does, throw an error that will get displayed to the user
		if (this.databaseReferenceExists(databaseReferenceEntry)) {
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
		const result = await this.sqlProjService.addDacpacReference(this.projectFilePath, settings.dacpacFileLocation.fsPath, settings.suppressMissingDependenciesErrors, settings.databaseVariable, settings.serverVariable, databaseLiteral)

		if (!result.success && result.errorMessage) {
			throw new Error(constants.errorAddingDatabaseReference(settings.dacpacFileLocation.fsPath, result.errorMessage));
		}
	}

	/**
	 * Adds reference to a another project in the workspace
	 */
	public async addProjectReference(settings: IProjectReferenceSettings): Promise<void> {
		const projectReferenceEntry = new SqlProjectReferenceProjectEntry(settings);

		// check if reference to this database already exists
		if (this.databaseReferenceExists(projectReferenceEntry)) {
			throw new Error(constants.databaseReferenceAlreadyExists);
		}

		await this.addToProjFile(projectReferenceEntry);
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

	private findOrCreateItemGroup(containedTag?: string, prePostScriptExist?: { scriptExist: boolean; }): Element {
		let outputItemGroup: Element[] = [];	// "None" can have more than one ItemGroup, for "None Include" (for pre/post deploy scripts and publish profiles), "None Remove"
		let returnItemGroup;

		// search for a particular item goup if a child type is provided
		if (containedTag) {
			// find any ItemGroup node that contains files; that's where we'll add
			for (let ig = 0; ig < this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup).length; ig++) {
				const currentItemGroup = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup)[ig];

				if (currentItemGroup.getElementsByTagName(containedTag).length > 0) {
					outputItemGroup.push(currentItemGroup);
				}
			}
		}

		// if none already exist, make a new ItemGroup for it
		if (outputItemGroup.length === 0) {
			returnItemGroup = this.projFileXmlDoc!.createElement(constants.ItemGroup);
			this.projFileXmlDoc!.documentElement.appendChild(returnItemGroup);

			if (prePostScriptExist) {
				prePostScriptExist.scriptExist = false;
			}
		} else {	// if item group exists and containedTag = None, read the content to find None Include with publish profile
			if (containedTag === constants.None) {
				for (let ig = 0; ig < outputItemGroup.length; ig++) {
					const itemGroup = outputItemGroup[ig];

					// find all none include scripts specified in the sqlproj
					const noneItems = itemGroup.getElementsByTagName(constants.None);
					for (let n = 0; n < noneItems.length; n++) {
						let noneIncludeItem = noneItems[n].getAttribute(constants.Include);
						if (noneIncludeItem && utils.isPublishProfile(noneIncludeItem)) {
							returnItemGroup = itemGroup;
							break;
						}
					}
				}
				if (!returnItemGroup) {
					returnItemGroup = this.projFileXmlDoc!.createElement(constants.ItemGroup);
					this.projFileXmlDoc!.documentElement.appendChild(returnItemGroup);
				}
			} else {
				returnItemGroup = outputItemGroup[0]; 	// Return the first item group that was found, to match prior implementation
			}
		}

		return returnItemGroup;
	}

	private async removeFileFromProjFile(path: string): Promise<void> {//TODO: publish profile
		const fileNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.Build);
		const preDeployNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.PreDeploy);
		const postDeployNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.PostDeploy);
		const noneNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.None);
		const nodes = [fileNodes, preDeployNodes, postDeployNodes, noneNodes];

		const isBuildElement = this.files.find(f => f.relativePath === path);

		let deleted = false;

		// remove the <Build Include="..."> entry if there is one
		for (let i = 0; i < nodes.length; i++) {
			deleted = this.removeNode(path, nodes[i]);

			if (deleted) {
				// still might need to add a <Build Remove="..."> node if this is an sdk style project
				if (this.sqlProjStyle === ProjectType.SdkStyle) {
					break;
				} else {
					return;
				}
			}
		}

		// if it's an sdk style project, we'll need to add a <Build Remove="..."> entry to remove this file if it's
		// still included by a glob
		if (this.sqlProjStyle === ProjectType.SdkStyle) {
			// write any changes from removing an include node and get the current files included in the project
			if (deleted) {
				await this.serializeToProjFile(this.projFileXmlDoc!);
			}
			this._preDeployScripts = await this.readPreDeployScripts();
			this._postDeployScripts = await this.readPostDeployScripts();
			this._noneDeployScripts = await this.readNoneScripts();
			const currentFiles = await this.readFilesInProject();

			// only add a Remove node to exclude the file if it's still included by a glob
			if (currentFiles.find(f => f.relativePath === utils.convertSlashesForSqlProj(path))) {
				const removeFileNode = isBuildElement ? this.projFileXmlDoc!.createElement(constants.Build) : this.projFileXmlDoc!.createElement(constants.None);
				removeFileNode.setAttribute(constants.Remove, utils.convertSlashesForSqlProj(path));
				this.findOrCreateItemGroup(constants.Build).appendChild(removeFileNode);
				return;
			}

			return;
		}

		throw new Error(constants.unableToFindObject(path, constants.fileObject));
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

	private async removeFolderFromProjFile(folderPath: string): Promise<void> {
		let deleted = this.removeFolderNode(folderPath);

		// TODO: consider removing this check when working on migration scenario. If a user converts to an SDK-style project and adding this
		// exclude XML doesn't hurt for non-SDK-style projects, then it might be better to just it anyway so that they don't have to exclude the folder
		// again when they convert to an SDK-style project
		if (this.sqlProjStyle === ProjectType.SdkStyle) {
			// update sqlproj if a node was deleted and load files and folders again
			await this.writeToSqlProjAndUpdateFilesFolders();

			// get latest folders to see if it still exists
			const currentFolders = await this.readFolders();

			// add exclude entry if it's still in the current folders
			if (currentFolders.find(f => f.relativePath === utils.convertSlashesForSqlProj(folderPath))) {
				const removeFileNode = this.projFileXmlDoc!.createElement(constants.Build);
				removeFileNode.setAttribute(constants.Remove, utils.convertSlashesForSqlProj(folderPath + '**'));
				this.findOrCreateItemGroup(constants.Build).appendChild(removeFileNode);

				// write changes and update files so everything is up to date for the next removal
				await this.writeToSqlProjAndUpdateFilesFolders();
			}

			deleted = true;
		}

		if (!deleted) {
			throw new Error(constants.unableToFindObject(folderPath, constants.folderObject));
		}
	}

	private removeFolderNode(folderPath: string): boolean {
		const folderNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.Folder);
		let deleted = this.removeNode(folderPath, folderNodes);

		// if it wasn't deleted, try deleting the folder path without trailing backslash
		// since sometimes SSDT adds folders without a trailing \
		if (!deleted) {
			deleted = this.removeNode(utils.trimChars(folderPath, '\\'), folderNodes);
		}

		return deleted;
	}

	private async writeToSqlProjAndUpdateFilesFolders(): Promise<void> {
		await this.serializeToProjFile(this.projFileXmlDoc!);
		const projFileText = await fs.readFile(this._projectFilePath);
		this.projFileXmlDoc = new xmldom.DOMParser().parseFromString(projFileText.toString());
		this._files = await this.readFilesInProject();
		this.files.push(...(await this.readFolders()));
	}

	private removeSqlCmdVariableFromProjFile(variableName: string): void {
		const sqlCmdVariableNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.SqlCmdVariable);
		const deleted = this.removeNode(variableName, sqlCmdVariableNodes);

		if (!deleted) {
			throw new Error(constants.unableToFindSqlCmdVariable(variableName));
		}
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

	private async addSystemDatabaseReferenceToProjFile(entry: SystemDatabaseReferenceProjectEntry): Promise<void> {
		const systemDbReferenceNode = this.projFileXmlDoc!.createElement(constants.ArtifactReference);

		// if it's a system database reference, we'll add an additional node with the SSDT location of the dacpac later
		systemDbReferenceNode.setAttribute(constants.Condition, constants.NetCoreCondition);
		systemDbReferenceNode.setAttribute(constants.Include, entry.pathForSqlProj());
		await this.addDatabaseReferenceChildren(systemDbReferenceNode, entry);
		this.findOrCreateItemGroup(constants.ArtifactReference).appendChild(systemDbReferenceNode);

		// add a reference to the system dacpac in SSDT if it's a system db
		const ssdtReferenceNode = this.projFileXmlDoc!.createElement(constants.ArtifactReference);
		ssdtReferenceNode.setAttribute(constants.Condition, constants.NotNetCoreCondition);
		ssdtReferenceNode.setAttribute(constants.Include, entry.ssdtPathForSqlProj());
		await this.addDatabaseReferenceChildren(ssdtReferenceNode, entry);
		this.findOrCreateItemGroup(constants.ArtifactReference).appendChild(ssdtReferenceNode);
	}

	private async addDatabaseReferenceToProjFile(entry: IDatabaseReferenceProjectEntry): Promise<void> {
		if (entry instanceof SystemDatabaseReferenceProjectEntry) {
			await this.addSystemDatabaseReferenceToProjFile(<SystemDatabaseReferenceProjectEntry>entry);
		} else if (entry instanceof SqlProjectReferenceProjectEntry) {
			const referenceNode = this.projFileXmlDoc!.createElement(constants.ProjectReference);
			referenceNode.setAttribute(constants.Include, entry.pathForSqlProj());
			this.addProjectReferenceChildren(referenceNode, <SqlProjectReferenceProjectEntry>entry);
			await this.addDatabaseReferenceChildren(referenceNode, entry);
			this.findOrCreateItemGroup(constants.ProjectReference).appendChild(referenceNode);
		} else {
			const referenceNode = this.projFileXmlDoc!.createElement(constants.ArtifactReference);
			referenceNode.setAttribute(constants.Include, entry.pathForSqlProj());
			await this.addDatabaseReferenceChildren(referenceNode, entry);
			this.findOrCreateItemGroup(constants.ArtifactReference).appendChild(referenceNode);
		}

		if (!this.databaseReferenceExists(entry)) {
			this._databaseReferences.push(entry);
		}
	}

	private databaseReferenceExists(entry: IDatabaseReferenceProjectEntry): boolean {
		const found = this._databaseReferences.find(reference => reference.pathForSqlProj() === entry.pathForSqlProj()) !== undefined;
		return found;
	}

	private async addDatabaseReferenceChildren(referenceNode: Element, entry: IDatabaseReferenceProjectEntry): Promise<void> {
		const suppressMissingDependenciesErrorNode = this.projFileXmlDoc!.createElement(constants.SuppressMissingDependenciesErrors);
		const suppressMissingDependenciesErrorTextNode = this.projFileXmlDoc!.createTextNode(entry.suppressMissingDependenciesErrors ? constants.True : constants.False);
		suppressMissingDependenciesErrorNode.appendChild(suppressMissingDependenciesErrorTextNode);
		referenceNode.appendChild(suppressMissingDependenciesErrorNode);

		if ((<DacpacReferenceProjectEntry>entry).databaseSqlCmdVariable) {
			const databaseSqlCmdVariableElement = this.projFileXmlDoc!.createElement(constants.DatabaseSqlCmdVariable);
			const databaseSqlCmdVariableTextNode = this.projFileXmlDoc!.createTextNode((<DacpacReferenceProjectEntry>entry).databaseSqlCmdVariable!);
			databaseSqlCmdVariableElement.appendChild(databaseSqlCmdVariableTextNode);
			referenceNode.appendChild(databaseSqlCmdVariableElement);

			// add SQLCMD variable
			await this.addSqlCmdVariable((<DacpacReferenceProjectEntry>entry).databaseSqlCmdVariable!, (<DacpacReferenceProjectEntry>entry).databaseVariableLiteralValue!);
		} else if (entry.databaseVariableLiteralValue) {
			const databaseVariableLiteralValueElement = this.projFileXmlDoc!.createElement(constants.DatabaseVariableLiteralValue);
			const databaseTextNode = this.projFileXmlDoc!.createTextNode(entry.databaseVariableLiteralValue);
			databaseVariableLiteralValueElement.appendChild(databaseTextNode);
			referenceNode.appendChild(databaseVariableLiteralValueElement);
		}

		if ((<DacpacReferenceProjectEntry>entry).serverSqlCmdVariable) {
			const serverSqlCmdVariableElement = this.projFileXmlDoc!.createElement(constants.ServerSqlCmdVariable);
			const serverSqlCmdVariableTextNode = this.projFileXmlDoc!.createTextNode((<DacpacReferenceProjectEntry>entry).serverSqlCmdVariable!);
			serverSqlCmdVariableElement.appendChild(serverSqlCmdVariableTextNode);
			referenceNode.appendChild(serverSqlCmdVariableElement);

			// add SQLCMD variable
			await this.addSqlCmdVariable((<DacpacReferenceProjectEntry>entry).serverSqlCmdVariable!, (<DacpacReferenceProjectEntry>entry).serverName!);
		}
	}

	private addProjectReferenceChildren(referenceNode: Element, entry: SqlProjectReferenceProjectEntry): void {
		// project name
		const nameElement = this.projFileXmlDoc!.createElement(constants.Name);
		const nameTextNode = this.projFileXmlDoc!.createTextNode(entry.projectName);
		nameElement.appendChild(nameTextNode);
		referenceNode.appendChild(nameElement);

		// add project guid
		const projectElement = this.projFileXmlDoc!.createElement(constants.Project);
		const projectGuidTextNode = this.projFileXmlDoc!.createTextNode(entry.projectGuid);
		projectElement.appendChild(projectGuidTextNode);
		referenceNode.appendChild(projectElement);

		// add Private (not sure what this is for)
		const privateElement = this.projFileXmlDoc!.createElement(constants.Private);
		const privateTextNode = this.projFileXmlDoc!.createTextNode(constants.True);
		privateElement.appendChild(privateTextNode);
		referenceNode.appendChild(privateElement);
	}

	public async addSqlCmdVariableToProjFile(entry: SqlCmdVariableProjectEntry): Promise<void> {
		// Remove any entries with the same variable name. It'll be replaced with a new one
		if (Object.keys(this._sqlCmdVariables).includes(entry.variableName)) {
			await this.removeFromProjFile(entry);
		}

		const sqlCmdVariableNode = this.projFileXmlDoc!.createElement(constants.SqlCmdVariable);
		sqlCmdVariableNode.setAttribute(constants.Include, entry.variableName);
		this.addSqlCmdVariableChildren(sqlCmdVariableNode, entry);
		this.findOrCreateItemGroup(constants.SqlCmdVariable).appendChild(sqlCmdVariableNode);

		// add to the project's loaded sqlcmd variables
		this._sqlCmdVariables[entry.variableName] = <string>entry.defaultValue;
	}

	private addSqlCmdVariableChildren(sqlCmdVariableNode: Element, entry: SqlCmdVariableProjectEntry): void {
		// add default value
		const defaultValueNode = this.projFileXmlDoc!.createElement(constants.DefaultValue);
		const defaultValueText = this.projFileXmlDoc!.createTextNode(entry.defaultValue);
		defaultValueNode.appendChild(defaultValueText);
		sqlCmdVariableNode.appendChild(defaultValueNode);

		// add value node which is in the format $(SqlCmdVar__x)
		const valueNode = this.projFileXmlDoc!.createElement(constants.Value);
		const valueText = this.projFileXmlDoc!.createTextNode(`$(SqlCmdVar__${this.getNextSqlCmdVariableCounter()})`);
		valueNode.appendChild(valueText);
		sqlCmdVariableNode.appendChild(valueNode);
	}

	/**
	 * returns the next number that should be used for the new SqlCmd Variable. Old numbers don't get reused even if a SqlCmd Variable
	 * gets removed from the project
	 */
	private getNextSqlCmdVariableCounter(): number {
		const sqlCmdVariableNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.SqlCmdVariable);
		let highestNumber = 0;

		for (let i = 0; i < sqlCmdVariableNodes.length; i++) {
			const value: string = sqlCmdVariableNodes[i].getElementsByTagName(constants.Value)[0].childNodes[0].nodeValue!;
			const number = parseInt(value.substring(13).slice(0, -1)); // want the number x in $(SqlCmdVar__x)

			// incremement the counter if there's already a variable with the same number or greater
			if (number > highestNumber) {
				highestNumber = number;
			}
		}

		return highestNumber + 1;
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
				const systemDb = currentNode.getAttribute(constants.Include)?.includes(constants.master) ? SystemDatabase.master : SystemDatabase.msdb;

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
				this._databaseReferences.splice(this._databaseReferences.findIndex(n => n.databaseName === (systemDb === SystemDatabase.master ? constants.master : constants.msdb)), 1);

				await this.addSystemDatabaseReference({ databaseName: databaseVariableName, systemDb: systemDb, suppressMissingDependenciesErrors: suppressMissingDependences });
			}
		}

		TelemetryReporter.createActionEvent(TelemetryViews.ProjectController, TelemetryActions.updateSystemDatabaseReferencesInProjFile)
			.withAdditionalMeasurements({ referencesCount: this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ArtifactReference).length })
			.send();
	}

	private async addToProjFile(entry: ProjectEntry): Promise<void> {
		switch (entry.type) {
			case EntryType.DatabaseReference:
				await this.addDatabaseReferenceToProjFile(<IDatabaseReferenceProjectEntry>entry);
				break;
			case EntryType.SqlCmdVariable:
				await this.addSqlCmdVariableToProjFile(<SqlCmdVariableProjectEntry>entry);
				break; // not required but adding so that we dont miss when we add new items
			default:
				throw new Error(`Unhandled entry type: ${entry.type}`);
		}

		await this.serializeToProjFile(this.projFileXmlDoc!);
	}

	private async removeFromProjFile(entries: IProjectEntry | IProjectEntry[]): Promise<void> {
		if (!Array.isArray(entries)) {
			entries = [entries];
		}

		// remove any folders first, otherwise unnecessary Build remove entries might get added for sdk style
		// projects to exclude both the folder and the files in the folder
		const folderEntries = entries.filter(e => e.type === EntryType.Folder);
		for (const folder of folderEntries) {
			await this.removeFolderFromProjFile((<FileProjectEntry>folder).relativePath);
		}

		entries = entries.filter(e => e.type !== EntryType.Folder);

		for (const entry of entries) {
			switch (entry.type) {
				case EntryType.File:
					await this.removeFileFromProjFile((<FileProjectEntry>entry).relativePath);
					break;
				case EntryType.DatabaseReference:
					this.removeDatabaseReferenceFromProjFile(<IDatabaseReferenceProjectEntry>entry);
					break;
				case EntryType.SqlCmdVariable:
					this.removeSqlCmdVariableFromProjFile((<SqlCmdVariableProjectEntry>entry).variableName);
					break; // not required but adding so that we dont miss when we add new items
			}
		}

		await this.serializeToProjFile(this.projFileXmlDoc!);
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
					await this.addScriptItem(relativePath);
				} else if (fileStat.isDirectory()) {
					await this.addFolder(relativePath);
				}
			}
		}
	}

	private throwIfFailed(result: ResultStatus): void {
		if (!result.success) {
			throw new Error('Error: ' + result.errorMessage);
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
