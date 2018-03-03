/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./agent';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';
import * as Utils from 'sql/parts/connection/common/utils';
import { RefreshWidgetAction, EditDashboardAction } from 'sql/parts/dashboard/common/actions';
import { IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as themeColors from 'vs/workbench/common/theme';
import { DashboardPage } from 'sql/parts/dashboard/common/dashboardPage.component';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IAgentService } from '../common/interfaces';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { AgentJobInfo } from 'sqlops';
import * as nls from 'vs/nls';
import { IGridDataSet } from 'sql/parts/grid/common/interfaces';
import * as Services from 'sql/parts/grid/services/sharedServices';
import { FieldType, IColumnDefinition } from 'angular2-slickgrid';
import { Table } from 'sql/base/browser/ui/table/table';
import { attachTableStyler } from 'sql/common/theme/styler';

export const DASHBOARD_SELECTOR: string = 'schedulesview-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./schedulesView.component.html'))
})
export class SchedulesViewComponent implements OnInit, OnDestroy {

	private _agentService: IAgentService;

	private _disposables: Array<IDisposable> = [];

	// public dataSet: IGridDataSet;

	private _table: Table<any>;

	private _columns: Array<Slick.Column<any>> = [
		{ name: 'Operation', field: 'operation' }
	];

	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) private _bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => DashboardServiceInterface)) private _dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef
	) {
		this._agentService = this._bootstrapService.agentService;
	}

	ngOnInit() {

		// let columnDefinitions = <IColumnDefinition[]>[{
		// 	id: '1',
		// 	name: 'Column',
		// 	type:  FieldType.String,
		// 	formatter: Services.textFormatter,
		// 	asyncPostRender: undefined
		// }];

		// // Store the result set from the event
		// this.dataSet = {
		// 	resized: undefined,
		// 	batchId: 1,
		// 	resultId: 1,
		// 	totalRows: 0,
		// 	maxHeight: 500,
		// 	minHeight: 200,
		// 	dataRows: undefined,
		// 	columnDefinitions: columnDefinitions
		// };

		// let data = [
		// 	{
		// 		operation: 'Op1'
		// 	}
		// ];


		// let columns = this._columns.map((column) => {
		// 	column.rerenderOnResize = true;
		// 	return column;
		// });

		// let options = <Slick.GridOptions<any>>{
		// 	autoHeight: true,
		// 	syncColumnCellResize: true,
		// 	enableColumnReorder: false
		// };

		// this._table = new Table(this._el.nativeElement, data, columns, options);
		// this._disposables.push(attachTableStyler(this._table, this._bootstrapService.themeService));

		// this.layout();
		// this._cd.detectChanges();
	}

	ngOnDestroy() {
	}

	public layout(): void {
		if (this._table) {
			setTimeout(() => {
				this._table.resizeCanvas();
				this._table.autosizeColumns();
			});
		}
	}
}


//new VirtualizedCollection(
			// 	self.windowSize,
			// 	resultSet.rowCount,
			// 	loadDataFunction,
			// 	index => { return { values: [] }; }
			// )