/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb, connection } from 'azdata';

import { localize } from 'vs/nls';
import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';

import { IClientSession, INotebookModel, INotebookModelOptions, ICellModel, NotebookContentChange, MoveDirection, ViewMode, ICellEdit } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookChangeType, CellType, CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { KernelsLanguage, nbversion } from 'sql/workbench/services/notebook/common/notebookConstants';
import * as notebookUtils from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IExecuteManager, SQL_NOTEBOOK_PROVIDER, DEFAULT_NOTEBOOK_PROVIDER, ISerializationManager, INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookContexts } from 'sql/workbench/services/notebook/browser/models/notebookContexts';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { INotification, Severity, INotificationService } from 'vs/platform/notification/common/notification';
import { URI } from 'vs/base/common/uri';
import { INotebookEditOperation, NotebookEditOperationType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { uriPrefixes } from 'sql/platform/connection/common/utils';
import { ILogService } from 'vs/platform/log/common/log';
import { getErrorMessage, onUnexpectedError } from 'vs/base/common/errors';
import { notebookConstants } from 'sql/workbench/services/notebook/browser/interfaces';
import { IAdsTelemetryService, ITelemetryEvent, ITelemetryEventProperties } from 'sql/platform/telemetry/common/telemetry';
import { Deferred } from 'sql/base/common/promise';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { values } from 'vs/base/common/collections';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { isUUID } from 'vs/base/common/uuid';
import { TextModel } from 'vs/editor/common/model/textModel';
import { QueryTextEditor } from 'sql/workbench/browser/modelComponents/queryTextEditor';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';
import { AddCellEdit, CellOutputEdit, ConvertCellTypeEdit, DeleteCellEdit, MoveCellEdit, CellOutputDataEdit, SplitCellEdit } from 'sql/workbench/services/notebook/browser/models/cellEdit';
import { IUndoRedoService } from 'vs/platform/undoRedo/common/undoRedo';
import { deepClone } from 'vs/base/common/objects';
import { IPYKERNEL_DISPLAY_NAME } from 'sql/workbench/common/constants';
import * as path from 'vs/base/common/path';
import { ILanguageService } from 'vs/editor/common/languages/language';

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

interface INotebookMetadataInternal extends nb.INotebookMetadata {
	azdata_notebook_guid?: string;
}

export type SplitCell = {
	cell: ICellModel;
	prefix: string | undefined;
};

type NotebookMetadataKeys = Required<nb.INotebookMetadata>;
const expectedMetadataKeys: NotebookMetadataKeys = {
	kernelspec: undefined,
	language_info: undefined,
	tags: undefined,
	connection_name: undefined,
	multi_connection_mode: undefined
};

const saveConnectionNameConfigName = 'notebook.saveConnectionName';
const injectedParametersMsg = localize('injectedParametersMsg', '# Injected-Parameters\n');

export class NotebookModel extends Disposable implements INotebookModel {
	private _contextsChangedEmitter = new Emitter<void>();
	private _contextsLoadingEmitter = new Emitter<void>();
	private _contentChangedEmitter = new Emitter<NotebookContentChange>();
	private _kernelsAddedEmitter = new Emitter<nb.IKernel>();
	private _kernelChangedEmitter = new Emitter<nb.IKernelChangedArgs>();
	private _viewModeChangedEmitter = new Emitter<ViewMode>();
	private _layoutChanged = new Emitter<void>();
	private _inErrorState: boolean = false;
	private _activeClientSession: IClientSession | undefined;
	private _sessionLoadFinished = new Deferred<void>();
	private _onClientSessionReady = new Emitter<IClientSession>();
	private _onProviderIdChanged = new Emitter<string>();
	private _trustedMode: boolean;
	private _onActiveCellChanged = new Emitter<ICellModel | undefined>();
	private _onCellTypeChanged = new Emitter<ICellModel>();
	private _onScrollEmitter = new Emitter<void>();

	private _cells: ICellModel[] | undefined;
	private _defaultLanguageInfo: nb.ILanguageInfo | undefined;
	private _tags: string[] | undefined;
	private _existingMetadata: nb.INotebookMetadata = {};
	private _language: string = '';
	private _viewMode: ViewMode = ViewMode.Notebook;
	private _onErrorEmitter = new Emitter<INotification>();
	private _savedKernelInfo: nb.IKernelSpec | undefined;
	private _savedConnectionName: string | undefined;
	private readonly _nbformat: number = nbversion.MAJOR_VERSION;
	private readonly _nbformatMinor: number = nbversion.MINOR_VERSION;
	private _activeConnection: ConnectionProfile | undefined;
	private _activeCell: ICellModel | undefined;
	private _providerId: string;
	private _defaultKernel: nb.IKernelSpec;
	private _kernelDisplayNameToConnectionProviderIds: Map<string, string[]> = new Map<string, string[]>();
	private _kernelDisplayNameToNotebookProviderIds: Map<string, string> = new Map<string, string>();
	private _onValidConnectionSelected = new Emitter<boolean>();
	private _oldKernel: nb.IKernel | undefined;
	private _connectionUrisToDispose: string[] = [];
	private _textCellsLoading: number = 0;
	private _standardKernels: notebookUtils.IStandardKernelWithProvider[] = [];
	private _kernelAliases: string[] = [];
	private _currentKernelAlias: string | undefined;
	private _selectedKernelDisplayName: string | undefined;
	private _multiConnectionMode: boolean = false;

	public requestConnectionHandler: (() => Promise<boolean>) | undefined;
	private _isLoading: boolean = false;

	constructor(
		private _notebookOptions: INotebookModelOptions,
		public connectionProfile: IConnectionProfile | undefined,
		@ILogService private readonly logService: ILogService,
		@INotificationService private readonly notificationService: INotificationService,
		@IAdsTelemetryService private readonly adstelemetryService: IAdsTelemetryService,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService,
		@IConfigurationService private configurationService: IConfigurationService,
		@IUndoRedoService private undoService: IUndoRedoService,
		@INotebookService private _notebookService: INotebookService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@ILanguageService private _languageService: ILanguageService,
	) {
		super();
		if (!_notebookOptions || !_notebookOptions.notebookUri || !_notebookOptions.executeManagers) {
			throw new Error('path or notebook service not defined');
		}
		this._trustedMode = false;
		this._providerId = _notebookOptions.providerId;
		this._onProviderIdChanged.fire(this._providerId);
		if (this._notebookOptions.layoutChanged) {
			this._notebookOptions.layoutChanged(() => this._layoutChanged.fire());
		}
		this._defaultKernel = _notebookOptions.defaultKernel;

		this._register(this._notebookService.onNotebookKernelsAdded(async kernels => this.handleNewKernelsAdded(kernels).catch(error => onUnexpectedError(error))));
	}

	// Add new kernels to the model's list as they're registered so that we don't
	// need to restart the notebook to select them in the kernel dropdown.
	private async handleNewKernelsAdded(kernels: notebookUtils.IStandardKernelWithProvider[]): Promise<void> {
		// Kernels are file-specific, so we need to check the file extension
		// to see if the kernel is supported for this notebook.
		let extensions: readonly string[];
		let fileExt = path.extname(this._notebookOptions.notebookUri.path);
		if (!fileExt) {
			let languageMode = this._notebookOptions.getInputLanguageMode();
			if (languageMode) {
				let fileExtensions = this._languageService.getExtensions(languageMode);
				if (fileExtensions?.length > 0) {
					extensions = fileExtensions;
				} else {
					this.logService.warn(`Could not retrieve file extensions for language mode '${languageMode}' in notebook '${this._notebookOptions.notebookUri.toString()}'`);
				}
			} else {
				this.logService.warn(`Could not determine language mode for notebook '${this._notebookOptions.notebookUri.toString()}'`);
			}
		} else {
			extensions = [fileExt];
		}
		// All kernels from the same provider share the same supported file extensions,
		// so we only need to check the first one here.
		if (extensions?.some(ext => kernels[0]?.supportedFileExtensions?.includes(ext))) {
			this._standardKernels.push(...kernels);
			this.setDisplayNameMapsForKernels(kernels);

			// Also add corresponding execute manager so that we can change to the new kernels
			let manager = await this._notebookService.getOrCreateExecuteManager(kernels[0].notebookProvider, this.notebookUri);
			this._notebookOptions.executeManagers.push(manager);

			this._kernelsAddedEmitter.fire(this._activeClientSession?.kernel);
		}
	}

	private get serializationManagers(): ISerializationManager[] {
		let managers = this._notebookOptions.serializationManagers.filter(manager => manager.providerId !== DEFAULT_NOTEBOOK_PROVIDER);
		if (!managers.length) {
			return this._notebookOptions.serializationManagers;
		}
		return managers;
	}

	public get serializationManager(): ISerializationManager | undefined {
		let manager = this.serializationManagers.find(manager => manager.providerId === this._providerId);
		if (!manager) {
			manager = this.serializationManagers.find(manager => manager.providerId === SQL_NOTEBOOK_PROVIDER);
		}
		return manager;
	}

	public get executeManagers(): IExecuteManager[] {
		let managers = this._notebookOptions.executeManagers.filter(manager => manager.providerId !== DEFAULT_NOTEBOOK_PROVIDER);
		if (!managers.length) {
			return this._notebookOptions.executeManagers;
		}
		return managers;
	}

	public get executeManager(): IExecuteManager | undefined {
		let manager = this.executeManagers.find(manager => manager.providerId === this._providerId);
		if (!manager) {
			manager = this.executeManagers.find(manager => manager.providerId === SQL_NOTEBOOK_PROVIDER);
		}
		return manager;
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
		return !!this.executeManager?.serverManager;
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
	public get clientSession(): IClientSession | undefined {
		return this._activeClientSession;
	}

	/**
	 * Event that gets fired after the kernel is changed from starting a session or selecting one from the kernel dropdown.
	 */
	public get kernelChanged(): Event<nb.IKernelChangedArgs> {
		return this._kernelChangedEmitter.event;
	}

	/**
	 * Event that gets fired when new kernels are added to the model from new notebook providers in the registry.
	 */
	public get kernelsAdded(): Event<nb.IKernel> {
		return this._kernelsAddedEmitter.event;
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

	public get onScroll(): Emitter<void> {
		return this._onScrollEmitter;
	}

	public get contextsLoading(): Event<void> {
		return this._contextsLoadingEmitter.event;
	}

	public get cells(): ICellModel[] | undefined {
		return this._cells;
	}

	public get context(): ConnectionProfile | undefined {
		return this._activeConnection;
	}

	public get savedConnectionName(): string | undefined {
		return this._savedConnectionName;
	}

	public get multiConnectionMode(): boolean {
		return this._multiConnectionMode;
	}

	public set multiConnectionMode(isMultiConnection: boolean) {
		this._multiConnectionMode = isMultiConnection;
	}

	public get specs(): nb.IAllKernels | undefined {
		let specs: nb.IAllKernels = {
			defaultKernel: '',
			kernels: []
		};
		this.executeManagers.forEach(manager => {
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

	public get kernelAliases(): string[] {
		return this._kernelAliases;
	}

	public get currentKernelAlias(): string | undefined {
		return this._currentKernelAlias;
	}

	public get selectedKernelDisplayName(): string | undefined {
		return this._selectedKernelDisplayName;
	}

	public set selectedKernelDisplayName(kernel: string) {
		this._selectedKernelDisplayName = kernel;
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

	public get viewModeChanged(): Event<ViewMode> {
		return this._viewModeChangedEmitter.event;
	}

	public get viewMode() {
		return this._viewMode;
	}

	/**
	 * Add custom metadata values to the notebook
	 */
	public setMetaValue(key: string, value: any) {
		this._existingMetadata[key] = value;
		let changeInfo: NotebookContentChange = {
			changeType: NotebookChangeType.MetadataChanged,
			isDirty: true,
			cells: [],
		};
		this._contentChangedEmitter.fire(changeInfo);
	}

	/**
	 * Get a custom metadata value from the notebook
	 */
	public getMetaValue(key: string): any {
		return this._existingMetadata[key];
	}

	public set viewMode(mode: ViewMode) {
		if (mode !== this._viewMode) {
			this._viewMode = mode;
			this._viewModeChangedEmitter.fire(mode);
		}
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

	public get onActiveCellChanged(): Event<ICellModel | undefined> {
		return this._onActiveCellChanged.event;
	}

	public get onCellTypeChanged(): Event<ICellModel> {
		return this._onCellTypeChanged.event;
	}

	public get standardKernels(): notebookUtils.IStandardKernelWithProvider[] {
		return this._standardKernels;
	}

	public set standardKernels(kernels: notebookUtils.IStandardKernelWithProvider[]) {
		this._standardKernels = kernels;
		this.setDisplayNameMapsForKernels(kernels);
	}

	public getApplicableConnectionProviderIds(kernelDisplayName: string): string[] {
		let ids;
		if (kernelDisplayName) {
			ids = this._kernelDisplayNameToConnectionProviderIds.get(kernelDisplayName);
		}
		return !ids ? [] : ids;
	}

	public async loadContents(isTrusted = false, forceLayoutChange = false): Promise<void> {
		try {
			this._isLoading = true;
			this._trustedMode = isTrusted;

			let contents: nb.INotebookContents | undefined;

			if (this._notebookOptions && this._notebookOptions.contentLoader) {
				contents = await this._notebookOptions.contentLoader.loadContent();
			}
			let factory = this._notebookOptions.factory;
			// if cells already exist, create them with language info (if it is saved)
			this._cells = [];
			if (contents) {
				if (contents.metadata) {
					this.loadContentMetadata(contents.metadata);
				}
				// Modify Notebook URI Params format from URI query to string space delimited format
				let notebookUriParams: string = this.notebookUri.query;
				notebookUriParams = notebookUriParams.replace(/&/g, '\n').replace(/=/g, ' = ');
				// Get parameter cell and index to place new notebookUri parameters accordingly
				let parameterCellIndex = 0;
				let hasParameterCell = false;
				let hasInjectedCell = false;
				if (contents.cells && contents.cells.length > 0) {
					this._cells = contents.cells.map(c => {
						let cellModel = factory.createCell(c, { notebook: this, isTrusted: isTrusted });
						if (cellModel.isParameter) {
							parameterCellIndex = contents.cells.indexOf(c);
							hasParameterCell = true;
						}
						/*
						In a parameterized notebook there will be an injected parameter cell.
						Papermill originally inserts the injected parameter with the comment "# Parameters"
						which would make it confusing to the user between the difference between this cell and the tagged parameters cell.
						So to make it clear we edit the injected parameters comment to indicate it is the Injected-Parameters cell.
						*/
						if (cellModel.isInjectedParameter) {
							hasInjectedCell = true;
							cellModel.source = [injectedParametersMsg].concat(cellModel.source.slice(1));
						}
						this.trackMarkdownTelemetry(<nb.ICellContents>c, cellModel);
						return cellModel;
					});
				}
				// Only add new parameter cell if notebookUri Parameters are found
				if (notebookUriParams && this.notebookUri?.scheme !== 'git') {
					this.addUriParameterCell(notebookUriParams, hasParameterCell, parameterCellIndex, hasInjectedCell);
				}
			}

			// Trust notebook by default if there are no code cells
			if (this._cells.length === 0 || this._cells.every(cell => cell.cellType === CellTypes.Markdown)) {
				this.trustedMode = true;
			}
			if (forceLayoutChange) {
				this._layoutChanged.fire();
			}
		} catch (error) {
			this._inErrorState = true;
			throw error;
		} finally {
			this._isLoading = false;
		}
	}

	public sendNotebookTelemetryActionEvent(action: TelemetryKeys.TelemetryAction | TelemetryKeys.NbTelemetryAction, additionalProperties: ITelemetryEventProperties = {}, connectionInfo?: IConnectionProfile): void {
		let properties: ITelemetryEventProperties = deepClone(additionalProperties);
		properties['azdata_notebook_guid'] = this.getMetaValue('azdata_notebook_guid');
		let event: ITelemetryEvent = this.adstelemetryService.createActionEvent(TelemetryKeys.TelemetryView.Notebook, action)
			.withAdditionalProperties(properties);
		if (connectionInfo) {
			event.withConnectionInfo(connectionInfo);
		}
		event.send();
	}

	private loadContentMetadata(metadata: INotebookMetadataInternal): void {
		this._savedKernelInfo = metadata.kernelspec;
		this._defaultLanguageInfo = metadata.language_info;
		// If language info was serialized in the notebook, attempt to use that to decrease time
		// required until colorization occurs
		if (this._defaultLanguageInfo) {
			this.updateLanguageInfo(this._defaultLanguageInfo);
		}
		this._savedConnectionName = metadata.connection_name;
		this._multiConnectionMode = !!metadata.multi_connection_mode;

		//Telemetry of loading notebook
		if (metadata.azdata_notebook_guid && metadata.azdata_notebook_guid.length === 36) {
			//Verify if it is actual GUID and then send it to the telemetry
			if (isUUID(metadata.azdata_notebook_guid)) {
				this.sendNotebookTelemetryActionEvent(TelemetryKeys.TelemetryAction.Open);
			}
		}
		Object.keys(metadata).forEach(key => {
			// If custom metadata is defined, add to the _existingMetadata object
			if (!Object.keys(expectedMetadataKeys).includes(key)) {
				this._existingMetadata[key] = metadata[key];
			}
		});
	}

	public async requestModelLoad(): Promise<void> {
		try {
			await this.setDefaultKernelAndProviderId();
			this.trySetLanguageFromLangInfo();
		} catch (error) {
			this._inErrorState = true;
			throw error;
		}
	}

	public async requestConnection(): Promise<boolean> {
		// If there is a saved connection name with a corresponding connection profile, use that one,
		// otherwise show connection dialog
		if (this.configurationService.getValue(saveConnectionNameConfigName) && this._savedConnectionName) {
			let profile: ConnectionProfile | undefined = this.getConnectionProfileFromName(this._savedConnectionName);
			if (profile) {
				await this.changeContext(this._savedConnectionName, profile);
				return true;
			}
		}
		if (this.requestConnectionHandler) {
			return this.requestConnectionHandler();
		} else if (this.notificationService) {
			this.notificationService.notify({ severity: Severity.Error, message: localize('kernelRequiresConnection', "Please select a connection to run cells for this kernel") });
		}
		return false;
	}

	public findCellIndex(cellModel: ICellModel): number {
		return this._cells.findIndex(cell => cell.equals(cellModel));
	}

	public addCell(cellType: CellType, index?: number, language?: string): ICellModel | undefined {
		if (this.inErrorState) {
			return undefined;
		}
		let cell = this.createCell(cellType, language);
		return this.insertCell(cell, index, true);
	}

	public splitCell(cellType: CellType, notebookService: INotebookService, index?: number, language?: string, addToUndoStack: boolean = true): ICellModel | undefined {
		if (this.inErrorState) {
			return undefined;
		}

		let notebookEditor = notebookService.findNotebookEditor(this.notebookUri);
		let cellEditorProvider = notebookEditor.cellEditors.find(e => e.cellGuid() === this.cells[index].cellGuid);
		//Only split the cell if the markdown editor is open.
		//TODO: Need to handle splitting of cell if the selection is on webview
		if (cellEditorProvider) {
			let editor = cellEditorProvider.getEditor() as QueryTextEditor;
			if (editor) {
				let editorControl = editor.getControl() as CodeEditorWidget;

				let model = editorControl.getModel() as TextModel;
				let range = model.getFullModelRange();
				let selection = editorControl.getSelection();
				let source = this.cells[index].source;
				let newCell: ICellModel = undefined, tailCell: ICellModel = undefined, partialSource = undefined;
				let newCellIndex = index;
				let tailCellIndex = index;
				let splitCells: SplitCell[] = [];
				let attachments = {};

				// Save UI state
				let showMarkdown = this.cells[index].showMarkdown;
				let showPreview = this.cells[index].showPreview;

				//Get selection value from current cell
				let newCellContent = model.getValueInRange(selection);
				let startPosition = selection.getStartPosition();
				//If the cursor is at the beginning of the cell with no selection, return
				if (newCellContent.length === 0 && startPosition.lineNumber === 1 && startPosition.column === 1) {
					return undefined;
				}

				//Get content after selection
				let tailRange = range.setStartPosition(selection.endLineNumber, selection.endColumn);
				let tailCellContent = model.getValueInRange(tailRange);

				//Get content before selection
				let headRange = range.setEndPosition(selection.startLineNumber, selection.startColumn);
				let headContent = model.getValueInRange(headRange);

				// If the selection is equal to entire content then do nothing
				if (headContent.length === 0 && tailCellContent.length === 0) {
					return undefined;
				}

				//Set content before selection if the selection is not the same as original content
				if (headContent.length) {
					let headsource = source.slice(range.startLineNumber - 1, selection.startLineNumber - 1);
					if (selection.startColumn > 1) {
						partialSource = source.slice(selection.startLineNumber - 1, selection.startLineNumber)[0].slice(0, selection.startColumn - 1);
						headsource = headsource.concat(partialSource.toString());
					}
					// Save attachments before updating cell contents
					attachments = this.cells[index].attachments;
					// No need to update attachments, since unused attachments are removed when updating the cell source
					this.cells[index].source = headsource;
					splitCells.push({ cell: this.cells[index], prefix: undefined });
				}

				if (newCellContent.length) {
					let newSource = source.slice(selection.startLineNumber - 1, selection.endLineNumber) as string[];
					if (selection.startColumn > 1) {
						partialSource = source.slice(selection.startLineNumber - 1)[0].slice(selection.startColumn - 1);
						newSource.splice(0, 1, partialSource);
					}
					if (selection.endColumn !== source[selection.endLineNumber - 1].length) {
						let splicestart = 0;
						if (selection.startLineNumber === selection.endLineNumber) {
							splicestart = selection.startColumn - 1;
						}
						let partial = source.slice(selection.endLineNumber - 1, selection.endLineNumber)[0].slice(splicestart, selection.endColumn - 1);
						newSource.splice(newSource.length - 1, 1, partial);
					}
					//If the selection is not from the start of the cell, create a new cell.
					if (headContent.length) {
						newCell = this.createCell(cellType, language);
						newCell.updateAttachmentsFromSource(newSource.join(), attachments);
						newCell.source = newSource;
						newCellIndex++;
						this.insertCell(newCell, newCellIndex, false);
						splitCells.push({ cell: this.cells[newCellIndex], prefix: undefined });
					}
					else { //update the existing cell
						this.cells[index].source = newSource;
					}
				}

				if (tailCellContent.length) {
					//tail cell will be of original cell type.
					tailCell = this.createCell(this._cells[index].cellType, language);
					let tailSource = source.slice(tailRange.startLineNumber - 1) as string[];
					if (selection.endColumn > 1) {
						partialSource = source.slice(tailRange.startLineNumber - 1, tailRange.startLineNumber)[0].slice(tailRange.startColumn - 1);
						tailSource.splice(0, 1, partialSource);
					}
					let newlinesBeforeTailCellContent: string;
					//Remove the trailing empty line after the cursor
					if (tailSource[0] === '\r\n' || tailSource[0] === '\n') {
						newlinesBeforeTailCellContent = tailSource.splice(0, 1)[0];
					}
					tailCell.updateAttachmentsFromSource(tailSource.join(), attachments);
					tailCell.source = tailSource;
					tailCellIndex = newCellIndex + 1;
					this.insertCell(tailCell, tailCellIndex, false);
					splitCells.push({ cell: this.cells[tailCellIndex], prefix: newlinesBeforeTailCellContent });
				}

				let activeCell = newCell ? newCell : (headContent.length ? tailCell : this.cells[index]);
				let activeCellIndex = newCell ? newCellIndex : (headContent.length ? tailCellIndex : index);

				if (addToUndoStack) {
					this.undoService.pushElement(new SplitCellEdit(this, splitCells));
				}
				//make new cell Active
				this.updateActiveCell(activeCell, true);
				this._contentChangedEmitter.fire({
					changeType: NotebookChangeType.CellsModified,
					cells: [activeCell],
					cellIndex: activeCellIndex
				});
				activeCell.showMarkdown = showMarkdown;
				activeCell.showPreview = showPreview;

				//return inserted cell
				return activeCell;
			}
		}
		return undefined;
	}

	public mergeCells(cells: SplitCell[]): void {
		let firstCell = cells[0].cell;
		// Append the other cell sources to the first cell
		for (let i = 1; i < cells.length; i++) {
			firstCell.attachments = { ...firstCell.attachments, ...cells[i].cell.attachments };
			firstCell.source = cells[i].prefix ? [...firstCell.source, ...cells[i].prefix, ...cells[i].cell.source] : [...firstCell.source, ...cells[i].cell.source];
		}
		// Set newly created cell as active cell
		this.updateActiveCell(firstCell, true);
		this._contentChangedEmitter.fire({
			changeType: NotebookChangeType.CellsModified,
			cells: [firstCell],
			cellIndex: 0
		});
		for (let i = 1; i < cells.length; i++) {
			this.deleteCell(cells[i].cell, false);
		}
	}

	public splitCells(cells: SplitCell[], firstCellOriginalSource: string | string[]): void {
		cells[0].cell.source = firstCellOriginalSource;
		this.updateActiveCell(cells[0].cell, true);
		this._contentChangedEmitter.fire({
			changeType: NotebookChangeType.CellsModified,
			cells: [cells[0].cell],
			cellIndex: 0
		});

		for (let i = 1; i < cells.length; i++) {
			this.insertCell(cells[i].cell, undefined, false);
		}
	}

	public insertCell(cell: ICellModel, index?: number, addToUndoStack: boolean = true): ICellModel | undefined {
		if (this.inErrorState) {
			return undefined;
		}
		if (index !== undefined && index !== null && index >= 0 && index < this._cells.length) {
			this._cells.splice(index, 0, cell);
		} else {
			this._cells.push(cell);
			index = undefined;
		}
		if (addToUndoStack) {
			// Only make cell active when inserting the cell. If we update the active cell when undoing/redoing, the user would have to deselect the cell first
			// and to undo multiple times.
			this.updateActiveCell(cell, true);
			this.undoService.pushElement(new AddCellEdit(this, cell, index));
		}

		this._contentChangedEmitter.fire({
			changeType: NotebookChangeType.CellsModified,
			cells: [cell],
			cellIndex: index
		});
		return cell;
	}

	/**
	 * Adds Parameters cell based on Notebook URI parameters
	 * @param notebookUriParams contains the parameters from Notebook URI
	 * @param hasParameterCell notebook contains a parameter cell
	 * @param parameterCellIndex index of the parameter cell in notebook
	 * @param hasInjectedCell notebook contains a injected parameter cell
	 */
	private addUriParameterCell(notebookUriParams: string, hasParameterCell: boolean, parameterCellIndex: number, hasInjectedCell: boolean): void {
		let uriParamsIndex = parameterCellIndex;
		// Set new uri parameters as a Injected Parameters cell after original parameter cell
		if (hasParameterCell) {
			uriParamsIndex = parameterCellIndex + 1;
			// Set the uri parameters after the injected parameter cell
			if (hasInjectedCell) {
				uriParamsIndex = uriParamsIndex + 1;
			}
			this.addCell('code', uriParamsIndex);
			this.cells[uriParamsIndex].isInjectedParameter = true;
			this.cells[uriParamsIndex].source = [injectedParametersMsg].concat(notebookUriParams);
		} else {
			// Set new parameters as the parameters cell as the first cell in the notebook
			this.addCell('code', uriParamsIndex);
			this.cells[uriParamsIndex].isParameter = true;
			this.cells[uriParamsIndex].source = [notebookUriParams];
		}
	}

	moveCell(cell: ICellModel, direction: MoveDirection, addToUndoStack: boolean = true): void {
		if (this.inErrorState) {
			return;
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

		if (addToUndoStack) {
			this.undoService.pushElement(new MoveCellEdit(this, cell, direction));
			// If we update the active cell when undoing/redoing, the user would have to deselect the cell first and to undo multiple times.
			this.updateActiveCell(cell);
		}
		index = this.findCellIndex(cell);

		this._contentChangedEmitter.fire({
			changeType: NotebookChangeType.CellsModified,
			cells: [cell],
			cellIndex: index
		});
	}

	public updateActiveCell(cell?: ICellModel, isEditMode: boolean = false): void {
		if (this._activeCell !== cell) {
			if (this._activeCell) {
				this._activeCell.active = false;
				if (this._activeCell.isEditMode) {
					this._activeCell.isEditMode = false;
				}
			}
			this._activeCell = cell;
			if (this._activeCell) {
				this._activeCell.active = true;
				if (this._activeCell.isEditMode !== isEditMode) {
					this._activeCell.isEditMode = isEditMode;
				}
			}
			this._onActiveCellChanged.fire(cell);
		}
	}

	public convertCellType(cell: ICellModel, addToUndoStack: boolean = true): void {
		if (cell) {
			let index = this.findCellIndex(cell);
			if (index > -1) {
				if (addToUndoStack) {
					this.undoService.pushElement(new ConvertCellTypeEdit(this, cell));
				}
				// Ensure override language is reset
				cell.setOverrideLanguage('');
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

	private createCell(cellType: CellType, language?: string): ICellModel {
		let singleCell: nb.ICellContents = {
			cell_type: cellType,
			source: '',
			metadata: {},
			execution_count: undefined
		};
		if (language) {
			singleCell.metadata.language = language;
		}
		return this._notebookOptions.factory.createCell(singleCell, { notebook: this, isTrusted: true });
	}

	deleteCell(cellModel: ICellModel, addToUndoStack: boolean = true): void {
		if (this.inErrorState || !this._cells) {
			return;
		}
		let index = this._cells.findIndex(cell => cell.equals(cellModel));
		if (index > -1) {
			if (addToUndoStack) {
				this.undoService.pushElement(new DeleteCellEdit(this, cellModel, index));
			}

			this._cells.splice(index, 1);
			if (this._activeCell === cellModel) {
				this.updateActiveCell();
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

	pushEditOperations(edits: INotebookEditOperation[]): void {
		if (this.inErrorState || !this._cells) {
			return;
		}

		for (const edit of edits) {
			const startCell = this.cells[edit.range.start];
			switch (edit.type) {
				case NotebookEditOperationType.UpdateCell:
					if (!startCell) {
						this.logService.warn(`Did not receive a valid starting cell when processing edit type ${edit.type}`);
						continue;
					}
					startCell.processEdits([
						new CellOutputEdit(edit.cell.outputs ?? [], !!edit.append)
					]);
					break;
				case NotebookEditOperationType.UpdateCellOutput:
					if (!startCell) {
						this.logService.warn(`Did not receive a valid starting cell when processing edit type ${edit.type}`);
						continue;
					}
					const cellEdits: ICellEdit[] = [];
					edit.cell.outputs?.forEach(o => {
						const targetOutput = startCell.outputs.find(o2 => o.id === o2.id);
						if (!targetOutput) {
							this.logService.warn(`Could not find target output with ID ${o.id} when updating cell output`);
							return;
						}
						cellEdits.push(new CellOutputDataEdit(targetOutput.id, (o as nb.IDisplayData).data, !!edit.append));
					});
					startCell.processEdits(cellEdits);
					break;
				case NotebookEditOperationType.InsertCell:
				case NotebookEditOperationType.ReplaceCells:
				case NotebookEditOperationType.DeleteCell:
					let newCells: ICellModel[] = [];
					if (edit.cell) {
						// TODO: should we validate and complete required missing parameters?
						let contents: nb.ICellContents = edit.cell as nb.ICellContents;
						newCells.push(this._notebookOptions.factory.createCell(contents, { notebook: this, isTrusted: this._trustedMode }));
						this.undoService.pushElement(new AddCellEdit(this, newCells[0], edit.range.start));
					}
					this._cells.splice(edit.range.start, edit.range.end - edit.range.start, ...newCells);
					if (newCells.length > 0) {
						this.updateActiveCell(newCells[0]);
					}
					this._contentChangedEmitter.fire({
						changeType: NotebookChangeType.CellsModified,
						isDirty: true
					});
					break;
			}
		}
	}

	public get activeCell(): ICellModel | undefined {
		return this._activeCell;
	}

	private notifyError(error: string): void {
		this._onErrorEmitter.fire({ message: error, severity: Severity.Error });
	}

	public async startSession(manager: IExecuteManager, displayName?: string, setErrorStateOnFail?: boolean, kernelAlias?: string): Promise<void> {
		if (displayName) {
			let standardKernel = this._standardKernels.find(kernel => kernel.displayName === displayName);
			if (standardKernel) {
				this._defaultKernel = { name: standardKernel.name, display_name: standardKernel.displayName };
			}
		}
		if (this._defaultKernel) {
			let clientSession = this._notebookOptions.factory.createClientSession({
				notebookUri: this._notebookOptions.notebookUri,
				executeManager: manager,
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
				this._savedConnectionName = profile.connectionName;
				kernelAlias = this._currentKernelAlias;
			}

			clientSession.onKernelChanging(async (e) => {
				await this.loadActiveContexts(e);
			});
			await clientSession.initialize().then(() => {
				this._sessionLoadFinished.resolve();
			});
			// By somehow we have to wait for ready, otherwise may not be called for some cases.
			await clientSession.ready;
			if (clientSession.kernel) {
				await clientSession.kernel.ready;
				await this.updateKernelInfoOnKernelChange(clientSession.kernel, kernelAlias);
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

	public async restartSession(): Promise<void> {
		if (this._activeClientSession) {
			// Old active client sessions have already been shutdown by RESTART_JUPYTER_NOTEBOOK_SESSIONS command
			this._activeClientSession = undefined;
			await this.startSession(this.executeManager, this._selectedKernelDisplayName, true);
		}
	}

	// When changing kernel, update the active session
	private updateActiveClientSession(clientSession: IClientSession) {
		this._activeClientSession = clientSession;
	}

	public async setDefaultKernelAndProviderId(): Promise<void> {
		if (!this._defaultKernel) {
			await this.executeManager.sessionManager.ready;
			if (this.executeManager.sessionManager.specs) {
				let defaultKernelName = this.executeManager.sessionManager.specs.defaultKernel;
				this._defaultKernel = this.executeManager.sessionManager.specs.kernels.find(kernel => kernel.name === defaultKernelName);
			}
		}

		if (this._capabilitiesService?.providers && this.executeManager.providerId === SQL_NOTEBOOK_PROVIDER) {
			let providers = this._capabilitiesService.providers;
			for (const server in providers) {
				let alias = providers[server].connection.notebookKernelAlias;
				// Add Notebook Kernel Alias to kernelAliases
				if (alias && this._kernelAliases.indexOf(alias) === -1) {
					this._kernelAliases.push(providers[server].connection.notebookKernelAlias);
					this._kernelDisplayNameToConnectionProviderIds.set(alias, [providers[server].connection.providerId]);
				}
			}
		}
		if (this._savedKernelInfo) {
			this.sanitizeSavedKernelInfo();
			let provider = this._kernelDisplayNameToNotebookProviderIds.get(this._savedKernelInfo.display_name);
			if (provider && provider !== this._providerId) {
				this._providerId = provider;
			} else if (!provider) {
				this._providerId = SQL_NOTEBOOK_PROVIDER;
				this._notebookOptions.notificationService.notify({ severity: Severity.Info, message: localize('savedKernelNotSupported', "This notebook's '{0}' kernel is not supported. Defaulting to SQL kernel instead.", this._savedKernelInfo.display_name ?? this._savedKernelInfo.name) });
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

		if (!this._defaultLanguageInfo?.name) {
			// update default language
			this._defaultLanguageInfo = {
				name: this._providerId === SQL_NOTEBOOK_PROVIDER ? 'sql' : 'python',
				version: ''
			};
		}
	}

	private isValidConnection(profile: IConnectionProfile | connection.Connection) {
		let standardKernels = this._standardKernels.find(kernel => this._defaultKernel && kernel.displayName === this._defaultKernel.display_name);
		let connectionProviderIds = standardKernels ? standardKernels.connectionProviderIds : undefined;
		let providerFeatures = this._capabilitiesService?.getCapabilities(profile.providerName);
		if (connectionProviderIds?.length) {
			this._currentKernelAlias = providerFeatures?.connection.notebookKernelAlias;
			// Switching from Kusto to another kernel should set the currentKernelAlias to undefined
			if (this._selectedKernelDisplayName !== this._currentKernelAlias && this._selectedKernelDisplayName) {
				this._currentKernelAlias = undefined;
			} else {
				// Adds Kernel Alias and Connection Provider to Map if new Notebook connection contains notebookKernelAlias
				this._kernelDisplayNameToConnectionProviderIds.set(this._currentKernelAlias, [profile.providerName]);
			}
		}
		return this._currentKernelAlias || profile && connectionProviderIds && connectionProviderIds.find(provider => provider === profile.providerName) !== undefined;
	}

	public getStandardKernelFromName(name: string): notebookUtils.IStandardKernelWithProvider | undefined {
		if (name) {
			let kernel = this._standardKernels.find(kernel => kernel.name.toLowerCase() === name.toLowerCase());
			return kernel;
		}
		return undefined;
	}

	public getStandardKernelFromDisplayName(displayName: string): notebookUtils.IStandardKernelWithProvider | undefined {
		if (displayName) {
			let kernel = this._standardKernels.find(kernel => kernel.displayName.toLowerCase() === displayName.toLowerCase());
			return kernel;
		}
		return undefined;
	}

	public get tags(): string[] | undefined {
		return this._tags;
	}

	public get languageInfo(): nb.ILanguageInfo | undefined {
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
		let language: string = '';
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
				language = KernelsLanguage.Python;
			} else if (language.toLowerCase() === 'c#') {
				language = KernelsLanguage.CSharp;
			} else if (language.toLowerCase() === 'f#') {
				language = KernelsLanguage.FSharp;
			}
		} else {
			language = KernelsLanguage.Python;
		}

		// Update cell language if it was using the previous default, but skip updating the cell
		// if it was using a more specific language.
		let oldLanguage = this._language;
		this._language = language.toLowerCase();
		this._cells?.forEach(cell => {
			if (!cell.language || cell.language === oldLanguage) {
				cell.setOverrideLanguage(this._language);
			}
		});
	}

	public changeKernel(displayName: string): void {
		this._selectedKernelDisplayName = displayName;
		this._currentKernelAlias = this.context?.serverCapabilities?.notebookKernelAlias;
		if (this._currentKernelAlias && this.kernelAliases.includes(this._currentKernelAlias) && displayName === this._currentKernelAlias) {
			this.doChangeKernel(displayName, true).catch(e => this.logService.error(e));
		} else {
			this._currentKernelAlias = undefined;
			this._contextsLoadingEmitter.fire();
			this.doChangeKernel(displayName, true).catch(e => this.logService.error(e));
		}
	}

	private async doChangeKernel(displayName: string, mustSetProvider: boolean = true, restoreOnFail: boolean = true): Promise<void> {
		if (!displayName) {
			// Can't change to an undefined kernel
			return;
		}
		let oldDisplayName = this._activeClientSession && this._activeClientSession.kernel ? this._activeClientSession.kernel.name : undefined;
		let nbKernelAlias: string | undefined;
		if (this.kernelAliases.includes(displayName)) {
			this._currentKernelAlias = displayName;
			displayName = 'SQL';
			nbKernelAlias = this._currentKernelAlias;
			this._kernelDisplayNameToConnectionProviderIds.set(this.currentKernelAlias, [this.currentKernelAlias.toUpperCase()]);
		}
		try {
			let changeKernelNeeded = true;
			if (mustSetProvider) {
				let providerChanged = await this.tryStartSessionByChangingProviders(displayName, nbKernelAlias);
				// If provider was changed, a new session with new kernel is already created. We can skip calling changeKernel.
				changeKernelNeeded = !providerChanged;
			}
			if (changeKernelNeeded) {
				let spec = this.findSpec(displayName);
				if (this._activeClientSession && this._activeClientSession.isReady) {
					let kernel = await this._activeClientSession.changeKernel(spec, this._oldKernel);
					try {
						await kernel?.ready;
						await this.updateKernelInfoOnKernelChange(kernel, nbKernelAlias);
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

	private async updateKernelInfoOnKernelChange(kernel: nb.IKernel, kernelAlias?: string) {
		await this.updateKernelInfo(kernel);
		if (!kernelAlias) {
			kernelAlias = this.kernelAliases.find(k => this._defaultLanguageInfo?.name === k.toLowerCase());
		}
		// In order to change from kernel alias to other kernel, set kernelAlias to undefined in order to update to new kernel language info
		if (this._selectedKernelDisplayName !== kernelAlias && this._selectedKernelDisplayName) {
			kernelAlias = undefined;
		}
		// Sets the kernel alias language info properly in order to open the notebook with the kernel alias
		if (kernelAlias) {
			let aliasLanguageInfo: nb.ILanguageInfo = {
				name: kernelAlias.toLowerCase(),
				version: ''
			};
			this.updateLanguageInfo(aliasLanguageInfo);
		} else if (kernel.info) {
			this.updateLanguageInfo(kernel.info.language_info);
		}
		this.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.KernelChanged, {
			name: kernel.name,
			alias: kernelAlias || ''
		});
		this._kernelChangedEmitter.fire({
			newValue: kernel,
			oldValue: undefined,
			nbKernelAlias: kernelAlias
		});
	}

	private findSpec(displayName: string) {
		let spec = this.getKernelSpecFromDisplayName(displayName);
		if (spec) {
			// Ensure that the kernel we try to switch to is a valid kernel; if not, use the default
			let kernelSpecs = this.getKernelSpecs();
			if (kernelSpecs && kernelSpecs.length > 0 && kernelSpecs.findIndex(k => k.display_name === spec.display_name) < 0) {
				spec = kernelSpecs.find(spec => spec.name === this.executeManager?.sessionManager.specs.defaultKernel);
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
				if (newConnection.serverCapabilities?.notebookKernelAlias) {
					this._currentKernelAlias = newConnection.serverCapabilities.notebookKernelAlias;
					// Removes SQL kernel to Kernel Alias Connection Provider map
					let sqlConnectionProvider = this._kernelDisplayNameToConnectionProviderIds.get('SQL');
					if (sqlConnectionProvider) {
						let index = sqlConnectionProvider.indexOf(newConnection.serverCapabilities.notebookKernelAlias.toUpperCase());
						if (index > -1) {
							sqlConnectionProvider.splice(index, 1);
						}
						this._kernelDisplayNameToConnectionProviderIds.set('SQL', sqlConnectionProvider);
					}
					this._kernelDisplayNameToConnectionProviderIds.set(newConnection.serverCapabilities.notebookKernelAlias, [newConnection.providerName]);
				}
				this._activeConnection = newConnection;
				this._savedConnectionName = newConnection.connectionName;
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
				this.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.ConnectionChanged, undefined, newConnection.toIConnectionProfile());
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
			this._activeConnection &&
			this._activeConnection.id !== '-1' &&
			this._activeConnection.id !== newConnection.id) {
			// Change the active connection to newConnection
			this._activeConnection = newConnection;
			this._savedConnectionName = newConnection.connectionName;
		}
	}

	private getConnectionProfileFromName(connectionName: string): ConnectionProfile | undefined {
		let connections: ConnectionProfile[] = this.connectionManagementService.getConnections();
		return values(connections).find(connection => connection.connectionName === connectionName);
	}

	private getKernelSpecFromDisplayName(displayName: string): nb.IKernelSpec | undefined {
		let kernel: nb.IKernelSpec = this.specs.kernels.find(k => k.display_name.toLowerCase() === displayName.toLowerCase());
		if (!kernel) {
			return undefined; // undefined is handled gracefully in the session to default to the default kernel
		} else if (!kernel.name) {
			kernel.name = this.specs.defaultKernel;
		}
		return kernel;
	}

	private sanitizeSavedKernelInfo(): void {
		if (this._savedKernelInfo) {
			let displayName = this._savedKernelInfo.display_name;
			let standardKernel = this._standardKernels.find(kernel => kernel.displayName === displayName || displayName.startsWith(kernel.displayName));
			if (standardKernel) {
				if (this._savedKernelInfo.name && this._savedKernelInfo.name !== standardKernel.name) {
					this._savedKernelInfo.name = standardKernel.name;
					this._savedKernelInfo.display_name = standardKernel.displayName;
				} else if (displayName === IPYKERNEL_DISPLAY_NAME && this._savedKernelInfo.name === standardKernel.name) {
					// Handle Jupyter alias for Python 3 kernel
					this._savedKernelInfo.display_name = standardKernel.displayName;
				}
			}
		}
	}

	public getDisplayNameFromSpecName(kernel: nb.IKernel): string | undefined {
		let specs = this.executeManager?.sessionManager.specs;
		if (!specs || !specs.kernels) {
			return kernel.name;
		}
		let newKernel = this.executeManager.sessionManager.specs.kernels.find(k => k.name === kernel.name);
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

	public override dispose(): void {
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
			this.logService.error('An error occurred when closing the notebook: ', getErrorMessage(err));
		}
	}

	private async shutdownActiveSession(): Promise<void> {
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
			if (this.context?.serverCapabilities?.notebookKernelAlias && this.selectedKernelDisplayName === this.context?.serverCapabilities?.notebookKernelAlias) {
				kernelDisplayName = this.context.serverCapabilities?.notebookKernelAlias;
			}
			let context;
			if (this._activeConnection) {
				context = NotebookContexts.getContextForKernel(this._activeConnection, this.getApplicableConnectionProviderIds(kernelDisplayName));
			}
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
					language: spec.language,
					supportedLanguages: spec.supportedLanguages,
				};
				this.clientSession?.configureKernel(this._savedKernelInfo);
			} catch (err) {
				// Don't worry about this for now. Just use saved values
			}
		}
	}

	/**
	 * Set _providerId and start session if it is new provider
	 * @param displayName Kernel dispay name
	 */
	private async tryStartSessionByChangingProviders(displayName: string, kernelAlias?: string): Promise<boolean> {
		if (displayName) {
			if (this._activeClientSession && this._activeClientSession.isReady) {
				this._oldKernel = this._activeClientSession.kernel;
			}
			let providerId = this.tryFindProviderForKernel(displayName);

			if (providerId && providerId !== this._providerId) {
				this._providerId = providerId;
				this._onProviderIdChanged.fire(this._providerId);

				await this.shutdownActiveSession();
				let manager = this.executeManager;
				if (manager) {
					await this.startSession(manager, displayName, false, kernelAlias);
				} else {
					throw new Error(localize('ProviderNoManager', "Can't find notebook manager for provider {0}", providerId));
				}
				return true;
			}
		}
		return false;
	}

	private tryFindProviderForKernel(displayName: string, alwaysReturnId: boolean = false): string | undefined {
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
			if (this.executeManagers?.length) {
				return this.executeManagers.map(m => m.providerId).find(p => p !== DEFAULT_NOTEBOOK_PROVIDER && p !== SQL_NOTEBOOK_PROVIDER);
			}
		}
		return undefined;
	}

	// Get kernel specs from current sessionManager
	private getKernelSpecs(): nb.IKernelSpec[] {
		if (this.executeManager && this.executeManager.sessionManager && this.executeManager.sessionManager.specs &&
			this.executeManager.sessionManager.specs.kernels) {
			return this.executeManager.sessionManager.specs.kernels;
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
		notebookUtils.asyncForEach(this._connectionUrisToDispose, async (conn: string) => {
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
	private setDisplayNameMapsForKernels(kernels: notebookUtils.IStandardKernelWithProvider[]): void {
		kernels.forEach(kernel => {
			let displayName = kernel.displayName;
			if (!displayName) {
				displayName = kernel.name;
			}
			this._kernelDisplayNameToConnectionProviderIds.set(displayName, kernel.connectionProviderIds);
			this._kernelDisplayNameToNotebookProviderIds.set(displayName, kernel.notebookProvider);
		});
	}

	/**
	 * Serialize the model to JSON.
	 */
	toJSON(): nb.INotebookContents {
		let cells: nb.ICellContents[] = this.cells?.map(c => c.toJSON());
		let metadata = Object.create(null) as nb.INotebookMetadata;
		// TODO update language and kernel when these change
		metadata.kernelspec = this._savedKernelInfo;
		delete metadata.kernelspec?.supportedLanguages;

		metadata.language_info = this.languageInfo;
		metadata.tags = this._tags;
		metadata.multi_connection_mode = this._multiConnectionMode ? this._multiConnectionMode : undefined;
		if (this.configurationService.getValue(saveConnectionNameConfigName)) {
			metadata.connection_name = this._savedConnectionName;
		}
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
				changeInfo.isDirty = this._isLoading ? false : true;
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
			cells: cell ? [cell] : []
		};

		this._contentChangedEmitter.fire(changeInfo);
	}

	public undo(): void {
		if (this.undoService.canUndo(this.notebookUri)) {
			this.undoService.undo(this.notebookUri);
		}
	}

	public redo(): void {
		if (this.undoService.canRedo(this.notebookUri)) {
			this.undoService.redo(this.notebookUri);
		}
	}
}
