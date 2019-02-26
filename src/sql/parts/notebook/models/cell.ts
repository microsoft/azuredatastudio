
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'sqlops';

import { Event, Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';

import { ICellModelOptions, IModelFactory, FutureInternal, CellExecutionState } from './modelInterfaces';
import * as notebookUtils from '../notebookUtils';
import { CellTypes, CellType, NotebookChangeType } from 'sql/parts/notebook/models/contracts';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { Schemas } from 'vs/base/common/network';
let modelId = 0;


export class CellModel implements ICellModel {
	private _cellType: nb.CellType;
	private _source: string;
	private _language: string;
	private _future: FutureInternal;
	private _outputs: nb.ICellOutput[] = [];
	private _isEditMode: boolean;
	private _onOutputsChanged = new Emitter<ReadonlyArray<nb.ICellOutput>>();
	private _onCellModeChanged = new Emitter<boolean>();
	private _onExecutionStateChanged = new Emitter<CellExecutionState>();
	private _isTrusted: boolean;
	private _active: boolean;
	private _hover: boolean;
	private _executionCount: number | undefined;
	private _cellUri: URI;
	public id: string;

	constructor(private factory: IModelFactory, cellData?: nb.ICellContents, private _options?: ICellModelOptions) {
		this.id = `${modelId++}`;
		if (cellData) {
			// Read in contents if available
			this.fromJSON(cellData);
		} else {
			this._cellType = CellTypes.Code;
			this._source = '';
		}
		this._isEditMode = this._cellType !== CellTypes.Markdown;
		if (_options && _options.isTrusted) {
			this._isTrusted = true;
		} else {
			this._isTrusted = false;
		}
		this.createUri();
	}

	public equals(other: ICellModel) {
		return other && other.id === this.id;
	}

	public get onOutputsChanged(): Event<ReadonlyArray<nb.ICellOutput>> {
		return this._onOutputsChanged.event;
	}

	public get onCellModeChanged(): Event<boolean> {
		return this._onCellModeChanged.event;
	}

	public get isEditMode(): boolean {
		return this._isEditMode;
	}

	public get future(): FutureInternal {
		return this._future;
	}

	public set isEditMode(isEditMode: boolean) {
		this._isEditMode = isEditMode;
		this._onCellModeChanged.fire(this._isEditMode);
		// Note: this does not require a notebook update as it does not change overall state
	}

	public get trustedMode(): boolean {
		return this._isTrusted;
	}

	public set trustedMode(isTrusted: boolean) {
		if (this._isTrusted !== isTrusted) {
			this._isTrusted = isTrusted;
			this._onOutputsChanged.fire(this._outputs);
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
		this.fireExecutionStateChanged();
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

	public set cellUri(value: URI) {
		this._cellUri = value;
	}

	public get options(): ICellModelOptions {
		return this._options;
	}

	public get cellType(): CellType {
		return this._cellType;
	}

	public get source(): string {
		return this._source;
	}

	public set source(newSource: string) {
		if (this._source !== newSource) {
			this._source = newSource;
			this.sendChangeToNotebook(NotebookChangeType.CellSourceUpdated);
		}
	}

	public get language(): string {
		if (this._cellType === CellTypes.Markdown) {
			return 'markdown';
		}
		if (this._language) {
			return this._language;
		}
		return this.options.notebook.language;
	}

	public setOverrideLanguage(newLanguage: string) {
		this._language = newLanguage;
	}

	public get onExecutionStateChange(): Event<CellExecutionState> {
		return this._onExecutionStateChanged.event;
	}

	private fireExecutionStateChanged(): void {
		this._onExecutionStateChanged.fire(this.executionState);
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

	public async runCell(notificationService?: INotificationService): Promise<boolean> {
		try {
			if (this.cellType !== CellTypes.Code) {
				// TODO should change hidden state to false if we add support
				// for this property
				return false;
			}
			let kernel = await this.getOrStartKernel(notificationService);
			if (!kernel) {
				return false;
			}
			// If cell is currently running and user clicks the stop/cancel button, call kernel.interrupt()
			// This matches the same behavior as JupyterLab
			if (this.future && this.future.inProgress) {
				this.future.inProgress = false;
				await kernel.interrupt();
			} else {
				// TODO update source based on editor component contents
				let content = this.source;
				if (content) {
					this.fireExecutionStateChanged();
					let future = await kernel.requestExecute({
						code: content,
						stop_on_error: true
					}, false);
					this.setFuture(future as FutureInternal);
					// For now, await future completion. Later we should just track and handle cancellation based on model notifications
					let result: nb.IExecuteReplyMsg = <nb.IExecuteReplyMsg><any>await future.done;
					if (result && result.content) {
						this.executionCount = result.content.execution_count;
						if (result.content.status !== 'ok') {
							// TODO track error state
							return false;
						}
					}
				}
			}
		} catch (error) {
			if (error.message === 'Canceled') {
				// swallow the error
			}
			let message = notebookUtils.getErrorMessage(error);
			this.sendNotification(notificationService, Severity.Error, message);
			// TODO track error state for the cell
			throw error;
		} finally {
			this.fireExecutionStateChanged();
		}

		return true;
	}

	private async getOrStartKernel(notificationService: INotificationService): Promise<nb.IKernel> {
		let model = this.options.notebook;
		let clientSession = model && model.clientSession;
		if (!clientSession) {
			this.sendNotification(notificationService, Severity.Error, localize('notebookNotReady', 'The session for this notebook is not yet ready'));
			return undefined;
		} else if (!clientSession.isReady || clientSession.status === 'dead') {

			this.sendNotification(notificationService, Severity.Info, localize('sessionNotReady', 'The session for this notebook will start momentarily'));
			await clientSession.kernelChangeCompleted;
		}
		if (!clientSession.kernel) {
			let defaultKernel = model && model.defaultKernel && model.defaultKernel.name;
			if (!defaultKernel) {
				this.sendNotification(notificationService, Severity.Error, localize('noDefaultKernel', 'No kernel is available for this notebook'));
				return undefined;
			}
			await clientSession.changeKernel({
				name: defaultKernel
			});
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
		this.clearOutputs();
		this._future = future;
		future.setReplyHandler({ handle: (msg) => this.handleReply(msg) });
		future.setIOPubHandler({ handle: (msg) => this.handleIOPub(msg) });
	}

	public clearOutputs(): void {
		this._outputs = [];
		this.fireOutputsChanged();
	}

	private fireOutputsChanged(): void {
		this._onOutputsChanged.fire(this.outputs);
		this.sendChangeToNotebook(NotebookChangeType.CellOutputUpdated);
	}

	private sendChangeToNotebook(change: NotebookChangeType): void {
		if (this._options && this._options.notebook) {
			this._options.notebook.onCellChange(this, change);
		}
	}

	public get outputs(): Array<nb.ICellOutput> {
		return this._outputs;
	}

	private handleReply(msg: nb.IShellMessage): void {
		// TODO #931 we should process this. There can be a payload attached which should be added to outputs.
		// In all other cases, it is a no-op
		let output: nb.ICellOutput = msg.content as nb.ICellOutput;

		if (!this._future.inProgress) {
			this._future.dispose();
			this._future = undefined;
		}
	}

	private handleIOPub(msg: nb.IIOPubMessage): void {
		let msgType = msg.header.msg_type;
		let displayId = this.getDisplayId(msg);
		let output: nb.ICellOutput;
		switch (msgType) {
			case 'execute_result':
			case 'display_data':
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
		if (output) {
			// deletes transient node in the serialized JSON
			delete output['transient'];
			this._outputs.push(this.rewriteOutputUrls(output));
			this.fireOutputsChanged();
		}
	}

	private rewriteOutputUrls(output: nb.ICellOutput): nb.ICellOutput {
		// Only rewrite if this is coming back during execution, not when loading from disk.
		// A good approximation is that the model has a future (needed for execution)
		if (this.future) {
			try {
				let result = output as nb.IDisplayResult;
				if (result && result.data && result.data['text/html']) {
					let model = (this as CellModel).options.notebook as NotebookModel;
					if (model.activeConnection) {
						let host = model.activeConnection.serverName;
						let html = result.data['text/html'];
						html = html.replace(/(https?:\/\/mssql-master.*\/proxy)(.*)/g, function (a, b, c) {
							let ret = '';
							if (b !== '') {
								ret = 'https://' + host + ':30443/gateway/default/yarn/proxy';
							}
							if (c !== '') {
								ret = ret + c;
							}
							return ret;
						});
						(<nb.IDisplayResult>output).data['text/html'] = html;
					}
				}
			}
			catch (e) { }
		}
		return output;
	}

	private getDisplayId(msg: nb.IIOPubMessage): string | undefined {
		let transient = (msg.content.transient || {});
		return transient['display_id'] as string;
	}

	public toJSON(): nb.ICellContents {
		let cellJson: Partial<nb.ICellContents> = {
			cell_type: this._cellType,
			source: this._source,
			metadata: {
			}
		};
		if (this._cellType === CellTypes.Code) {
			cellJson.metadata.language = this._language,
				cellJson.outputs = this._outputs;
			cellJson.execution_count = this.executionCount;
		}
		return cellJson as nb.ICellContents;
	}

	public fromJSON(cell: nb.ICellContents): void {
		if (!cell) {
			return;
		}
		this._cellType = cell.cell_type;
		this.executionCount = cell.execution_count;
		this._source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
		this.setLanguageFromContents(cell);
		if (cell.outputs) {
			for (let output of cell.outputs) {
				// For now, we're assuming it's OK to save these as-is with no modification
				this.addOutput(output);
			}
		}
	}

	private setLanguageFromContents(cell: nb.ICellContents): void {
		if (cell.cell_type === CellTypes.Markdown) {
			this._language = 'markdown';
		} else if (cell.metadata && cell.metadata.language) {
			this._language = cell.metadata.language;
		}
		// else skip, we set default language anyhow
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
		let uri = URI.from({ scheme: Schemas.untitled, path: `notebook-editor-${this.id}` });
		// Use this to set the internal (immutable) and public (shared with extension) uri properties
		this.cellUri = uri;
	}
}
