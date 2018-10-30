/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import './notebookStyles';

import { nb } from 'sqlops';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, ViewChildren } from '@angular/core';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { AngularDisposable } from 'sql/base/common/lifecycle';

import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { CellTypes, CellType } from 'sql/parts/notebook/models/contracts';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { INotebookService } from 'sql/services/notebook/notebookService';

export const NOTEBOOK_SELECTOR: string = 'notebook-component';

class CellModelStub implements ICellModel {
	constructor(public id: string,
		public language: string,
		public source: string,
		public cellType: CellType,
		public trustedMode: boolean = false,
		public active: boolean = false
	) { }

	equals(cellModel: ICellModel): boolean {
		throw new Error('Method not implemented.');
	}
	toJSON(): nb.ICell {
		throw new Error('Method not implemented.');
	}
}

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
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IConnectionManagementService) private connectionManagementService: IConnectionManagementService,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(INotebookService) private notebookService: INotebookService
	) {
		super();

		// TODO NOTEBOOK REFACTOR: This is mock data for cells. Will remove this code when we have a service
		let cell1 : ICellModel = new CellModelStub ('1', 'sql', 'select * from sys.tables', CellTypes.Code);
		let cell2 : ICellModel = new CellModelStub ('2', 'sql', 'select 1', CellTypes.Code);
		let cell3 : ICellModel = new CellModelStub ('3', 'markdown', '## This is test!', CellTypes.Markdown);
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
