/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';
import { CellView } from 'sql/parts/notebook/cellViews/interfaces';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';


export const CODE_SELECTOR: string = 'code-cell-component';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./codeCell.component.html'))
})
export class CodeCellComponent extends CellView implements OnInit {
	private _model: NotebookModel;
	@Input() cellModel: ICellModel;
	@Input() set model(value: NotebookModel) {
		this._model = value;
	}

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
	) {
		super();
	}

	ngOnInit() {
	}

	// Todo: implement layout
	public layout() {

	}

	get model(): NotebookModel {
		return this._model;
	}

}
