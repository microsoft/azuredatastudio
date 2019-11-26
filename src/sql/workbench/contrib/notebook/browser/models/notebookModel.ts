/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb, connection } from 'azdata';

import { localize } from 'vs/nls';
import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';

import { IClientSession, INotebookModel, IDefaultConnection, INotebookModelOptions, ICellModel, NotebookContentChange, notebookConstants } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';
import { NotebookChangeType, CellType, CellTypes } from 'sql/workbench/contrib/notebook/common/models/contracts';
import { nbversion } from 'sql/workbench/contrib/notebook/common/models/notebookConstants';
import * as notebookUtils from 'sql/workbench/contrib/notebook/browser/models/notebookUtils';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { INotebookManager, SQL_NOTEBOOK_PROVIDER, DEFAULT_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookContexts } from 'sql/workbench/contrib/notebook/browser/models/notebookContexts';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { INotification, Severity, INotificationService } from 'vs/platform/notification/common/notification';
import { URI } from 'vs/base/common/uri';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { uriPrefixes } from 'sql/platform/connection/common/utils';
import { keys } from 'vs/base/common/map';
import { ILogService } from 'vs/platform/log/common/log';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { getErrorMessage, onUnexpectedError } from 'vs/base/common/errors';
import * as types from 'vs/base/common/types';
import { Range, IRange } from 'vs/editor/common/core/range';
import * as model from 'vs/editor/common/model';
import { IntervalNode } from 'vs/editor/common/model/intervalTree';
import { DidChangeDecorationsEmitter, ModelDecorationOptions } from 'vs/editor/common/model/textModel';
import { IModelDecorationsChangedEvent } from 'vs/editor/common/model/textModelEvents';
import { PieceTreeTextBufferBuilder } from 'vs/editor/common/model/pieceTreeTextBuffer/pieceTreeTextBufferBuilder';
import { VSBufferReadableStream, VSBuffer } from 'vs/base/common/buffer';
import { EDITOR_MODEL_DEFAULTS } from 'vs/editor/common/config/editorOptions';
import { find, firstIndex } from 'vs/base/common/arrays';
import { startsWith, singleLetterHash, isHighSurrogate, } from 'vs/base/common/strings';
import { NotebookRange, NotebookFindMatch } from 'sql/workbench/contrib/notebook/browser/cellViews/NotebookFindDecorations';

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

let MODEL_ID = 0;

const invalidFunc = () => { throw new Error(`Invalid change accessor`); };

function _normalizeOptions(options: model.IModelDecorationOptions): ModelDecorationOptions {
	if (options instanceof ModelDecorationOptions) {
		return options;
	}
	return ModelDecorationOptions.createDynamic(options);
}

function createTextBufferBuilder() {
	return new PieceTreeTextBufferBuilder();
}

export function createTextBufferFactory(text: string): model.ITextBufferFactory {
	const builder = createTextBufferBuilder();
	builder.acceptChunk(text);
	return builder.finish();
}

interface ITextStream {
	on(event: 'data', callback: (data: string) => void): void;
	on(event: 'error', callback: (err: Error) => void): void;
	on(event: 'end', callback: () => void): void;
	on(event: string, callback: any): void;
}

export function createTextBufferFactoryFromStream(stream: ITextStream, filter?: (chunk: string) => string, validator?: (chunk: string) => Error | undefined): Promise<model.ITextBufferFactory>;
export function createTextBufferFactoryFromStream(stream: VSBufferReadableStream, filter?: (chunk: VSBuffer) => VSBuffer, validator?: (chunk: VSBuffer) => Error | undefined): Promise<model.ITextBufferFactory>;
export function createTextBufferFactoryFromStream(stream: ITextStream | VSBufferReadableStream, filter?: (chunk: any) => string | VSBuffer, validator?: (chunk: any) => Error | undefined): Promise<model.ITextBufferFactory> {
	return new Promise<model.ITextBufferFactory>((resolve, reject) => {
		const builder = createTextBufferBuilder();

		let done = false;

		stream.on('data', (chunk: string | VSBuffer) => {
			if (validator) {
				const error = validator(chunk);
				if (error) {
					done = true;
					reject(error);
				}
			}

			if (filter) {
				chunk = filter(chunk);
			}

			builder.acceptChunk((typeof chunk === 'string') ? chunk : chunk.toString());
		});

		stream.on('error', (error) => {
			if (!done) {
				done = true;
				reject(error);
			}
		});

		stream.on('end', () => {
			if (!done) {
				done = true;
				resolve(builder.finish());
			}
		});
	});
}

export function createTextBufferFactoryFromSnapshot(snapshot: model.ITextSnapshot): model.ITextBufferFactory {
	let builder = createTextBufferBuilder();

	let chunk: string | null;
	while (typeof (chunk = snapshot.read()) === 'string') {
		builder.acceptChunk(chunk);
	}

	return builder.finish();
}

export function createTextBuffer(value: string | model.ITextBufferFactory, defaultEOL: model.DefaultEndOfLine): model.ITextBuffer {
	const factory = (typeof value === 'string' ? createTextBufferFactory(value) : value);
	return factory.create(defaultEOL);
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
	private _tags: string[];
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
	private _connectionUrisToDispose: string[] = [];
	private _textCellsLoading: number = 0;
	private _standardKernels: notebookUtils.IStandardKernelWithProvider[];
	private _findArray: Array<NotebookRange>;
	private _findIndex: number;
	private _onFindCountChange = new Emitter<number>();
	public get onFindCountChange(): Event<number> { return this._onFindCountChange.event; }
	public requestConnectionHandler: () => Promise<boolean>;
	private _isDisposed: boolean;
	private _versionId: number;
	private _buffer: model.ITextBuffer;
	public readonly id: string;

	//#region Decorations
	private readonly _onDidChangeDecorations: DidChangeDecorationsEmitter = this._register(new DidChangeDecorationsEmitter());
	public readonly onDidChangeDecorations: Event<IModelDecorationsChangedEvent> = this._onDidChangeDecorations.event;

	private readonly _instanceId: string;
	private _lastDecorationId: number;
	private _decorations: { [decorationId: string]: NotebookIntervalNode; };
	public static DEFAULT_CREATION_OPTIONS: model.ITextModelCreationOptions = {
		isForSimpleWidget: false,
		tabSize: EDITOR_MODEL_DEFAULTS.tabSize,
		indentSize: EDITOR_MODEL_DEFAULTS.indentSize,
		insertSpaces: EDITOR_MODEL_DEFAULTS.insertSpaces,
		detectIndentation: false,
		defaultEOL: model.DefaultEndOfLine.LF,
		trimAutoWhitespace: EDITOR_MODEL_DEFAULTS.trimAutoWhitespace,
		largeFileOptimizations: EDITOR_MODEL_DEFAULTS.largeFileOptimizations,
	};
	//#endregion
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
		this._isDisposed = false;
		this._instanceId = singleLetterHash(MODEL_ID);
		this._lastDecorationId = 0;
		this._decorations = Object.create(null);

		this._buffer = createTextBuffer('', NotebookModel.DEFAULT_CREATION_OPTIONS.defaultEOL);

		// Generate a new unique model id
		MODEL_ID++;
		this.id = '$model' + MODEL_ID;
		this._versionId = 1;
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
			let notebookContent: string = '';
			let factory = this._notebookOptions.factory;
			// if cells already exist, create them with language info (if it is saved)
			this._cells = [];
			if (contents) {
				this._defaultLanguageInfo = contents.metadata && contents.metadata.language_info;
				this._savedKernelInfo = this.getSavedKernelInfo(contents);
				if (contents.cells && contents.cells.length > 0) {
					this._cells = contents.cells.map(c => {
						let cellModel = factory.createCell(c, { notebook: this, isTrusted: isTrusted });
						this.trackMarkdownTelemetry(<nb.ICellContents>c, cellModel);
						notebookContent = notebookContent.concat(cellModel.source.toString());
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

		this._contentChangedEmitter.fire({
			changeType: NotebookChangeType.CellsModified,
			cells: [cell],
			cellIndex: index
		});

		return cell;
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

	public set activeCell(cell: ICellModel) {
		this._activeCell = cell;
	}

	private notifyError(error: string): void {
		this._onErrorEmitter.fire({ message: error, severity: Severity.Error });
	}

	public async startSession(manager: INotebookManager, displayName?: string, setErrorStateOnFail?: boolean): Promise<void> {
		if (displayName && this._standardKernels) {
			let standardKernel = find(this._standardKernels, kernel => kernel.displayName === displayName);
			this._defaultKernel = { name: standardKernel.name, display_name: standardKernel.displayName };
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
			}
		}

		this._language = language;
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
			if (!newConnection) {
				newConnection = find(this._activeContexts.otherConnections, (connection) => connection.title === title);
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
			let displayName = this.sanitizeDisplayName(this._savedKernelInfo.display_name);

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
		this._findArray = [];
		this._isDisposed = true;
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
			this._activeClientSession = undefined;
		}
	}

	private async loadActiveContexts(kernelChangedArgs: nb.IKernelChangedArgs): Promise<void> {
		if (kernelChangedArgs && kernelChangedArgs.newValue && kernelChangedArgs.newValue.name) {
			let kernelDisplayName = this.getDisplayNameFromSpecName(kernelChangedArgs.newValue);
			this._activeContexts = NotebookContexts.getContextsForKernel(this._notebookOptions.connectionService, this.getApplicableConnectionProviderIds(kernelDisplayName), kernelChangedArgs, this.connectionProfile);
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
		if (this.notebookOptions.connectionService.getConnectionUri(conn).indexOf(uriPrefixes.notebook) > -1) {
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
		metadata.tags = this._tags;
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

	findNext(): Thenable<NotebookRange> {
		if (this._findArray && this._findArray.length !== 0) {
			if (this._findIndex === this._findArray.length - 1) {
				this._findIndex = 0;
			} else {
				++this._findIndex;
			}
			return Promise.resolve(this._findArray[this._findIndex]);
		} else {
			return Promise.reject(new Error('no search running'));
		}
	}

	findPrevious(): Thenable<NotebookRange> {
		if (this._findArray && this._findArray.length !== 0) {
			if (this._findIndex === 0) {
				this._findIndex = this._findArray.length - 1;
			} else {
				--this._findIndex;
			}
			return Promise.resolve(this._findArray[this._findIndex]);
		} else {
			return Promise.reject(new Error('no search running'));
		}
	}

	find(exp: string, maxMatches?: number): Promise<NotebookRange> {
		this._findArray = new Array<NotebookRange>();
		this._findIndex = 0;
		this._onFindCountChange.fire(this._findArray.length);
		if (exp) {
			return new Promise<NotebookRange>((resolve) => {
				const disp = this.onFindCountChange(e => {
					resolve(this._findArray[0]);
					disp.dispose();
				});
				this._startSearch(exp, maxMatches);
			});
		} else {
			return Promise.reject(new Error('no expression'));
		}
	}

	public get findMatches(): NotebookFindMatch[] {
		let findMatches: NotebookFindMatch[] = [];
		this._findArray.forEach(element => {
			findMatches = findMatches.concat(new NotebookFindMatch(element, null));
		});
		return findMatches;
	}

	public get findArray(): NotebookRange[] {
		return this.findArray;
	}

	private _startSearch(exp: string, maxMatches: number = 0): void {
		let searchFn = (cell: ICellModel, exp: string): NotebookRange[] => {
			let findResults: NotebookRange[] = [];
			let cellVal = cell.source;
			let index: number;
			let start: number;
			let end: number;
			if (cellVal) {
				if (typeof cellVal === 'string') {
					index = 0;
					while (cellVal.substr(index).toLocaleLowerCase().indexOf(exp.toLocaleLowerCase()) > -1) {
						start = cellVal.substr(index).toLocaleLowerCase().indexOf(exp.toLocaleLowerCase()) + index;
						end = start + exp.length;
						let range = new NotebookRange(cell, 0, start, 0, end);
						findResults = findResults.concat(range);
						index = end;
					}
				} else {
					for (let j = 0; j < cellVal.length; j++) {
						index = 0;
						let cellValFormatted = cell.cellType === 'markdown' ? this.cleanMarkdownLinks(cellVal[j]) : cellVal[j];
						while (cellValFormatted.substr(index).toLocaleLowerCase().indexOf(exp.toLocaleLowerCase()) > -1) {
							start = cellValFormatted.substr(index).toLocaleLowerCase().indexOf(exp.toLocaleLowerCase()) + index + 1;
							end = start + exp.length;
							// lineNumber: j+1 since notebook editors aren't zero indexed.
							let range = new NotebookRange(cell, j + 1, start, j + 1, end);
							findResults = findResults.concat(range);
							index = end;
						}
					}
				}
			}
			return findResults;
		};
		for (let i = 0; i < this.cells.length; i++) {
			const item = this.cells[i];
			const result = searchFn!(item, exp);
			if (result) {
				this._findArray = this._findArray.concat(result);
				this._onFindCountChange.fire(this._findArray.length);
				if (maxMatches > 0 && this._findArray.length === maxMatches) {
					break;
				}
			}
		}
	}

	cleanMarkdownLinks(cellSrc: string): string {
		return cellSrc.replace(/(?:__|[*#])|\[(.*?)\]\(.*?\)/gm, '$1');
	}

	clearFind(): void {
		this._findArray = new Array<NotebookRange>();
		this._findIndex = 0;
		this._onFindCountChange.fire(this._findArray.length);
	}

	getFindIndex(): number {
		return types.isUndefinedOrNull(this._findIndex) ? 0 : this._findIndex + 1;
	}

	getFindCount(): number {
		return types.isUndefinedOrNull(this._findArray) ? 0 : this._findArray.length;
	}

	public getDecorationRange(id: string): NotebookRange | null {
		const node = this._decorations[id];
		if (!node) {
			return null;
		}

		let range = node.node.range;
		if (range === null) {
			node.node.range = this._getRangeAt(node.cell, node.node.cachedAbsoluteStart, node.node.cachedAbsoluteEnd);
		}
		return new NotebookRange(node.cell, node.node.range.startLineNumber, node.node.range.startColumn, node.node.range.endLineNumber, node.node.range.endColumn);
	}

	getLineMaxColumn(lineNumber: number): number {
		this._assertNotDisposed();
		if (lineNumber < 1 || lineNumber > this.getLineCount()) {
			throw new Error('Illegal value for lineNumber');
		}
		return this._buffer.getLineLength(lineNumber) + 1;
	}

	getLineCount(): number {
		this._assertNotDisposed();
		return this._buffer.getLineCount();
	}

	//#region Decorations

	public getVersionId(): number {
		this._assertNotDisposed();
		return this._versionId;
	}

	public isDisposed(): boolean {
		return this._isDisposed;
	}

	private _assertNotDisposed(): void {
		if (this._isDisposed) {
			throw new Error('Model is disposed!');
		}
	}

	public changeDecorations<T>(callback: (changeAccessor: model.IModelDecorationsChangeAccessor) => T, ownerId: number = 0): T | null {
		this._assertNotDisposed();

		try {
			this._onDidChangeDecorations.beginDeferredEmit();
			return this._changeDecorations(ownerId, callback);
		} finally {
			this._onDidChangeDecorations.endDeferredEmit();
		}
	}

	private _changeDecorations<T>(ownerId: number, callback: (changeAccessor: model.IModelDecorationsChangeAccessor) => T): T | null {
		let changeAccessor: model.IModelDecorationsChangeAccessor = {
			addDecoration: (range: IRange, options: model.IModelDecorationOptions): string => {
				this._onDidChangeDecorations.fire();
				return this._deltaDecorationsImpl(ownerId, [], [{ range: range, options: options }])[0];
			},
			changeDecoration: (id: string, newRange: IRange): void => {
				this._onDidChangeDecorations.fire();
				this._changeDecorationImpl(id, newRange);
			},
			changeDecorationOptions: (id: string, options: model.IModelDecorationOptions) => {
				this._onDidChangeDecorations.fire();
				this._changeDecorationOptionsImpl(id, _normalizeOptions(options));
			},
			removeDecoration: (id: string): void => {
				this._onDidChangeDecorations.fire();
				this._deltaDecorationsImpl(ownerId, [id], []);
			},
			deltaDecorations: (oldDecorations: string[], newDecorations: model.IModelDeltaDecoration[]): string[] => {
				if (oldDecorations.length === 0 && newDecorations.length === 0) {
					// nothing to do
					return [];
				}
				this._onDidChangeDecorations.fire();
				return this._deltaDecorationsImpl(ownerId, oldDecorations, newDecorations);
			}
		};
		let result: T | null = null;
		try {
			result = callback(changeAccessor);
		} catch (e) {
			onUnexpectedError(e);
		}
		// Invalidate change accessor
		changeAccessor.addDecoration = invalidFunc;
		changeAccessor.changeDecoration = invalidFunc;
		changeAccessor.changeDecorationOptions = invalidFunc;
		changeAccessor.removeDecoration = invalidFunc;
		changeAccessor.deltaDecorations = invalidFunc;
		return result;
	}

	private _getRangeAt(cell: ICellModel, start: number, end: number): NotebookRange {
		let range: Range = this._buffer.getRangeAt(start, end - start);
		return new NotebookRange(cell, range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
	}

	/**
	 * @param range the range to check for validity
	 * @param strict Do NOT allow a range to have its boundaries inside a high-low surrogate pair
	 */
	private _isValidRange(range: NotebookRange, strict: boolean): boolean {
		const startLineNumber = range.startLineNumber;
		const startColumn = range.startColumn;
		const endLineNumber = range.endLineNumber;
		const endColumn = range.endColumn;

		if (!this._isValidPosition(startLineNumber, startColumn, false)) {
			return false;
		}
		if (!this._isValidPosition(endLineNumber, endColumn, false)) {
			return false;
		}

		if (strict) {
			const charCodeBeforeStart = (startColumn > 1 ? this._buffer.getLineCharCode(startLineNumber, startColumn - 2) : 0);
			const charCodeBeforeEnd = (endColumn > 1 && endColumn <= this._buffer.getLineLength(endLineNumber) ? this._buffer.getLineCharCode(endLineNumber, endColumn - 2) : 0);

			const startInsideSurrogatePair = isHighSurrogate(charCodeBeforeStart);
			const endInsideSurrogatePair = isHighSurrogate(charCodeBeforeEnd);

			if (!startInsideSurrogatePair && !endInsideSurrogatePair) {
				return true;
			}

			return false;
		}

		return true;
	}

	private _isValidPosition(lineNumber: number, column: number, strict: boolean): boolean {
		if (typeof lineNumber !== 'number' || typeof column !== 'number') {
			return false;
		}

		if (isNaN(lineNumber) || isNaN(column)) {
			return false;
		}

		if (lineNumber < 0 || column < 1) {
			return false;
		}

		if ((lineNumber | 0) !== lineNumber || (column | 0) !== column) {
			return false;
		}

		const lineCount = this._buffer.getLineCount();
		if (lineNumber > lineCount) {
			return false;
		}

		if (strict) {
			if (column > 1) {
				const charCodeBefore = this._buffer.getLineCharCode(lineNumber, column - 2);
				if (isHighSurrogate(charCodeBefore)) {
					return false;
				}
			}
		}

		return true;
	}


	public validateRange(_range: IRange): NotebookRange {
		this._assertNotDisposed();

		// Avoid object allocation and cover most likely case
		if ((_range instanceof NotebookRange) && !(_range instanceof Selection)) {
			if (this._isValidRange(_range, true)) {
				return _range;
			}
		}

		return undefined;
	}

	/**
	 * Validates `range` is within buffer bounds, but allows it to sit in between surrogate pairs, etc.
	 * Will try to not allocate if possible.
	 */
	private _validateRangeRelaxedNoAllocations(range: IRange): NotebookRange {
		if (range instanceof NotebookRange) {
			this._buffer = createTextBuffer(range.cell.source instanceof Array ? range.cell.source.join('\n') : range.cell.source, NotebookModel.DEFAULT_CREATION_OPTIONS.defaultEOL);
		}

		const linesCount = this._buffer.getLineCount();

		const initialStartLineNumber = range.startLineNumber;
		const initialStartColumn = range.startColumn;
		let startLineNumber: number;
		let startColumn: number;

		if (initialStartLineNumber < 1) {
			startLineNumber = 1;
			startColumn = 1;
		} else if (initialStartLineNumber > linesCount) {
			startLineNumber = linesCount;
			startColumn = this.getLineMaxColumn(startLineNumber);
		} else {
			startLineNumber = initialStartLineNumber | 0;
			if (initialStartColumn <= 1) {
				startColumn = 1;
			} else {
				const maxColumn = this.getLineMaxColumn(startLineNumber);
				if (initialStartColumn >= maxColumn) {
					startColumn = maxColumn;
				} else {
					startColumn = initialStartColumn | 0;
				}
			}
		}

		const initialEndLineNumber = range.endLineNumber;
		const initialEndColumn = range.endColumn;
		let endLineNumber: number;
		let endColumn: number;

		if (initialEndLineNumber < 1) {
			endLineNumber = 1;
			endColumn = 1;
		} else if (initialEndLineNumber > linesCount) {
			endLineNumber = linesCount;
			endColumn = this.getLineMaxColumn(endLineNumber);
		} else {
			endLineNumber = initialEndLineNumber | 0;
			if (initialEndColumn <= 1) {
				endColumn = 1;
			} else {
				const maxColumn = this.getLineMaxColumn(endLineNumber);
				if (initialEndColumn >= maxColumn) {
					endColumn = maxColumn;
				} else {
					endColumn = initialEndColumn | 0;
				}
			}
		}

		if (
			initialStartLineNumber === startLineNumber
			&& initialStartColumn === startColumn
			&& initialEndLineNumber === endLineNumber
			&& initialEndColumn === endColumn
			&& range instanceof NotebookRange
			&& !(range instanceof Selection)
		) {
			return range;
		}

		if (range instanceof NotebookRange) {
			return range;
		}
		return new NotebookRange(undefined, startLineNumber, startColumn, endLineNumber, endColumn);
	}

	private _changeDecorationImpl(decorationId: string, _range: IRange): void {
		const node = this._decorations[decorationId];
		if (!node) {
			return;
		}
		const range = this._validateRangeRelaxedNoAllocations(_range);
		const startOffset = this._buffer.getOffsetAt(range.startLineNumber, range.startColumn);
		const endOffset = this._buffer.getOffsetAt(range.endLineNumber, range.endColumn);
		node.node.reset(this.getVersionId(), startOffset, endOffset, range);
	}

	private _changeDecorationOptionsImpl(decorationId: string, options: ModelDecorationOptions): void {
		const node = this._decorations[decorationId];
		if (!node) {
			return;
		}

		const nodeWasInOverviewRuler = (node.node.options.overviewRuler && node.node.options.overviewRuler.color ? true : false);
		const nodeIsInOverviewRuler = (options.overviewRuler && options.overviewRuler.color ? true : false);

		if (nodeWasInOverviewRuler !== nodeIsInOverviewRuler) {
			// Delete + Insert due to an overview ruler status change
			node.node.setOptions(options);
		} else {
			node.node.setOptions(options);
		}
	}

	private _deltaDecorationsImpl(ownerId: number, oldDecorationsIds: string[], newDecorations: model.IModelDeltaDecoration[]): string[] {
		const versionId = this.getVersionId();


		const oldDecorationsLen = oldDecorationsIds.length;
		let oldDecorationIndex = 0;

		const newDecorationsLen = newDecorations.length;
		let newDecorationIndex = 0;

		let result = new Array<string>(newDecorationsLen);
		while (oldDecorationIndex < oldDecorationsLen || newDecorationIndex < newDecorationsLen) {

			let node: IntervalNode | null = null;
			let cell: ICellModel | null = null;

			if (oldDecorationIndex < oldDecorationsLen) {
				// (1) get ourselves an old node
				do {
					node = this._decorations[oldDecorationsIds[oldDecorationIndex++]].node;
				} while (!node && oldDecorationIndex < oldDecorationsLen);

				// (2) remove the node from the tree (if it exists)
				if (node) {
					//this._decorationsTree.delete(node);
				}
			}

			if (newDecorationIndex < newDecorationsLen) {
				// (3) create a new node if necessary
				if (!node) {
					const internalDecorationId = (++this._lastDecorationId);
					const decorationId = `${this._instanceId};${internalDecorationId}`;
					node = new IntervalNode(decorationId, 0, 0);
					this._decorations[decorationId] = new NotebookIntervalNode(node, cell);
				}

				// (4) initialize node
				const newDecoration = newDecorations[newDecorationIndex];
				const range = this._validateRangeRelaxedNoAllocations(newDecoration.range);
				const options = _normalizeOptions(newDecoration.options);
				const startOffset = this._buffer.getOffsetAt(range.startLineNumber, range.startColumn);
				const endOffset = this._buffer.getOffsetAt(range.endLineNumber, range.endColumn);

				node.ownerId = ownerId;
				node.reset(versionId, startOffset, endOffset, range);
				node.setOptions(options);

				this._decorations[node.id].cell = range.cell;
				this._decorations[node.id].node = node;
				//this._decorationsTree.insert(node);

				result[newDecorationIndex] = node.id;

				newDecorationIndex++;
			} else {
				if (node) {
					delete this._decorations[node.id];
				}
			}
		}

		return result;
	}

}

export class NotebookIntervalNode {

	constructor(public node: IntervalNode, public cell: ICellModel) {

	}
}
