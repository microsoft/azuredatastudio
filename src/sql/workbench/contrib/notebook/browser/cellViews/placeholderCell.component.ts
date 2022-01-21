/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./placeholder';

import { OnInit, Component, Input, Inject, forwardRef, ChangeDetectorRef, SimpleChange, OnChanges } from '@angular/core';
import { CellView } from 'sql/workbench/contrib/notebook/browser/cellViews/interfaces';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { localize } from 'vs/nls';
import { CellType } from 'sql/workbench/services/notebook/common/contracts';


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

	get plusCodeAriaLabel(): string {
		return localize('plusCodeAriaLabel', "Add a code cell");
	}

	get plusTextAriaLabel(): string {
		return localize('plusTextAriaLabel', "Add a text cell");
	}

	public addCell(cellType: string, event?: Event): void {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		let type: CellType = <CellType>cellType;
		if (!type) {
			type = 'code';
		}
		this._model.addCell(type);
	}

	public layout() {

	}

	public cellGuid(): string {
		return this.cellModel.cellGuid;
	}
}
