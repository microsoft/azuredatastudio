/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, SimpleChange, OnChanges, AfterViewInit } from '@angular/core';
import { CellView } from 'sql/parts/notebook/cellViews/interfaces';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';


export const CODE_SELECTOR: string = 'code-cell-component';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./codeCell.component.html'))
})

export class CodeCellComponent extends CellView implements OnInit, OnChanges {
	@Input() cellModel: ICellModel;
	@Input() set model(value: NotebookModel) {
		this._model = value;
	}
	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	private _model: NotebookModel;
	private _activeCellId: string;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
	) {
		super();
	}

	ngOnInit() {
		if (this.cellModel) {
			this._register(this.cellModel.onOutputsChanged(() => {
				this._changeRef.detectChanges();
			}));
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

	get model(): NotebookModel {
		return this._model;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}
	public layout() {

	}
}
