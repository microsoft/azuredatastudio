/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import './notebookStyles';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, ViewChildren } from '@angular/core';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { AngularDisposable } from 'sql/base/common/lifecycle';

import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { ICellModel, CellTypes } from 'sql/parts/notebook/cellViews/interfaces';

export const NOTEBOOK_SELECTOR: string = 'notebook-component';

@Component({
	selector: NOTEBOOK_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./notebook.component.html'))
})
export class NotebookComponent extends AngularDisposable implements OnInit {
	@ViewChild('toolbar', { read: ElementRef }) private toolbar: ElementRef;
	protected cells: Array<ICellModel> = [];
	private _activeCell: ICellModel;
	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService
	) {
		super();

		// Todo: This is mock data for cells. Will remove this code when we have a service
		let cell1: ICellModel = {
			id: '1', language: 'sql', source: 'select * from sys.tables', cellType: CellTypes.Code, active: false
		};
		let cell2: ICellModel = {
			id: '2', language: 'sql', source: 'select 1', cellType: CellTypes.Code, active: false
		};
		let cell3: ICellModel = {
			id: '3', language: 'markdown', source: '##This is test!', cellType: CellTypes.Markdown, active: false
		};
		this.cells.push(cell1, cell2, cell3);
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
	}

	private updateTheme(theme: IColorTheme): void {
		let toolbarEl = <HTMLElement>this.toolbar.nativeElement;
		toolbarEl.style.borderBottomColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	public selectCell(cell: ICellModel) {
		if (cell !== this._activeCell) {
			if (this._activeCell) {
				this._activeCell.active = false;
			}
			this._activeCell = cell;
			this._activeCell.active = true;
			this._changeRef.detectChanges();
		}
	}
}
