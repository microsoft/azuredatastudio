/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { createHash } from 'crypto';
import { join } from 'vs/base/common/path';
import { isLinux } from 'vs/base/common/platform';
import { writeFileSync, RimRafMode, Promises } from 'vs/base/node/pfs';
import { IBackupMainService, IWorkspaceBackupInfo, isWorkspaceBackupInfo } from 'vs/platform/backup/electron-main/backup';
import { IBackupWorkspacesFormat, IEmptyWindowBackupInfo } from 'vs/platform/backup/node/backup';
import { IEnvironmentMainService } from 'vs/platform/environment/electron-main/environmentMainService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IFilesConfiguration, HotExitConfiguration } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { IWorkspaceIdentifier, isWorkspaceIdentifier } from 'vs/platform/workspaces/common/workspaces';
import { URI } from 'vs/base/common/uri';
import { isEqual } from 'vs/base/common/extpath';
import { Schemas } from 'vs/base/common/network';
import { extUriBiasedIgnorePathCase } from 'vs/base/common/resources';

export class BackupMainService implements IBackupMainService {

	declare readonly _serviceBrand: undefined;

	protected backupHome: string;
	protected workspacesJsonPath: string;

	private workspaces: IWorkspaceBackupInfo[] = [];
	private folders: URI[] = [];
	private emptyWindows: IEmptyWindowBackupInfo[] = [];

	// Comparers for paths and resources that will
	// - ignore path casing on Windows/macOS
	// - respect path casing on Linux
	private readonly backupUriComparer = extUriBiasedIgnorePathCase;
	private readonly backupPathComparer = { isEqual: (pathA: string, pathB: string) => isEqual(pathA, pathB, !isLinux) };

	constructor(
		@IEnvironmentMainService environmentMainService: IEnvironmentMainService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ILogService private readonly logService: ILogService
	) {
		this.backupHome = environmentMainService.backupHome;
		this.workspacesJsonPath = environmentMainService.backupWorkspacesPath;
	}

	async initialize(): Promise<void> {
		let backups: IBackupWorkspacesFormat;
		try {
			backups = JSON.parse(await Promises.readFile(this.workspacesJsonPath, 'utf8')); // invalid JSON or permission issue can happen here
		} catch (error) {
			backups = Object.create(null);
		}

		// validate empty workspaces backups first
		this.emptyWindows = await this.validateEmptyWorkspaces(backups.emptyWorkspaceInfos);

		// read workspace backups
		let rootWorkspaces: IWorkspaceBackupInfo[] = [];
		try {
			if (Array.isArray(backups.rootURIWorkspaces)) {
				rootWorkspaces = backups.rootURIWorkspaces.map(workspace => ({
					workspace: { id: workspace.id, configPath: URI.parse(workspace.configURIPath) },
					remoteAuthority: workspace.remoteAuthority
				}));
			}
		} catch (e) {
			// ignore URI parsing exceptions
		}

		// validate workspace backups
		this.workspaces = await this.validateWorkspaces(rootWorkspaces);

		// read folder backups
		let workspaceFolders: URI[] = [];
		try {
			if (Array.isArray(backups.folderURIWorkspaces)) {
				workspaceFolders = backups.folderURIWorkspaces.map(folder => URI.parse(folder));
			}
		} catch (e) {
			// ignore URI parsing exceptions
		}

		// validate folder backups
		this.folders = await this.validateFolders(workspaceFolders);

		// save again in case some workspaces or folders have been removed
		await this.save();
	}

	getWorkspaceBackups(): IWorkspaceBackupInfo[] {
		if (this.isHotExitOnExitAndWindowClose()) {
			// Only non-folder windows are restored on main process launch when
			// hot exit is configured as onExitAndWindowClose.
			return [];
		}

		return this.workspaces.slice(0); // return a copy
	}

	getFolderBackupPaths(): URI[] {
		if (this.isHotExitOnExitAndWindowClose()) {
			// Only non-folder windows are restored on main process launch when
			// hot exit is configured as onExitAndWindowClose.
			return [];
		}

		return this.folders.slice(0); // return a copy
	}

	isHotExitEnabled(): boolean {
		return this.getHotExitConfig() !== HotExitConfiguration.OFF;
	}

	private isHotExitOnExitAndWindowClose(): boolean {
		return this.getHotExitConfig() === HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE;
	}

	private getHotExitConfig(): string {
		const config = this.configurationService.getValue<IFilesConfiguration>();

		return config?.files?.hotExit || HotExitConfiguration.ON_EXIT;
	}

	getEmptyWindowBackupPaths(): IEmptyWindowBackupInfo[] {
		return this.emptyWindows.slice(0); // return a copy
	}

	registerWorkspaceBackupSync(workspaceInfo: IWorkspaceBackupInfo, migrateFrom?: string): string {
		if (!this.workspaces.some(workspace => workspaceInfo.workspace.id === workspace.workspace.id)) {
			this.workspaces.push(workspaceInfo);
			this.saveSync();
		}

		const backupPath = this.getBackupPath(workspaceInfo.workspace.id);

		if (migrateFrom) {
			this.moveBackupFolderSync(backupPath, migrateFrom);
		}

		return backupPath;
	}

	private moveBackupFolderSync(backupPath: string, moveFromPath: string): void {

		// Target exists: make sure to convert existing backups to empty window backups
		if (fs.existsSync(backupPath)) {
			this.convertToEmptyWindowBackupSync(backupPath);
		}

		// When we have data to migrate from, move it over to the target location
		if (fs.existsSync(moveFromPath)) {
			try {
				fs.renameSync(moveFromPath, backupPath);
			} catch (error) {
				this.logService.error(`Backup: Could not move backup folder to new location: ${error.toString()}`);
			}
		}
	}

	unregisterWorkspaceBackupSync(workspace: IWorkspaceIdentifier): void {
		const id = workspace.id;
		const index = this.workspaces.findIndex(workspace => workspace.workspace.id === id);
		if (index !== -1) {
			this.workspaces.splice(index, 1);
			this.saveSync();
		}
	}

	registerFolderBackupSync(folderUri: URI): string {
		if (!this.folders.some(folder => this.backupUriComparer.isEqual(folderUri, folder))) {
			this.folders.push(folderUri);
			this.saveSync();
		}

		return this.getBackupPath(this.getFolderHash(folderUri));
	}

	unregisterFolderBackupSync(folderUri: URI): void {
		const index = this.folders.findIndex(folder => this.backupUriComparer.isEqual(folderUri, folder));
		if (index !== -1) {
			this.folders.splice(index, 1);
			this.saveSync();
		}
	}

	registerEmptyWindowBackupSync(backupFolderCandidate?: string, remoteAuthority?: string): string {

		// Generate a new folder if this is a new empty workspace
		const backupFolder = backupFolderCandidate || this.getRandomEmptyWindowId();
		if (!this.emptyWindows.some(emptyWindow => !!emptyWindow.backupFolder && this.backupPathComparer.isEqual(emptyWindow.backupFolder, backupFolder))) {
			this.emptyWindows.push({ backupFolder, remoteAuthority });
			this.saveSync();
		}

		return this.getBackupPath(backupFolder);
	}

	unregisterEmptyWindowBackupSync(backupFolder: string): void {
		const index = this.emptyWindows.findIndex(emptyWindow => !!emptyWindow.backupFolder && this.backupPathComparer.isEqual(emptyWindow.backupFolder, backupFolder));
		if (index !== -1) {
			this.emptyWindows.splice(index, 1);
			this.saveSync();
		}
	}

	private getBackupPath(oldFolderHash: string): string {
		return join(this.backupHome, oldFolderHash);
	}

	private async validateWorkspaces(rootWorkspaces: IWorkspaceBackupInfo[]): Promise<IWorkspaceBackupInfo[]> {
		if (!Array.isArray(rootWorkspaces)) {
			return [];
		}

		const seenIds: Set<string> = new Set();
		const result: IWorkspaceBackupInfo[] = [];

		// Validate Workspaces
		for (let workspaceInfo of rootWorkspaces) {
			const workspace = workspaceInfo.workspace;
			if (!isWorkspaceIdentifier(workspace)) {
				return []; // wrong format, skip all entries
			}

			if (!seenIds.has(workspace.id)) {
				seenIds.add(workspace.id);

				const backupPath = this.getBackupPath(workspace.id);
				const hasBackups = await this.doHasBackups(backupPath);

				// If the workspace has no backups, ignore it
				if (hasBackups) {
					if (workspace.configPath.scheme !== Schemas.file || await Promises.exists(workspace.configPath.fsPath)) {
						result.push(workspaceInfo);
					} else {
						// If the workspace has backups, but the target workspace is missing, convert backups to empty ones
						await this.convertToEmptyWindowBackup(backupPath);
					}
				} else {
					await this.deleteStaleBackup(backupPath);
				}
			}
		}

		return result;
	}

	private async validateFolders(folderWorkspaces: URI[]): Promise<URI[]> {
		if (!Array.isArray(folderWorkspaces)) {
			return [];
		}

		const result: URI[] = [];
		const seenIds: Set<string> = new Set();
		for (let folderURI of folderWorkspaces) {
			const key = this.backupUriComparer.getComparisonKey(folderURI);
			if (!seenIds.has(key)) {
				seenIds.add(key);

				const backupPath = this.getBackupPath(this.getFolderHash(folderURI));
				const hasBackups = await this.doHasBackups(backupPath);

				// If the folder has no backups, ignore it
				if (hasBackups) {
					if (folderURI.scheme !== Schemas.file || await Promises.exists(folderURI.fsPath)) {
						result.push(folderURI);
					} else {
						// If the folder has backups, but the target workspace is missing, convert backups to empty ones
						await this.convertToEmptyWindowBackup(backupPath);
					}
				} else {
					await this.deleteStaleBackup(backupPath);
				}
			}
		}

		return result;
	}

	private async validateEmptyWorkspaces(emptyWorkspaces: IEmptyWindowBackupInfo[]): Promise<IEmptyWindowBackupInfo[]> {
		if (!Array.isArray(emptyWorkspaces)) {
			return [];
		}

		const result: IEmptyWindowBackupInfo[] = [];
		const seenIds: Set<string> = new Set();

		// Validate Empty Windows
		for (let backupInfo of emptyWorkspaces) {
			const backupFolder = backupInfo.backupFolder;
			if (typeof backupFolder !== 'string') {
				return [];
			}

			if (!seenIds.has(backupFolder)) {
				seenIds.add(backupFolder);

				const backupPath = this.getBackupPath(backupFolder);
				if (await this.doHasBackups(backupPath)) {
					result.push(backupInfo);
				} else {
					await this.deleteStaleBackup(backupPath);
				}
			}
		}

		return result;
	}

	private async deleteStaleBackup(backupPath: string): Promise<void> {
		try {
			if (await Promises.exists(backupPath)) {
				await Promises.rm(backupPath, RimRafMode.MOVE);
			}
		} catch (error) {
			this.logService.error(`Backup: Could not delete stale backup: ${error.toString()}`);
		}
	}

	private async convertToEmptyWindowBackup(backupPath: string): Promise<boolean> {

		// New empty window backup
		let newBackupFolder = this.getRandomEmptyWindowId();
		while (this.emptyWindows.some(emptyWindow => !!emptyWindow.backupFolder && this.backupPathComparer.isEqual(emptyWindow.backupFolder, newBackupFolder))) {
			newBackupFolder = this.getRandomEmptyWindowId();
		}

		// Rename backupPath to new empty window backup path
		const newEmptyWindowBackupPath = this.getBackupPath(newBackupFolder);
		try {
			await Promises.rename(backupPath, newEmptyWindowBackupPath);
		} catch (error) {
			this.logService.error(`Backup: Could not rename backup folder: ${error.toString()}`);
			return false;
		}
		this.emptyWindows.push({ backupFolder: newBackupFolder });

		return true;
	}

	private convertToEmptyWindowBackupSync(backupPath: string): boolean {

		// New empty window backup
		let newBackupFolder = this.getRandomEmptyWindowId();
		while (this.emptyWindows.some(emptyWindow => !!emptyWindow.backupFolder && this.backupPathComparer.isEqual(emptyWindow.backupFolder, newBackupFolder))) {
			newBackupFolder = this.getRandomEmptyWindowId();
		}

		// Rename backupPath to new empty window backup path
		const newEmptyWindowBackupPath = this.getBackupPath(newBackupFolder);
		try {
			fs.renameSync(backupPath, newEmptyWindowBackupPath);
		} catch (error) {
			this.logService.error(`Backup: Could not rename backup folder: ${error.toString()}`);
			return false;
		}
		this.emptyWindows.push({ backupFolder: newBackupFolder });

		return true;
	}

	async getDirtyWorkspaces(): Promise<Array<IWorkspaceIdentifier | URI>> {
		const dirtyWorkspaces: Array<IWorkspaceIdentifier | URI> = [];

		// Workspaces with backups
		for (const workspace of this.workspaces) {
			if ((await this.hasBackups(workspace))) {
				dirtyWorkspaces.push(workspace.workspace);
			}
		}

		// Folders with backups
		for (const folder of this.folders) {
			if ((await this.hasBackups(folder))) {
				dirtyWorkspaces.push(folder);
			}
		}

		return dirtyWorkspaces;
	}

	private hasBackups(backupLocation: IWorkspaceBackupInfo | IEmptyWindowBackupInfo | URI): Promise<boolean> {
		let backupPath: string;

		// Folder
		if (URI.isUri(backupLocation)) {
			backupPath = this.getBackupPath(this.getFolderHash(backupLocation));
		}

		// Workspace
		else if (isWorkspaceBackupInfo(backupLocation)) {
			backupPath = this.getBackupPath(backupLocation.workspace.id);
		}

		// Empty
		else {
			backupPath = backupLocation.backupFolder;
		}

		return this.doHasBackups(backupPath);
	}

	private async doHasBackups(backupPath: string): Promise<boolean> {
		try {
			const backupSchemas = await Promises.readdir(backupPath);

			for (const backupSchema of backupSchemas) {
				try {
					const backupSchemaChildren = await Promises.readdir(join(backupPath, backupSchema));
					if (backupSchemaChildren.length > 0) {
						return true;
					}
				} catch (error) {
					// invalid folder
				}
			}
		} catch (error) {
			// backup path does not exist
		}

		return false;
	}

	private saveSync(): void {
		try {
			writeFileSync(this.workspacesJsonPath, JSON.stringify(this.serializeBackups()));
		} catch (error) {
			this.logService.error(`Backup: Could not save workspaces.json: ${error.toString()}`);
		}
	}

	private async save(): Promise<void> {
		try {
			await Promises.writeFile(this.workspacesJsonPath, JSON.stringify(this.serializeBackups()));
		} catch (error) {
			this.logService.error(`Backup: Could not save workspaces.json: ${error.toString()}`);
		}
	}

	private serializeBackups(): IBackupWorkspacesFormat {
		return {
			rootURIWorkspaces: this.workspaces.map(workspace => ({ id: workspace.workspace.id, configURIPath: workspace.workspace.configPath.toString(), remoteAuthority: workspace.remoteAuthority })),
			folderURIWorkspaces: this.folders.map(folder => folder.toString()),
			emptyWorkspaceInfos: this.emptyWindows
		};
	}

	private getRandomEmptyWindowId(): string {
		return (Date.now() + Math.round(Math.random() * 1000)).toString();
	}

	protected getFolderHash(folderUri: URI): string {
		let key: string;

		if (folderUri.scheme === Schemas.file) {
			// for backward compatibility, use the fspath as key
			key = isLinux ? folderUri.fsPath : folderUri.fsPath.toLowerCase();
		} else {
			key = folderUri.toString().toLowerCase();
		}

		return createHash('md5').update(key).digest('hex');
	}
}
