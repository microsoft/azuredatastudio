/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb, connection } from 'azdata';

import { localize } from 'vs/nls';
import { Event, Emitter } from 'vs/base/common/event';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';

import { CellModel } from './cell';
import { IClientSession, INotebookModel, IDefaultConnection, INotebookModelOptions, ICellModel, NotebookContentChange } from './modelInterfaces';
import { NotebookChangeType, CellType } from 'sql/parts/notebook/models/contracts';
import { nbversion } from '../notebookConstants';
import * as notebookUtils from '../notebookUtils';
import { INotebookManager, SQL_NOTEBOOK_PROVIDER, DEFAULT_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/common/notebookService';
import { NotebookContexts } from 'sql/parts/notebook/models/notebookContexts';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { INotification, Severity } from 'vs/platform/notification/common/notification';
import { URI } from 'vs/base/common/uri';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { sqlKernelSpec } from 'sql/workbench/services/notebook/sql/sqlSessionManager';

/*
* Used to control whether a message in a dialog/wizard is displayed as an error,
* warning, or informational message. Default is error.
*/
export enum MessageLevel {
	Error = 0,
	Warning = 1,
	Information = 2
}

export class ErrorInfo {
	constructor(public readonly message: string, public readonly severity: MessageLevel) {
	}
}

export class NotebookModel extends Disposable implements INotebookModel {
	private _contextsChangedEmitter = new Emitter<void>();
	private _contextsChangingEmitter = new Emitter<void>();
	private _contentChangedEmitter = new Emitter<NotebookContentChange>();
	private _kernelsChangedEmitter = new Emitter<nb.IKernelSpec>();
	private _kernelChangedEmitter = new Emitter<nb.IKernelChangedArgs>();
	private _layoutChanged = new Emitter<void>();
	private _inErrorState: boolean = false;
	private _activeClientSession: IClientSession;
	private _sessionLoadFinished: Promise<void>;
	private _onClientSessionReady = new Emitter<IClientSession>();
	private _onProviderIdChanged = new Emitter<string>();
	private _activeContexts: IDefaultConnection;
	private _trustedMode: boolean;

	private _cells: ICellModel[];
	private _defaultLanguageInfo: nb.ILanguageInfo;
	private _language: string;
	private _onErrorEmitter = new Emitter<INotification>();
	private _savedKernelInfo: nb.IKernelInfo;
	private readonly _nbformat: number = nbversion.MAJOR_VERSION;
	private readonly _nbformatMinor: number = nbversion.MINOR_VERSION;
	private _activeConnection: ConnectionProfile;
	private _otherConnections: ConnectionProfile[] = [];
	private _activeCell: ICellModel;
	private _providerId: string;
	private _defaultKernel: nb.IKernelSpec;
	private _kernelDisplayNameToConnectionProviderIds: Map<string, string[]> = new Map<string, string[]>();
	private _kernelDisplayNameToNotebookProviderIds: Map<string, string> = new Map<string, string>();
	private _onValidConnectionSelected = new Emitter<boolean>();
	private _oldKernel: nb.IKernel;
	private _clientSessionListeners: IDisposable[] = [];

	constructor(private _notebookOptions: INotebookModelOptions, startSessionImmediately?: boolean, private connectionProfile?: IConnectionProfile) {
		super();
		if (!_notebookOptions || !_notebookOptions.notebookUri || !_notebookOptions.notebookManagers) {
			throw new Error('path or notebook service not defined');
		}
		this._trustedMode = false;
		this._providerId = _notebookOptions.providerId;
		this._onProviderIdChanged.fire(this._providerId);
		this._notebookOptions.standardKernels.forEach(kernel => {
			this._kernelDisplayNameToConnectionProviderIds.set(kernel.displayName, kernel.connectionProviderIds);
			this._kernelDisplayNameToNotebookProviderIds.set(kernel.displayName, kernel.notebookProvider);
		});
		if (this._notebookOptions.layoutChanged) {
			this._notebookOptions.layoutChanged(() => this._layoutChanged.fire());
		}
		this._defaultKernel = _notebookOptions.defaultKernel;
	}

	public get notebookManagers(): INotebookManager[] {
		let notebookManagers = this._notebookOptions.notebookManagers.filter(manager => manager.providerId !== DEFAULT_NOTEBOOK_PROVIDER);
		if (!notebookManagers.length) {
			return this._notebookOptions.notebookManagers;
		}
		return notebookManagers;
	}

	public get notebookManager(): INotebookManager {
		let manager = this.notebookManagers.find(manager => manager.providerId === this._providerId);
		if (!manager) {
			// Note: this seems like a less than ideal scenario. We should ideally pass in the "correct" provider ID and allow there to be a default,
			// instead of assuming in the NotebookModel constructor that the option is either SQL or Jupyter
			manager = this.notebookManagers.find(manager => manager.providerId === DEFAULT_NOTEBOOK_PROVIDER);
		}
		return manager;
	}

	public getNotebookManager(providerId: string): Promise<INotebookManager> {
		let manager = this.notebookManagers.find(manager => manager.providerId === providerId);
		if (!manager) {
			return Promise.reject('Failed to find notebook manager');
		}
		return Promise.resolve(manager);
	}

	public get notebookOptions(): INotebookModelOptions {
		return this._notebookOptions;
	}

	public get notebookUri(): URI {
		return this._notebookOptions.notebookUri;
	}
	public set notebookUri(value: URI) {
		this._notebookOptions.notebookUri = value;
	}

	public get hasServerManager(): boolean {
		// If the service has a server manager, then we can show the start button
		return !!this.notebookManager.serverManager;
	}

	public get contentChanged(): Event<NotebookContentChange> {
		return this._contentChangedEmitter.event;
	}


	public get isSessionReady(): boolean {
		return !!this._activeClientSession;
	}

	/**
	 * ClientSession object which handles management of a session instance,
	 * plus startup of the session manager which can return key metadata about the
	 * notebook environment
	 */
	public get clientSession(): IClientSession {
		return this._activeClientSession;
	}

	public get kernelChanged(): Event<nb.IKernelChangedArgs> {
		return this._kernelChangedEmitter.event;
	}

	public get kernelsChanged(): Event<nb.IKernelSpec> {
		return this._kernelsChangedEmitter.event;
	}

	public get layoutChanged(): Event<void> {
		return this._layoutChanged.event;
	}

	public get defaultKernel(): nb.IKernelSpec {
		return this._defaultKernel;
	}

	public get contextsChanged(): Event<void> {
		return this._contextsChangedEmitter.event;
	}

	public get contextsChanging(): Event<void> {
		return this._contextsChangingEmitter.event;
	}

	public get cells(): ICellModel[] {
		return this._cells;
	}

	public get contexts(): IDefaultConnection {
		return this._activeContexts;
	}

	public get specs(): nb.IAllKernels | undefined {
		let specs: nb.IAllKernels = {
			defaultKernel: undefined,
			kernels: []
		};
		this.notebookManagers.forEach(manager => {
			if (manager.sessionManager && manager.sessionManager.specs && manager.sessionManager.specs.kernels) {
				manager.sessionManager.specs.kernels.forEach(kernel => {
					specs.kernels.push(kernel);
				});
				if (!specs.defaultKernel) {
					specs.defaultKernel = manager.sessionManager.specs.defaultKernel;
				}
			}
		});
		return specs;
	}

	public standardKernelsDisplayName(): string[] {
		return Array.from(this._kernelDisplayNameToNotebookProviderIds.keys());
	}

	public get inErrorState(): boolean {
		return this._inErrorState;
	}

	public get onError(): Event<INotification> {
		return this._onErrorEmitter.event;
	}

	public get trustedMode(): boolean {
		return this._trustedMode;
	}

	public get providerId(): string {
		return this._providerId;
	}

	public set trustedMode(isTrusted: boolean) {
		this._trustedMode = isTrusted;
		if (this._cells) {
			this._cells.forEach(c => {
				c.trustedMode = this._trustedMode;
			});
		}
	}

	public get activeConnection(): IConnectionProfile {
		return this._activeConnection;
	}

	/**
	 * Indicates the server has finished loading. It may have failed to load in
	 * which case the view will be in an error state.
	 */
	public get sessionLoadFinished(): Promise<void> {
		return this._sessionLoadFinished;
	}

	/**
	 * Notifies when the client session is ready for use
	 */
	public get onClientSessionReady(): Event<IClientSession> {
		return this._onClientSessionReady.event;
	}

	public get onProviderIdChange(): Event<string> {
		return this._onProviderIdChanged.event;
	}

	public get onValidConnectionSelected(): Event<boolean> {
		return this._onValidConnectionSelected.event;
	}

	public getApplicableConnectionProviderIds(kernelDisplayName: string): string[] {
		let ids = [];
		if (kernelDisplayName) {
			ids = this._kernelDisplayNameToConnectionProviderIds.get(kernelDisplayName);
		}
		return !ids ? [] : ids;
	}

	public async requestModelLoad(isTrusted: boolean = false): Promise<void> {
		try {
			this._trustedMode = isTrusted;
			let contents = null;

			if (this._notebookOptions && this._notebookOptions.contentManager) {
				contents = await this._notebookOptions.contentManager.loadContent();
			}
			let factory = this._notebookOptions.factory;
			// if cells already exist, create them with language info (if it is saved)
			this._cells = [];
			if (contents) {
				this._defaultLanguageInfo = this.getDefaultLanguageInfo(contents);
				this._savedKernelInfo = this.getSavedKernelInfo(contents);
				if (contents.cells && contents.cells.length > 0) {
					this._cells = contents.cells.map(c => factory.createCell(c, { notebook: this, isTrusted: isTrusted }));
				}
			}
			this.setDefaultKernelAndProviderId();
			this.trySetLanguageFromLangInfo();
		} catch (error) {
			this._inErrorState = true;
			throw error;
		}
	}

	public findCellIndex(cellModel: ICellModel): number {
		return this._cells.findIndex((cell) => cell.equals(cellModel));
	}

	public addCell(cellType: CellType, index?: number): ICellModel {
		if (this.inErrorState) {
			return null;
		}
		let cell = this.createCell(cellType);

		if (index !== undefined && index !== null && index >= 0 && index < this._cells.length) {
			this._cells.splice(index, 0, cell);
		} else {
			this._cells.push(cell);
			index = undefined;
		}
		// Set newly created cell as active cell
		this.updateActiveCell(cell);

		this._contentChangedEmitter.fire({
			changeType: NotebookChangeType.CellsAdded,
			cells: [cell],
			cellIndex: index
		});

		return cell;
	}

	private updateActiveCell(cell: ICellModel) {
		if (this._activeCell) {
			this._activeCell.active = false;
		}
		this._activeCell = cell;
		this._activeCell.active = true;
	}

	private createCell(cellType: CellType): ICellModel {
		let singleCell: nb.ICellContents = {
			cell_type: cellType,
			source: '',
			metadata: {},
			execution_count: undefined
		};
		return this._notebookOptions.factory.createCell(singleCell, { notebook: this, isTrusted: true });
	}

	deleteCell(cellModel: ICellModel): void {
		if (this.inErrorState || !this._cells) {
			return;
		}
		let index = this._cells.findIndex((cell) => cell.equals(cellModel));
		if (index > -1) {
			this._cells.splice(index, 1);
			this._contentChangedEmitter.fire({
				changeType: NotebookChangeType.CellDeleted,
				cells: [cellModel],
				cellIndex: index
			});
		} else {
			this.notifyError(localize('deleteCellFailed', 'Failed to delete cell.'));
		}
	}

	pushEditOperations(edits: ISingleNotebookEditOperation[]): void {
		if (this.inErrorState || !this._cells) {
			return;
		}

		for (let edit of edits) {
			let newCells: ICellModel[] = [];
			if (edit.cell) {
				// TODO: should we validate and complete required missing parameters?
				let contents: nb.ICellContents = edit.cell as nb.ICellContents;
				newCells.push(this._notebookOptions.factory.createCell(contents, { notebook: this, isTrusted: this._trustedMode }));
			}
			this._cells.splice(edit.range.start, edit.range.end - edit.range.start, ...newCells);
			if (newCells.length > 0) {
				this.updateActiveCell(newCells[0]);
			}
			this._contentChangedEmitter.fire({
				changeType: NotebookChangeType.CellsAdded
			});
		}
	}

	public get activeCell(): ICellModel {
		return this._activeCell;
	}

	public set activeCell(value: ICellModel) {
		this._activeCell = value;
	}

	private notifyError(error: string): void {
		this._onErrorEmitter.fire({ message: error, severity: Severity.Error });
	}

	public async startSession(manager: INotebookManager, displayName?: string): Promise<void> {
		if (displayName) {
			let standardKernel = this._notebookOptions.standardKernels.find(kernel => kernel.displayName === displayName);
			this._defaultKernel = displayName ? { name: standardKernel.name, display_name: standardKernel.displayName } : this._defaultKernel;
		}
		if (this._defaultKernel) {
			let clientSession = this._notebookOptions.factory.createClientSession({
				notebookUri: this._notebookOptions.notebookUri,
				notebookManager: manager,
				notificationService: this._notebookOptions.notificationService,
				kernelSpec: this._defaultKernel
			});
			if (!this._activeClientSession) {
				this.updateActiveClientSession(clientSession);

			}
			let profile = new ConnectionProfile(this._notebookOptions.capabilitiesService, this.connectionProfile);

			if (this.isValidConnection(profile)) {
				this._activeConnection = profile;
			} else {
				this._activeConnection = undefined;
			}

			await clientSession.initialize();
			this._sessionLoadFinished = clientSession.ready.then(async () => {
				if (clientSession.isInErrorState) {
					this.setErrorState(clientSession.errorMessage);
				} else {
					this._onClientSessionReady.fire(clientSession);
					// Once session is loaded, can use the session manager to retrieve useful info
					this.loadKernelInfo(clientSession, this.defaultKernel.display_name);
				}
			});
		}
	}

	private updateActiveClientSession(clientSession: IClientSession) {
		this.clearClientSessionListeners();
		this._activeClientSession = clientSession;
		this._clientSessionListeners.push(this._activeClientSession.kernelChanged(e => this._kernelChangedEmitter.fire(e)));
	}

	private clearClientSessionListeners() {
		this._clientSessionListeners.forEach(listener => listener.dispose());
		this._clientSessionListeners = [];
	}

	public setDefaultKernelAndProviderId() {
		if (this._savedKernelInfo) {
			this.sanitizeSavedKernelInfo();
			let provider = this._kernelDisplayNameToNotebookProviderIds.get(this._savedKernelInfo.display_name);
			if (provider && provider !== this._providerId) {
				this._providerId = provider;
			}
			this._defaultKernel = this._savedKernelInfo;
		}
		else if (this._defaultKernel) {
			let providerId = this._kernelDisplayNameToNotebookProviderIds.get(this._defaultKernel.display_name);
			if (providerId) {
				if (this._providerId !== providerId) {
					this._providerId = providerId;
				} else {
					this._defaultKernel = sqlKernelSpec;
					this._providerId = SQL_NOTEBOOK_PROVIDER;
				}
			}
		} else if (!this._defaultKernel) {
			this._defaultKernel = sqlKernelSpec;
			this._providerId = SQL_NOTEBOOK_PROVIDER;
		}
		// update default language
		this._defaultLanguageInfo = {
			name: this._providerId === SQL_NOTEBOOK_PROVIDER ? 'sql' : 'python',
			version: ''
		};
	}

	private isValidConnection(profile: IConnectionProfile | connection.Connection) {
		let standardKernels = this._notebookOptions.standardKernels.find(kernel => this._savedKernelInfo && kernel.displayName === this._savedKernelInfo.display_name);
		let connectionProviderIds = standardKernels ? standardKernels.connectionProviderIds : undefined;
		return profile && connectionProviderIds && connectionProviderIds.find(provider => provider === profile.providerName) !== undefined;
	}

	public getStandardKernelFromName(name: string): notebookUtils.IStandardKernelWithProvider {
		let kernel = this._notebookOptions.standardKernels.find(kernel => kernel.name.toLowerCase() === name.toLowerCase());
		return kernel;
	}

	private getProviderIdFromName(name: string): string {
		let standardKernel = this.getStandardKernelFromName(name);
		if (standardKernel && this._kernelDisplayNameToNotebookProviderIds.has(standardKernel.displayName)) {
			return this._kernelDisplayNameToNotebookProviderIds.get(standardKernel.displayName);
		}
		return undefined;
	}
	public get languageInfo(): nb.ILanguageInfo {
		return this._defaultLanguageInfo;
	}

	public get language(): string {
		return this._language;
	}

	private updateLanguageInfo(info: nb.ILanguageInfo) {
		if (info) {
			this._defaultLanguageInfo = info;
			this.trySetLanguageFromLangInfo();
		}
	}

	private trySetLanguageFromLangInfo() {
		// In languageInfo, set the language to the "name" property
		// If the "name" property isn't defined, check the "mimeType" property
		// Otherwise, default to python as the language
		let languageInfo = this.languageInfo;
		let language: string;
		if (languageInfo) {
			if (languageInfo.codemirror_mode) {
				let codeMirrorMode: nb.ICodeMirrorMode = <nb.ICodeMirrorMode>(languageInfo.codemirror_mode);
				if (codeMirrorMode && codeMirrorMode.name) {
					language = codeMirrorMode.name;
				}
			}
			if (!language && languageInfo.name) {
				language = languageInfo.name;
			}
			if (!language && languageInfo.mimetype) {
				language = languageInfo.mimetype;
			}
		}

		if (language) {
			let mimeTypePrefix = 'x-';
			if (language.includes(mimeTypePrefix)) {
				language = language.replace(mimeTypePrefix, '');
			} else if (language.toLowerCase() === 'ipython') {
				// Special case ipython because in many cases this is defined as the code mirror mode for python notebooks
				language = 'python';
			}
		}

		this._language = language;
	}

	public changeKernel(displayName: string): void {
		this._contextsChangingEmitter.fire();
		this.doChangeKernel(displayName, true);
	}

	public async doChangeKernel(displayName: string, needSetProvider: boolean = true): Promise<void> {
		if (needSetProvider) {
			await this.setProviderIdAndStartSession(displayName);
		}
		let spec = this.getKernelSpecFromDisplayName(displayName);
		if (spec) {
			// Ensure that the kernel we try to switch to is a valid kernel; if not, use the default
			let kernelSpecs = this.getKernelSpecs();
			if (kernelSpecs && kernelSpecs.length > 0 && kernelSpecs.findIndex(k => k.display_name === spec.display_name) < 0) {
				spec = kernelSpecs.find(spec => spec.name === this.notebookManager.sessionManager.specs.defaultKernel);
			}
		} else {
			spec = sqlKernelSpec;
		}
		if (this._activeClientSession && this._activeClientSession.isReady) {
			return this._activeClientSession.changeKernel(spec, this._oldKernel)
				.then((kernel) => {
					this.updateKernelInfo(kernel);
					kernel.ready.then(() => {
						if (kernel.info) {
							this.updateLanguageInfo(kernel.info.language_info);
						}
					}, err => undefined);
				}).catch((err) => {
					this.notifyError(localize('changeKernelFailed', 'Failed to change kernel: {0}', notebookUtils.getErrorMessage(err)));
					// TODO should revert kernels dropdown
				});
		}
		return Promise.resolve();
	}

	public async changeContext(server: string, newConnection?: IConnectionProfile, hideErrorMessage?: boolean): Promise<void> {
		try {
			if (!newConnection) {
				newConnection = this._activeContexts.otherConnections.find((connection) => connection.serverName === server);
			}
			if (!newConnection && (this._activeContexts.defaultConnection.serverName === server)) {
				newConnection = this._activeContexts.defaultConnection;
			}
			let newConnectionProfile = new ConnectionProfile(this._notebookOptions.capabilitiesService, newConnection);
			if (this._activeConnection) {
				this._otherConnections.push(this._activeConnection);
			}
			this._activeConnection = newConnectionProfile;
			this.refreshConnections(newConnectionProfile);
			this._activeClientSession.updateConnection(this._activeConnection.toIConnectionProfile()).then(
				result => {
					//Remove 'Select connection' from 'Attach to' drop-down since its a valid connection
					this._onValidConnectionSelected.fire(true);
				},
				error => {
					if (error) {
						if (!hideErrorMessage) {
							this.notifyError(notebookUtils.getErrorMessage(error));
						}
						//Selected a wrong connection, Attach to should be defaulted with 'Select connection'
						this._onValidConnectionSelected.fire(false);
					}
				});
		} catch (err) {
			let msg = notebookUtils.getErrorMessage(err);
			this.notifyError(localize('changeContextFailed', 'Changing context failed: {0}', msg));
		}
	}

	private refreshConnections(newConnection: ConnectionProfile) {
		if (this.isValidConnection(newConnection) &&
			this._activeConnection.id !== '-1' &&
			this._activeConnection.id !== this._activeContexts.defaultConnection.id) {
			// Put the defaultConnection to the head of otherConnections
			if (this.isValidConnection(this._activeContexts.defaultConnection)) {
				this._activeContexts.otherConnections = this._activeContexts.otherConnections.filter(conn => conn.id !== this._activeContexts.defaultConnection.id);
				this._activeContexts.otherConnections.unshift(this._activeContexts.defaultConnection);
			}
			// Change the defaultConnection to newConnection
			this._activeContexts.defaultConnection = newConnection;
		}
	}

	private loadKernelInfo(clientSession: IClientSession, displayName: string): void {
		clientSession.onKernelChanging(async (e) => {
			await this.loadActiveContexts(e);
		});
		clientSession.statusChanged(async (session) => {
			this._kernelsChangedEmitter.fire(session.kernel);
		});
		if (!this.notebookManager) {
			return;
		}
		try {
			let sessionManager = this.notebookManager.sessionManager;
			if (sessionManager) {
				if (!this._defaultKernel || this._defaultKernel.display_name !== displayName) {
					this._defaultKernel = NotebookContexts.getDefaultKernel(sessionManager.specs, displayName);
				}
				let spec = this.getKernelSpecFromDisplayName(this._defaultKernel.display_name);
				if (spec) {
					this._defaultKernel = spec;
				}
				this.doChangeKernel(this._defaultKernel.display_name, false);
			}
		} catch (err) {
			let msg = notebookUtils.getErrorMessage(err);
			this.notifyError(localize('loadKernelFailed', 'Loading kernel info failed: {0}', msg));
		}
	}

	// Get default language if saved in notebook file
	// Otherwise, default to python
	private getDefaultLanguageInfo(notebook: nb.INotebookContents): nb.ILanguageInfo {
		return (notebook && notebook.metadata && notebook.metadata.language_info) ? notebook.metadata.language_info : {
			name: this._providerId === SQL_NOTEBOOK_PROVIDER ? 'sql' : 'python',
			version: '',
			mimetype: this._providerId === SQL_NOTEBOOK_PROVIDER ? 'x-sql' : 'x-python'
		};
	}

	// Get default kernel info if saved in notebook file
	private getSavedKernelInfo(notebook: nb.INotebookContents): nb.IKernelInfo {
		return (notebook && notebook.metadata && notebook.metadata.kernelspec) ? notebook.metadata.kernelspec : undefined;
	}

	private getKernelSpecFromDisplayName(displayName: string): nb.IKernelSpec {
		displayName = this.sanitizeDisplayName(displayName);
		let kernel: nb.IKernelSpec = this.specs.kernels.find(k => k.display_name.toLowerCase() === displayName.toLowerCase());
		if (!kernel) {
			return undefined; // undefined is handled gracefully in the session to default to the default kernel
		} else if (!kernel.name) {
			kernel.name = this.specs.defaultKernel;
		}
		return kernel;
	}

	private sanitizeSavedKernelInfo() {
		if (this._savedKernelInfo) {
			let displayName = this.sanitizeDisplayName(this._savedKernelInfo.display_name);

			if (this._savedKernelInfo.display_name !== displayName) {
				this._savedKernelInfo.display_name = displayName;
			}

			let standardKernel = this._notebookOptions.standardKernels.find(kernel => kernel.displayName === displayName || displayName.startsWith(kernel.displayName));
			if (standardKernel && this._savedKernelInfo.name && this._savedKernelInfo.name !== standardKernel.name) {
				this._savedKernelInfo.name = standardKernel.name;
				this._savedKernelInfo.display_name = standardKernel.displayName;
			}
		}
	}

	public getDisplayNameFromSpecName(kernel: nb.IKernel): string {
		let specs = this.notebookManager.sessionManager.specs;
		if (!specs || !specs.kernels) {
			return kernel.name;
		}
		let newKernel = this.notebookManager.sessionManager.specs.kernels.find(k => k.name === kernel.name);
		let newKernelDisplayName;
		if (newKernel) {
			newKernelDisplayName = newKernel.display_name;
		}
		return newKernelDisplayName;
	}

	private setErrorState(errMsg: string): void {
		this._inErrorState = true;
		let msg = localize('startSessionFailed', 'Could not start session: {0}', errMsg);
		this.notifyError(msg);

	}

	public dispose(): void {
		super.dispose();
		this.handleClosed();
	}

	public async handleClosed(): Promise<void> {
		try {
			if (this.notebookOptions && this.notebookOptions.connectionService) {
				let connectionService = this.notebookOptions.connectionService;
				if (this._otherConnections) {
					this._otherConnections.forEach(conn => connectionService.disconnect(conn).catch(e => console.log(e)));
					this._otherConnections = [];
				}
				if (this._activeConnection) {
					this.notebookOptions.connectionService.disconnect(this._activeConnection).catch(e => console.log(e));
					this._activeConnection = undefined;
				}
			}
			await this.shutdownActiveSession();
		} catch (err) {
			this.notifyError(localize('shutdownError', 'An error occurred when closing the notebook: {0}', err));
		}
	}

	private async shutdownActiveSession() {
		if (this._activeClientSession) {
			try {
				await this._activeClientSession.ready;
			}
			catch (err) {
				this.notifyError(localize('shutdownClientSessionError', 'A client session error occurred when closing the notebook: {0}', err));
			}
			await this._activeClientSession.shutdown();
			this.clearClientSessionListeners();
			this._activeClientSession = undefined;
		}
	}

	private async loadActiveContexts(kernelChangedArgs: nb.IKernelChangedArgs): Promise<void> {
		if (kernelChangedArgs && kernelChangedArgs.newValue && kernelChangedArgs.newValue.name) {
			let kernelDisplayName = this.getDisplayNameFromSpecName(kernelChangedArgs.newValue);
			this._activeContexts = await NotebookContexts.getContextsForKernel(this._notebookOptions.connectionService, this.getApplicableConnectionProviderIds(kernelDisplayName), kernelChangedArgs, this.connectionProfile);
			this._contextsChangedEmitter.fire();
			if (this.contexts.defaultConnection !== undefined && this.contexts.defaultConnection.serverName !== undefined) {
				await this.changeContext(this.contexts.defaultConnection.serverName);
			}
		}
	}

	/**
	 * Sanitizes display name to remove IP address in order to fairly compare kernels
	 * In some notebooks, display name is in the format <kernel> (<ip address>)
	 * example: PySpark (25.23.32.4)
	 * @param displayName Display Name for the kernel
	 */
	public sanitizeDisplayName(displayName: string): string {
		let name = displayName;
		if (name) {
			let index = name.indexOf('(');
			name = (index > -1) ? name.substr(0, index - 1).trim() : name;
		}
		return name;
	}

	public async saveModel(): Promise<boolean> {
		let notebook = this.toJSON();
		if (!notebook) {
			return false;
		}
		// TODO: refactor ContentManager out from NotebookManager
		await this.notebookManagers[0].contentManager.save(this._notebookOptions.notebookUri, notebook);
		this._contentChangedEmitter.fire({
			changeType: NotebookChangeType.DirtyStateChanged,
			isDirty: false
		});
		return true;
	}

	private async updateKernelInfo(kernel: nb.IKernel): Promise<void> {
		if (kernel) {
			try {
				let spec = await kernel.getSpec();
				this._savedKernelInfo = {
					name: kernel.name,
					display_name: spec.display_name,
					language: spec.language
				};
				this.clientSession.configureKernel(this._savedKernelInfo);
			} catch (err) {
				// Don't worry about this for now. Just use saved values
			}
		}
	}

	/**
	 * Set _providerId and _activeClientSession based on a kernelSpec representing new kernel
	 * @param kernelSpec KernelSpec for new kernel
	 */
	private async setProviderIdAndStartSession(displayName: string): Promise<void> {
		if (displayName) {
			if (this._activeClientSession && this._activeClientSession.isReady) {
				this._oldKernel = this._activeClientSession.kernel;
				if (this._oldKernel.name !== displayName) {
					let oldProviderId = this.getProviderIdFromName(this._oldKernel.name);

					if (this._kernelDisplayNameToNotebookProviderIds.has(displayName)) {
						let providerId = this._kernelDisplayNameToNotebookProviderIds.get(displayName);
						if (providerId) {
							if (providerId !== this._providerId) {
								this._providerId = providerId;
								this._onProviderIdChanged.fire(this._providerId);

								await this.shutdownActiveSession();

								try {
									let manager = await this.getNotebookManager(providerId);
									await this.startSession(manager, displayName);
								}
								catch (err) {
									console.log(err);
								}
							}
						}

					} else {
						console.log(`No provider found support kernel: ${displayName}`);
					}
				}
			}
		}
	}

	// Get kernel specs from current sessionManager
	private getKernelSpecs(): nb.IKernelSpec[] {
		if (this.notebookManager && this.notebookManager.sessionManager && this.notebookManager.sessionManager.specs &&
			this.notebookManager.sessionManager.specs.kernels) {
			return this.notebookManager.sessionManager.specs.kernels;
		}
		return [];
	}

	/**
	 * Serialize the model to JSON.
	 */
	toJSON(): nb.INotebookContents {
		let cells: nb.ICellContents[] = this.cells.map(c => c.toJSON());
		let metadata = Object.create(null) as nb.INotebookMetadata;
		// TODO update language and kernel when these change
		metadata.kernelspec = this._savedKernelInfo;
		metadata.language_info = this.languageInfo;
		return {
			metadata,
			nbformat_minor: this._nbformatMinor,
			nbformat: this._nbformat,
			cells
		};
	}

	onCellChange(cell: CellModel, change: NotebookChangeType): void {
		let changeInfo: NotebookContentChange = {
			changeType: change,
			cells: [cell]
		};
		switch (change) {
			case NotebookChangeType.CellOutputUpdated:
			case NotebookChangeType.CellSourceUpdated:
				changeInfo.changeType = NotebookChangeType.DirtyStateChanged;
				changeInfo.isDirty = true;
				break;
			default:
			// Do nothing for now
		}
		this._contentChangedEmitter.fire(changeInfo);
	}

}
