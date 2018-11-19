
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Event, Emitter } from 'vs/base/common/event';
import URI from 'vs/base/common/uri';

import { nb } from 'sqlops';
import { ICellModelOptions, IModelFactory, FutureInternal } from './modelInterfaces';
import * as notebookUtils from '../notebookUtils';
import { CellTypes, CellType, NotebookChangeType } from 'sql/parts/notebook/models/contracts';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';

let modelId = 0;


export class CellModel implements ICellModel {
	private static LanguageMapping: Map<string, string>;

	private _cellType: nb.CellType;
	private _source: string;
	private _language: string;
	private _future: FutureInternal;
	private _outputs: nb.ICellOutput[] = [];
	private _isEditMode: boolean;
	private _onOutputsChanged = new Emitter<ReadonlyArray<nb.ICellOutput>>();
	private _onCellModeChanged = new Emitter<boolean>();
	public id: string;
	private _isTrusted: boolean;
	private _active: boolean;
	private _cellUri: URI;

	constructor(private factory: IModelFactory, cellData?: nb.ICell, private _options?: ICellModelOptions) {
		this.id = `${modelId++}`;
		CellModel.CreateLanguageMappings();
		// Do nothing for now
		if (cellData) {
			this.fromJSON(cellData);
		} else {
			this._cellType = CellTypes.Code;
			this._source = '';
		}
		this._isEditMode = this._cellType !== CellTypes.Markdown;
		this.setDefaultLanguage();
		if (_options && _options.isTrusted) {
			this._isTrusted = true;
		} else {
			this._isTrusted = false;
		}
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
		return this._language;
	}

	public set language(newLanguage: string) {
		this._language = newLanguage;
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
			this._outputs.push(output);
			this.fireOutputsChanged();
		}
	}

	private getDisplayId(msg: nb.IIOPubMessage): string | undefined {
		let transient = (msg.content.transient || {});
		return transient['display_id'] as string;
	}

	public toJSON(): nb.ICell {
		let cellJson: Partial<nb.ICell> = {
			cell_type: this._cellType,
			source: this._source,
			metadata: {
			}
		};
		if (this._cellType === CellTypes.Code) {
			cellJson.metadata.language = this._language,
			cellJson.outputs = this._outputs;
			cellJson.execution_count = 1; // TODO: keep track of actual execution count
		}
		return cellJson as nb.ICell;
	}

	public fromJSON(cell: nb.ICell): void {
		if (!cell) {
			return;
		}
		this._cellType = cell.cell_type;
		this._source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
		this._language = (cell.metadata && cell.metadata.language) ? cell.metadata.language : 'python';
		if (cell.outputs) {
			for (let output of cell.outputs) {
				// For now, we're assuming it's OK to save these as-is with no modification
				this.addOutput(output);
			}
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

	private static CreateLanguageMappings(): void {
		if (CellModel.LanguageMapping) {
			return;
		}
		CellModel.LanguageMapping = new Map<string, string>();
		CellModel.LanguageMapping['pyspark'] = 'python';
		CellModel.LanguageMapping['pyspark3'] = 'python';
		CellModel.LanguageMapping['python'] = 'python';
		CellModel.LanguageMapping['scala'] = 'scala';
	}

	private get languageInfo(): nb.ILanguageInfo {
		if (this._options && this._options.notebook && this._options.notebook.languageInfo) {
			return this._options.notebook.languageInfo;
		}
		return undefined;
	}

	private setDefaultLanguage(): void {
		this._language = 'python';
		// In languageInfo, set the language to the "name" property
		// If the "name" property isn't defined, check the "mimeType" property
		// Otherwise, default to python as the language
		let languageInfo = this.languageInfo;
		if (languageInfo) {
			if (languageInfo.name) {
				// check the LanguageMapping to determine if a mapping is necessary (example 'pyspark' -> 'python')
				if (CellModel.LanguageMapping[languageInfo.name]) {
					this._language = CellModel.LanguageMapping[languageInfo.name];
				} else {
					this._language = languageInfo.name;
				}
			} else if (languageInfo.mimetype) {
				this._language = languageInfo.mimetype;
			}
		}
		let mimeTypePrefix = 'x-';
		if (this._language.includes(mimeTypePrefix)) {
			this._language = this._language.replace(mimeTypePrefix, '');
		}
	}
}
