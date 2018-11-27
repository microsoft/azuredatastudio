/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./codeCell';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, SimpleChange, OnChanges } from '@angular/core';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { CellView } from 'sql/parts/notebook/cellViews/interfaces';

import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';


export const CODE_SELECTOR: string = 'code-cell-component';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./codeCell.component.html'))
})
export class CodeCellComponent extends CellView implements OnInit, OnChanges {
	@ViewChild('codeCellOutput', { read: ElementRef }) private outputPreview: ElementRef;

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
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService
	) {
		super();
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		if (this.cellModel) {
			this.cellModel.onOutputsChanged(() => {
				this._changeRef.detectChanges();
			});
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

	// Todo: implement layout
	public layout() {

	}

	private updateTheme(theme: IColorTheme): void {
		let outputElement = <HTMLElement>this.outputPreview.nativeElement;
		outputElement.style.borderTopColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

}
