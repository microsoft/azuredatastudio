/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb, connection } from 'azdata';

import { localize } from 'vs/nls';
import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';

import { IClientSession, INotebookModel, INotebookModelOptions, ICellModel, NotebookContentChange, MoveDirection } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookChangeType, CellType, CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { nbversion } from 'sql/workbench/services/notebook/common/notebookConstants';
import * as notebookUtils from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { INotebookManager, SQL_NOTEBOOK_PROVIDER, DEFAULT_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookContexts } from 'sql/workbench/services/notebook/browser/models/notebookContexts';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { INotification, Severity, INotificationService } from 'vs/platform/notification/common/notification';
import { URI } from 'vs/base/common/uri';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { uriPrefixes } from 'sql/platform/connection/common/utils';
import { ILogService } from 'vs/platform/log/common/log';
import { getErrorMessage } from 'vs/base/common/errors';
import { find, firstIndex } from 'vs/base/common/arrays';
import { startsWith } from 'vs/base/common/strings';
import { notebookConstants } from 'sql/workbench/services/notebook/browser/interfaces';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { Deferred } from 'sql/base/common/promise';

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
	private _sessionLoadFinished = new Deferred<void>();
	private _onClientSessionReady = new Emitter<IClientSession>();
	private _onProviderIdChanged = new Emitter<string>();
	private _trustedMode: boolean;
	private _onActiveCellChanged = new Emitter<ICellModel>();
	private _onCellTypeChanged = new Emitter<ICellModel>();

	private _cells: ICellModel[];
	private _defaultLanguageInfo: nb.ILanguageInfo;
	private _tags: string[];
	private _existingMetadata = {};
	private _language: string;
	private _onErrorEmitter = new Emitter<INotification>();
	private _savedKernelInfo: nb.IKernelInfo;
	private readonly _nbformat: number = nbversion.MAJOR_VERSION;
	private readonly _nbformatMinor: number = nbversion.MINOR_VERSION;
	private _activeConnection: ConnectionProfile;
	private _activeCell: ICellModel;
	private _providerId: string;
	private _defaultKernel: nb.IKernelSpec;
	private _kernelDisplayNameToConnectionProviderIds: Map<string, string[]> = new Map<string, string[]>();
	private _kernelDisplayNameToNotebookProviderIds: Map<string, string> = new Map<string, string>();
	private _onValidConnectionSelected = new Emitter<boolean>();
	private _oldKernel: nb.IKernel;
	private _connectionUrisToDispose: string[] = [];
	private _textCellsLoading: number = 0;
	private _standardKernels: notebookUtils.IStandardKernelWithProvider[];

	public requestConnectionHandler: () => Promise<boolean>;

	constructor(
		private _notebookOptions: INotebookModelOptions,
		public connectionProfile: IConnectionProfile | undefined,
		@ILogService private readonly logService: ILogService,
		@INotificationService private readonly notificationService: INotificationService,
		@IAdsTelemetryService private readonly adstelemetryService: IAdsTelemetryService
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
		let manager = find(this.notebookManagers, manager => manager.providerId === this._providerId);
		if (!manager) {
			// Note: this seems like a less than ideal scenario. We should ideally pass in the "correct" provider ID and allow there to be a default,
			// instead of assuming in the NotebookModel constructor that the option is either SQL or Jupyter
			manager = find(this.notebookManagers, manager => manager.providerId === DEFAULT_NOTEBOOK_PROVIDER);
		}
		return manager;
	}

	public getNotebookManager(providerId: string): INotebookManager {
		if (providerId) {
			return find(this.notebookManagers, manager => manager.providerId === providerId);
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

	public get context(): ConnectionProfile {
		return this._activeConnection;
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
		this._contentChangedEmitter.fire({
			changeType: NotebookChangeType.TrustChanged
		});
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

	public get onCellTypeChanged(): Event<ICellModel> {
		return this._onCellTypeChanged.event;
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
				this._defaultLanguageInfo = contents.metadata && contents.metadata.language_info;
				this._savedKernelInfo = this.getSavedKernelInfo(contents);
				if (contents.metadata) {
					//Telemetry of loading notebook
					if (contents.metadata.azdata_notebook_guid && contents.metadata.azdata_notebook_guid.length === 36) {
						//Verify if it is actual GUID and then send it to the telemetry
						let regex = new RegExp('(\{){0,1}[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}(\}){0,1}');
						if (regex.test(contents.metadata.azdata_notebook_guid)) {
							this.adstelemetryService.createActionEvent(TelemetryKeys.TelemetryView.Notebook, TelemetryKeys.TelemetryAction.Open)
								.withAdditionalProperties({ azdata_notebook_guid: contents.metadata.azdata_notebook_guid })
								.send();
						}
					}
					Object.keys(contents.metadata).forEach(key => {
						let expectedKeys = ['kernelspec', 'language_info', 'tags'];
						// If custom metadata is defined, add to the _existingMetadata object
						if (expectedKeys.indexOf(key) < 0) {
							this._existingMetadata[key] = contents.metadata[key];
						}
					});
				}
				if (contents.cells && contents.cells.length > 0) {
					this._cells = contents.cells.map(c => {
						let cellModel = factory.createCell(c, { notebook: this, isTrusted: isTrusted });
						this.trackMarkdownTelemetry(<nb.ICellContents>c, cellModel);
						return cellModel;
					});
				}
			}

			// Trust notebook by default if there are no code cells
			if (this._cells.length === 0 || this._cells.every(cell => cell.cellType === CellTypes.Markdown)) {
				this.trustedMode = true;
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
		return firstIndex(this._cells, (cell) => cell.equals(cellModel));
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
		cell.isEditMode = true;
		this._contentChangedEmitter.fire({
			changeType: NotebookChangeType.CellsModified,
			cells: [cell],
			cellIndex: index
		});

		return cell;
	}

	moveCell(cell: ICellModel, direction: MoveDirection): void {
		if (this.inErrorState) {
			return null;
		}
		let index = this.findCellIndex(cell);

		if ((index === 0 && direction === MoveDirection.Up) || ((index === this._cells.length - 1 && direction === MoveDirection.Down))) {
			// Nothing to do
			return;
		}

		if (direction === MoveDirection.Down) {
			this._cells.splice(index, 1);
			if (index + 1 < this._cells.length) {
				this._cells.splice(index + 1, 0, cell);
			} else {
				this._cells.push(cell);
			}
		} else {
			this._cells.splice(index, 1);
			this._cells.splice(index - 1, 0, cell);
		}

		index = this.findCellIndex(cell);

		// Set newly created cell as active cell
		this.updateActiveCell(cell);
		this._contentChangedEmitter.fire({
			changeType: NotebookChangeType.CellsModified,
			cells: [cell],
			cellIndex: index
		});
	}

	public updateActiveCell(cell: ICellModel): void {
		if (this._activeCell) {
			this._activeCell.active = false;
		}
		this._activeCell = cell;
		if (cell) {
			this._activeCell.active = true;
		}
		this._onActiveCellChanged.fire(cell);
	}

	public convertCellType(cell: ICellModel): void {
		if (cell) {
			let index = this.findCellIndex(cell);
			if (index > -1) {
				cell.cellType = cell.cellType === CellTypes.Markdown ? CellTypes.Code : CellTypes.Markdown;
				this._onCellTypeChanged.fire(cell);
				this._contentChangedEmitter.fire({
					changeType: NotebookChangeType.CellsModified,
					cells: [cell],
					cellIndex: index
				});
			}
		}
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
		let index = firstIndex(this._cells, (cell) => cell.equals(cellModel));
		if (index > -1) {
			this._cells.splice(index, 1);
			if (this._activeCell === cellModel) {
				this.updateActiveCell(undefined);
			}
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

	private notifyError(error: string): void {
		this._onErrorEmitter.fire({ message: error, severity: Severity.Error });
	}

	public async startSession(manager: INotebookManager, displayName?: string, setErrorStateOnFail?: boolean): Promise<void> {
		if (displayName && this._standardKernels) {
			let standardKernel = find(this._standardKernels, kernel => kernel.displayName === displayName);
			if (standardKernel) {
				this._defaultKernel = { name: standardKernel.name, display_name: standardKernel.displayName };
			}
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

			// If a connection profile is passed in and _activeConnection isn't yet set, use that. Otherwise, use _activeConnection
			let profile = this._activeConnection ? this._activeConnection : new ConnectionProfile(this._notebookOptions.capabilitiesService, this.connectionProfile);

			if (this.isValidConnection(profile)) {
				this._activeConnection = profile;
			}

			clientSession.onKernelChanging(async (e) => {
				await this.loadActiveContexts(e);
			});
			clientSession.statusChanged(async (session) => {
				this._kernelsChangedEmitter.fire(session.kernel);
			});
			await clientSession.initialize().then(() => {
				this._sessionLoadFinished.resolve();
			});
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

	// When changing kernel, update the active session
	private updateActiveClientSession(clientSession: IClientSession) {
		this._activeClientSession = clientSession;
	}

	public setDefaultKernelAndProviderId() {
		if (this._savedKernelInfo) {
			this.sanitizeSavedKernelInfo();
			let provider = this._kernelDisplayNameToNotebookProviderIds.get(this._savedKernelInfo.display_name);
			if (provider && provider !== this._providerId) {
				this._providerId = provider;
			} else if (!provider) {
				this.notebookOptions.notebookManagers.forEach(m => {
					if (m.providerId !== SQL_NOTEBOOK_PROVIDER) {
						// We don't know which provider it is before that provider is chosen to query its specs. Choosing the "last" one registered.
						this._providerId = m.providerId;
					}
				});
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
			let standardKernels = find(this._standardKernels, kernel => this._defaultKernel && kernel.displayName === this._defaultKernel.display_name);
			let connectionProviderIds = standardKernels ? standardKernels.connectionProviderIds : undefined;
			return profile && connectionProviderIds && find(connectionProviderIds, provider => provider === profile.providerName) !== undefined;
		}
		return false;
	}

	public getStandardKernelFromName(name: string): notebookUtils.IStandardKernelWithProvider {
		if (name && this._standardKernels) {
			let kernel = find(this._standardKernels, kernel => kernel.name.toLowerCase() === name.toLowerCase());
			return kernel;
		}
		return undefined;
	}

	public getStandardKernelFromDisplayName(displayName: string): notebookUtils.IStandardKernelWithProvider {
		if (displayName && this._standardKernels) {
			let kernel = find(this._standardKernels, kernel => kernel.displayName.toLowerCase() === displayName.toLowerCase());
			return kernel;
		}
		return undefined;
	}

	public get tags(): string[] {
		return this._tags;
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
			if (language.indexOf(mimeTypePrefix) > -1) {
				language = language.replace(mimeTypePrefix, '');
			} else if (language.toLowerCase() === 'ipython') {
				// Special case ipython because in many cases this is defined as the code mirror mode for python notebooks
				language = 'python';
			} else if (language.toLowerCase() === 'c#') {
				language = 'cs';
			}
		}

		this._language = language.toLowerCase();
	}

	public changeKernel(displayName: string): void {
		this._contextsLoadingEmitter.fire();
		this.doChangeKernel(displayName, true).catch(e => this.logService.error(e));
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
		this._kernelChangedEmitter.fire({
			newValue: kernel,
			oldValue: undefined
		});
	}

	private findSpec(displayName: string) {
		let spec = this.getKernelSpecFromDisplayName(displayName);
		if (spec) {
			// Ensure that the kernel we try to switch to is a valid kernel; if not, use the default
			let kernelSpecs = this.getKernelSpecs();
			if (kernelSpecs && kernelSpecs.length > 0 && firstIndex(kernelSpecs, k => k.display_name === spec.display_name) < 0) {
				spec = find(kernelSpecs, spec => spec.name === this.notebookManager.sessionManager.specs.defaultKernel);
			}
		}
		else {
			spec = notebookConstants.sqlKernelSpec;
		}
		return spec;
	}

	public async changeContext(title: string, newConnection?: ConnectionProfile, hideErrorMessage?: boolean): Promise<void> {
		try {
			if ((!newConnection) && this._activeConnection && (this._activeConnection.title === title)) {
				newConnection = this._activeConnection;
			}

			if (newConnection) {
				this._activeConnection = newConnection;
				this.setActiveConnectionIfDifferent(newConnection);
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

	private setActiveConnectionIfDifferent(newConnection: ConnectionProfile) {
		if (this.isValidConnection(newConnection) &&
			this._activeConnection.id !== '-1' &&
			this._activeConnection.id !== newConnection.id) {
			// Change the active connection to newConnection
			this._activeConnection = newConnection;
		}
	}


	// Get default kernel info if saved in notebook file
	private getSavedKernelInfo(notebook: nb.INotebookContents): nb.IKernelInfo {
		return (notebook && notebook.metadata && notebook.metadata.kernelspec) ? notebook.metadata.kernelspec : undefined;
	}

	private getKernelSpecFromDisplayName(displayName: string): nb.IKernelSpec {
		let kernel: nb.IKernelSpec = find(this.specs.kernels, k => k.display_name.toLowerCase() === displayName.toLowerCase());
		if (!kernel) {
			return undefined; // undefined is handled gracefully in the session to default to the default kernel
		} else if (!kernel.name) {
			kernel.name = this.specs.defaultKernel;
		}
		return kernel;
	}

	private sanitizeSavedKernelInfo() {
		if (this._savedKernelInfo) {
			let displayName = this._savedKernelInfo.display_name;

			if (this._savedKernelInfo.display_name !== displayName) {
				this._savedKernelInfo.display_name = displayName;
			}
			if (this._standardKernels) {
				let standardKernel = find(this._standardKernels, kernel => kernel.displayName === displayName || startsWith(displayName, kernel.displayName));
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
		let newKernel = find(this.notebookManager.sessionManager.specs.kernels, k => k.name === kernel.name);
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
		this.disconnectAttachToConnections().catch(e => this.logService.error(e));
		this.handleClosed().catch(e => this.logService.error(e));
	}

	public async handleClosed(): Promise<void> {
		try {
			if (this.notebookOptions && this.notebookOptions.connectionService && this._activeConnection) {
				await this.disconnectNotebookConnection(this._activeConnection);
				this._activeConnection = undefined;
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
			this._activeClientSession = undefined;
		}
	}

	private async loadActiveContexts(kernelChangedArgs: nb.IKernelChangedArgs): Promise<void> {
		if (kernelChangedArgs && kernelChangedArgs.newValue && kernelChangedArgs.newValue.name) {
			let kernelDisplayName = this.getDisplayNameFromSpecName(kernelChangedArgs.newValue);
			let context = NotebookContexts.getContextForKernel(this._activeConnection, this.getApplicableConnectionProviderIds(kernelDisplayName));
			if (context !== undefined && context.serverName !== undefined && context.title !== undefined) {
				await this.changeContext(context.title, context);
			}
			this._contextsChangedEmitter.fire();
		}
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
		} else {
			if (this.notebookManagers?.length) {
				return this.notebookManagers.map(m => m.providerId).find(p => p !== DEFAULT_NOTEBOOK_PROVIDER && p !== SQL_NOTEBOOK_PROVIDER);
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
		if (this.notebookOptions.connectionService.getConnectionUri(conn).indexOf(uriPrefixes.notebook) > -1) {
			let uri = this._notebookOptions.connectionService.getConnectionUri(conn);
			await this.notebookOptions.connectionService.disconnect(uri).catch(e => this.logService.error(e));
		}
	}

	// Disconnect any connections that were added through the "Change connection" functionality in the Attach To dropdown
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
						this.adstelemetryService.sendMetricsEvent({ markdownRenderingElapsedMs: markdownRenderingTime }, TelemetryKeys.TelemetryView.Notebook);
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
		metadata.tags = this._tags;
		Object.keys(this._existingMetadata).forEach(key => {
			metadata[key] = this._existingMetadata[key];
		});
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
			case NotebookChangeType.CellInputVisibilityChanged:
			case NotebookChangeType.CellMetadataUpdated:
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
