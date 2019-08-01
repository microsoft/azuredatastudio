/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, SimpleChange, OnChanges } from '@angular/core';
import { CellView } from 'sql/workbench/parts/notebook/browser/cellViews/interfaces';
import { ICellModel } from 'sql/workbench/parts/notebook/common/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/parts/notebook/common/models/notebookModel';
import { localize } from 'vs/nls';
import { CellType } from 'sql/workbench/parts/notebook/common/models/contracts';


export const HIDDEN_SELECTOR: string = 'hidden-component';

@Component({
	selector: HIDDEN_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./hidden.component.html'))
})

export class HiddenComponent extends CellView implements OnInit, OnChanges {
	@Input() cellModel: ICellModel;
	@Input() set model(value: NotebookModel) {
		this._model = value;
	}

	private _model: NotebookModel;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
	) {
		super();
	}

	ngOnInit() {
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
	}

	get model(): NotebookModel {
		return this._model;
	}

	public toggleVisibility(event?: Event): void {
		if (event) {
			event.stopPropagation();
		}
		this.cellModel.isHidden = !this.cellModel.isHidden;

		// this._model.addCell(<CellType>cellType);
	}

	get isVisible(): boolean {
		return !this.cellModel.isHidden;
	}

	public layout() {

	}
}
