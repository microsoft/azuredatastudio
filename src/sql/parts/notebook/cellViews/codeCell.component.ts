/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./codeCell';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';

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
export class CodeCellComponent extends CellView implements OnInit {
	@ViewChild('codeCellOutput', { read: ElementRef }) private outputPreview: ElementRef;
	private _model: NotebookModel;
	@Input() cellModel: ICellModel;
	@Input() set model(value: NotebookModel) {
		this._model = value;
	}

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

	// Todo: implement layout
	public layout() {

	}

	private updateTheme(theme: IColorTheme): void {
		let outputElement = <HTMLElement>this.outputPreview.nativeElement;
		outputElement.style.borderTopColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	get model(): NotebookModel {
		return this._model;
	}

}
