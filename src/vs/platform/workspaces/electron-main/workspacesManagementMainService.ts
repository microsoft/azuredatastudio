/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BrowserWindow, MessageBoxOptions } from 'electron';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { Emitter, Event } from 'vs/base/common/event';
import { parse } from 'vs/base/common/json';
import { mnemonicButtonLabel } from 'vs/base/common/labels';
import { Disposable } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { dirname, join } from 'vs/base/common/path';
import { isWindows } from 'vs/base/common/platform';
import { basename, extUriBiasedIgnorePathCase, joinPath, originalFSPath } from 'vs/base/common/resources';
import { withNullAsUndefined } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { Promises, readdirSync, rimrafSync, writeFileSync } from 'vs/base/node/pfs';
import { localize } from 'vs/nls';
import { IBackupMainService } from 'vs/platform/backup/electron-main/backup';
import { IDialogMainService } from 'vs/platform/dialogs/electron-main/dialogMainService';
import { IEnvironmentMainService } from 'vs/platform/environment/electron-main/environmentMainService';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { IProductService } from 'vs/platform/product/common/productService';
import { ICodeWindow } from 'vs/platform/windows/electron-main/windows';
import { findWindowOnWorkspaceOrFolder } from 'vs/platform/windows/electron-main/windowsFinder';
import { getStoredWorkspaceFolder, hasWorkspaceFileExtension, IEnterWorkspaceResult, IResolvedWorkspace, isStoredWorkspaceFolder, IStoredWorkspace, IStoredWorkspaceFolder, isUntitledWorkspace, isWorkspaceIdentifier, IUntitledWorkspaceInfo, IWorkspaceFolderCreationData, IWorkspaceIdentifier, toWorkspaceFolders, UNTITLED_WORKSPACE_NAME } from 'vs/platform/workspaces/common/workspaces';
import { getWorkspaceIdentifier } from 'vs/platform/workspaces/electron-main/workspaces';

export const IWorkspacesManagementMainService = createDecorator<IWorkspacesManagementMainService>('workspacesManagementMainService');

export interface IWorkspaceEnteredEvent {
	window: ICodeWindow;
	workspace: IWorkspaceIdentifier;
}

export interface IWorkspacesManagementMainService {

	readonly _serviceBrand: undefined;

	readonly onDidDeleteUntitledWorkspace: Event<IWorkspaceIdentifier>;
	readonly onDidEnterWorkspace: Event<IWorkspaceEnteredEvent>;

	enterWorkspace(intoWindow: ICodeWindow, openedWindows: ICodeWindow[], path: URI): Promise<IEnterWorkspaceResult | undefined>;

	createUntitledWorkspace(folders?: IWorkspaceFolderCreationData[], remoteAuthority?: string): Promise<IWorkspaceIdentifier>;
	createUntitledWorkspaceSync(folders?: IWorkspaceFolderCreationData[]): IWorkspaceIdentifier;

	deleteUntitledWorkspace(workspace: IWorkspaceIdentifier): Promise<void>;
	deleteUntitledWorkspaceSync(workspace: IWorkspaceIdentifier): void;

	getUntitledWorkspacesSync(): IUntitledWorkspaceInfo[];
	isUntitledWorkspace(workspace: IWorkspaceIdentifier): boolean;

	resolveLocalWorkspaceSync(path: URI): IResolvedWorkspace | undefined;
	resolveLocalWorkspace(path: URI): Promise<IResolvedWorkspace | undefined>;

	getWorkspaceIdentifier(workspacePath: URI): Promise<IWorkspaceIdentifier>;
}

export class WorkspacesManagementMainService extends Disposable implements IWorkspacesManagementMainService {

	declare readonly _serviceBrand: undefined;

	private readonly untitledWorkspacesHome = this.environmentMainService.untitledWorkspacesHome; // local URI that contains all untitled workspaces

	private readonly _onDidDeleteUntitledWorkspace = this._register(new Emitter<IWorkspaceIdentifier>());
	readonly onDidDeleteUntitledWorkspace: Event<IWorkspaceIdentifier> = this._onDidDeleteUntitledWorkspace.event;

	private readonly _onDidEnterWorkspace = this._register(new Emitter<IWorkspaceEnteredEvent>());
	readonly onDidEnterWorkspace: Event<IWorkspaceEnteredEvent> = this._onDidEnterWorkspace.event;

	constructor(
		@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService,
		@ILogService private readonly logService: ILogService,
		@IBackupMainService private readonly backupMainService: IBackupMainService,
		@IDialogMainService private readonly dialogMainService: IDialogMainService,
		@IProductService private readonly productService: IProductService
	) {
		super();
	}

	resolveLocalWorkspaceSync(uri: URI): IResolvedWorkspace | undefined {
		return this.doResolveLocalWorkspace(uri, path => readFileSync(path, 'utf8'));
	}

	resolveLocalWorkspace(uri: URI): Promise<IResolvedWorkspace | undefined> {
		return this.doResolveLocalWorkspace(uri, path => Promises.readFile(path, 'utf8'));
	}

	private doResolveLocalWorkspace(uri: URI, contentsFn: (path: string) => string): IResolvedWorkspace | undefined;
	private doResolveLocalWorkspace(uri: URI, contentsFn: (path: string) => Promise<string>): Promise<IResolvedWorkspace | undefined>;
	private doResolveLocalWorkspace(uri: URI, contentsFn: (path: string) => string | Promise<string>): IResolvedWorkspace | undefined | Promise<IResolvedWorkspace | undefined> {
		if (!this.isWorkspacePath(uri)) {
			return undefined; // does not look like a valid workspace config file
		}

		if (uri.scheme !== Schemas.file) {
			return undefined;
		}

		try {
			const contents = contentsFn(uri.fsPath);
			if (contents instanceof Promise) {
				return contents.then(value => this.doResolveWorkspace(uri, value), error => undefined /* invalid workspace */);
			} else {
				return this.doResolveWorkspace(uri, contents);
			}
		} catch {
			return undefined; // invalid workspace
		}
	}

	private isWorkspacePath(uri: URI): boolean {
		return isUntitledWorkspace(uri, this.environmentMainService) || hasWorkspaceFileExtension(uri);
	}

	private doResolveWorkspace(path: URI, contents: string): IResolvedWorkspace | undefined {
		try {
			const workspace = this.doParseStoredWorkspace(path, contents);
			const workspaceIdentifier = getWorkspaceIdentifier(path);
			return {
				id: workspaceIdentifier.id,
				configPath: workspaceIdentifier.configPath,
				folders: toWorkspaceFolders(workspace.folders, workspaceIdentifier.configPath, extUriBiasedIgnorePathCase),
				remoteAuthority: workspace.remoteAuthority,
				transient: workspace.transient
			};
		} catch (error) {
			this.logService.warn(error.toString());
		}

		return undefined;
	}

	private doParseStoredWorkspace(path: URI, contents: string): IStoredWorkspace {

		// Parse workspace file
		const storedWorkspace: IStoredWorkspace = parse(contents); // use fault tolerant parser

		// Filter out folders which do not have a path or uri set
		if (storedWorkspace && Array.isArray(storedWorkspace.folders)) {
			storedWorkspace.folders = storedWorkspace.folders.filter(folder => isStoredWorkspaceFolder(folder));
		} else {
			throw new Error(`${path.toString(true)} looks like an invalid workspace file.`);
		}

		return storedWorkspace;
	}

	async createUntitledWorkspace(folders?: IWorkspaceFolderCreationData[], remoteAuthority?: string): Promise<IWorkspaceIdentifier> {
		const { workspace, storedWorkspace } = this.newUntitledWorkspace(folders, remoteAuthority);
		const configPath = workspace.configPath.fsPath;

		await Promises.mkdir(dirname(configPath), { recursive: true });
		await Promises.writeFile(configPath, JSON.stringify(storedWorkspace, null, '\t'));

		return workspace;
	}

	createUntitledWorkspaceSync(folders?: IWorkspaceFolderCreationData[], remoteAuthority?: string): IWorkspaceIdentifier {
		const { workspace, storedWorkspace } = this.newUntitledWorkspace(folders, remoteAuthority);
		const configPath = workspace.configPath.fsPath;

		mkdirSync(dirname(configPath), { recursive: true });
		writeFileSync(configPath, JSON.stringify(storedWorkspace, null, '\t'));

		return workspace;
	}

	private newUntitledWorkspace(folders: IWorkspaceFolderCreationData[] = [], remoteAuthority?: string): { workspace: IWorkspaceIdentifier, storedWorkspace: IStoredWorkspace } {
		const randomId = (Date.now() + Math.round(Math.random() * 1000)).toString();
		const untitledWorkspaceConfigFolder = joinPath(this.untitledWorkspacesHome, randomId);
		const untitledWorkspaceConfigPath = joinPath(untitledWorkspaceConfigFolder, UNTITLED_WORKSPACE_NAME);

		const storedWorkspaceFolder: IStoredWorkspaceFolder[] = [];

		for (const folder of folders) {
			storedWorkspaceFolder.push(getStoredWorkspaceFolder(folder.uri, true, folder.name, untitledWorkspaceConfigFolder, !isWindows, extUriBiasedIgnorePathCase));
		}

		return {
			workspace: getWorkspaceIdentifier(untitledWorkspaceConfigPath),
			storedWorkspace: { folders: storedWorkspaceFolder, remoteAuthority }
		};
	}

	async getWorkspaceIdentifier(configPath: URI): Promise<IWorkspaceIdentifier> {
		return getWorkspaceIdentifier(configPath);
	}

	isUntitledWorkspace(workspace: IWorkspaceIdentifier): boolean {
		return isUntitledWorkspace(workspace.configPath, this.environmentMainService);
	}

	deleteUntitledWorkspaceSync(workspace: IWorkspaceIdentifier): void {
		if (!this.isUntitledWorkspace(workspace)) {
			return; // only supported for untitled workspaces
		}

		// Delete from disk
		this.doDeleteUntitledWorkspaceSync(workspace);

		// Event
		this._onDidDeleteUntitledWorkspace.fire(workspace);
	}

	async deleteUntitledWorkspace(workspace: IWorkspaceIdentifier): Promise<void> {
		this.deleteUntitledWorkspaceSync(workspace);
	}

	private doDeleteUntitledWorkspaceSync(workspace: IWorkspaceIdentifier): void {
		const configPath = originalFSPath(workspace.configPath);
		try {

			// Delete Workspace
			rimrafSync(dirname(configPath));

			// Mark Workspace Storage to be deleted
			const workspaceStoragePath = join(this.environmentMainService.workspaceStorageHome.fsPath, workspace.id);
			if (existsSync(workspaceStoragePath)) {
				writeFileSync(join(workspaceStoragePath, 'obsolete'), '');
			}
		} catch (error) {
			this.logService.warn(`Unable to delete untitled workspace ${configPath} (${error}).`);
		}
	}

	getUntitledWorkspacesSync(): IUntitledWorkspaceInfo[] {
		const untitledWorkspaces: IUntitledWorkspaceInfo[] = [];
		try {
			const untitledWorkspacePaths = readdirSync(this.untitledWorkspacesHome.fsPath).map(folder => joinPath(this.untitledWorkspacesHome, folder, UNTITLED_WORKSPACE_NAME));
			for (const untitledWorkspacePath of untitledWorkspacePaths) {
				const workspace = getWorkspaceIdentifier(untitledWorkspacePath);
				const resolvedWorkspace = this.resolveLocalWorkspaceSync(untitledWorkspacePath);
				if (!resolvedWorkspace) {
					this.doDeleteUntitledWorkspaceSync(workspace);
				} else {
					untitledWorkspaces.push({ workspace, remoteAuthority: resolvedWorkspace.remoteAuthority });
				}
			}
		} catch (error) {
			if (error.code !== 'ENOENT') {
				this.logService.warn(`Unable to read folders in ${this.untitledWorkspacesHome} (${error}).`);
			}
		}

		return untitledWorkspaces;
	}

	async enterWorkspace(window: ICodeWindow, windows: ICodeWindow[], path: URI): Promise<IEnterWorkspaceResult | undefined> {
		if (!window || !window.win || !window.isReady) {
			return undefined; // return early if the window is not ready or disposed
		}

		const isValid = await this.isValidTargetWorkspacePath(window, windows, path);
		if (!isValid) {
			return undefined; // return early if the workspace is not valid
		}

		const result = this.doEnterWorkspace(window, getWorkspaceIdentifier(path));
		if (!result) {
			return undefined;
		}

		// Emit as event
		this._onDidEnterWorkspace.fire({ window, workspace: result.workspace });

		return result;
	}

	private async isValidTargetWorkspacePath(window: ICodeWindow, windows: ICodeWindow[], workspacePath?: URI): Promise<boolean> {
		if (!workspacePath) {
			return true;
		}

		if (isWorkspaceIdentifier(window.openedWorkspace) && extUriBiasedIgnorePathCase.isEqual(window.openedWorkspace.configPath, workspacePath)) {
			return false; // window is already opened on a workspace with that path
		}

		// Prevent overwriting a workspace that is currently opened in another window
		if (findWindowOnWorkspaceOrFolder(windows, workspacePath)) {
			const options: MessageBoxOptions = {
				title: this.productService.nameLong,
				type: 'info',
				buttons: [mnemonicButtonLabel(localize({ key: 'ok', comment: ['&& denotes a mnemonic'] }, "&&OK"))],
				message: localize('workspaceOpenedMessage', "Unable to save workspace '{0}'", basename(workspacePath)),
				detail: localize('workspaceOpenedDetail', "The workspace is already opened in another window. Please close that window first and then try again."),
				noLink: true,
				defaultId: 0
			};

			await this.dialogMainService.showMessageBox(options, withNullAsUndefined(BrowserWindow.getFocusedWindow()));

			return false;
		}

		return true; // OK
	}

	private doEnterWorkspace(window: ICodeWindow, workspace: IWorkspaceIdentifier): IEnterWorkspaceResult | undefined {
		if (!window.config) {
			return undefined;
		}

		window.focus();

		// Register window for backups and migrate current backups over
		let backupPath: string | undefined;
		if (!window.config.extensionDevelopmentPath) {
			backupPath = this.backupMainService.registerWorkspaceBackupSync({ workspace, remoteAuthority: window.remoteAuthority }, window.config.backupPath);
		}

		// if the window was opened on an untitled workspace, delete it.
		if (isWorkspaceIdentifier(window.openedWorkspace) && this.isUntitledWorkspace(window.openedWorkspace)) {
			this.deleteUntitledWorkspaceSync(window.openedWorkspace);
		}

		// Update window configuration properly based on transition to workspace
		window.config.workspace = workspace;
		window.config.backupPath = backupPath;

		return { workspace, backupPath };
	}
}
