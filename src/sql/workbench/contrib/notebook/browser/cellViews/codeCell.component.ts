/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { OnInit, Component, Input, Inject, forwardRef, ChangeDetectorRef, SimpleChange, OnChanges, HostListener, ViewChildren, QueryList, ViewChild } from '@angular/core';
import { CellView } from 'sql/workbench/contrib/notebook/browser/cellViews/interfaces';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { Deferred } from 'sql/base/common/promise';
import { ICellEditorProvider } from 'sql/workbench/services/notebook/browser/notebookService';
import { CodeComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/code.component';
import { OutputAreaComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/outputArea.component';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';

export const CODE_SELECTOR: string = 'code-cell-component';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./codeCell.component.html'))
})

export class CodeCellComponent extends CellView implements OnInit, OnChanges {
	@ViewChildren(CodeComponent) private codeCells: QueryList<ICellEditorProvider>;
	@ViewChild(OutputAreaComponent) private outputAreaCell: OutputAreaComponent;
	@Input() cellModel: ICellModel;
	@Input() set model(value: NotebookModel) {
		this._model = value;
	}
	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	// Onclick to edit text cell in notebook
	@HostListener('click', ['$event']) onClick() {
		this.setEditMode(true);
	}

	@HostListener('document:keydown', ['$event'])
	handleKeyboardEvent(e) {
		let event = new StandardKeyboardEvent(e);
		if (this.cellModel.active) {
			if (event.keyCode === KeyCode.Escape) {
				if (this.isEditMode) {
					this.setEditMode(false);
				}
			}
			else if (event.keyCode === KeyCode.Enter) {
				if (!this.isEditMode) {
					e.preventDefault();
					this.setEditMode(true);
					this._model.updateActiveCell(this.cellModel);
				}
			}
		}
	}

	private _activeCellId: string;
	private isEditMode: boolean;

	public inputDeferred: Deferred<string>;
	public stdIn: nb.IStdinMessage;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _changeRef: ChangeDetectorRef,
	) {
		super();
	}

	ngOnInit() {
		if (this.cellModel) {
			this._register(this.cellModel.onCollapseStateChanged((state) => {
				this._changeRef.detectChanges();
			}));
			this._register(this.cellModel.onParameterStateChanged((state) => {
				this._changeRef.detectChanges();
			}));
			this._register(this.cellModel.onOutputsChanged(() => {
				this._changeRef.detectChanges();
			}));
			this._register(this.cellModel.onCellModeChanged(mode => {
				if (mode !== this.isEditMode) {
					this.setEditMode(mode);
				}
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
		if (this.outputAreaCell) {
			editors.push(...this.outputAreaCell.cellEditors);
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

	public setEditMode(editMode?: boolean): void {
		this.isEditMode = editMode !== undefined ? editMode : !this.isEditMode;
		this.cellModel.isEditMode = this.isEditMode;
		this._changeRef.detectChanges();
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

	protected async awaitStdIn(): Promise<void> {
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
