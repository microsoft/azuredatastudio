/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { OnInit, Component, Input, Inject, forwardRef, ChangeDetectorRef, SimpleChange, OnChanges, HostListener, ViewChildren, QueryList } from '@angular/core';
import { CellView } from 'sql/workbench/contrib/notebook/browser/cellViews/interfaces';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { Deferred } from 'sql/base/common/promise';
import { ICellEditorProvider } from 'sql/workbench/services/notebook/browser/notebookService';
import { CodeComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/code.component';
import { OutputComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/output.component';


export const CODE_SELECTOR: string = 'code-cell-component';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./codeCell.component.html'))
})

export class CodeCellComponent extends CellView implements OnInit, OnChanges {
	@ViewChildren(CodeComponent) private codeCells: QueryList<ICellEditorProvider>;
	@ViewChildren(OutputComponent) private outputCells: QueryList<ICellEditorProvider>;
	@Input() cellModel: ICellModel;
	@Input() set model(value: NotebookModel) {
		this._model = value;
	}
	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	@HostListener('document:keydown.escape', ['$event'])
	handleKeyboardEvent() {
		this.cellModel.active = false;
		this._model.updateActiveCell(undefined);
	}

	private _model: NotebookModel;
	private _activeCellId: string;

	public inputDeferred: Deferred<string>;
	public stdIn: nb.IStdinMessage;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
	) {
		super();
	}

	ngOnInit() {
		if (this.cellModel) {
			this._register(this.cellModel.onCollapseStateChanged((state) => {
				this._changeRef.detectChanges();
			}));
			this._register(this.cellModel.onOutputsChanged(() => {
				this._changeRef.detectChanges();
			}));
			// Register request handler, cleanup on dispose of this component
			this.cellModel.setStdInHandler({ handle: (msg) => this.handleStdIn(msg) });
			this._register({ dispose: () => this.cellModel.setStdInHandler(undefined) });
		}
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		for (let propName in changes) {
			if (propName === 'activeCellId') {
				let changedProp = changes[propName];
				this._activeCellId = changedProp.currentValue;
				break;
			}
		}
	}

	public get cellEditors(): ICellEditorProvider[] {
		let editors: ICellEditorProvider[] = [];
		if (this.codeCells) {
			editors.push(...this.codeCells.toArray());
		}
		if (this.outputCells) {
			editors.push(...this.outputCells.toArray());
		}
		return editors;
	}

	get model(): NotebookModel {
		return this._model;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}

	public layout() {

	}

	handleStdIn(msg: nb.IStdinMessage): void | Thenable<void> {
		if (msg) {
			this.stdIn = msg;
			this.inputDeferred = new Deferred();
			this.cellModel.stdInVisible = true;
			this._changeRef.detectChanges();
			return this.awaitStdIn();
		}
	}

	private async awaitStdIn(): Promise<void> {
		try {
			let value = await this.inputDeferred.promise;
			this.cellModel.future.sendInputReply({ value: value });
		} catch (err) {
			// Note: don't have a better way to handle completing input request. For now just canceling by sending empty string?
			this.cellModel.future.sendInputReply({ value: '' });
		} finally {
			// Clean up so no matter what, the stdIn request goes away
			this.stdIn = undefined;
			this.inputDeferred = undefined;
			this.cellModel.stdInVisible = false;
			this._changeRef.detectChanges();
		}
	}

	get isStdInVisible(): boolean {
		return this.cellModel.stdInVisible;
	}

	public cellGuid(): string {
		return this.cellModel.cellGuid;
	}
}
