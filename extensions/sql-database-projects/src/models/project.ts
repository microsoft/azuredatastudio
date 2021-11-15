/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as xmldom from 'xmldom';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import * as xmlFormat from 'xml-formatter';
import * as os from 'os';
import * as templates from '../templates/templates';

import { Uri, window } from 'vscode';
import { ISqlProject, SqlTargetPlatform } from 'sqldbproj';
import { promises as fs } from 'fs';
import { DataSource } from './dataSources/dataSources';
import { ISystemDatabaseReferenceSettings, IDacpacReferenceSettings, IProjectReferenceSettings } from './IDatabaseReferenceSettings';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';
import { DacpacReferenceProjectEntry, EntryType, FileProjectEntry, IDatabaseReferenceProjectEntry, ProjectEntry, SqlCmdVariableProjectEntry, SqlProjectReferenceProjectEntry, SystemDatabase, SystemDatabaseReferenceProjectEntry } from './projectEntry';

/**
 * Class representing a Project, and providing functions for operating on it
 */
export class Project implements ISqlProject {
	private _projectFilePath: string;
	private _projectFileName: string;
	private _projectGuid: string | undefined;
	private _files: FileProjectEntry[] = [];
	private _dataSources: DataSource[] = [];
	private _importedTargets: string[] = [];
	private _databaseReferences: IDatabaseReferenceProjectEntry[] = [];
	private _sqlCmdVariables: Record<string, string> = {};
	private _preDeployScripts: FileProjectEntry[] = [];
	private _postDeployScripts: FileProjectEntry[] = [];
	private _noneDeployScripts: FileProjectEntry[] = [];
	private _isMsbuildSdkStyleProject: boolean = false;

	public get dacpacOutputPath(): string {
		return path.join(this.projectFolderPath, 'bin', 'Debug', `${this._projectFileName}.dacpac`);
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

	public get isMsbuildSdkStyleProject(): boolean {
		return this._isMsbuildSdkStyleProject;
	}

	private projFileXmlDoc: Document | undefined = undefined;

	constructor(projectFilePath: string) {
		this._projectFilePath = projectFilePath;
		this._projectFileName = path.basename(projectFilePath, '.sqlproj');
	}

	/**
	 * Open and load a .sqlproj file
	 */
	public static async openProject(projectFilePath: string): Promise<Project> {
		const proj = new Project(projectFilePath);
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

		// check if this is a new msbuild sdk style project
		this._isMsbuildSdkStyleProject = this.CheckForMsbuildSdkStyleProject();

		// get files and folders
		this._files = await this.readFilesInProject();
		this.files.push(...await this.readFolders());

		this._preDeployScripts = this.readPreDeployScripts();
		this._postDeployScripts = this.readPostDeployScripts();
		this._noneDeployScripts = this.readNoneDeployScripts();
		this._databaseReferences = this.readDatabaseReferences();
		this._importedTargets = this.readImportedTargets();

		// find all SQLCMD variables to include
		try {
			this._sqlCmdVariables = utils.readSqlCmdVariables(this.projFileXmlDoc, false);
		} catch (e) {
			void window.showErrorMessage(constants.errorReadingProject(constants.sqlCmdVariables, this.projectFilePath));
			console.error(utils.getErrorMessage(e));
		}

		// get projectGUID
		try {
			this._projectGuid = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ProjectGuid)[0].childNodes[0].nodeValue!;
		} catch (e) {
			void window.showErrorMessage(constants.errorReadingProject(constants.ProjectGuid, this.projectFilePath));
			console.error(utils.getErrorMessage(e));
		}
	}

	/**
	 * Gets all the files specified by <Build Inlude="..."> and removes all the files specified by <Build Remove="...">
	 * and all files included by the default glob of the folder of the sqlproj if it's an msbuild sdk style project
	 */
	private async readFilesInProject(): Promise<FileProjectEntry[]> {
		const filesSet: Set<string> = new Set();
		const entriesWithType: { relativePath: string, typeAttribute: string }[] = [];

		// default glob include pattern for msbuild sdk style projects
		if (this._isMsbuildSdkStyleProject) {
			try {
				const globFiles = await utils.getSqlFilesInFolder(this.projectFolderPath, true);
				globFiles.forEach(f => {
					filesSet.add(utils.convertSlashesForSqlProj(utils.trimUri(Uri.file(this.projectFilePath), Uri.file(f))));
				});
			} catch (e) {
				console.error(utils.getErrorMessage(e));
			}
		}

		for (let ig = 0; ig < this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup).length; ig++) {
			const itemGroup = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup)[ig];

			// find all files to include that are specified in the project file
			try {
				const buildElements = itemGroup.getElementsByTagName(constants.Build);

				// <Build Include....>
				for (let b = 0; b < buildElements.length; b++) {
					const relativePath = buildElements[b].getAttribute(constants.Include)!;

					if (relativePath) {
						const fullPath = path.join(utils.getPlatformSafeFileEntryPath(this.projectFolderPath), utils.getPlatformSafeFileEntryPath(relativePath));

						// msbuild sdk style projects can handle other globbing patterns like <Build Include="folder1\*.sql" /> and <Build Include="Production*.sql" />
						if (this._isMsbuildSdkStyleProject && !(await utils.exists(fullPath))) {
							// add files from the glob pattern
							const globFiles = await utils.globWithPattern(fullPath);
							globFiles.forEach(gf => {
								const newFileRelativePath = utils.convertSlashesForSqlProj(utils.trimUri(Uri.file(this.projectFilePath), Uri.file(gf)));
								filesSet.add(newFileRelativePath);
							});
						} else {
							filesSet.add(relativePath);

							// Right now only used for external streaming jobs
							const typeAttribute = buildElements[b].getAttribute(constants.Type)!;
							if (typeAttribute) {
								entriesWithType.push({ relativePath, typeAttribute });
							}
						}
					}
				}

				// <Build Remove....>
				// after all the files have been included, remove the ones specified in the sqlproj to remove
				if (this._isMsbuildSdkStyleProject) {
					for (let b = 0; b < buildElements.length; b++) {
						const relativePath = buildElements[b].getAttribute(constants.Remove)!;

						if (relativePath) {
							const fullPath = path.join(utils.getPlatformSafeFileEntryPath(this.projectFolderPath), utils.getPlatformSafeFileEntryPath(relativePath));

							const globRemoveFiles = await utils.globWithPattern(fullPath);
							globRemoveFiles.forEach(gf => {
								const removeFileRelativePath = utils.convertSlashesForSqlProj(utils.trimUri(Uri.file(this.projectFilePath), Uri.file(gf)));
								filesSet.delete(removeFileRelativePath);
							});
						}
					}
				}
			} catch (e) {
				void window.showErrorMessage(constants.errorReadingProject(constants.BuildElements, this.projectFilePath));
				console.error(utils.getErrorMessage(e));
			}
		}

		// create a FileProjectEntry for each file
		const fileEntries: FileProjectEntry[] = [];
		filesSet.forEach(f => {
			const typeEntry = entriesWithType.find(e => e.relativePath === f);
			fileEntries.push(this.createFileProjectEntry(f, EntryType.File, typeEntry ? typeEntry.typeAttribute : undefined));
		});

		return fileEntries;
	}

	private async readFolders(): Promise<FileProjectEntry[]> {
		const folderEntries: FileProjectEntry[] = [];
		// glob style getting folders for new msbuild sdk style projects
		if (this._isMsbuildSdkStyleProject) {
			const folders = await utils.getFoldersInFolder(this.projectFolderPath, true);
			folders.forEach(f => {
				folderEntries.push(this.createFileProjectEntry(utils.trimUri(Uri.file(this.projectFilePath), Uri.file(f)), EntryType.Folder));
			});
		}

		// get any folders listed in the project file
		for (let ig = 0; ig < this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup).length; ig++) {
			const itemGroup = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup)[ig];
			try {
				const folderElements = itemGroup.getElementsByTagName(constants.Folder);
				for (let f = 0; f < folderElements.length; f++) {
					const relativePath = folderElements[f].getAttribute(constants.Include)!;
					// don't add Properties folder since it isn't supported for now and don't add if the folder was already added
					if (relativePath !== constants.Properties && !folderEntries.find(f => f.relativePath === utils.trimChars(relativePath, '\\'))) {
						folderEntries.push(this.createFileProjectEntry(relativePath, EntryType.Folder));
					}
				}
			} catch (e) {
				void window.showErrorMessage(constants.errorReadingProject(constants.Folder, this.projectFilePath));
				console.error(utils.getErrorMessage(e));
			}
		}

		return folderEntries;
	}

	private readPreDeployScripts(): FileProjectEntry[] {
		const preDeployScripts: FileProjectEntry[] = [];
		// find all pre-deployment scripts to include
		let preDeployScriptCount: number = 0;

		for (let ig = 0; ig < this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup).length; ig++) {
			const itemGroup = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup)[ig];

			try {
				const preDeploy = itemGroup.getElementsByTagName(constants.PreDeploy);
				for (let pre = 0; pre < preDeploy.length; pre++) {
					preDeployScripts.push(this.createFileProjectEntry(preDeploy[pre].getAttribute(constants.Include)!, EntryType.File));
					preDeployScriptCount++;
				}
			} catch (e) {
				void window.showErrorMessage(constants.errorReadingProject(constants.PreDeployElements, this.projectFilePath));
				console.error(utils.getErrorMessage(e));
			}
		}

		if (preDeployScriptCount > 1) {
			void window.showWarningMessage(constants.prePostDeployCount, constants.okString);
		}

		return preDeployScripts;
	}

	private readPostDeployScripts(): FileProjectEntry[] {
		const postDeployScripts: FileProjectEntry[] = [];
		// find all post-deployment scripts to include
		let postDeployScriptCount: number = 0;

		for (let ig = 0; ig < this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup).length; ig++) {
			const itemGroup = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup)[ig];

			try {
				const postDeploy = itemGroup.getElementsByTagName(constants.PostDeploy);
				for (let post = 0; post < postDeploy.length; post++) {
					postDeployScripts.push(this.createFileProjectEntry(postDeploy[post].getAttribute(constants.Include)!, EntryType.File));
					postDeployScriptCount++;
				}
			} catch (e) {
				void window.showErrorMessage(constants.errorReadingProject(constants.PostDeployElements, this.projectFilePath));
				console.error(utils.getErrorMessage(e));
			}
		}

		if (postDeployScriptCount > 1) {
			void window.showWarningMessage(constants.prePostDeployCount, constants.okString);
		}

		return postDeployScripts;
	}

	private readNoneDeployScripts(): FileProjectEntry[] {
		const noneDeployScripts: FileProjectEntry[] = [];

		for (let ig = 0; ig < this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup).length; ig++) {
			const itemGroup = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup)[ig];

			// find all none-deployment scripts to include
			try {
				const noneItems = itemGroup.getElementsByTagName(constants.None);
				for (let n = 0; n < noneItems.length; n++) {
					noneDeployScripts.push(this.createFileProjectEntry(noneItems[n].getAttribute(constants.Include)!, EntryType.File));
				}
			} catch (e) {
				void window.showErrorMessage(constants.errorReadingProject(constants.NoneElements, this.projectFilePath));
				console.error(utils.getErrorMessage(e));
			}
		}

		return noneDeployScripts;
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

	private resetProject(): void {
		this._files = [];
		this._importedTargets = [];
		this._databaseReferences = [];
		this._sqlCmdVariables = {};
		this._preDeployScripts = [];
		this._postDeployScripts = [];
		this._noneDeployScripts = [];
		this.projFileXmlDoc = undefined;
	}

	/**
	 *  Checks for the 3 possible ways a project can reference the sql msbuild sdk
	 *  https://docs.microsoft.com/en-us/visualstudio/msbuild/how-to-use-project-sdk?view=vs-2019
	 *  @returns true if the project is an msbuild sdk style project, false if it isn't
	 */
	public CheckForMsbuildSdkStyleProject(): boolean {
		// type 1: Sdk node like <Sdk Name="Microsoft.Build.Sql" Version="1.0.0" />
		const sdkNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.Sdk);
		if (sdkNodes.length > 0) {
			return sdkNodes[0].getAttribute(constants.Name) === constants.sqlMsbuildSdk;
		}

		// type 2: Project node has Sdk attribute like <Project Sdk="Microsoft.Build.Sql/1.0.0">
		const sdkAttribute: string = this.projFileXmlDoc!.documentElement.getAttribute(constants.Sdk)!;
		if (sdkAttribute) {
			return sdkAttribute.includes(constants.sqlMsbuildSdk);
		}

		// type 3: Import node with Sdk attribute like <Import Project="Sdk.targets" Sdk="Microsoft.Build.Sql" Version="1.0.0" />
		const importNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.Import);
		for (let i = 0; i < importNodes.length; i++) {
			if (importNodes[i].getAttribute(constants.Sdk) === constants.sqlMsbuildSdk) {
				return true;
			}
		}

		return false;
	}

	public async updateProjectForRoundTrip(): Promise<void> {
		if (this._importedTargets.includes(constants.NetCoreTargets) && !this.containsSSDTOnlySystemDatabaseReferences() // old style project check
			|| this.isMsbuildSdkStyleProject) { // new style project check
			return;
		}

		TelemetryReporter.sendActionEvent(TelemetryViews.ProjectController, TelemetryActions.updateProjectForRoundtrip);

		if (!this._importedTargets.includes(constants.NetCoreTargets)) {
			const result = await window.showWarningMessage(constants.updateProjectForRoundTrip(this.projectFileName), constants.yesString, constants.noString);
			if (result === constants.yesString) {
				await fs.copyFile(this._projectFilePath, this._projectFilePath + '_backup');
				await this.updateImportToSupportRoundTrip();
				await this.updatePackageReferenceInProjFile();
				await this.updateBeforeBuildTargetInProjFile();
				await this.updateSystemDatabaseReferencesInProjFile();
			}
		} else if (this.containsSSDTOnlySystemDatabaseReferences()) {
			const result = await window.showWarningMessage(constants.updateProjectDatabaseReferencesForRoundTrip(this.projectFileName), constants.yesString, constants.noString);
			if (result === constants.yesString) {
				await fs.copyFile(this._projectFilePath, this._projectFilePath + '_backup');
				await this.updateSystemDatabaseReferencesInProjFile();
			}
		}
	}

	private async updateImportToSupportRoundTrip(): Promise<void> {
		// update an SSDT project to include Net core target information
		for (let i = 0; i < this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.Import).length; i++) {
			const importTarget = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.Import)[i];

			let condition = importTarget.getAttribute(constants.Condition);
			let projectAttributeVal = importTarget.getAttribute(constants.Project);

			if (condition === constants.SqlDbPresentCondition && projectAttributeVal === constants.SqlDbTargets) {
				await this.updateImportedTargetsToProjFile(constants.RoundTripSqlDbPresentCondition, projectAttributeVal, importTarget);
			}
			if (condition === constants.SqlDbNotPresentCondition && projectAttributeVal === constants.MsBuildtargets) {
				await this.updateImportedTargetsToProjFile(constants.RoundTripSqlDbNotPresentCondition, projectAttributeVal, importTarget);
			}
		}

		await this.updateImportedTargetsToProjFile(constants.NetCoreCondition, constants.NetCoreTargets, undefined);
	}

	private async updateBeforeBuildTargetInProjFile(): Promise<void> {
		// Search if clean target already present, update it
		for (let i = 0; i < this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.Target).length; i++) {
			const beforeBuildNode = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.Target)[i];
			const name = beforeBuildNode.getAttribute(constants.Name);
			if (name === constants.BeforeBuildTarget) {
				return await this.createCleanFileNode(beforeBuildNode);
			}
		}

		// If clean target not found, create new
		const beforeBuildNode = this.projFileXmlDoc!.createElement(constants.Target);
		beforeBuildNode.setAttribute(constants.Name, constants.BeforeBuildTarget);
		this.projFileXmlDoc!.documentElement.appendChild(beforeBuildNode);
		await this.createCleanFileNode(beforeBuildNode);
	}

	private async createCleanFileNode(parentNode: any): Promise<void> {
		const deleteFileNode = this.projFileXmlDoc!.createElement(constants.Delete);
		deleteFileNode.setAttribute(constants.Files, constants.ProjJsonToClean);
		parentNode.appendChild(deleteFileNode);
		await this.serializeToProjFile(this.projFileXmlDoc);
	}

	/**
	 * Adds a folder to the project, and saves the project file
	 *
	 * @param relativeFolderPath Relative path of the folder
	 */
	public async addFolderItem(relativeFolderPath: string): Promise<FileProjectEntry> {
		const folderEntry = await this.ensureFolderItems(relativeFolderPath);

		if (folderEntry) {
			return folderEntry;
		} else {
			throw new Error(constants.outsideFolderPath);
		}
	}

	/**
	 * Writes a file to disk if contents are provided, adds that file to the project, and writes it to disk
	 *
	 * @param relativeFilePath Relative path of the file
	 * @param contents Contents to be written to the new file
	 * @param itemType Type of the project entry to add. This maps to the build action for the item.
	 */
	public async addScriptItem(relativeFilePath: string, contents?: string, itemType?: string): Promise<FileProjectEntry> {
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

		// Ensure that parent folder item exist in the project for the corresponding file path
		await this.ensureFolderItems(path.relative(this.projectFolderPath, path.dirname(absoluteFilePath)));

		// Check if file already has been added to sqlproj
		const normalizedRelativeFilePath = utils.convertSlashesForSqlProj(relativeFilePath);

		const existingEntry = this.files.find(f => f.relativePath.toUpperCase() === normalizedRelativeFilePath.toUpperCase());
		if (existingEntry) {
			return existingEntry;
		}

		// Update sqlproj XML
		const fileEntry = this.createFileProjectEntry(normalizedRelativeFilePath, EntryType.File);

		let xmlTag;
		switch (itemType) {
			case templates.preDeployScript:
				xmlTag = constants.PreDeploy;
				this._preDeployScripts.length === 0 ? this._preDeployScripts.push(fileEntry) : this._noneDeployScripts.push(fileEntry);
				break;
			case templates.postDeployScript:
				xmlTag = constants.PostDeploy;
				this._postDeployScripts.length === 0 ? this._postDeployScripts.push(fileEntry) : this._noneDeployScripts.push(fileEntry);
				break;
			default:
				xmlTag = constants.Build;
				this._files.push(fileEntry);
		}

		const attributes = new Map<string, string>();

		if (itemType === templates.externalStreamingJob) {
			fileEntry.sqlObjectType = constants.ExternalStreamingJob;
			attributes.set(constants.Type, constants.ExternalStreamingJob);
		}

		await this.addToProjFile(fileEntry, xmlTag, attributes);

		return fileEntry;
	}

	public async exclude(entry: FileProjectEntry): Promise<void> {
		const toExclude: FileProjectEntry[] = this._files.concat(this._preDeployScripts).concat(this._postDeployScripts).concat(this._noneDeployScripts).filter(x => x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
		await this.removeFromProjFile(toExclude);

		this._files = this._files.filter(x => !x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
		this._preDeployScripts = this._preDeployScripts.filter(x => !x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
		this._postDeployScripts = this._postDeployScripts.filter(x => !x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
		this._noneDeployScripts = this._noneDeployScripts.filter(x => !x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
	}

	public async deleteFileFolder(entry: FileProjectEntry): Promise<void> {
		// compile a list of folder contents to delete; if entry is a file, contents will contain only itself
		const toDeleteFiles: FileProjectEntry[] = this._files.concat(this._preDeployScripts).concat(this._postDeployScripts).concat(this._noneDeployScripts).filter(x => x.fsUri.fsPath.startsWith(entry.fsUri.fsPath) && x.type === EntryType.File);
		const toDeleteFolders: FileProjectEntry[] = this._files.filter(x => x.fsUri.fsPath.startsWith(entry.fsUri.fsPath) && x.type === EntryType.Folder);

		await Promise.all(toDeleteFiles.map(x => fs.unlink(x.fsUri.fsPath)));
		await Promise.all(toDeleteFolders.map(x => fs.rmdir(x.fsUri.fsPath, { recursive: true })));

		await this.exclude(entry);
	}

	public async deleteDatabaseReference(entry: IDatabaseReferenceProjectEntry): Promise<void> {
		await this.removeFromProjFile(entry);
		this._databaseReferences = this._databaseReferences.filter(x => x !== entry);
	}

	/**
	 * Set the target platform of the project
	 * @param newTargetPlatform compat level of project
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

			await this.serializeToProjFile(this.projFileXmlDoc);
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
		return Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', versionFolder, dacpac));
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
		let dsp: string | undefined;

		try {
			dsp = this.evaluateProjectPropertyValue(constants.DSP);
		}
		catch {
			// We will throw specialized error instead
		}

		// Check if DSP is missing or invalid
		if (!dsp) {
			throw new Error(constants.invalidDataSchemaProvider);
		}

		// get version from dsp, which is a string like Microsoft.Data.Tools.Schema.Sql.Sql130DatabaseSchemaProvider
		// Remove prefix and suffix to only get the actual version number/name. For the example above the result
		// should be just '130'.
		const version =
			dsp.substring(
				constants.MicrosoftDatatoolsSchemaSqlSql.length,
				dsp.length - constants.databaseSchemaProvider.length);

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
		return this.evaluateProjectPropertyValue(constants.DefaultCollationProperty, constants.DefaultCollation);
	}

	/**
	 * Adds reference to a dacpac to the project
	 * @param uri Uri of the dacpac
	 * @param databaseName name of the database
	 */
	public async addDatabaseReference(settings: IDacpacReferenceSettings): Promise<void> {
		const databaseReferenceEntry = new DacpacReferenceProjectEntry(settings);

		// check if reference to this database already exists
		if (this.databaseReferenceExists(databaseReferenceEntry)) {
			throw new Error(constants.databaseReferenceAlreadyExists);
		}

		await this.addToProjFile(databaseReferenceEntry);
	}

	/**
	 * Adds reference to a another project in the workspace
	 * @param uri Uri of the dacpac
	 * @param databaseName name of the database
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
		const sqlCmdVariableEntry = new SqlCmdVariableProjectEntry(name, defaultValue);
		await this.addToProjFile(sqlCmdVariableEntry);
	}

	public createFileProjectEntry(relativePath: string, entryType: EntryType, sqlObjectType?: string): FileProjectEntry {
		let platformSafeRelativePath = utils.getPlatformSafeFileEntryPath(relativePath);
		return new FileProjectEntry(
			Uri.file(path.join(this.projectFolderPath, platformSafeRelativePath)),
			utils.convertSlashesForSqlProj(relativePath),
			entryType,
			sqlObjectType);
	}

	private findOrCreateItemGroup(containedTag?: string, prePostScriptExist?: { scriptExist: boolean; }): any {
		let outputItemGroup = undefined;

		// search for a particular item goup if a child type is provided
		if (containedTag) {
			// find any ItemGroup node that contains files; that's where we'll add
			for (let ig = 0; ig < this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup).length; ig++) {
				const currentItemGroup = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ItemGroup)[ig];

				// if we find the tag, use the ItemGroup
				if (currentItemGroup.getElementsByTagName(containedTag).length > 0) {
					outputItemGroup = currentItemGroup;
					break;
				}
			}
		}

		// if none already exist, make a new ItemGroup for it
		if (!outputItemGroup) {
			outputItemGroup = this.projFileXmlDoc!.createElement(constants.ItemGroup);
			this.projFileXmlDoc!.documentElement.appendChild(outputItemGroup);

			if (prePostScriptExist) {
				prePostScriptExist.scriptExist = false;
			}
		}

		return outputItemGroup;
	}

	private addFileToProjFile(path: string, xmlTag: string, attributes?: Map<string, string>): void {
		let itemGroup;

		if (xmlTag === constants.PreDeploy || xmlTag === constants.PostDeploy) {
			let prePostScriptExist = { scriptExist: true };
			itemGroup = this.findOrCreateItemGroup(xmlTag, prePostScriptExist);

			if (prePostScriptExist.scriptExist === true) {
				void window.showInformationMessage(constants.deployScriptExists(xmlTag));
				xmlTag = constants.None;	// Add only one pre-deploy and post-deploy script. All additional ones get added in the same item group with None tag
			}
		}
		else {
			itemGroup = this.findOrCreateItemGroup(xmlTag);
		}

		const newFileNode = this.projFileXmlDoc!.createElement(xmlTag);

		newFileNode.setAttribute(constants.Include, utils.convertSlashesForSqlProj(path));

		if (attributes) {
			for (const key of attributes.keys()) {
				newFileNode.setAttribute(key, attributes.get(key)!);
			}
		}

		itemGroup.appendChild(newFileNode);
	}

	private removeFileFromProjFile(path: string): void {
		const fileNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.Build);
		const preDeployNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.PreDeploy);
		const postDeployNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.PostDeploy);
		const noneNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.None);
		const nodes = [fileNodes, preDeployNodes, postDeployNodes, noneNodes];

		let deleted = false;
		for (let i = 0; i < nodes.length; i++) {
			deleted = this.removeNode(path, nodes[i]);

			if (deleted) {
				return;
			}
		}

		throw new Error(constants.unableToFindObject(path, constants.fileObject));
	}

	private removeNode(includeString: string, nodes: any): boolean {
		for (let i = 0; i < nodes.length; i++) {
			const parent = nodes[i].parentNode;

			if (nodes[i].getAttribute(constants.Include) === utils.convertSlashesForSqlProj(includeString)) {
				parent.removeChild(nodes[i]);

				// delete ItemGroup if this was the only entry
				// only want element nodes, not text nodes
				const otherChildren = Array.from(parent.childNodes).filter((c: any) => c.childNodes);

				if (otherChildren.length === 0) {
					parent.parentNode.removeChild(parent);
				}

				return true;
			}
		}

		return false;
	}

	private addFolderToProjFile(path: string): void {
		const newFolderNode = this.projFileXmlDoc!.createElement(constants.Folder);
		newFolderNode.setAttribute(constants.Include, utils.convertSlashesForSqlProj(path));

		this.findOrCreateItemGroup(constants.Folder).appendChild(newFolderNode);
	}

	private removeFolderFromProjFile(path: string): void {
		const folderNodes = this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.Folder);
		const deleted = this.removeNode(path, folderNodes);

		if (!deleted) {
			throw new Error(constants.unableToFindObject(path, constants.folderObject));
		}
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

	private async addDatabaseReferenceChildren(referenceNode: any, entry: IDatabaseReferenceProjectEntry): Promise<void> {
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

	private addProjectReferenceChildren(referenceNode: any, entry: SqlProjectReferenceProjectEntry): void {
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

	private addSqlCmdVariableChildren(sqlCmdVariableNode: any, entry: SqlCmdVariableProjectEntry): void {
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

	private async updateImportedTargetsToProjFile(condition: string, projectAttributeVal: string, oldImportNode?: any): Promise<any> {
		const importNode = this.projFileXmlDoc!.createElement(constants.Import);
		importNode.setAttribute(constants.Condition, condition);
		importNode.setAttribute(constants.Project, projectAttributeVal);

		if (oldImportNode) {
			this.projFileXmlDoc!.documentElement.replaceChild(importNode, oldImportNode);
		}
		else {
			this.projFileXmlDoc!.documentElement.appendChild(importNode);
			this._importedTargets.push(projectAttributeVal);	// Add new import target to the list
		}

		await this.serializeToProjFile(this.projFileXmlDoc);
		return importNode;
	}

	private async updatePackageReferenceInProjFile(): Promise<void> {
		const packageRefNode = this.projFileXmlDoc!.createElement(constants.PackageReference);
		packageRefNode.setAttribute(constants.Condition, constants.NetCoreCondition);
		packageRefNode.setAttribute(constants.Include, constants.NETFrameworkAssembly);
		packageRefNode.setAttribute(constants.Version, constants.VersionNumber);
		packageRefNode.setAttribute(constants.PrivateAssets, constants.All);

		this.findOrCreateItemGroup(constants.PackageReference).appendChild(packageRefNode);

		await this.serializeToProjFile(this.projFileXmlDoc);
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

				// remove this node
				this.projFileXmlDoc!.documentElement.removeChild(currentNode);

				// delete ItemGroup if there aren't any other children
				if (this.projFileXmlDoc!.documentElement.getElementsByTagName(constants.ArtifactReference).length === 0) {
					this.projFileXmlDoc!.documentElement.removeChild(currentNode.parentNode!);
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

	private async addToProjFile(entry: ProjectEntry, xmlTag?: string, attributes?: Map<string, string>): Promise<void> {
		switch (entry.type) {
			case EntryType.File:
				this.addFileToProjFile((<FileProjectEntry>entry).relativePath, xmlTag ? xmlTag : constants.Build, attributes);
				break;
			case EntryType.Folder:
				this.addFolderToProjFile((<FileProjectEntry>entry).relativePath);
				break;
			case EntryType.DatabaseReference:
				await this.addDatabaseReferenceToProjFile(<IDatabaseReferenceProjectEntry>entry);
				break;
			case EntryType.SqlCmdVariable:
				await this.addSqlCmdVariableToProjFile(<SqlCmdVariableProjectEntry>entry);
				break; // not required but adding so that we dont miss when we add new items
		}

		await this.serializeToProjFile(this.projFileXmlDoc);
	}

	private async removeFromProjFile(entries: ProjectEntry | ProjectEntry[]): Promise<void> {
		if (entries instanceof ProjectEntry) {
			entries = [entries];
		}

		for (const entry of entries) {
			switch (entry.type) {
				case EntryType.File:
					this.removeFileFromProjFile((<FileProjectEntry>entry).relativePath);
					break;
				case EntryType.Folder:
					this.removeFolderFromProjFile((<FileProjectEntry>entry).relativePath);
					break;
				case EntryType.DatabaseReference:
					this.removeDatabaseReferenceFromProjFile(<IDatabaseReferenceProjectEntry>entry);
					break;
				case EntryType.SqlCmdVariable:
					this.removeSqlCmdVariableFromProjFile((<SqlCmdVariableProjectEntry>entry).variableName);
					break; // not required but adding so that we dont miss when we add new items
			}
		}

		await this.serializeToProjFile(this.projFileXmlDoc);
	}

	private async serializeToProjFile(projFileContents: any): Promise<void> {
		let xml = new xmldom.XMLSerializer().serializeToString(projFileContents);
		xml = xmlFormat(xml, <any>{
			collapseContent: true,
			indentation: '  ',
			lineSeparator: os.EOL,
			whiteSpaceAtEndOfSelfclosingTag: true
		}); // TODO: replace <any>

		await fs.writeFile(this._projectFilePath, xml);
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
					await this.addFolderItem(relativePath);
				}
			}
		}
	}

	/**
	 * Evaluates the value of the property item in the loaded project.
	 *
	 * @param propertyName Name of the property item to evaluate.
	 * @returns Value of the property or `undefined`, if property is missing.
	 */
	private evaluateProjectPropertyValue(propertyName: string): string | undefined;

	/**
	 * Evaluates the value of the property item in the loaded project.
	 *
	 * @param propertyName Name of the property item to evaluate.
	 * @param defaultValue Default value to return, if property is not set.
	 * @returns Value of the property or `defaultValue`, if property is missing.
	 */
	private evaluateProjectPropertyValue(propertyName: string, defaultValue: string): string;

	/**
	 * Evaluates the value of the property item in the loaded project.
	 *
	 * @param propertyName Name of the property item to evaluate.
	 * @param defaultValue Default value to return, if property is not set.
	 * @returns Value of the property or `defaultValue`, if property is missing.
	 */
	private evaluateProjectPropertyValue(propertyName: string, defaultValue?: string): string | undefined {
		// TODO: Currently we simply read the value of the first matching element. The code should be updated to:
		//       1) Narrow it down to items under <PropertyGroup> only
		//       2) Respect the `Condition` attribute on group and property itself
		//       3) Evaluate any expressions within the property value

		// Check if property is set in the project
		const propertyElements = this.projFileXmlDoc!.getElementsByTagName(propertyName);
		if (propertyElements.length === 0) {
			return defaultValue;
		}

		// Try to extract the value from the first matching element
		const firstPropertyElement = propertyElements[0];
		if (firstPropertyElement.childNodes.length !== 1) {
			// Property items are expected to have simple string content
			throw new Error(constants.invalidProjectPropertyValue(propertyName));
		}

		return firstPropertyElement.childNodes[0].nodeValue!;
	}

	/**
	 * Adds all folders in the path to the project and saves the project file, if provided path is under the project folder.
	 * If path is outside the project folder, then no action is taken.
	 *
	 * @param relativeFolderPath Relative folder path to add folders from.
	 * @returns Project entry for the last folder in the path, if path is under the project folder; otherwise `undefined`.
	 */
	private async ensureFolderItems(relativeFolderPath: string): Promise<FileProjectEntry | undefined> {
		const absoluteFolderPath = path.join(this.projectFolderPath, relativeFolderPath);
		const normalizedProjectFolderPath = path.normalize(this.projectFolderPath);

		// Only add folders within the project folder. When adding files outside the project folder,
		// they should be copied to the project root and there will be no additional folders to add.
		if (!absoluteFolderPath.toUpperCase().startsWith(normalizedProjectFolderPath.toUpperCase())) {
			return;
		}

		// If folder doesn't exist, create it
		await fs.mkdir(absoluteFolderPath, { recursive: true });

		// Add project file entries for all folders in the path.
		// SSDT expects all folders to be explicitly listed in the project file, so we construct
		// folder paths for all intermediate folders and ensure they are present in the project as well.
		// We do not use `path.relative` here, because it may return '.' if paths are the same,
		// but in our case we actually want an empty string, that will result in an empty segments
		// array and nothing will be added.
		const relativePath = utils.convertSlashesForSqlProj(absoluteFolderPath.substring(normalizedProjectFolderPath.length));
		const pathSegments = utils.trimChars(relativePath, ' \\').split(constants.SqlProjPathSeparator);
		let folderEntryPath = '';
		let folderEntry: FileProjectEntry | undefined;

		// Add folder items for all segments, including the requested folder itself
		for (let segment of pathSegments) {
			if (segment) {
				folderEntryPath += segment + constants.SqlProjPathSeparator;
				folderEntry =
					this.files.find(f => utils.ensureTrailingSlash(f.relativePath.toUpperCase()) === folderEntryPath.toUpperCase());

				if (!folderEntry) {
					// If there is no <Folder/> item for the folder - add it
					folderEntry = this.createFileProjectEntry(folderEntryPath, EntryType.Folder);
					this.files.push(folderEntry);
					await this.addToProjFile(folderEntry);
				}
			}
		}

		return folderEntry;
	}
}

export const reservedProjectFolders = ['Properties', 'Data Sources', 'Database References'];
