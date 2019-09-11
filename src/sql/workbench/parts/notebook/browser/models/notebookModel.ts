/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb, connection } from 'azdata';

import { localize } from 'vs/nls';
import { Event, Emitter } from 'vs/base/common/event';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';

import { IClientSession, INotebookModel, IDefaultConnection, INotebookModelOptions, ICellModel, NotebookContentChange, notebookConstants, INotebookContentsEditable } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';
import { NotebookChangeType, CellType, CellTypes } from 'sql/workbench/parts/notebook/common/models/contracts';
import { nbversion } from 'sql/workbench/parts/notebook/common/models/notebookConstants';
import * as notebookUtils from 'sql/workbench/parts/notebook/browser/models/notebookUtils';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { INotebookManager, SQL_NOTEBOOK_PROVIDER, DEFAULT_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookContexts } from 'sql/workbench/parts/notebook/browser/models/notebookContexts';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { INotification, Severity, INotificationService } from 'vs/platform/notification/common/notification';
import { URI } from 'vs/base/common/uri';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { uriPrefixes } from 'sql/platform/connection/common/utils';
import { keys } from 'vs/base/common/map';
import { ILogService } from 'vs/platform/log/common/log';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { getErrorMessage } from 'vs/base/common/errors';

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
	private _contextsLoadingEmitter = new Emitter<void>();
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
	private _onActiveCellChanged = new Emitter<ICellModel>();

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
	private _clientSessionListeners = new DisposableStore(); // should this be registered?
	private _connectionUrisToDispose: string[] = [];
	private _textCellsLoading: number = 0;
	private _standardKernels: notebookUtils.IStandardKernelWithProvider[];

	public requestConnectionHandler: () => Promise<boolean>;

	constructor(
		private _notebookOptions: INotebookModelOptions,
		public connectionProfile: IConnectionProfile | undefined,
		@ILogService private readonly logService: ILogService,
		@INotificationService private readonly notificationService: INotificationService,
		@ITelemetryService private readonly telemetryService: ITelemetryService
	) {
		super();
		if (!_notebookOptions || !_notebookOptions.notebookUri || !_notebookOptions.notebookManagers) {
			throw new Error('path or notebook service not defined');
		}
		this._trustedMode = false;
		this._providerId = _notebookOptions.providerId;
		this._onProviderIdChanged.fire(this._providerId);
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

	public getNotebookManager(providerId: string): INotebookManager {
		if (providerId) {
			return this.notebookManagers.find(manager => manager.providerId === providerId);
		}
		return undefined;
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

	public get contextsLoading(): Event<void> {
		return this._contextsLoadingEmitter.event;
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
		return Array.from(keys(this._kernelDisplayNameToNotebookProviderIds));
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
		this._contentChangedEmitter.fire({
			changeType: NotebookChangeType.TrustChanged
		});
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

	public get onActiveCellChanged(): Event<ICellModel> {
		return this._onActiveCellChanged.event;
	}

	public get standardKernels(): notebookUtils.IStandardKernelWithProvider[] {
		return this._standardKernels;
	}

	public set standardKernels(kernels) {
		this._standardKernels = kernels;
		this.setKernelDisplayNameMapsWithStandardKernels();
	}

	public getApplicableConnectionProviderIds(kernelDisplayName: string): string[] {
		let ids = [];
		if (kernelDisplayName) {
			ids = this._kernelDisplayNameToConnectionProviderIds.get(kernelDisplayName);
		}
		return !ids ? [] : ids;
	}

	public async loadContents(isTrusted: boolean = false): Promise<void> {
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
				this._defaultLanguageInfo = contents && contents.metadata && contents.metadata.language_info;
				this._savedKernelInfo = this.getSavedKernelInfo(contents);
				if (contents.cells && contents.cells.length > 0) {
					this._cells = contents.cells.map(c => {
						let cellModel = factory.createCell(c, { notebook: this, isTrusted: isTrusted });
						this.trackMarkdownTelemetry(<nb.ICellContents>c, cellModel);
						return cellModel;
					});
				}
			}
		} catch (error) {
			this._inErrorState = true;
			throw error;
		}
	}
	public async requestModelLoad(): Promise<void> {
		try {
			this.setDefaultKernelAndProviderId();
			this.trySetLanguageFromLangInfo();
		} catch (error) {
			this._inErrorState = true;
			throw error;
		}
	}

	public async requestConnection(): Promise<boolean> {
		if (this.requestConnectionHandler) {
			return this.requestConnectionHandler();
		} else if (this.notificationService) {
			this.notificationService.notify({ severity: Severity.Error, message: localize('kernelRequiresConnection', "Please select a connection to run cells for this kernel") });
		}
		return false;
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
			changeType: NotebookChangeType.CellsModified,
			cells: [cell],
			cellIndex: index
		});

		return cell;
	}

	public updateActiveCell(cell: ICellModel) {
		if (this._activeCell) {
			this._activeCell.active = false;
		}
		this._activeCell = cell;
		if (cell) {
			this._activeCell.active = true;
		}
		this._onActiveCellChanged.fire(cell);
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
				changeType: NotebookChangeType.CellsModified,
				cells: [cellModel],
				cellIndex: index,
				isDirty: true
			});
		} else {
			this.notifyError(localize('deleteCellFailed', "Failed to delete cell."));
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
				changeType: NotebookChangeType.CellsModified,
				isDirty: true
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

	public async startSession(manager: INotebookManager, displayName?: string, setErrorStateOnFail?: boolean): Promise<void> {
		if (displayName && this._standardKernels) {
			let standardKernel = this._standardKernels.find(kernel => kernel.displayName === displayName);
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

			// TODO: this code needs to be fixed since it is called before the this._savedKernelInfo is set.
			// This means it always fails, and we end up using the default connection instead. If you right-click
			// and run "New Notebook" on a disconnected server this means you get the wrong connection (global active)
			// instead of the one you chose, or it'll fail to connect in general
			if (this.isValidConnection(profile)) {
				this._activeConnection = profile;
			} else {
				this._activeConnection = undefined;
			}

			clientSession.onKernelChanging(async (e) => {
				await this.loadActiveContexts(e);
			});
			clientSession.statusChanged(async (session) => {
				this._kernelsChangedEmitter.fire(session.kernel);
			});
			await clientSession.initialize();
			// By somehow we have to wait for ready, otherwise may not be called for some cases.
			await clientSession.ready;
			if (clientSession.kernel) {
				await clientSession.kernel.ready;
				await this.updateKernelInfoOnKernelChange(clientSession.kernel);
			}
			if (clientSession.isInErrorState) {
				if (setErrorStateOnFail) {
					this.setErrorState(clientSession.errorMessage);
				} else {
					throw new Error(clientSession.errorMessage);
				}
			}
			this._onClientSessionReady.fire(clientSession);
		}
	}

	// When changing kernel, update the active session and register the kernel change event
	// So KernelDropDown could get the event fired when added listerner on Model.KernelChange
	private updateActiveClientSession(clientSession: IClientSession) {
		this.clearClientSessionListeners();
		this._activeClientSession = clientSession;
		this._clientSessionListeners.add(this._activeClientSession.kernelChanged(e => this._kernelChangedEmitter.fire(e)));
	}

	private clearClientSessionListeners() {
		this._clientSessionListeners.clear();
	}

	public setDefaultKernelAndProviderId() {
		if (this._savedKernelInfo) {
			this.sanitizeSavedKernelInfo();
			let provider = this._kernelDisplayNameToNotebookProviderIds.get(this._savedKernelInfo.display_name);
			if (provider && provider !== this._providerId) {
				this._providerId = provider;
			}
			this._defaultKernel = this._savedKernelInfo;
		} else if (this._defaultKernel) {
			let providerId = this._kernelDisplayNameToNotebookProviderIds.get(this._defaultKernel.display_name);
			if (providerId) {
				if (this._providerId !== providerId) {
					this._providerId = providerId;
				}
			} else {
				this._defaultKernel = notebookConstants.sqlKernelSpec;
				this._providerId = SQL_NOTEBOOK_PROVIDER;
			}
		} else {
			this._defaultKernel = notebookConstants.sqlKernelSpec;
			this._providerId = SQL_NOTEBOOK_PROVIDER;
		}
		if (!this._defaultLanguageInfo || this._defaultLanguageInfo.name) {
			// update default language
			this._defaultLanguageInfo = {
				name: this._providerId === SQL_NOTEBOOK_PROVIDER ? 'sql' : 'python',
				version: ''
			};
		}
	}

	private isValidConnection(profile: IConnectionProfile | connection.Connection) {
		if (this._standardKernels) {
			let standardKernels = this._standardKernels.find(kernel => this._defaultKernel && kernel.displayName === this._defaultKernel.display_name);
			let connectionProviderIds = standardKernels ? standardKernels.connectionProviderIds : undefined;
			return profile && connectionProviderIds && connectionProviderIds.find(provider => provider === profile.providerName) !== undefined;
		}
		return false;
	}

	public getStandardKernelFromName(name: string): notebookUtils.IStandardKernelWithProvider {
		if (name && this._standardKernels) {
			let kernel = this._standardKernels.find(kernel => kernel.name.toLowerCase() === name.toLowerCase());
			return kernel;
		}
		return undefined;
	}

	public getStandardKernelFromDisplayName(displayName: string): notebookUtils.IStandardKernelWithProvider {
		if (displayName && this._standardKernels) {
			let kernel = this._standardKernels.find(kernel => kernel.displayName.toLowerCase() === displayName.toLowerCase());
			return kernel;
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
		this._contextsLoadingEmitter.fire();
		this.doChangeKernel(displayName, true);
	}

	private async doChangeKernel(displayName: string, mustSetProvider: boolean = true, restoreOnFail: boolean = true): Promise<void> {
		if (!displayName) {
			// Can't change to an undefined kernel
			return;
		}
		let oldDisplayName = this._activeClientSession && this._activeClientSession.kernel ? this._activeClientSession.kernel.name : undefined;
		try {
			let changeKernelNeeded = true;
			if (mustSetProvider) {
				let providerChanged = await this.tryStartSessionByChangingProviders(displayName);
				// If provider was changed, a new session with new kernel is already created. We can skip calling changeKernel.
				changeKernelNeeded = !providerChanged;
			}
			if (changeKernelNeeded) {
				let spec = this.findSpec(displayName);
				if (this._activeClientSession && this._activeClientSession.isReady) {
					let kernel = await this._activeClientSession.changeKernel(spec, this._oldKernel);
					try {
						await kernel.ready;
						await this.updateKernelInfoOnKernelChange(kernel);
					} catch (err2) {
						// TODO should we handle this in any way?
						this.logService.error(`doChangeKernel: ignoring error ${getErrorMessage(err2)}`);
					}
				}
			}
		} catch (err) {
			if (oldDisplayName && restoreOnFail) {
				this.notifyError(localize('changeKernelFailedRetry', "Failed to change kernel. Kernel {0} will be used. Error was: {1}", oldDisplayName, getErrorMessage(err)));
				// Clear out previous kernel
				let failedProviderId = this.tryFindProviderForKernel(displayName, true);
				let oldProviderId = this.tryFindProviderForKernel(oldDisplayName, true);
				if (failedProviderId !== oldProviderId) {
					// We need to clear out the old kernel information so we switch providers. Otherwise in the SQL -> Jupyter -> SQL failure case,
					// we would never reset the providers
					this._oldKernel = undefined;
				}
				return this.doChangeKernel(oldDisplayName, mustSetProvider, false);
			} else {
				this.notifyError(localize('changeKernelFailed', "Failed to change kernel due to error: {0}", getErrorMessage(err)));
				this._kernelChangedEmitter.fire({
					newValue: undefined,
					oldValue: undefined
				});
			}
		}
		// Else no need to do anything
	}

	private async updateKernelInfoOnKernelChange(kernel: nb.IKernel) {
		await this.updateKernelInfo(kernel);
		if (kernel.info) {
			this.updateLanguageInfo(kernel.info.language_info);
		}
	}

	private findSpec(displayName: string) {
		let spec = this.getKernelSpecFromDisplayName(displayName);
		if (spec) {
			// Ensure that the kernel we try to switch to is a valid kernel; if not, use the default
			let kernelSpecs = this.getKernelSpecs();
			if (kernelSpecs && kernelSpecs.length > 0 && kernelSpecs.findIndex(k => k.display_name === spec.display_name) < 0) {
				spec = kernelSpecs.find(spec => spec.name === this.notebookManager.sessionManager.specs.defaultKernel);
			}
		}
		else {
			spec = notebookConstants.sqlKernelSpec;
		}
		return spec;
	}

	public async changeContext(title: string, newConnection?: ConnectionProfile, hideErrorMessage?: boolean): Promise<void> {
		try {
			if (!newConnection) {
				newConnection = this._activeContexts.otherConnections.find((connection) => connection.title === title);
			}
			if ((!newConnection) && (this._activeContexts.defaultConnection.title === title)) {
				newConnection = this._activeContexts.defaultConnection;
			}

			if (newConnection) {
				if (this._activeConnection && this._activeConnection.id !== newConnection.id) {
					this._otherConnections.push(this._activeConnection);
				}
				this._activeConnection = newConnection;
				this.refreshConnections(newConnection);
				this._activeClientSession.updateConnection(newConnection.toIConnectionProfile()).then(
					result => {
						//Remove 'Select connection' from 'Attach to' drop-down since its a valid connection
						this._onValidConnectionSelected.fire(true);
					},
					error => {
						if (error) {
							if (!hideErrorMessage) {
								this.notifyError(getErrorMessage(error));
							}
							//Selected a wrong connection, Attach to should be defaulted with 'Select connection'
							this._onValidConnectionSelected.fire(false);
						}
					});
			} else {
				this._onValidConnectionSelected.fire(false);
			}
		} catch (err) {
			let msg = getErrorMessage(err);
			this.notifyError(localize('changeContextFailed', "Changing context failed: {0}", msg));
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
			if (this._standardKernels) {
				let standardKernel = this._standardKernels.find(kernel => kernel.displayName === displayName || displayName.startsWith(kernel.displayName));
				if (standardKernel && this._savedKernelInfo.name && this._savedKernelInfo.name !== standardKernel.name) {
					this._savedKernelInfo.name = standardKernel.name;
					this._savedKernelInfo.display_name = standardKernel.displayName;
				}
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

	public addAttachToConnectionsToBeDisposed(connUri: string) {
		this._connectionUrisToDispose.push(connUri);
	}

	private setErrorState(errMsg: string): void {
		this._inErrorState = true;
		let msg = localize('startSessionFailed', "Could not start session: {0}", errMsg);
		this.notifyError(msg);

	}

	public dispose(): void {
		super.dispose();
		this.disconnectAttachToConnections();
		this.handleClosed();
	}

	public async handleClosed(): Promise<void> {
		try {
			if (this.notebookOptions && this.notebookOptions.connectionService) {
				if (this._otherConnections) {
					notebookUtils.asyncForEach(this._otherConnections, async (conn) => {
						await this.disconnectNotebookConnection(conn);
					});
					this._otherConnections = [];
				}
				if (this._activeConnection) {
					await this.disconnectNotebookConnection(this._activeConnection);
					this._activeConnection = undefined;
				}
			}
			await this.shutdownActiveSession();
		} catch (err) {
			this.logService.error('An error occurred when closing the notebook: {0}', getErrorMessage(err));
		}
	}

	private async shutdownActiveSession() {
		if (this._activeClientSession) {
			try {
				await this._activeClientSession.ready;
			}
			catch (err) {
				this.notifyError(localize('shutdownClientSessionError', "A client session error occurred when closing the notebook: {0}", getErrorMessage(err)));
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
			if (this.contexts.defaultConnection !== undefined && this.contexts.defaultConnection.serverName !== undefined && this.contexts.defaultConnection.title !== undefined) {
				await this.changeContext(this.contexts.defaultConnection.title, this.contexts.defaultConnection);
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
	 * Set _providerId and start session if it is new provider
	 * @param displayName Kernel dispay name
	 */
	private async tryStartSessionByChangingProviders(displayName: string): Promise<boolean> {
		if (displayName) {
			if (this._activeClientSession && this._activeClientSession.isReady) {
				this._oldKernel = this._activeClientSession.kernel;
			}
			let providerId = this.tryFindProviderForKernel(displayName);

			if (providerId && providerId !== this._providerId) {
				this._providerId = providerId;
				this._onProviderIdChanged.fire(this._providerId);

				await this.shutdownActiveSession();
				let manager = this.getNotebookManager(providerId);
				if (manager) {
					await this.startSession(manager, displayName, false);
				} else {
					throw new Error(localize('ProviderNoManager', "Can't find notebook manager for provider {0}", providerId));
				}
				return true;
			}
		}
		return false;
	}

	private tryFindProviderForKernel(displayName: string, alwaysReturnId: boolean = false): string {
		if (!displayName) {
			return undefined;
		}
		let standardKernel = this.getStandardKernelFromDisplayName(displayName);
		if (standardKernel) {
			let providerId = this._kernelDisplayNameToNotebookProviderIds.get(displayName);
			if (alwaysReturnId || (!this._oldKernel || this._oldKernel.name !== standardKernel.name)) {
				return providerId;
			}
		}
		return undefined;
	}

	// Get kernel specs from current sessionManager
	private getKernelSpecs(): nb.IKernelSpec[] {
		if (this.notebookManager && this.notebookManager.sessionManager && this.notebookManager.sessionManager.specs &&
			this.notebookManager.sessionManager.specs.kernels) {
			return this.notebookManager.sessionManager.specs.kernels;
		}
		return [];
	}

	// Check for and disconnect from any new connections opened while in the notebook
	// Note: notebooks should always connect with the connection URI in the following format,
	// so that connections can be tracked accordingly throughout ADS:
	// let connectionUri = Utils.generateUri(connection, 'notebook');
	private async disconnectNotebookConnection(conn: ConnectionProfile): Promise<void> {
		if (this.notebookOptions.connectionService.getConnectionUri(conn).includes(uriPrefixes.notebook)) {
			let uri = this._notebookOptions.connectionService.getConnectionUri(conn);
			await this.notebookOptions.connectionService.disconnect(uri).catch(e => this.logService.error(e));
		}
	}

	// Disconnect any connections that were added through the "Add new connection" functionality in the Attach To dropdown
	private async disconnectAttachToConnections(): Promise<void> {
		notebookUtils.asyncForEach(this._connectionUrisToDispose, async conn => {
			await this.notebookOptions.connectionService.disconnect(conn).catch(e => this.logService.error(e));
		});
		this._connectionUrisToDispose = [];
	}

	/**
	 * Track time it takes to render all markdown cells
	 */
	private trackMarkdownTelemetry(cellContent: nb.ICellContents, cellModel: ICellModel): void {
		if (cellContent && cellContent.cell_type === CellTypes.Markdown) {
			this._textCellsLoading++;
		}
		this._register(cellModel.onLoaded((cell_type) => {
			if (cell_type === CellTypes.Markdown) {
				this._textCellsLoading--;
				if (this._textCellsLoading <= 0) {
					if (this._notebookOptions.editorLoadedTimestamp) {
						let markdownRenderingTime = Date.now() - this._notebookOptions.editorLoadedTimestamp;
						this.telemetryService.publicLog(TelemetryKeys.NotebookMarkdownRendered, { markdownRenderingElapsedMs: markdownRenderingTime });
					}
				}
			}
		}));
	}

	/**
	 * Set maps with values to have a way to determine the connection
	 * provider and notebook provider ids from a kernel display name
	 */
	private setKernelDisplayNameMapsWithStandardKernels(): void {
		if (this._standardKernels) {
			this._standardKernels.forEach(kernel => {
				let displayName = kernel.displayName;
				if (!displayName) {
					displayName = kernel.name;
				}
				this._kernelDisplayNameToConnectionProviderIds.set(displayName, kernel.connectionProviderIds);
				this._kernelDisplayNameToNotebookProviderIds.set(displayName, kernel.notebookProvider);
			});
		}
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

	onCellChange(cell: ICellModel, change: NotebookChangeType): void {
		let changeInfo: NotebookContentChange = {
			changeType: change,
			cells: [cell]
		};
		switch (change) {
			case NotebookChangeType.CellOutputUpdated:
			case NotebookChangeType.CellSourceUpdated:
				changeInfo.isDirty = true;
				changeInfo.modelContentChangedEvent = cell.modelContentChangedEvent;
				break;
			default:
			// Do nothing for now
		}
		this._contentChangedEmitter.fire(changeInfo);
	}

	serializationStateChanged(changeType: NotebookChangeType, cell?: ICellModel): void {
		let changeInfo: NotebookContentChange = {
			changeType: changeType,
			cells: [cell]
		};

		this._contentChangedEmitter.fire(changeInfo);
	}

}
