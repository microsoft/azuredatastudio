/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import 'vs/css!./notebook';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';

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
	@ViewChild('header', { read: ElementRef }) private header: ElementRef;
	protected cells: Array<ICellModel> = [];
	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService
	) {
		super();

		// Todo: This is mock data for cells. Will remove this code when we have a service
		let cell1 : ICellModel = {
			id: '1', language: 'sql', source: 'select * from sys.tables', cellType: CellTypes.Code
		};
		let cell2 : ICellModel = {
			id: '2', language: 'sql', source: 'select 1', cellType: CellTypes.Code
		};
		this.cells.push(cell1, cell2);
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
	}

	private updateTheme(theme: IColorTheme): void {
		let headerEl = <HTMLElement>this.header.nativeElement;
		headerEl.style.borderBottomColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}
}
