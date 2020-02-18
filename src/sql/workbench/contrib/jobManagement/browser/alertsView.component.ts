/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/jobs';

import * as dom from 'vs/base/browser/dom';
import * as nls from 'vs/nls';
import * as azdata from 'azdata';
import { Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { Table } from 'sql/base/browser/ui/table/table';
import { AgentViewComponent } from 'sql/workbench/contrib/jobManagement/browser/agentView.component';
import { IJobManagementService } from 'sql/workbench/services/jobManagement/common/interfaces';
import { EditAlertAction, DeleteAlertAction, NewAlertAction } from 'sql/workbench/contrib/jobManagement/browser/jobActions';
import { JobManagementView } from 'sql/workbench/contrib/jobManagement/browser/jobManagementView';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IAction } from 'vs/base/common/actions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { AlertsCacheObject } from 'sql/workbench/services/jobManagement/common/jobManagementService';
import { RowDetailView } from 'sql/base/browser/ui/table/plugins/rowDetailView';

export const VIEW_SELECTOR: string = 'jobalertsview-component';
export const ROW_HEIGHT: number = 45;

@Component({
	selector: VIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./alertsView.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => AlertsViewComponent) }],
})
export class AlertsViewComponent extends JobManagementView implements OnInit, OnDestroy {

	private columns: Array<Slick.Column<any>> = [
		{
			name: nls.localize('jobAlertColumns.name', "Name"),
			field: 'name',
			formatter: (row, cell, value, columnDef, dataContext) => this.renderName(row, cell, value, columnDef, dataContext),
			width: 500,
			id: 'name'
		},
		{ name: nls.localize('jobAlertColumns.lastOccurrenceDate', "Last Occurrence"), field: 'lastOccurrenceDate', width: 150, id: 'lastOccurrenceDate' },
		{ name: nls.localize('jobAlertColumns.enabled', "Enabled"), field: 'enabled', width: 80, id: 'enabled' },
		{ name: nls.localize('jobAlertColumns.delayBetweenResponses', "Delay Between Responses (in secs)"), field: 'delayBetweenResponses', width: 200, id: 'delayBetweenResponses' },
		{ name: nls.localize('jobAlertColumns.categoryName', "Category Name"), field: 'categoryName', width: 250, id: 'categoryName' },
	];

	private options: Slick.GridOptions<any> = {
		syncColumnCellResize: true,
		enableColumnReorder: false,
		rowHeight: ROW_HEIGHT,
		enableCellNavigation: true,
		editable: false
	};

	private dataView: any;
	public _isCloud: boolean;
	private _alertsCacheObject: AlertsCacheObject;

	private _didTabChange: boolean;
	@ViewChild('jobalertsgrid') _gridEl: ElementRef;

	public alerts: azdata.AgentAlertInfo[];
	public contextAction = NewAlertAction;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => AgentViewComponent)) _agentViewComponent: AgentViewComponent,
		@Inject(IJobManagementService) private _jobManagementService: IJobManagementService,
		@Inject(ICommandService) private _commandService: ICommandService,
		@Inject(IInstantiationService) instantiationService: IInstantiationService,
		@Inject(forwardRef(() => CommonServiceInterface)) commonService: CommonServiceInterface,
		@Inject(IContextMenuService) contextMenuService: IContextMenuService,
		@Inject(IKeybindingService) keybindingService: IKeybindingService,
		@Inject(IDashboardService) _dashboardService: IDashboardService) {
		super(commonService, _dashboardService, contextMenuService, keybindingService, instantiationService, _agentViewComponent);
		this._didTabChange = false;
		this._isCloud = commonService.connectionManagementService.connectionInfo.serverInfo.isCloud;
		let alertsCacheObjectMap = this._jobManagementService.alertsCacheObjectMap;
		let alertsCache = alertsCacheObjectMap[this._serverName];
		if (alertsCache) {
			this._alertsCacheObject = alertsCache;
		} else {
			this._alertsCacheObject = new AlertsCacheObject();
			this._alertsCacheObject.serverName = this._serverName;
			this._jobManagementService.addToCache(this._serverName, this._alertsCacheObject);
		}
	}

	ngOnInit() {
		// set base class elements
		this._visibilityElement = this._gridEl;
		this._parentComponent = this._agentViewComponent;
	}

	ngOnDestroy() {
		this._didTabChange = true;
	}

	public layout() {
		let height = dom.getContentHeight(this._gridEl.nativeElement) - 10;
		if (height < 0) {
			height = 0;
		}

		if (this._table) {
			this._table.layout(new dom.Dimension(
				dom.getContentWidth(this._gridEl.nativeElement),
				height));
		}
	}

	onFirstVisible() {
		let self = this;
		let cached: boolean = false;
		if (this._alertsCacheObject.serverName === this._serverName) {
			if (this._alertsCacheObject.alerts && this._alertsCacheObject.alerts.length > 0) {
				cached = true;
				this.alerts = this._alertsCacheObject.alerts;
			}
		}

		let columns = this.columns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});

		this.dataView = new Slick.Data.DataView({ inlineFilters: false });
		let rowDetail = new RowDetailView({
			cssClass: '_detail_selector',
			useRowClick: false,
			panelRows: 1,
			postTemplate: () => '', // I'm assuming these code paths are just never hit...
			preTemplate: () => '',
			process: () => { }
		});
		columns.unshift(rowDetail.getColumnDefinition());
		jQuery(this._gridEl.nativeElement).empty();
		jQuery(this.actionBarContainer.nativeElement).empty();
		this.initActionBar();

		this._table = new Table(this._gridEl.nativeElement, { columns }, this.options);
		this._table.grid.setData(this.dataView, true);
		this._register(this._table.onContextMenu(e => {
			self.openContextMenu(e);
		}));

		// check for cached state
		if (cached && this._agentViewComponent.refresh !== true) {
			self.onAlertsAvailable(this.alerts);
			this._showProgressWheel = false;
			if (this.isVisible) {
				this._cd.detectChanges();
			}
		} else {
			let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
			this._jobManagementService.getAlerts(ownerUri).then((result) => {
				if (result && result.alerts) {
					self.alerts = result.alerts;
					self._alertsCacheObject.alerts = result.alerts;
					self.onAlertsAvailable(result.alerts);
				} else {
					// TODO: handle error
				}
				this._showProgressWheel = false;
				if (this.isVisible && !this._didTabChange) {
					this._cd.detectChanges();
				} else if (this._didTabChange) {
					return;
				}
			});
		}
	}

	private onAlertsAvailable(alerts: azdata.AgentAlertInfo[]) {
		let items: any = alerts.map((item) => {
			return {
				id: item.id,
				name: item.name,
				lastOccurrenceDate: item.lastOccurrenceDate,
				enabled: item.isEnabled,
				delayBetweenResponses: item.delayBetweenResponses,
				categoryName: item.categoryName
			};
		});

		this.dataView.beginUpdate();
		this.dataView.setItems(items);
		this.dataView.endUpdate();
		this._alertsCacheObject.dataview = this.dataView;
		this._table.autosizeColumns();
		this._table.resizeCanvas();
	}

	protected getTableActions(): IAction[] {
		return [
			this._instantiationService.createInstance(EditAlertAction),
			this._instantiationService.createInstance(DeleteAlertAction)
		];
	}

	protected getCurrentTableObject(rowIndex: number): any {
		let targetObject = {
			alertInfo: this.alerts && this.alerts.length >= rowIndex ? this.alerts[rowIndex] : undefined
		};
		return targetObject;
	}


	private renderName(row, cell, value, columnDef, dataContext) {
		let resultIndicatorClass = dataContext.enabled ? 'alertview-alertnameindicatorenabled' :
			'alertview-alertnameindicatordisabled';

		return '<table class="alertview-alertnametable"><tr class="alertview-alertnamerow">' +
			'<td nowrap class=' + resultIndicatorClass + '></td>' +
			'<td nowrap class="alertview-alertnametext">' + dataContext.name + '</td>' +
			'</tr></table>';
	}

	public async openCreateAlertDialog() {
		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		await this._commandService.executeCommand('agent.openAlertDialog', ownerUri, null, null);
	}
}
