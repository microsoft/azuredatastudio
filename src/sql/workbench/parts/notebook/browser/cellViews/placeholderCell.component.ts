/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./placeholder';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, SimpleChange, OnChanges } from '@angular/core';
import { CellView } from 'sql/workbench/parts/notebook/browser/cellViews/interfaces';
import { ICellModel } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/parts/notebook/browser/models/notebookModel';
import { localize } from 'vs/nls';
import { CellType } from 'sql/workbench/parts/notebook/common/models/contracts';


export const PLACEHOLDER_SELECTOR: string = 'placeholder-cell-component';

@Component({
	selector: PLACEHOLDER_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./placeholderCell.component.html'))
})

export class PlaceholderCellComponent extends CellView implements OnInit, OnChanges {
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
		if (this.cellModel) {
			this._register(this.cellModel.onOutputsChanged(() => {
				this._changeRef.detectChanges();
			}));
		}
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
	}

	get model(): NotebookModel {
		return this._model;
	}

	get clickOn(): string {
		return localize('clickOn', "Click on");
	}

	get plusCode(): string {
		return localize('plusCode', "+ Code");
	}

	get or(): string {
		return localize('or', "or");
	}

	get plusText(): string {
		return localize('plusText', "+ Text");
	}

	get toAddCell(): string {
		return localize('toAddCell', "to add a code or text cell");
	}

	public addCell(cellType: string, event?: Event): void {
		if (event) {
			event.stopPropagation();
		}
		let type: CellType = <CellType>cellType;
		if (!type) {
			type = 'code';
		}
		this._model.addCell(<CellType>cellType);
	}

	public layout() {

	}
}
