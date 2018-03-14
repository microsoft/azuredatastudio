/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!../common/media/jobs';
import 'vs/css!sql/parts/grid/media/slickColorTheme';
import 'vs/css!sql/parts/grid/media/flexbox';
import 'vs/css!sql/parts/grid/media/styles';
import 'vs/css!sql/parts/grid/media/slick.grid';
import 'vs/css!sql/parts/grid/media/slickGrid';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';
import * as Utils from 'sql/parts/connection/common/utils';
import { RefreshWidgetAction, EditDashboardAction } from 'sql/parts/dashboard/common/actions';
import { IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as themeColors from 'vs/workbench/common/theme';
import { DashboardPage } from 'sql/parts/dashboard/common/dashboardPage.component';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IJobManagementService } from '../common/interfaces';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { AgentJobInfo } from 'sqlops';
import * as vscode from 'vscode';
import * as nls from 'vs/nls';
import { IGridDataSet } from 'sql/parts/grid/common/interfaces';
import { FieldType, IObservableCollection, CollectionChange, SlickGrid } from 'angular2-slickgrid';
import { Table } from 'sql/base/browser/ui/table/table';
import { attachTableStyler } from 'sql/common/theme/styler';

export const JOBSVIEW_SELECTOR: string = 'jobsview-component';

@Component({
	selector: JOBSVIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./jobsView.component.html'))
})
export class JobsViewComponent implements OnInit, OnDestroy {

	private _jobManagementService: IJobManagementService;

	private _disposables = new Array<vscode.Disposable>();

	private columns2: Array<Slick.Column<any>> = [
		{ name: 'Name', field: 'name' },
		{ name: 'Last Run', field: 'lastRun' },
		{ name: 'Next Run', field: 'nextRun' },
		{ name: 'Enabled', field: 'enabled' },
		{ name: 'Status', field: 'currentExecutionStatus' },
		{ name: 'Category', field: 'category' },
		{ name: 'Runnable', field: 'runnable' },
		{ name: 'Schedule', field: 'hasSchedule' },
		{ name: 'Category ID', field: 'categoryId' },
		{ name: 'Last Run Outcome', field: 'lastRunOutcome' },
	];

	private _table: Table<any>;

	public jobs: AgentJobInfo[];

	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) private bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => DashboardServiceInterface)) private _dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef
	) {
		this._jobManagementService = bootstrapService.jobManagementService;
	}

	ngOnInit() {
		// let options = <Slick.GridOptions<any>>{
		// 	autoHeight: true,
		// 	syncColumnCellResize: true,
		// 	enableColumnReorder: false
		// };

		let columns = this.columns2.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});
		this._table = new Table(this._el.nativeElement, this.jobs, columns);
		this._disposables.push(attachTableStyler(this._table, this.bootstrapService.themeService));
		this._cd.detectChanges();

		let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
		this._jobManagementService.getJobs(ownerUri).then((result) => {
			if (result) {
				this.jobs = result.jobs;
				this._table.setData(result.jobs);
				this._table.resizeCanvas();
				this._table.autosizeColumns();
			}
		});
	}

	public layout(): void {
		if (this._table) {
			setTimeout(() => {
				this._table.resizeCanvas();
				this._table.autosizeColumns();
			});
		}
	}

	ngOnDestroy() {
	}
}
