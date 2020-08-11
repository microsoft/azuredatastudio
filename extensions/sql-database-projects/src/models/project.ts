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

import { Uri } from 'vscode';
import { promises as fs } from 'fs';
import { DataSource } from './dataSources/dataSources';

/**
 * Class representing a Project, and providing functions for operating on it
 */
export class Project {
	public projectFilePath: string;
	public projectFileName: string;
	public files: ProjectEntry[] = [];
	public dataSources: DataSource[] = [];
	public importedTargets: string[] = [];
	public databaseReferences: DatabaseReferenceProjectEntry[] = [];
	public sqlCmdVariables: Record<string, string> = {};

	public get projectFolderPath() {
		return Uri.file(path.dirname(this.projectFilePath)).fsPath;
	}

	private projFileXmlDoc: any = undefined;

	constructor(projectFilePath: string) {
		this.projectFilePath = projectFilePath;
		this.projectFileName = path.basename(projectFilePath, '.sqlproj');
	}

	/**
	 * Open and load a .sqlproj file
	 */
	public static async openProject(projectFilePath: string): Promise<Project> {
		const proj = new Project(projectFilePath);
		await proj.readProjFile();

		return proj;
	}

	/**
	 * Reads the project setting and contents from the file
	 */
	public async readProjFile() {
		const projFileText = await fs.readFile(this.projectFilePath);
		this.projFileXmlDoc = new xmldom.DOMParser().parseFromString(projFileText.toString());

		// find all folders and files to include
		for (let ig = 0; ig < this.projFileXmlDoc.documentElement.getElementsByTagName(constants.ItemGroup).length; ig++) {
			const itemGroup = this.projFileXmlDoc.documentElement.getElementsByTagName(constants.ItemGroup)[ig];

			const buildElements = itemGroup.getElementsByTagName(constants.Build);
			for (let b = 0; b < buildElements.length; b++) {
				this.files.push(this.createProjectEntry(buildElements[b].getAttribute(constants.Include), EntryType.File));
			}

			const folderElements = itemGroup.getElementsByTagName(constants.Folder);
			for (let f = 0; f < folderElements.length; f++) {
				// don't add Properties folder since it isn't supported for now
				if (folderElements[f].getAttribute(constants.Include) !== constants.Properties) {
					this.files.push(this.createProjectEntry(folderElements[f].getAttribute(constants.Include), EntryType.Folder));
				}
			}
		}

		// find all import statements to include
		const importElements = this.projFileXmlDoc.documentElement.getElementsByTagName(constants.Import);
		for (let i = 0; i < importElements.length; i++) {
			const importTarget = importElements[i];
			this.importedTargets.push(importTarget.getAttribute(constants.Project));
		}

		// find all SQLCMD variables to include
		this.sqlCmdVariables = utils.readSqlCmdVariables(this.projFileXmlDoc);

		// find all database references to include
		const references = this.projFileXmlDoc.documentElement.getElementsByTagName(constants.ArtifactReference);
		for (let r = 0; r < references.length; r++) {
			if (references[r].getAttribute(constants.Condition) !== constants.NotNetCoreCondition) {
				const filepath = references[r].getAttribute(constants.Include);
				if (!filepath) {
					throw new Error(constants.invalidDatabaseReference);
				}

				let nameNodes = references[r].getElementsByTagName(constants.DatabaseVariableLiteralValue);
				let name = nameNodes.length === 1 ? nameNodes[0].childNodes[0].nodeValue : undefined;
				this.databaseReferences.push(new DatabaseReferenceProjectEntry(Uri.parse(filepath), name ? DatabaseReferenceLocation.differentDatabaseSameServer : DatabaseReferenceLocation.sameDatabase, name));
			}
		}
	}

	public async updateProjectForRoundTrip() {
		await fs.copyFile(this.projectFilePath, this.projectFilePath + '_backup');
		await this.updateImportToSupportRoundTrip();
		await this.updatePackageReferenceInProjFile();
		await this.updateAfterCleanTargetInProjFile();
	}

	private async updateImportToSupportRoundTrip(): Promise<void> {
		// update an SSDT project to include Net core target information
		for (let i = 0; i < this.projFileXmlDoc.documentElement.getElementsByTagName(constants.Import).length; i++) {
			const importTarget = this.projFileXmlDoc.documentElement.getElementsByTagName(constants.Import)[i];

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

	private async updateAfterCleanTargetInProjFile(): Promise<void> {
		// Search if clean target already present, update it
		for (let i = 0; i < this.projFileXmlDoc.documentElement.getElementsByTagName(constants.Target).length; i++) {
			const afterCleanNode = this.projFileXmlDoc.documentElement.getElementsByTagName(constants.Target)[i];
			const name = afterCleanNode.getAttribute(constants.Name);
			if (name === constants.AfterCleanTarget) {
				return await this.createCleanFileNode(afterCleanNode);
			}
		}

		// If clean target not found, create new
		const afterCleanNode = this.projFileXmlDoc.createElement(constants.Target);
		afterCleanNode.setAttribute(constants.Name, constants.AfterCleanTarget);
		this.projFileXmlDoc.documentElement.appendChild(afterCleanNode);
		await this.createCleanFileNode(afterCleanNode);
	}

	private async createCleanFileNode(parentNode: any): Promise<void> {
		const deleteFileNode = this.projFileXmlDoc.createElement(constants.Delete);
		deleteFileNode.setAttribute(constants.Files, constants.ProjJsonToClean);
		parentNode.appendChild(deleteFileNode);
		await this.serializeToProjFile(this.projFileXmlDoc);
	}

	/**
	 * Adds a folder to the project, and saves the project file
	 * @param relativeFolderPath Relative path of the folder
	 */
	public async addFolderItem(relativeFolderPath: string): Promise<ProjectEntry> {
		const absoluteFolderPath = path.join(this.projectFolderPath, relativeFolderPath);

		//If folder doesn't exist, create it
		let exists = await utils.exists(absoluteFolderPath);
		if (!exists) {
			await fs.mkdir(absoluteFolderPath, { recursive: true });
		}

		const folderEntry = this.createProjectEntry(relativeFolderPath, EntryType.Folder);
		this.files.push(folderEntry);

		await this.addToProjFile(folderEntry);
		return folderEntry;
	}

	/**
	 * Writes a file to disk if contents are provided, adds that file to the project, and writes it to disk
	 * @param relativeFilePath Relative path of the file
	 * @param contents Contents to be written to the new file
	 */
	public async addScriptItem(relativeFilePath: string, contents?: string): Promise<ProjectEntry> {
		const absoluteFilePath = path.join(this.projectFolderPath, relativeFilePath);

		if (contents) {
			await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true });
			await fs.writeFile(absoluteFilePath, contents);
		}

		//Check that file actually exists
		let exists = await utils.exists(absoluteFilePath);
		if (!exists) {
			throw new Error(constants.noFileExist(absoluteFilePath));
		}

		const fileEntry = this.createProjectEntry(relativeFilePath, EntryType.File);
		this.files.push(fileEntry);

		await this.addToProjFile(fileEntry);

		return fileEntry;
	}

	public async exclude(entry: ProjectEntry): Promise<void> {
		const toExclude: ProjectEntry[] = this.files.filter(x => x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
		await this.removeFromProjFile(toExclude);
		this.files = this.files.filter(x => !x.fsUri.fsPath.startsWith(entry.fsUri.fsPath));
	}

	public async deleteFileFolder(entry: ProjectEntry): Promise<void> {
		// compile a list of folder contents to delete; if entry is a file, contents will contain only itself
		const toDeleteFiles: ProjectEntry[] = this.files.filter(x => x.fsUri.fsPath.startsWith(entry.fsUri.fsPath) && x.type === EntryType.File);
		const toDeleteFolders: ProjectEntry[] = this.files.filter(x => x.fsUri.fsPath.startsWith(entry.fsUri.fsPath) && x.type === EntryType.Folder).sort(x => -x.relativePath.length);

		await Promise.all(toDeleteFiles.map(x => fs.unlink(x.fsUri.fsPath)));

		for (const folder of toDeleteFolders) {
			await fs.rmdir(folder.fsUri.fsPath); // TODO: replace .sort() and iteration with rmdir recursive flag once that's unbugged
		}

		await this.exclude(entry);
	}

	/**
	 * Set the compat level of the project
	 * Just used in tests right now, but can be used later if this functionality is added to the UI
	 * @param compatLevel compat level of project
	 */
	public changeDSP(compatLevel: string): void {
		const newDSP = `${constants.MicrosoftDatatoolsSchemaSqlSql}${compatLevel}${constants.databaseSchemaProvider}`;
		this.projFileXmlDoc.getElementsByTagName(constants.DSP)[0].childNodes[0].nodeValue = newDSP;
	}

	/**
	 * Adds reference to the appropriate system database dacpac to the project
	 */
	public async addSystemDatabaseReference(name: SystemDatabase): Promise<void> {
		let uri: Uri;
		let ssdtUri: Uri;
		let dbName: string;
		if (name === SystemDatabase.master) {
			uri = this.getSystemDacpacUri(constants.masterDacpac);
			ssdtUri = this.getSystemDacpacSsdtUri(constants.masterDacpac);
			dbName = constants.master;
		} else {
			uri = this.getSystemDacpacUri(constants.msdbDacpac);
			ssdtUri = this.getSystemDacpacSsdtUri(constants.msdbDacpac);
			dbName = constants.msdb;
		}

		let systemDatabaseReferenceProjectEntry = new SystemDatabaseReferenceProjectEntry(uri, ssdtUri, dbName);
		await this.addToProjFile(systemDatabaseReferenceProjectEntry);
	}

	public getSystemDacpacUri(dacpac: string): Uri {
		let version = this.getProjectTargetPlatform();
		return Uri.parse(path.join('$(NETCoreTargetsPath)', 'SystemDacpacs', version, dacpac));
	}

	public getSystemDacpacSsdtUri(dacpac: string): Uri {
		let version = this.getProjectTargetPlatform();
		return Uri.parse(path.join('$(DacPacRootPath)', 'Extensions', 'Microsoft', 'SQLDB', 'Extensions', 'SqlServer', version, 'SqlSchemas', dacpac));
	}

	public getProjectTargetPlatform(): string {
		// check for invalid DSP
		if (this.projFileXmlDoc.getElementsByTagName(constants.DSP).length !== 1 || this.projFileXmlDoc.getElementsByTagName(constants.DSP)[0].childNodes.length !== 1) {
			throw new Error(constants.invalidDataSchemaProvider);
		}

		let dsp: string = this.projFileXmlDoc.getElementsByTagName(constants.DSP)[0].childNodes[0].nodeValue;

		// get version from dsp, which is a string like Microsoft.Data.Tools.Schema.Sql.Sql130DatabaseSchemaProvider
		// remove part before the number
		let version: any = dsp.substring(constants.MicrosoftDatatoolsSchemaSqlSql.length);
		// remove DatabaseSchemaProvider
		version = version.substring(0, version.length - constants.databaseSchemaProvider.length);

		// make sure version is valid
		if (!Object.values(TargetPlatform).includes(version)) {
			throw new Error(constants.invalidDataSchemaProvider);
		}

		return version;
	}

	/**
	 * Adds reference to a dacpac to the project
	 * @param uri Uri of the dacpac
	 * @param databaseName name of the database
	 */
	public async addDatabaseReference(uri: Uri, databaseLocation: DatabaseReferenceLocation, databaseName?: string): Promise<void> {
		let databaseReferenceEntry = new DatabaseReferenceProjectEntry(uri, databaseLocation, databaseName);
		await this.addToProjFile(databaseReferenceEntry);
	}

	public createProjectEntry(relativePath: string, entryType: EntryType): ProjectEntry {
		let platformSafeRelativePath = utils.getPlatformSafeFileEntryPath(relativePath);
		return new ProjectEntry(Uri.file(path.join(this.projectFolderPath, platformSafeRelativePath)), relativePath, entryType);
	}

	private findOrCreateItemGroup(containedTag?: string): any {
		let outputItemGroup = undefined;

		// search for a particular item goup if a child type is provided
		if (containedTag) {
			// find any ItemGroup node that contains files; that's where we'll add
			for (let ig = 0; ig < this.projFileXmlDoc.documentElement.getElementsByTagName(constants.ItemGroup).length; ig++) {
				const currentItemGroup = this.projFileXmlDoc.documentElement.getElementsByTagName(constants.ItemGroup)[ig];

				// if we find the tag, use the ItemGroup
				if (currentItemGroup.getElementsByTagName(containedTag).length > 0) {
					outputItemGroup = currentItemGroup;
					break;
				}
			}
		}

		// if none already exist, make a new ItemGroup for it
		if (!outputItemGroup) {
			outputItemGroup = this.projFileXmlDoc.createElement(constants.ItemGroup);
			this.projFileXmlDoc.documentElement.appendChild(outputItemGroup);
		}

		return outputItemGroup;
	}

	private addFileToProjFile(path: string) {
		const newFileNode = this.projFileXmlDoc.createElement(constants.Build);
		newFileNode.setAttribute(constants.Include, utils.convertSlashesForSqlProj(path));

		this.findOrCreateItemGroup(constants.Build).appendChild(newFileNode);
	}

	private removeFileFromProjFile(path: string) {
		const fileNodes = this.projFileXmlDoc.documentElement.getElementsByTagName(constants.Build);

		for (let i = 0; i < fileNodes.length; i++) {
			if (fileNodes[i].getAttribute(constants.Include) === utils.convertSlashesForSqlProj(path)) {
				fileNodes[i].parentNode.removeChild(fileNodes[i]);
				return;
			}
		}

		throw new Error(constants.unableToFindObject(path, constants.fileObject));
	}

	private addFolderToProjFile(path: string) {
		const newFolderNode = this.projFileXmlDoc.createElement(constants.Folder);
		newFolderNode.setAttribute(constants.Include, utils.convertSlashesForSqlProj(path));

		this.findOrCreateItemGroup(constants.Folder).appendChild(newFolderNode);
	}

	private removeFolderFromProjFile(path: string) {
		const folderNodes = this.projFileXmlDoc.documentElement.getElementsByTagName(constants.Folder);

		for (let i = 0; i < folderNodes.length; i++) {
			if (folderNodes[i].getAttribute(constants.Include) === utils.convertSlashesForSqlProj(path)) {
				folderNodes[i].parentNode.removeChild(folderNodes[i]);
				return;
			}
		}

		throw new Error(constants.unableToFindObject(path, constants.folderObject));
	}

	private addDatabaseReferenceToProjFile(entry: DatabaseReferenceProjectEntry): void {
		// check if reference to this database already exists
		if (this.databaseReferenceExists(entry)) {
			throw new Error(constants.databaseReferenceAlreadyExists);
		}

		let referenceNode = this.projFileXmlDoc.createElement(constants.ArtifactReference);
		const isSystemDatabaseProjectEntry = (<SystemDatabaseReferenceProjectEntry>entry).ssdtUri;

		// if it's a system database reference, we'll add an additional node with the SSDT location of the dacpac later
		if (isSystemDatabaseProjectEntry) {
			referenceNode.setAttribute(constants.Condition, constants.NetCoreCondition);
		}

		referenceNode.setAttribute(constants.Include, entry.pathForSqlProj());
		this.addDatabaseReferenceChildren(referenceNode, entry.name);
		this.findOrCreateItemGroup(constants.ArtifactReference).appendChild(referenceNode);
		this.databaseReferences.push(entry);

		// add a reference to the system dacpac in SSDT if it's a system db
		if (isSystemDatabaseProjectEntry) {
			let ssdtReferenceNode = this.projFileXmlDoc.createElement(constants.ArtifactReference);
			ssdtReferenceNode.setAttribute(constants.Condition, constants.NotNetCoreCondition);
			ssdtReferenceNode.setAttribute(constants.Include, (<SystemDatabaseReferenceProjectEntry>entry).ssdtPathForSqlProj());
			this.addDatabaseReferenceChildren(ssdtReferenceNode, entry.name);
			this.findOrCreateItemGroup(constants.ArtifactReference).appendChild(ssdtReferenceNode);
		}
	}

	private databaseReferenceExists(entry: DatabaseReferenceProjectEntry): boolean {
		const found = this.databaseReferences.find(reference => reference.fsUri.fsPath === entry.fsUri.fsPath) !== undefined;
		return found;
	}

	private addDatabaseReferenceChildren(referenceNode: any, name?: string): void {
		let suppressMissingDependenciesErrorNode = this.projFileXmlDoc.createElement(constants.SuppressMissingDependenciesErrors);
		let falseTextNode = this.projFileXmlDoc.createTextNode('False');
		suppressMissingDependenciesErrorNode.appendChild(falseTextNode);
		referenceNode.appendChild(suppressMissingDependenciesErrorNode);

		if (name) {
			let databaseVariableLiteralValue = this.projFileXmlDoc.createElement(constants.DatabaseVariableLiteralValue);
			let databaseTextNode = this.projFileXmlDoc.createTextNode(name);
			databaseVariableLiteralValue.appendChild(databaseTextNode);
			referenceNode.appendChild(databaseVariableLiteralValue);
		}
	}

	private async updateImportedTargetsToProjFile(condition: string, projectAttributeVal: string, oldImportNode?: any): Promise<any> {
		const importNode = this.projFileXmlDoc.createElement(constants.Import);
		importNode.setAttribute(constants.Condition, condition);
		importNode.setAttribute(constants.Project, projectAttributeVal);

		if (oldImportNode) {
			this.projFileXmlDoc.documentElement.replaceChild(importNode, oldImportNode);
		}
		else {
			this.projFileXmlDoc.documentElement.appendChild(importNode, oldImportNode);
			this.importedTargets.push(projectAttributeVal);	// Add new import target to the list
		}

		await this.serializeToProjFile(this.projFileXmlDoc);
		return importNode;
	}

	private async updatePackageReferenceInProjFile(): Promise<void> {
		const packageRefNode = this.projFileXmlDoc.createElement(constants.PackageReference);
		packageRefNode.setAttribute(constants.Condition, constants.NetCoreCondition);
		packageRefNode.setAttribute(constants.Include, constants.NETFrameworkAssembly);
		packageRefNode.setAttribute(constants.Version, constants.VersionNumber);
		packageRefNode.setAttribute(constants.PrivateAssets, constants.All);

		this.findOrCreateItemGroup(constants.PackageReference).appendChild(packageRefNode);

		await this.serializeToProjFile(this.projFileXmlDoc);
	}

	public containsSSDTOnlySystemDatabaseReferences(): boolean {
		for (let r = 0; r < this.projFileXmlDoc.documentElement.getElementsByTagName(constants.ArtifactReference).length; r++) {
			const currentNode = this.projFileXmlDoc.documentElement.getElementsByTagName(constants.ArtifactReference)[r];
			if (currentNode.getAttribute(constants.Condition) !== constants.NetCoreCondition && currentNode.getAttribute(constants.Condition) !== constants.NotNetCoreCondition
				&& currentNode.getAttribute(constants.Include).includes(constants.DacpacRootPath)) {
				return true;
			}
		}

		return false;
	}

	public async updateSystemDatabaseReferencesInProjFile(): Promise<void> {
		// find all system database references
		for (let r = 0; r < this.projFileXmlDoc.documentElement.getElementsByTagName(constants.ArtifactReference).length; r++) {
			const currentNode = this.projFileXmlDoc.documentElement.getElementsByTagName(constants.ArtifactReference)[r];
			if (!currentNode.getAttribute(constants.Condition) && currentNode.getAttribute(constants.Include).includes(constants.DacpacRootPath)) {
				// get name of system database
				const name = currentNode.getAttribute(constants.Include).includes(constants.master) ? SystemDatabase.master : SystemDatabase.msdb;
				this.projFileXmlDoc.documentElement.removeChild(currentNode);

				// delete ItemGroup if there aren't any other children
				if (this.projFileXmlDoc.documentElement.getElementsByTagName(constants.ArtifactReference).length === 0) {
					this.projFileXmlDoc.documentElement.removeChild(currentNode.parentNode);
				}

				// remove from database references because it'll get added again later
				this.databaseReferences.splice(this.databaseReferences.findIndex(n => n.databaseName === (name === SystemDatabase.master ? constants.master : constants.msdb)), 1);

				await this.addSystemDatabaseReference(name);
			}
		}
	}

	private async addToProjFile(entry: ProjectEntry) {
		switch (entry.type) {
			case EntryType.File:
				this.addFileToProjFile(entry.relativePath);
				break;
			case EntryType.Folder:
				this.addFolderToProjFile(entry.relativePath);
				break;
			case EntryType.DatabaseReference:
				this.addDatabaseReferenceToProjFile(<DatabaseReferenceProjectEntry>entry);
				break; // not required but adding so that we dont miss when we add new items
		}

		await this.serializeToProjFile(this.projFileXmlDoc);
	}

	private async removeFromProjFile(entries: ProjectEntry | ProjectEntry[]) {
		if (entries instanceof ProjectEntry) {
			entries = [entries];
		}

		for (const entry of entries) {
			switch (entry.type) {
				case EntryType.File:
					this.removeFileFromProjFile(entry.relativePath);
					break;
				case EntryType.Folder:
					this.removeFolderFromProjFile(entry.relativePath);
					break;
				case EntryType.DatabaseReference:
					break; // not required but adding so that we dont miss when we add new items
			}
		}

		await this.serializeToProjFile(this.projFileXmlDoc);
	}

	private async serializeToProjFile(projFileContents: any) {
		let xml = new xmldom.XMLSerializer().serializeToString(projFileContents);
		xml = xmlFormat(xml, <any>{ collapseContent: true, indentation: '  ', lineSeparator: os.EOL }); // TODO: replace <any>

		await fs.writeFile(this.projectFilePath, xml);
	}

	/**
	 * Adds the list of sql files and directories to the project, and saves the project file
	 * @param absolutePath Absolute path of the folder
	 */
	public async addToProject(list: string[]): Promise<void> {

		for (let i = 0; i < list.length; i++) {
			let file: string = list[i];
			const relativePath = utils.trimChars(utils.trimUri(Uri.file(this.projectFilePath), Uri.file(file)), '/');

			if (relativePath.length > 0) {
				let fileStat = await fs.stat(file);

				if (fileStat.isFile() && file.toLowerCase().endsWith(constants.sqlFileExtension)) {
					await this.addScriptItem(relativePath);
				}
				else if (fileStat.isDirectory()) {
					await this.addFolderItem(relativePath);
				}
			}
		}
	}
}

/**
 * Represents an entry in a project file
 */
export class ProjectEntry {
	/**
	 * Absolute file system URI
	 */
	fsUri: Uri;
	relativePath: string;
	type: EntryType;

	constructor(uri: Uri, relativePath: string, type: EntryType) {
		this.fsUri = uri;
		this.relativePath = relativePath;
		this.type = type;
	}

	public toString(): string {
		return this.fsUri.path;
	}

	public pathForSqlProj(): string {
		return utils.convertSlashesForSqlProj(this.fsUri.path);
	}
}

/**
 * Represents a database reference entry in a project file
 */
export class DatabaseReferenceProjectEntry extends ProjectEntry {
	constructor(uri: Uri, public databaseLocation: DatabaseReferenceLocation, public name?: string) {
		super(uri, '', EntryType.DatabaseReference);
	}

	public get databaseName(): string {
		return path.parse(utils.getPlatformSafeFileEntryPath(this.fsUri.fsPath)).name;
	}
}

class SystemDatabaseReferenceProjectEntry extends DatabaseReferenceProjectEntry {
	constructor(uri: Uri, public ssdtUri: Uri, public name: string) {
		super(uri, DatabaseReferenceLocation.differentDatabaseSameServer, name);
	}

	public pathForSqlProj(): string {
		// need to remove the leading slash for system database path for build to work on Windows
		return utils.convertSlashesForSqlProj(this.fsUri.path.substring(1));
	}

	public ssdtPathForSqlProj(): string {
		// need to remove the leading slash for system database path for build to work on Windows
		return utils.convertSlashesForSqlProj(this.ssdtUri.path.substring(1));
	}
}

export enum EntryType {
	File,
	Folder,
	DatabaseReference
}

export enum DatabaseReferenceLocation {
	sameDatabase,
	differentDatabaseSameServer
}

export enum TargetPlatform {
	Sql90 = '90',
	Sql100 = '100',
	Sql110 = '110',
	Sql120 = '120',
	Sql130 = '130',
	Sql140 = '140',
	Sql150 = '150',
	SqlAzureV12 = 'AzureV12'
}

export enum SystemDatabase {
	master,
	msdb
}

export const reservedProjectFolders = ['Properties', 'Data Sources', 'Database References'];
