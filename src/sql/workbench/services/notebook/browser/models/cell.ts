/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';

import { Event, Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';

import * as notebookUtils from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import { CellTypes, CellType, NotebookChangeType, TextCellEditModes } from 'sql/workbench/services/notebook/common/contracts';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { ICellModel, IOutputChangedEvent, CellExecutionState, ICellModelOptions, ITableUpdatedEvent, CellEditModes, ICaretPosition, ICellEdit, CellEditType } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { Schemas } from 'vs/base/common/network';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { getErrorMessage, onUnexpectedError } from 'vs/base/common/errors';
import { generateUuid } from 'vs/base/common/uuid';
import { HideInputTag, ParametersTag, InjectedParametersTag } from 'sql/platform/notebooks/common/outputRegistry';
import { FutureInternal } from 'sql/workbench/services/notebook/browser/interfaces';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { tryMatchCellMagic, extractCellMagicCommandPlusArgs } from 'sql/workbench/services/notebook/browser/utils';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Disposable } from 'vs/base/common/lifecycle';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IInsightOptions } from 'sql/workbench/common/editor/query/chartState';
import { IPosition } from 'vs/editor/common/core/position';
import { CellOutputEdit, CellOutputDataEdit } from 'sql/workbench/services/notebook/browser/models/cellEdit';
import { ILogService } from 'vs/platform/log/common/log';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { ICellMetadata } from 'sql/workbench/api/common/sqlExtHostTypes';
import { alert } from 'vs/base/browser/ui/aria/aria';
import { CELL_URI_PATH_PREFIX } from 'sql/workbench/common/constants';
import { IModelContentChangedEvent } from 'vs/editor/common/textModelEvents';

let modelId = 0;
const ads_execute_command = 'ads_execute_command';
const validBase64OctetStreamRegex = /data:(?:(application\/octet-stream|image\/png));base64,(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=|[A-Za-z0-9+\/]{4})/;
export interface QueryResultId {
	batchId: number;
	id: number;
}

export class CellModel extends Disposable implements ICellModel {
	public id: string;
	public cellLabel: string;

	private _cellType: nb.CellType;
	private _source: string | string[];
	private _language: string;
	private _savedConnectionName: string | undefined;
	private _cellGuid: string;
	private _future: FutureInternal;
	private _outputs: nb.ICellOutput[] = [];
	private _outputsIdMap: Map<nb.ICellOutput, QueryResultId> = new Map<nb.ICellOutput, QueryResultId>();
	private _renderedOutputTextContent: string[] = [];
	private _isEditMode: boolean;
	private _onOutputsChanged = new Emitter<IOutputChangedEvent>();
	private _onTableUpdated = new Emitter<ITableUpdatedEvent>();
	private _onCellEditModeChanged = new Emitter<boolean>();
	private _onExecutionStateChanged = new Emitter<CellExecutionState>();
	private _onCurrentEditModeChanged = new Emitter<CellEditModes>();
	private _isTrusted: boolean;
	private _active: boolean;
	private _hover: boolean;
	private _executionCount: number | undefined;
	private _cellUri: URI;
	private _stdInHandler: nb.MessageHandler<nb.IStdinMessage>;
	private _onCellLoaded = new Emitter<string>();
	private _loaded: boolean;
	private _stdInVisible: boolean;
	private _metadata: ICellMetadata;
	private _isCollapsed: boolean;
	private _onLanguageChanged = new Emitter<string>();
	private _onCollapseStateChanged = new Emitter<boolean>();
	private _modelContentChangedEvent: IModelContentChangedEvent;
	private _isCommandExecutionSettingEnabled: boolean = false;
	private _showPreview: boolean = true;
	private _showMarkdown: boolean = false;
	private _cellSourceChanged: boolean = false;
	private _defaultTextEditMode: string;
	private _isParameter: boolean;
	private _onParameterStateChanged = new Emitter<boolean>();
	private _isInjectedParameter: boolean;
	private _previousChartState: IInsightOptions[] = [];
	private _outputCounter = 0; // When re-executing the same cell, ensure that we apply chart options in the same order
	private _attachments: nb.ICellAttachments | undefined;
	private _preventNextChartCache: boolean = false;
	private _lastEditMode: string | undefined;
	public richTextCursorPosition: ICaretPosition | undefined;
	public markdownCursorPosition: IPosition | undefined;
	public cellPreviewUpdated = new Emitter<void>();

	constructor(cellData: nb.ICellContents,
		private _options: ICellModelOptions,
		@INotebookService private _notebookService?: INotebookService,
		@ICommandService private _commandService?: ICommandService,
		@IConfigurationService private _configurationService?: IConfigurationService,
		@ILogService private _logService?: ILogService,
		@ILanguageService private _languageService?: ILanguageService
	) {
		super();
		this.id = `${modelId++}`;
		if (cellData) {
			// Read in contents if available
			this.fromJSON(cellData);
		} else {
			this._cellType = CellTypes.Code;
			this._source = '';
		}

		this._isEditMode = false;
		this._stdInVisible = false;
		if (_options && _options.isTrusted) {
			this._isTrusted = true;
		} else {
			this._isTrusted = false;
		}
		// if the fromJson() method was already called and _cellGuid was previously set, don't generate another UUID unnecessarily
		this._cellGuid = this._cellGuid || generateUuid();
		if (this._cellType === 'code') {
			this.cellLabel = localize('codeCellLabel', "Code Cell {0}", this.id);
		} else {
			this.cellLabel = localize('mdCellLabel', "Markdown Cell {0}", this.id);
		}
		this.createUri();
		this.populatePropertiesFromSettings();
	}

	public equals(other: ICellModel) {
		return other !== undefined && other.id === this.id;
	}

	public get onLanguageChanged(): Event<string> {
		return this._onLanguageChanged.event;
	}

	public get onCollapseStateChanged(): Event<boolean> {
		return this._onCollapseStateChanged.event;
	}

	public get onOutputsChanged(): Event<IOutputChangedEvent> {
		return this._onOutputsChanged.event;
	}

	public get onTableUpdated(): Event<ITableUpdatedEvent> {
		return this._onTableUpdated.event;
	}

	public get onCellEditModeChanged(): Event<boolean> {
		return this._onCellEditModeChanged.event;
	}

	public set metadata(data: any) {
		this._metadata = data;
		this.sendChangeToNotebook(NotebookChangeType.CellMetadataUpdated);
	}

	public get metadata(): any {
		return this._metadata;
	}

	public get attachments(): nb.ICellAttachments | undefined {
		return this._attachments;
	}

	public set attachments(attachments: nb.ICellAttachments | undefined) {
		this._attachments = attachments ?? {};
	}

	addAttachment(mimeType: string, base64Encoding: string, name: string): string {
		// base64Encoded value looks like: data:application/octet-stream;base64,<base64Value>
		// get the <base64Value> from the string
		let index = base64Encoding.indexOf('base64,');
		if (this.isValidBase64OctetStream(base64Encoding)) {
			base64Encoding = base64Encoding.substring(index + 7);
			let attachment: nb.ICellAttachment = {};
			attachment[mimeType] = base64Encoding;
			if (!this._attachments) {
				this._attachments = {};
			}
			// Check if name already exists and get a unique name
			if (this._attachments[name] && this._attachments[name][mimeType] !== attachment[mimeType]) {
				name = this.getUniqueAttachmentName(name.substring(0, name.lastIndexOf('.')), name.substring(name.lastIndexOf('.') + 1));
			}
			if (!this._attachments[name]) {
				this._attachments[name] = attachment;
				this.sendChangeToNotebook(NotebookChangeType.CellMetadataUpdated);
			}
		}
		return name;
	}

	private isValidBase64OctetStream(base64Image: string): boolean {
		return base64Image && validBase64OctetStreamRegex.test(base64Image);
	}

	public get isEditMode(): boolean {
		return this._isEditMode;
	}

	public get future(): FutureInternal {
		return this._future;
	}

	public get isCollapsed() {
		return this._isCollapsed;
	}

	public set isCollapsed(value: boolean) {
		if (this.cellType !== CellTypes.Code) {
			return;
		}
		let stateChanged = this._isCollapsed !== value;
		this._isCollapsed = value;

		let tagIndex = -1;
		if (this._metadata.tags) {
			tagIndex = this._metadata.tags.findIndex(tag => tag === HideInputTag);
		}

		if (this._isCollapsed) {
			if (tagIndex === -1) {
				if (!this._metadata.tags) {
					this._metadata.tags = [];
				}
				this._metadata.tags.push(HideInputTag);
			}
		} else {
			if (tagIndex > -1) {
				this._metadata.tags.splice(tagIndex, 1);
			}
		}

		if (stateChanged) {
			this._onCollapseStateChanged.fire(this._isCollapsed);
			this.sendChangeToNotebook(NotebookChangeType.CellInputVisibilityChanged);
		}
	}

	public set isEditMode(isEditMode: boolean) {
		if (this._isEditMode !== isEditMode) {
			this._isEditMode = isEditMode;
			if (this._isEditMode) {
				const newEditMode = this._lastEditMode ?? this._defaultTextEditMode;
				this.showPreview = newEditMode !== TextCellEditModes.Markdown;
				this.showMarkdown = newEditMode !== TextCellEditModes.RichText;
			} else {
				// when not in edit mode, default the values since they are only valid when editing.
				// And to return the correct currentMode value.
				this._showMarkdown = false;
				this._showPreview = true;
			}
			this._onCellEditModeChanged.fire(this._isEditMode);
			// Note: this does not require a notebook update as it does not change overall state
		}
	}

	public get trustedMode(): boolean {
		return this._isTrusted;
	}

	public set trustedMode(isTrusted: boolean) {
		if (this._isTrusted !== isTrusted) {
			this._isTrusted = isTrusted;
			let outputEvent: IOutputChangedEvent = {
				outputs: this._outputs,
				shouldScroll: false
			};
			this._onOutputsChanged.fire(outputEvent);
		}
	}

	public get active(): boolean {
		return this._active;
	}

	public set active(value: boolean) {
		this._active = value;
		this.fireExecutionStateChanged();
	}

	public get hover(): boolean {
		return this._hover;
	}

	public set hover(value: boolean) {
		this._hover = value;
		// The Run button is always visible while the cell is active, so we only need to emit this event for inactive cells
		if (!this.active) {
			this.fireExecutionStateChanged();
		}
	}

	public get executionCount(): number | undefined {
		return this._executionCount;
	}

	public set executionCount(value: number | undefined) {
		this._executionCount = value;
		this.fireExecutionStateChanged();
	}

	public get cellUri(): URI {
		return this._cellUri;
	}

	public get notebookModel(): NotebookModel {
		return this._options && <NotebookModel>this._options.notebook;
	}

	public set cellUri(value: URI) {
		this._cellUri = value;
	}

	public get cellType(): CellType {
		return this._cellType;
	}

	public set cellType(type: CellType) {
		if (type !== this._cellType) {
			this._cellType = type;
			// Regardless, get rid of outputs; this matches Jupyter behavior
			this._outputs = [];
			this._outputsIdMap.clear();
		}
	}

	public get source(): string | string[] {
		return this._source;
	}

	public set source(newSource: string | string[]) {
		this.updateAttachmentsFromSource(Array.isArray(newSource) ? newSource.join() : newSource);
		newSource = this.attachImageFromSource(newSource);
		newSource = this.getMultilineSource(newSource);
		if (this._source !== newSource) {
			this._source = newSource;
			this.sendChangeToNotebook(NotebookChangeType.CellSourceUpdated);
			this.cellSourceChanged = true;
		}
		this._modelContentChangedEvent = undefined;
		this._preventNextChartCache = true;
	}

	private attachImageFromSource(newSource: string | string[]): string | string[] {
		if (!Array.isArray(newSource) && this.isValidBase64OctetStream(newSource)) {
			let results;
			// only replace the base64 value if it's from markdown [](base64value) not html tags <img src="base64value">
			let validImageTag = /<img\s+[^>]*src="([^"]*)"[^>]*>/;
			let imageResults;
			// Note: Currently this will not process any markdown image attachments that are below an HTML img element.
			// This is acceptable for now given the low risk of this happening and an easy workaround being to just changing the img element to a markdown embedded image instead
			while ((results = validBase64OctetStreamRegex.exec(newSource)) !== null && ((imageResults = validImageTag.exec(newSource)) !== null && this.isValidBase64OctetStream(imageResults[1]) && results[0] !== imageResults[1])) {
				let imageName = this.addAttachment(results[1], results[0], 'image.png');
				newSource = newSource.replace(validBase64OctetStreamRegex, `attachment:${imageName}`);
			}
			return newSource;
		}
		return newSource;
	}

	public updateAttachmentsFromSource(source: string, attachments?: nb.ICellAttachments): void {
		const originalAttachments = attachments ? attachments : this._attachments;
		this._attachments = {};
		// Find existing attachments in the form ![...](attachment:...) so that we can make sure we keep those attachments
		const attachmentRegex = /!\[.*?\]\(attachment:(.*?)\)/g;
		let match;
		while (match = attachmentRegex.exec(source)) { // eslint-disable-line no-cond-assign
			this._attachments[match[1]] = originalAttachments[match[1]];
		}
	}

	/**
	 * Gets unique attachment name to add to cell metadata
	 * @param imgName a string defining name of the image.
	 * @param imgExtension extension of the image
	 * Returns the unique name
	 */
	private getUniqueAttachmentName(imgName?: string, imgExtension?: string): string {
		let nextVal = 0;
		// Note: this will go forever if it's coded wrong, or you have infinite images in a notebook!
		while (true) {
			let imageName = imgName ? `${imgName}${nextVal}.${imgExtension ?? 'png'}` : `image${nextVal}.png`;
			if (!this._attachments || !this._attachments[imageName]) {
				return imageName;
			}
			nextVal++;
		}
	}

	public get modelContentChangedEvent(): IModelContentChangedEvent {
		return this._modelContentChangedEvent;
	}

	public set modelContentChangedEvent(e: IModelContentChangedEvent) {
		this._modelContentChangedEvent = e;
	}

	public get language(): string {
		if (this._cellType === CellTypes.Markdown) {
			return 'markdown';
		}
		if (this._language) {
			return this._language;
		}
		return this._options.notebook.language;
	}

	public get displayLanguage(): string {
		let result: string;
		if (this._cellType === CellTypes.Markdown) {
			result = 'Markdown';
		} else if (this._languageService) {
			let language = this._languageService.getLanguageName(this.language);
			result = language ?? this.language;
		} else {
			result = this.language;
		}
		return result;
	}

	public get savedConnectionName(): string | undefined {
		return this._savedConnectionName;
	}

	public get cellGuid(): string {
		return this._cellGuid;
	}

	public setOverrideLanguage(newLanguage: string) {
		if (newLanguage !== this._language) {
			this._language = newLanguage;
			this._onLanguageChanged.fire(newLanguage);
			this.sendChangeToNotebook(NotebookChangeType.CellMetadataUpdated);
		}
	}

	public get onExecutionStateChange(): Event<CellExecutionState> {
		return this._onExecutionStateChanged.event;
	}

	public get onCurrentEditModeChanged(): Event<CellEditModes> {
		return this._onCurrentEditModeChanged.event;
	}

	private fireExecutionStateChanged(): void {
		this._onExecutionStateChanged.fire(this.executionState);
	}

	public get onLoaded(): Event<string> {
		return this._onCellLoaded.event;
	}

	public get loaded(): boolean {
		return this._loaded;
	}

	public set loaded(val: boolean) {
		this._loaded = val;
		if (val) {
			this._onCellLoaded.fire(this._cellType);
		}
	}

	public get stdInVisible(): boolean {
		return this._stdInVisible;
	}

	public set stdInVisible(val: boolean) {
		this._stdInVisible = val;
	}

	public get showPreview(): boolean {
		return this._showPreview;
	}

	public set showPreview(val: boolean) {
		this._showPreview = val;
		this.doModeUpdates();
	}

	public get showMarkdown(): boolean {
		return this._showMarkdown;
	}

	public set showMarkdown(val: boolean) {
		this._showMarkdown = val;
		this.doModeUpdates();
	}

	private doModeUpdates() {
		if (this._isEditMode) {
			this._lastEditMode = this._showPreview && this._showMarkdown ? TextCellEditModes.SplitView : (this._showMarkdown ? TextCellEditModes.Markdown : TextCellEditModes.RichText);
		}
		this._onCurrentEditModeChanged.fire(this.currentMode);
	}

	public get defaultTextEditMode(): string {
		return this._defaultTextEditMode;
	}

	public get cellSourceChanged(): boolean {
		return this._cellSourceChanged;
	}
	public set cellSourceChanged(val: boolean) {
		this._cellSourceChanged = val;
	}

	public get onCellPreviewUpdated(): Event<void> {
		return this.cellPreviewUpdated.event;
	}

	public get onParameterStateChanged(): Event<boolean> {
		return this._onParameterStateChanged.event;
	}

	public get isParameter() {
		return this._isParameter;
	}

	public set isParameter(value: boolean) {
		if (this.cellType !== CellTypes.Code) {
			return;
		}

		/**
		 * The value will not be updated if there is already a parameter cell in the Notebook.
		**/
		value = this.notebookModel?.cells?.find(cell => cell.isParameter) ? false : value;

		let stateChanged = this._isParameter !== value;
		this._isParameter = value;

		let tagIndex = -1;
		if (this._metadata.tags) {
			tagIndex = this._metadata.tags.findIndex(tag => tag === ParametersTag);
		}

		if (this._isParameter) {
			if (tagIndex === -1) {
				if (!this._metadata.tags) {
					this._metadata.tags = [];
				}
				this._metadata.tags.push(ParametersTag);
			}
		} else {
			if (tagIndex > -1) {
				this._metadata.tags.splice(tagIndex, 1);
			}
		}

		if (stateChanged) {
			this._onParameterStateChanged.fire(this._isParameter);
			this.sendChangeToNotebook(NotebookChangeType.CellInputVisibilityChanged);
		}
	}

	/**
	Injected Parameters will be used for future scenarios
	when we need to hide this cell for Parameterization
	*/
	public get isInjectedParameter() {
		return this._isInjectedParameter;
	}

	public set isInjectedParameter(value: boolean) {
		if (this.cellType !== CellTypes.Code) {
			return;
		}
		this._isInjectedParameter = value;

		let tagIndex = -1;
		if (this._metadata.tags) {
			tagIndex = this._metadata.tags.findIndex(tag => tag === InjectedParametersTag);
		}

		if (this._isInjectedParameter) {
			if (tagIndex === -1) {
				if (!this._metadata.tags) {
					this._metadata.tags = [];
				}
				this._metadata.tags.push(InjectedParametersTag);
			}
		} else {
			if (tagIndex > -1) {
				this._metadata.tags.splice(tagIndex, 1);
			}
		}
	}

	private notifyExecutionComplete(): void {
		if (this._notebookService) {
			this._notebookService.serializeNotebookStateChange(this.notebookModel.notebookUri, NotebookChangeType.CellExecuted, this)
				.catch(e => onUnexpectedError(e));
		}
	}

	public get executionState(): CellExecutionState {
		let isRunning = !!(this._future && this._future.inProgress);
		if (isRunning) {
			return CellExecutionState.Running;
		} else if (this.active || this.hover) {
			return CellExecutionState.Stopped;
		}
		// TODO save error state and show the error
		return CellExecutionState.Hidden;
	}

	public async runCell(notificationService?: INotificationService, connectionManagementService?: IConnectionManagementService): Promise<boolean> {
		let kernel: nb.IKernel | undefined;
		try {
			// Allow screen reader to announce when cell execution is started
			alert(localize('cellExecutionStarted', "Cell execution started"));
			if (!this.active && this !== this.notebookModel.activeCell) {
				this.notebookModel.updateActiveCell(this);
				this.active = true;
			}

			if (this.cellType !== CellTypes.Code) {
				// TODO should change hidden state to false if we add support
				// for this property
				return false;
			}
			kernel = await this.getOrStartKernel(notificationService);
			if (!kernel) {
				return false;
			}
			this._outputCounter = 0;
			// Hide IntelliSense suggestions list when running cell to match SSMS behavior
			this._commandService.executeCommand('hideSuggestWidget');
			this.notebookModel.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.RunCell, { cell_language: kernel.name, azdata_cell_guid: this._cellGuid });
			// If cell is currently running and user clicks the stop/cancel button, call kernel.interrupt()
			// This matches the same behavior as JupyterLab
			if (this.future && this.future.inProgress) {
				// If stdIn is visible, to prevent a kernel hang, we need to send a dummy input reply
				if (this._stdInVisible && this._stdInHandler) {
					this.future.sendInputReply({ value: '' });
				}
				this.future.inProgress = false;
				await kernel.interrupt();
				this.sendNotification(notificationService, Severity.Info, localize('runCellCancelled', "Cell execution cancelled"));
			} else {
				// TODO update source based on editor component contents
				if (kernel.requiresConnection && !this.notebookModel.context) {
					let connected = await this.notebookModel.requestConnection();
					if (!connected) {
						return false;
					}
				}
				let content = this.source;
				if ((Array.isArray(content) && content.length > 0) || (!Array.isArray(content) && content)) {
					this.notebookModel.trustedMode = true;

					// requestExecute expects a string for the code parameter
					content = Array.isArray(content) ? content.join('') : content;
					if (tryMatchCellMagic(this.source[0]) !== ads_execute_command || !this._isCommandExecutionSettingEnabled) {
						const future = kernel.requestExecute({
							code: content,
							stop_on_error: true,
							language: this.language
						}, false);
						this.setFuture(future as FutureInternal);
						this.fireExecutionStateChanged();
						this.notebookModel.onCellChange(this, NotebookChangeType.CellExecutionStarted);
						this._notebookService?.notifyCellExecutionStarted();
						// For now, await future completion. Later we should just track and handle cancellation based on model notifications
						let result: nb.IExecuteReplyMsg = <nb.IExecuteReplyMsg><any>await future.done;
						if (result && result.content) {
							this.executionCount = result.content.execution_count;
							if (result.content.status !== 'ok') {
								// TODO track error state
								return false;
							}
						}
					} else {
						let result = extractCellMagicCommandPlusArgs(this._source[0], ads_execute_command);
						// Similar to the markdown renderer, we should not allow downloadResource here
						if (result?.commandId !== '_workbench.downloadResource') {
							try {
								// Need to reset outputs here (kernels do this on their own)
								this._outputs = [];
								this._outputsIdMap.clear();
								let commandExecuted = this._commandService?.executeCommand(result.commandId, result.args);
								// This will ensure that the run button turns into a stop button
								this.fireExecutionStateChanged();
								this._notebookService?.notifyCellExecutionStarted();
								await commandExecuted;
								// For save files, if we output a message after saving the file, the file becomes dirty again.
								// Special casing this to avoid this particular issue.
								if (result?.commandId !== 'workbench.action.files.saveFiles') {
									this.handleIOPub(this.toIOPubMessage(false));
								}
							} catch (error) {
								this.handleIOPub(this.toIOPubMessage(true, error?.message));
								return false;
							}
						}
					}
				}
			}
		} catch (error) {
			let message: string;
			if (error.message === 'Canceled') {
				message = localize('executionCanceled', "Query execution was canceled");
			} else {
				message = getErrorMessage(error);
			}
			this.notebookModel.sendNotebookTelemetryActionEvent(TelemetryKeys.NbTelemetryAction.CellExecutionFailed, { kernel: kernel, reason: error.message === 'Canceled' ? 'Canceled' : 'Other' });
			this.sendNotification(notificationService, Severity.Error, message);
			// TODO track error state for the cell
		} finally {
			this.disposeFuture();
			this.fireExecutionStateChanged();
			// Serialize cell output once the cell is done executing
			this.sendChangeToNotebook(NotebookChangeType.CellOutputUpdated);
			this.notifyExecutionComplete();
			// Allow screen reader to announce when a cell is done running
			alert(localize('cellExecutionComplete', "Cell execution is complete"));
		}

		return true;
	}

	private async getOrStartKernel(notificationService: INotificationService): Promise<nb.IKernel> {
		let model = this._options.notebook;
		if (model) {
			await model.sessionLoadFinished;
		}
		let clientSession = model && model.clientSession;
		if (!clientSession) {
			this.sendNotification(notificationService, Severity.Error, localize('notebookNotReady', "The session for this notebook is not yet ready"));
			return undefined;
		} else if (!clientSession.isReady || clientSession.status === 'dead') {
			this.sendNotification(notificationService, Severity.Info, localize('sessionNotReady', "The session for this notebook will start momentarily"));
			await clientSession.kernelChangeCompleted;
		}
		if (!clientSession.kernel) {
			let defaultKernel = model && model.defaultKernel;
			if (!defaultKernel) {
				this.sendNotification(notificationService, Severity.Error, localize('noDefaultKernel', "No kernel is available for this notebook"));
				return undefined;
			}
			await clientSession.changeKernel(defaultKernel);
		}
		return clientSession.kernel;
	}

	private sendNotification(notificationService: INotificationService, severity: Severity, message: string): void {
		if (notificationService) {
			notificationService.notify({ severity: severity, message: message });
		}
	}

	/**
	 * Sets the future which will be used to update the output
	 * area for this cell
	 */
	setFuture(future: FutureInternal): void {
		if (this._future === future) {
			// Nothing to do
			return;
		}
		// Setting the future indicates the cell is running which enables trusted mode.
		// See https://jupyter-notebook.readthedocs.io/en/stable/security.html

		this._isTrusted = true;

		if (this._future) {
			this._future.dispose();
		}
		this.clearOutputs(true);
		this._future = future;
		future.setReplyHandler({ handle: (msg) => this.handleReply(msg) });
		future.setIOPubHandler({ handle: (msg) => this.handleIOPub(msg) });
		future.setStdInHandler({ handle: (msg) => this.handleStdIn(msg) });
	}
	/**
	 * Clear outputs can be done as part of the "Clear Outputs" action on a cell or as part of running a cell
	 * @param runCellPending If a cell has been run
	 */
	public clearOutputs(runCellPending = false): void {
		if (runCellPending) {
			this.cacheChartStateIfExists();
		} else {
			this.clearPreviousChartState();
		}
		this._outputs = [];
		this._outputsIdMap.clear();
		this.fireOutputsChanged();

		this.executionCount = undefined;
	}

	public get previousChartState(): any[] {
		return this._previousChartState;
	}

	private fireOutputsChanged(shouldScroll: boolean = false): void {
		let outputEvent: IOutputChangedEvent = {
			outputs: this.outputs,
			shouldScroll: !!shouldScroll
		};
		this._onOutputsChanged.fire(outputEvent);
		if (this.outputs.length === 0) {
			this.sendChangeToNotebook(NotebookChangeType.CellOutputCleared);
		}
	}

	public sendChangeToNotebook(change: NotebookChangeType): void {
		if (this._options && this._options.notebook) {
			this._options.notebook.onCellChange(this, change);
		}
	}

	public get outputs(): Array<nb.ICellOutput> {
		return this._outputs;
	}

	public getOutputId(output: nb.ICellOutput): QueryResultId | undefined {
		return this._outputsIdMap.get(output);
	}

	public get renderedOutputTextContent(): string[] {
		return this._renderedOutputTextContent;
	}

	public set renderedOutputTextContent(content: string[]) {
		this._renderedOutputTextContent = content;
	}

	private handleReply(msg: nb.IShellMessage): void {
		// TODO #931 we should process this. There can be a payload attached which should be added to outputs.
		// In all other cases, it is a no-op

		if (!this._future.inProgress) {
			this.disposeFuture();
		}
	}

	private handleIOPub(msg: nb.IIOPubMessage): void {
		let msgType = msg.header.msg_type;
		let output: nb.ICellOutput;
		let added = false;
		switch (msgType) {
			case 'execute_result':
				output = msg.content as nb.ICellOutput;
				output.output_type = msgType;
				// Check if the table already exists
				for (let i = 0; i < this._outputs.length; i++) {
					if (this._outputs[i].output_type === 'execute_result') {
						let currentOutputId: QueryResultId = this._outputsIdMap.get(this._outputs[i]);
						if (currentOutputId.batchId === (<QueryResultId>msg.metadata).batchId
							&& currentOutputId.id === (<QueryResultId>msg.metadata).id) {
							// If it does, update output with data resource and html table
							(<nb.IExecuteResult>this._outputs[i]).data = (<nb.IExecuteResult>output).data;
							added = true;
							break;
						}
					}
				}
				if (!added) {
					if (this._previousChartState[this._outputCounter]) {
						if (!output.metadata) {
							output.metadata = {};
						}
						output.metadata.azdata_chartOptions = this._previousChartState[this._outputCounter];
					}
					this._outputsIdMap.set(output, { batchId: (<QueryResultId>msg.metadata).batchId, id: (<QueryResultId>msg.metadata).id });
					this._outputCounter++;
				}
				break;
			case 'execute_result_update':
				let update = msg.content as nb.IExecuteResultUpdate;
				// Send update to gridOutput component
				this._onTableUpdated.fire({
					resultSet: update.resultSet,
					rows: update.data
				});
				break;
			case 'display_data':
				output = msg.content as nb.ICellOutput;
				output.output_type = msgType;
				// Display message outputs before grid outputs
				if (this._outputs.length > 0) {
					for (let i = 0; i < this._outputs.length; i++) {
						if (this._outputs[i].output_type === 'execute_result') {
							// Deletes transient node in the serialized JSON
							// "Optional transient data introduced in 5.1. Information not to be persisted to a notebook or other documents."
							// (https://jupyter-client.readthedocs.io/en/stable/messaging.html)
							delete output['transient'];
							this._outputs.splice(i, 0, output);
							this.fireOutputsChanged();
							added = true;
							break;
						}
					}
				}
				break;
			case 'stream':
			case 'error':
				output = msg.content as nb.ICellOutput;
				output.output_type = msgType;
				break;
			case 'clear_output':
				// TODO wait until next message before clearing
				// let wait = (msg as KernelMessage.IClearOutputMsg).content.wait;
				this.clearOutputs();
				break;
			case 'update_display_data':
				output = msg.content as nb.ICellOutput;
				output.output_type = 'display_data';
				// TODO #930 handle in-place update of displayed data
				// targets = this._displayIdMap.get(displayId);
				// if (targets) {
				//     for (let index of targets) {
				//         model.set(index, output);
				//     }
				// }
				break;
			default:
				break;
		}
		// TODO handle in-place update of displayed data
		// if (displayId && msgType === 'display_data') {
		//     targets = this._displayIdMap.get(displayId) || [];
		//     targets.push(model.length - 1);
		//     this._displayIdMap.set(displayId, targets);
		// }
		if (output && !added) {
			// deletes transient node in the serialized JSON
			delete output['transient'];
			this._outputs.push(output);
			// Only scroll on 1st output being added
			let shouldScroll = this._outputs.length === 1;
			this.fireOutputsChanged(shouldScroll);
		}
	}

	public setStdInHandler(handler: nb.MessageHandler<nb.IStdinMessage>): void {
		this._stdInHandler = handler;
	}

	/**
	 * StdIn requires user interaction, so this is deferred to upstream UI
	 * components. If one is registered the cell will call and wait on it, if not
	 * it will immediately return to unblock error handling
	 */
	private handleStdIn(msg: nb.IStdinMessage): void | Thenable<void> {
		let handler = async () => {
			if (!this._stdInHandler) {
				// No-op
				return;
			}
			try {
				await this._stdInHandler.handle(msg);
			} catch (err) {
				if (this.future) {
					// TODO should we error out in this case somehow? E.g. send Ctrl+C?
					this.future.sendInputReply({ value: '' });
				}
			}
		};

		this.sendChangeToNotebook(NotebookChangeType.CellAwaitingInput);

		return handler();
	}

	public toJSON(): nb.ICellContents {
		let metadata = this._metadata || {};
		let cellJson: Partial<nb.ICellContents> = {
			cell_type: this._cellType,
			source: this._source,
			metadata: metadata
		};
		cellJson.metadata.azdata_cell_guid = this._cellGuid;
		if (this._cellType === CellTypes.Code) {
			cellJson.metadata.language = this._language;
			cellJson.metadata.tags = metadata.tags;
			cellJson.outputs = this._outputs;
			cellJson.execution_count = this.executionCount ? this.executionCount : null;
			if (this._configurationService?.getValue('notebook.saveConnectionName')) {
				metadata.connection_name = this._savedConnectionName;
			}
		} else if (this._cellType === CellTypes.Markdown && this._attachments) {
			cellJson.attachments = this._attachments;
		}
		return cellJson as nb.ICellContents;
	}

	public fromJSON(cell: nb.ICellContents): void {
		if (!cell) {
			return;
		}
		this._cellType = cell.cell_type;
		this.executionCount = cell.execution_count;
		this._source = this.getMultilineSource(cell.source);
		this._metadata = cell.metadata || {};
		if (this._metadata.tags && this._cellType === CellTypes.Code) {
			this._isCollapsed = this._metadata.tags.some(x => x === HideInputTag);
			this._isParameter = this._metadata.tags.some(x => x === ParametersTag);
			this._isInjectedParameter = this._metadata.tags.some(x => x === InjectedParametersTag);
		} else {
			this._isCollapsed = false;
			this._isParameter = false;
			this._isInjectedParameter = false;
		}
		this._attachments = cell.attachments;
		this._cellGuid = cell.metadata && cell.metadata.azdata_cell_guid ? cell.metadata.azdata_cell_guid : generateUuid();
		this.setLanguageFromContents(cell.cell_type, cell.metadata);
		this._savedConnectionName = this._metadata.connection_name;
		if (cell.outputs) {
			for (let output of cell.outputs) {
				// For now, we're assuming it's OK to save these as-is with no modification
				this.addOutput(output);
			}
		}
	}

	public get currentMode(): CellEditModes {
		if (this._cellType === CellTypes.Code) {
			return CellEditModes.CODE;
		}
		if (this._showMarkdown && this._showPreview) {
			return CellEditModes.SPLIT;
		} else if (this._showMarkdown && !this._showPreview) {
			return CellEditModes.MARKDOWN;
		}
		// defaulting to WYSIWYG
		return CellEditModes.WYSIWYG;
	}

	public processEdits(edits: ICellEdit[]): void {
		for (const edit of edits) {
			switch (edit.type) {
				case CellEditType.Output:
					const outputEdit = edit as CellOutputEdit;
					if (outputEdit.append) {
						this._outputs.push(...outputEdit.outputs);
					} else {
						this._outputs = outputEdit.outputs;
					}

					break;
				case CellEditType.OutputData:
					const outputDataEdit = edit as CellOutputDataEdit;
					const outputIndex = this._outputs.findIndex(o => outputDataEdit.outputId === o.id);
					if (outputIndex > -1) {
						const output = this._outputs[outputIndex] as nb.IExecuteResult;
						// TODO: Append overwrites existing mime types currently
						const newData = (edit as CellOutputDataEdit).append ?
							Object.assign(output.data, outputDataEdit.data) :
							outputDataEdit.data;
						output.data = newData;
						// We create a new object so that angular detects that the content has changed
						this._outputs[outputIndex] = Object.assign({}, output);
					} else {
						this._logService.warn(`Unable to find output with ID ${outputDataEdit.outputId} when processing ReplaceOutputData`);
					}
					break;
			}
		}
		this.fireOutputsChanged(false);
	}

	private setLanguageFromContents(cellType: string, metadata: ICellMetadata): void {
		if (cellType === CellTypes.Markdown) {
			this._language = 'markdown';
		} else if (metadata?.language) {
			this._language = metadata.language;
		} else {
			this._language = this._options?.notebook?.language;
		}
	}

	private addOutput(output: nb.ICellOutput) {
		this._normalize(output);
		this._outputs.push(output);
	}

	/**
	 * Normalize an output.
	 */
	private _normalize(value: nb.ICellOutput): void {
		if (notebookUtils.isStream(value)) {
			if (Array.isArray(value.text)) {
				value.text = (value.text as string[]).join('\n');
			}
		}
	}

	private createUri(): void {
		let uri = URI.from({ scheme: Schemas.untitled, path: `${CELL_URI_PATH_PREFIX}${this.id}` });
		// Use this to set the internal (immutable) and public (shared with extension) uri properties
		this.cellUri = uri;
	}

	private getMultilineSource(source: string | string[]): string | string[] {
		if (source === undefined) {
			return [];
		}
		if (typeof source === 'string') {
			let sourceMultiline = source.split('\n');
			// If source is one line (i.e. no '\n'), return it immediately
			if (sourceMultiline.length === 1) {
				return [source];
			} else if (sourceMultiline.length === 0) {
				return [];
			}
			// Otherwise, add back all of the newlines here
			// Note: for Windows machines that require '/r/n',
			// splitting on '\n' and putting back the '\n' will still
			// retain the '\r', so that isn't lost in the process
			// Note: the last line will not include a newline at the end
			for (let i = 0; i < sourceMultiline.length - 1; i++) {
				sourceMultiline[i] += '\n';
			}
			return sourceMultiline;
		}
		return source;
	}

	// Create an iopub message to display either a display result or an error result,
	// in order to be displayed as part of a cell's outputs
	private toIOPubMessage(isError: boolean, message?: string): nb.IIOPubMessage {
		return {
			channel: 'iopub',
			type: 'iopub',
			header: <nb.IHeader>{
				msg_id: undefined,
				msg_type: isError ? 'error' : 'display_data'
			},
			content: isError ? <nb.IErrorResult>{
				output_type: 'error',
				evalue: message,
				ename: '',
				traceback: []
			} : <nb.IDisplayResult>{
				output_type: 'execute_result',
				data: {
					'text/html': localize('commandSuccessful', "Command executed successfully"),
				}
			},
			metadata: undefined,
			parent_header: undefined
		};
	}

	// Dispose and set current future to undefined
	private disposeFuture() {
		if (this._future) {
			this._future.dispose();
		}
		this._future = undefined;
	}

	private populatePropertiesFromSettings() {
		if (this._configurationService) {
			const defaultTextModeKey = 'notebook.defaultTextEditMode';
			this._defaultTextEditMode = this._configurationService.getValue(defaultTextModeKey);

			const allowADSCommandsKey = 'notebook.allowAzureDataStudioCommands';
			this._isCommandExecutionSettingEnabled = this._configurationService.getValue(allowADSCommandsKey);
			this._register(this._configurationService.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration(allowADSCommandsKey)) {
					this._isCommandExecutionSettingEnabled = this._configurationService.getValue(allowADSCommandsKey);
				} else if (e.affectsConfiguration(defaultTextModeKey)) {
					this._defaultTextEditMode = this._configurationService.getValue(defaultTextModeKey);
				}
			}));
		}
	}

	/**
	 * Cache start state for any existing charts.
	 * This ensures that data can be passed to the grid output component when a cell is re-executed
	 */
	private cacheChartStateIfExists(): void {
		this.clearPreviousChartState();
		// If a cell's source was changed, don't cache chart state
		if (!this._preventNextChartCache) {
			this._outputs?.forEach(o => {
				if (dataResourceDataExists(o)) {
					if (o.metadata?.azdata_chartOptions) {
						this._previousChartState.push(o.metadata.azdata_chartOptions);
					} else {
						this._previousChartState.push(undefined);
					}
				}
			});
		}
		this._preventNextChartCache = false;
	}

	private clearPreviousChartState(): void {
		this._previousChartState = [];
	}
}

function dataResourceDataExists(metadata: nb.ICellOutput): boolean {
	return metadata['data']?.['application/vnd.dataresource+json'];
}
