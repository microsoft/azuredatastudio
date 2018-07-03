/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/parts/grid/media/slickColorTheme';
import 'vs/css!sql/parts/grid/media/flexbox';
import 'vs/css!sql/parts/grid/media/styles';
import 'vs/css!sql/parts/grid/media/slick.grid';
import 'vs/css!sql/parts/grid/media/slickGrid';
import 'vs/css!../common/media/jobs';
import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!sql/base/browser/ui/table/media/table';

import * as dom from 'vs/base/browser/dom';
import * as nls from 'vs/nls';
import * as sqlops from 'sqlops';
import { Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, OnInit } from '@angular/core';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { Table } from 'sql/base/browser/ui/table/table';
import { AgentViewComponent } from 'sql/parts/jobManagement/agent/agentView.component';
import { IJobManagementService } from 'sql/parts/jobManagement/common/interfaces';
import { EditAlertAction, DeleteAlertAction } from 'sql/parts/jobManagement/common/jobActions';
import { JobManagementView } from 'sql/parts/jobManagement/views/jobManagementView';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IAction } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';

import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export const VIEW_SELECTOR: string = 'jobalertsview-component';
export const ROW_HEIGHT: number = 45;

@Component({
	selector: VIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./alertsView.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => AlertsViewComponent) }],
})
export class AlertsViewComponent extends JobManagementView implements OnInit {

	private NewAlertText: string = nls.localize('jobAlertToolbar-NewJob', "New Alert");
	private RefreshText: string = nls.localize('jobAlertToolbar-Refresh', "Refresh");

	private columns: Array<Slick.Column<any>> = [
		{ name: nls.localize('jobAlertColumns.name', 'Name'), field: 'name', width: 200, id: 'name' },
		{ name: nls.localize('jobAlertColumns.lastOccurrenceDate', 'Last Occurrence'), field: 'lastOccurrenceDate', width: 200, id: 'lastOccurrenceDate' },
		{ name: nls.localize('jobAlertColumns.enabled', 'Enabled'), field: 'enabled', width: 200, id: 'enabled' },
		{ name: nls.localize('jobAlertColumns.databaseName', 'Database Name'), field: 'databaseName', width: 200, id: 'databaseName' },
		{ name: nls.localize('jobAlertColumns.categoryName', 'Category Name'), field: 'categoryName', width: 200, id: 'categoryName' },
	];

	private options: Slick.GridOptions<any> = {
		syncColumnCellResize: true,
		enableColumnReorder: false,
		rowHeight: ROW_HEIGHT,
		enableCellNavigation: true,
		editable: false
	};

	private dataView: any;
	private _isCloud: boolean;

	@ViewChild('jobalertsgrid') _gridEl: ElementRef;

	public alerts: sqlops.AgentAlertInfo[];

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(forwardRef(() => AgentViewComponent)) private _agentViewComponent: AgentViewComponent,
		@Inject(IJobManagementService) private _jobManagementService: IJobManagementService,
		@Inject(IThemeService) private _themeService: IThemeService,
		@Inject(ICommandService) private _commandService: ICommandService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(forwardRef(() => CommonServiceInterface)) commonService: CommonServiceInterface,
		@Inject(IContextMenuService) contextMenuService: IContextMenuService,
		@Inject(IKeybindingService) keybindingService: IKeybindingService
	) {
		super(commonService, contextMenuService, keybindingService);
		this._isCloud = commonService.connectionManagementService.connectionInfo.serverInfo.isCloud;
	}

	ngOnInit(){
		// set base class elements
		this._visibilityElement = this._gridEl;
		this._parentComponent = this._agentViewComponent;
	 }

	public layout() {
		this._table.layout(new dom.Dimension(dom.getContentWidth(this._gridEl.nativeElement), dom.getContentHeight(this._gridEl.nativeElement)));
	}

	onFirstVisible() {
		let self = this;
		let columns = this.columns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});
		let options = <Slick.GridOptions<any>>{
			syncColumnCellResize: true,
			enableColumnReorder: false,
			rowHeight: ROW_HEIGHT,
			enableCellNavigation: true,
			forceFitColumns: true
		};

		this.dataView = new Slick.Data.DataView();

		$(this._gridEl.nativeElement).empty();
		this._table = new Table(this._gridEl.nativeElement, undefined, columns, this.options);
		this._table.grid.setData(this.dataView, true);

		this._register(this._table.onContextMenu((e: DOMEvent, data: Slick.OnContextMenuEventArgs<any>) => {
			self.openContextMenu(e);
		}));

		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		this._jobManagementService.getAlerts(ownerUri).then((result) => {
			if (result && result.alerts) {
				self.alerts = result.alerts;
				self.onAlertsAvailable(result.alerts);
			} else {
				// TODO: handle error
			}

			this._showProgressWheel = false;
			if (this.isVisible) {
				this._cd.detectChanges();
			}
		});
	}

	private onAlertsAvailable(alerts: sqlops.AgentAlertInfo[]) {
		let items: any = alerts.map((item) => {
			return {
				id: item.id,
				name: item.name,
				lastOccurrenceDate: item.lastOccurrenceDate,
				enabled: item.isEnabled,
				databaseName: item.databaseName,
				categoryName: item.categoryName
			};
		});

		this.dataView.beginUpdate();
		this.dataView.setItems(items);
		this.dataView.endUpdate();
		this._table.autosizeColumns();
		this._table.resizeCanvas();
	}

	protected getTableActions(): TPromise<IAction[]> {
		let actions: IAction[] = [];
		actions.push(this._instantiationService.createInstance(EditAlertAction));
		actions.push(this._instantiationService.createInstance(DeleteAlertAction));
		return TPromise.as(actions);
	}

	protected getCurrentTableObject(rowIndex: number): any {
		return (this.alerts && this.alerts.length >= rowIndex)
			? this.alerts[rowIndex]
			: undefined;
	}

	private openCreateAlertDialog() {
		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		this._commandService.executeCommand('agent.openCreateAlertDialog', ownerUri);
	}

	private refreshJobs() {
		this._agentViewComponent.refresh = true;
	}
}