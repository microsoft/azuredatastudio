/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { app, JumpListCategory, JumpListItem } from 'electron';
import { coalesce } from 'vs/base/common/arrays';
import { ThrottledDelayer } from 'vs/base/common/async';
import { Emitter, Event as CommonEvent } from 'vs/base/common/event';
import { normalizeDriveLetter, splitName } from 'vs/base/common/labels';
import { Disposable } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { isMacintosh, isWindows } from 'vs/base/common/platform';
import { basename, extUriBiasedIgnorePathCase, originalFSPath } from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { Promises } from 'vs/base/node/pfs';
import { localize } from 'vs/nls';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ILifecycleMainService, LifecycleMainPhase } from 'vs/platform/lifecycle/electron-main/lifecycleMainService';
import { ILogService } from 'vs/platform/log/common/log';
import { StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { IGlobalStorageMainService } from 'vs/platform/storage/electron-main/storageMainService';
import { ICodeWindow } from 'vs/platform/window/electron-main/window';
import { IRecent, IRecentFile, IRecentFolder, IRecentlyOpened, IRecentWorkspace, isRecentFile, isRecentFolder, isRecentWorkspace, restoreRecentlyOpened, toStoreData } from 'vs/platform/workspaces/common/workspaces';
import { isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier, IWorkspaceIdentifier, WORKSPACE_EXTENSION } from 'vs/platform/workspace/common/workspace';
import { IWorkspacesManagementMainService } from 'vs/platform/workspaces/electron-main/workspacesManagementMainService';

export const IWorkspacesHistoryMainService = createDecorator<IWorkspacesHistoryMainService>('workspacesHistoryMainService');

export interface IWorkspacesHistoryMainService {

	readonly _serviceBrand: undefined;

	readonly onDidChangeRecentlyOpened: CommonEvent<void>;

	addRecentlyOpened(recents: IRecent[]): Promise<void>;
	getRecentlyOpened(include?: ICodeWindow): Promise<IRecentlyOpened>;
	removeRecentlyOpened(paths: URI[]): Promise<void>;
	clearRecentlyOpened(): Promise<void>;
}

export class WorkspacesHistoryMainService extends Disposable implements IWorkspacesHistoryMainService {

	private static readonly MAX_TOTAL_RECENT_ENTRIES = 500;

	private static readonly RECENTLY_OPENED_STORAGE_KEY = 'history.recentlyOpenedPathsList';

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeRecentlyOpened = this._register(new Emitter<void>());
	readonly onDidChangeRecentlyOpened = this._onDidChangeRecentlyOpened.event;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IWorkspacesManagementMainService private readonly workspacesManagementMainService: IWorkspacesManagementMainService,
		@ILifecycleMainService private readonly lifecycleMainService: ILifecycleMainService,
		@IGlobalStorageMainService private readonly globalStorageMainService: IGlobalStorageMainService
	) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {

		// Install window jump list after opening window
		this.lifecycleMainService.when(LifecycleMainPhase.AfterWindowOpen).then(() => this.handleWindowsJumpList());

		// Add to history when entering workspace
		this._register(this.workspacesManagementMainService.onDidEnterWorkspace(event => this.addRecentlyOpened([{ workspace: event.workspace, remoteAuthority: event.window.remoteAuthority }])));
	}

	//#region Workspaces History

	async addRecentlyOpened(recentToAdd: IRecent[]): Promise<void> {
		const workspaces: Array<IRecentFolder | IRecentWorkspace> = [];
		const files: IRecentFile[] = [];

		for (let recent of recentToAdd) {

			// Workspace
			if (isRecentWorkspace(recent)) {
				if (!this.workspacesManagementMainService.isUntitledWorkspace(recent.workspace) && this.indexOfWorkspace(workspaces, recent.workspace) === -1) {
					workspaces.push(recent);
				}
			}

			// Folder
			else if (isRecentFolder(recent)) {
				if (this.indexOfFolder(workspaces, recent.folderUri) === -1) {
					workspaces.push(recent);
				}
			}

			// File
			else {
				const alreadyExistsInHistory = this.indexOfFile(files, recent.fileUri) >= 0;
				const shouldBeFiltered = recent.fileUri.scheme === Schemas.file && WorkspacesHistoryMainService.COMMON_FILES_FILTER.indexOf(basename(recent.fileUri)) >= 0;

				if (!alreadyExistsInHistory && !shouldBeFiltered) {
					files.push(recent);

					// Add to recent documents (Windows only, macOS later)
					if (isWindows && recent.fileUri.scheme === Schemas.file) {
						app.addRecentDocument(recent.fileUri.fsPath);
					}
				}
			}
		}

		await this.addEntriesFromStorage(workspaces, files);

		if (workspaces.length > WorkspacesHistoryMainService.MAX_TOTAL_RECENT_ENTRIES) {
			workspaces.length = WorkspacesHistoryMainService.MAX_TOTAL_RECENT_ENTRIES;
		}

		if (files.length > WorkspacesHistoryMainService.MAX_TOTAL_RECENT_ENTRIES) {
			files.length = WorkspacesHistoryMainService.MAX_TOTAL_RECENT_ENTRIES;
		}

		await this.saveRecentlyOpened({ workspaces, files });
		this._onDidChangeRecentlyOpened.fire();

		// Schedule update to recent documents on macOS dock
		if (isMacintosh) {
			this.macOSRecentDocumentsUpdater.trigger(() => this.updateMacOSRecentDocuments());
		}
	}

	async removeRecentlyOpened(recentToRemove: URI[]): Promise<void> {
		const keep = (recent: IRecent) => {
			const uri = this.location(recent);
			for (const resourceToRemove of recentToRemove) {
				if (extUriBiasedIgnorePathCase.isEqual(resourceToRemove, uri)) {
					return false;
				}
			}

			return true;
		};

		const mru = await this.getRecentlyOpened();
		const workspaces = mru.workspaces.filter(keep);
		const files = mru.files.filter(keep);

		if (workspaces.length !== mru.workspaces.length || files.length !== mru.files.length) {
			await this.saveRecentlyOpened({ files, workspaces });
			this._onDidChangeRecentlyOpened.fire();

			// Schedule update to recent documents on macOS dock
			if (isMacintosh) {
				this.macOSRecentDocumentsUpdater.trigger(() => this.updateMacOSRecentDocuments());
			}
		}
	}

	async clearRecentlyOpened(): Promise<void> {
		await this.saveRecentlyOpened({ workspaces: [], files: [] });
		app.clearRecentDocuments();

		// Event
		this._onDidChangeRecentlyOpened.fire();
	}

	async getRecentlyOpened(include?: ICodeWindow): Promise<IRecentlyOpened> {
		const workspaces: Array<IRecentFolder | IRecentWorkspace> = [];
		const files: IRecentFile[] = [];

		// Add current workspace to beginning if set
		if (include) {
			const currentWorkspace = include.config?.workspace;
			if (isWorkspaceIdentifier(currentWorkspace) && !this.workspacesManagementMainService.isUntitledWorkspace(currentWorkspace)) {
				workspaces.push({ workspace: currentWorkspace, remoteAuthority: include.remoteAuthority });
			} else if (isSingleFolderWorkspaceIdentifier(currentWorkspace)) {
				workspaces.push({ folderUri: currentWorkspace.uri, remoteAuthority: include.remoteAuthority });
			}
		}

		// Add currently files to open to the beginning if any
		const currentFiles = include?.config?.filesToOpenOrCreate;
		if (currentFiles) {
			for (let currentFile of currentFiles) {
				const fileUri = currentFile.fileUri;
				if (fileUri && this.indexOfFile(files, fileUri) === -1) {
					files.push({ fileUri });
				}
			}
		}

		await this.addEntriesFromStorage(workspaces, files);

		return { workspaces, files };
	}

	private async addEntriesFromStorage(workspaces: Array<IRecentFolder | IRecentWorkspace>, files: IRecentFile[]): Promise<void> {

		// Get from storage
		let recents = await this.getRecentlyOpenedFromStorage();
		for (let recent of recents.workspaces) {
			let index = isRecentFolder(recent) ? this.indexOfFolder(workspaces, recent.folderUri) : this.indexOfWorkspace(workspaces, recent.workspace);
			if (index >= 0) {
				workspaces[index].label = workspaces[index].label || recent.label;
			} else {
				workspaces.push(recent);
			}
		}

		for (let recent of recents.files) {
			let index = this.indexOfFile(files, recent.fileUri);
			if (index >= 0) {
				files[index].label = files[index].label || recent.label;
			} else {
				files.push(recent);
			}
		}
	}

	private async getRecentlyOpenedFromStorage(): Promise<IRecentlyOpened> {

		// Wait for global storage to be ready
		await this.globalStorageMainService.whenReady;

		let storedRecentlyOpened: object | undefined = undefined;

		// First try with storage service
		const storedRecentlyOpenedRaw = this.globalStorageMainService.get(WorkspacesHistoryMainService.RECENTLY_OPENED_STORAGE_KEY, StorageScope.GLOBAL);
		if (typeof storedRecentlyOpenedRaw === 'string') {
			try {
				storedRecentlyOpened = JSON.parse(storedRecentlyOpenedRaw);
			} catch (error) {
				this.logService.error('Unexpected error parsing opened paths list', error);
			}
		}

		return restoreRecentlyOpened(storedRecentlyOpened, this.logService);
	}

	private async saveRecentlyOpened(recent: IRecentlyOpened): Promise<void> {

		// Wait for global storage to be ready
		await this.globalStorageMainService.whenReady;

		// Store in global storage (but do not sync since this is mainly local paths)
		this.globalStorageMainService.store(WorkspacesHistoryMainService.RECENTLY_OPENED_STORAGE_KEY, JSON.stringify(toStoreData(recent)), StorageScope.GLOBAL, StorageTarget.MACHINE);
	}

	private location(recent: IRecent): URI {
		if (isRecentFolder(recent)) {
			return recent.folderUri;
		}

		if (isRecentFile(recent)) {
			return recent.fileUri;
		}

		return recent.workspace.configPath;
	}

	private indexOfWorkspace(recents: IRecent[], candidate: IWorkspaceIdentifier): number {
		return recents.findIndex(recent => isRecentWorkspace(recent) && recent.workspace.id === candidate.id);
	}

	private indexOfFolder(recents: IRecent[], candidate: URI): number {
		return recents.findIndex(recent => isRecentFolder(recent) && extUriBiasedIgnorePathCase.isEqual(recent.folderUri, candidate));
	}

	private indexOfFile(recents: IRecentFile[], candidate: URI): number {
		return recents.findIndex(recent => extUriBiasedIgnorePathCase.isEqual(recent.fileUri, candidate));
	}

	//#endregion


	//#region macOS Dock / Windows JumpList

	private static readonly MAX_MACOS_DOCK_RECENT_WORKSPACES = 7; 		// prefer higher number of workspaces...
	private static readonly MAX_MACOS_DOCK_RECENT_ENTRIES_TOTAL = 10; 	// ...over number of files

	private static readonly MAX_WINDOWS_JUMP_LIST_ENTRIES = 7;

	// Exclude some very common files from the dock/taskbar
	private static readonly COMMON_FILES_FILTER = [
		'COMMIT_EDITMSG',
		'MERGE_MSG'
	];

	private readonly macOSRecentDocumentsUpdater = this._register(new ThrottledDelayer<void>(800));

	private async handleWindowsJumpList(): Promise<void> {
		if (!isWindows) {
			return; // only on windows
		}

		await this.updateWindowsJumpList();
		this._register(this.onDidChangeRecentlyOpened(() => this.updateWindowsJumpList()));
	}

	private async updateWindowsJumpList(): Promise<void> {
		if (!isWindows) {
			return; // only on windows
		}

		const jumpList: JumpListCategory[] = [];

		// Tasks
		jumpList.push({
			type: 'tasks',
			items: [
				{
					type: 'task',
					title: localize('newWindow', "New Window"),
					description: localize('newWindowDesc', "Opens a new window"),
					program: process.execPath,
					args: '-n', // force new window
					iconPath: process.execPath,
					iconIndex: 0
				}
			]
		});

		// Recent Workspaces
		if ((await this.getRecentlyOpened()).workspaces.length > 0) {

			// The user might have meanwhile removed items from the jump list and we have to respect that
			// so we need to update our list of recent paths with the choice of the user to not add them again
			// Also: Windows will not show our custom category at all if there is any entry which was removed
			// by the user! See https://github.com/microsoft/vscode/issues/15052
			let toRemove: URI[] = [];
			for (let item of app.getJumpListSettings().removedItems) {
				const args = item.args;
				if (args) {
					const match = /^--(folder|file)-uri\s+"([^"]+)"$/.exec(args);
					if (match) {
						toRemove.push(URI.parse(match[2]));
					}
				}
			}
			await this.removeRecentlyOpened(toRemove);

			// Add entries
			let hasWorkspaces = false;
			const items: JumpListItem[] = coalesce((await this.getRecentlyOpened()).workspaces.slice(0, WorkspacesHistoryMainService.MAX_WINDOWS_JUMP_LIST_ENTRIES).map(recent => {
				const workspace = isRecentWorkspace(recent) ? recent.workspace : recent.folderUri;

				const { title, description } = this.getWindowsJumpListLabel(workspace, recent.label);
				let args;
				if (URI.isUri(workspace)) {
					args = `--folder-uri "${workspace.toString()}"`;
				} else {
					hasWorkspaces = true;
					args = `--file-uri "${workspace.configPath.toString()}"`;
				}

				return {
					type: 'task',
					title: title.substr(0, 255), 				// Windows seems to be picky around the length of entries
					description: description.substr(0, 255),	// (see https://github.com/microsoft/vscode/issues/111177)
					program: process.execPath,
					args,
					iconPath: 'explorer.exe', // simulate folder icon
					iconIndex: 0
				};
			}));

			if (items.length > 0) {
				jumpList.push({
					type: 'custom',
					name: hasWorkspaces ? localize('recentFoldersAndWorkspaces', "Recent Folders & Workspaces") : localize('recentFolders', "Recent Folders"),
					items
				});
			}
		}

		// Recent
		jumpList.push({
			type: 'recent' // this enables to show files in the "recent" category
		});

		try {
			app.setJumpList(jumpList);
		} catch (error) {
			this.logService.warn('updateWindowsJumpList#setJumpList', error); // since setJumpList is relatively new API, make sure to guard for errors
		}
	}

	private getWindowsJumpListLabel(workspace: IWorkspaceIdentifier | URI, recentLabel: string | undefined): { title: string; description: string } {

		// Prefer recent label
		if (recentLabel) {
			return { title: splitName(recentLabel).name, description: recentLabel };
		}

		// Single Folder
		if (URI.isUri(workspace)) {
			return { title: basename(workspace), description: this.renderJumpListPathDescription(workspace) };
		}

		// Workspace: Untitled
		if (this.workspacesManagementMainService.isUntitledWorkspace(workspace)) {
			return { title: localize('untitledWorkspace', "Untitled (Workspace)"), description: '' };
		}

		// Workspace: normal
		let filename = basename(workspace.configPath);
		if (filename.endsWith(WORKSPACE_EXTENSION)) {
			filename = filename.substr(0, filename.length - WORKSPACE_EXTENSION.length - 1);
		}

		return { title: localize('workspaceName', "{0} (Workspace)", filename), description: this.renderJumpListPathDescription(workspace.configPath) };
	}

	private renderJumpListPathDescription(uri: URI) {
		return uri.scheme === 'file' ? normalizeDriveLetter(uri.fsPath) : uri.toString();
	}

	private async updateMacOSRecentDocuments(): Promise<void> {
		if (!isMacintosh) {
			return;
		}

		// We clear all documents first to ensure an up-to-date view on the set. Since entries
		// can get deleted on disk, this ensures that the list is always valid
		app.clearRecentDocuments();

		const mru = await this.getRecentlyOpened();

		// Collect max-N recent workspaces that are known to exist
		const workspaceEntries: string[] = [];
		let entries = 0;
		for (let i = 0; i < mru.workspaces.length && entries < WorkspacesHistoryMainService.MAX_MACOS_DOCK_RECENT_WORKSPACES; i++) {
			const loc = this.location(mru.workspaces[i]);
			if (loc.scheme === Schemas.file) {
				const workspacePath = originalFSPath(loc);
				if (await Promises.exists(workspacePath)) {
					workspaceEntries.push(workspacePath);
					entries++;
				}
			}
		}

		// Collect max-N recent files that are known to exist
		const fileEntries: string[] = [];
		for (let i = 0; i < mru.files.length && entries < WorkspacesHistoryMainService.MAX_MACOS_DOCK_RECENT_ENTRIES_TOTAL; i++) {
			const loc = this.location(mru.files[i]);
			if (loc.scheme === Schemas.file) {
				const filePath = originalFSPath(loc);
				if (
					WorkspacesHistoryMainService.COMMON_FILES_FILTER.includes(basename(loc)) || // skip some well known file entries
					workspaceEntries.includes(filePath)											// prefer a workspace entry over a file entry (e.g. for .code-workspace)
				) {
					continue;
				}

				if (await Promises.exists(filePath)) {
					fileEntries.push(filePath);
					entries++;
				}
			}
		}

		// The apple guidelines (https://developer.apple.com/design/human-interface-guidelines/macos/menus/menu-anatomy/)
		// explain that most recent entries should appear close to the interaction by the user (e.g. close to the
		// mouse click). Most native macOS applications that add recent documents to the dock, show the most recent document
		// to the bottom (because the dock menu is not appearing from top to bottom, but from the bottom to the top). As such
		// we fill in the entries in reverse order so that the most recent shows up at the bottom of the menu.
		//
		// On top of that, the maximum number of documents can be configured by the user (defaults to 10). To ensure that
		// we are not failing to show the most recent entries, we start by adding files first (in reverse order of recency)
		// and then add folders (in reverse order of recency). Given that strategy, we can ensure that the most recent
		// N folders are always appearing, even if the limit is low (https://github.com/microsoft/vscode/issues/74788)
		fileEntries.reverse().forEach(fileEntry => app.addRecentDocument(fileEntry));
		workspaceEntries.reverse().forEach(workspaceEntry => app.addRecentDocument(workspaceEntry));
	}

	//#endregion
}
