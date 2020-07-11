/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/jobs';

import * as dom from 'vs/base/browser/dom';
import * as nls from 'vs/nls';
import * as azdata from 'azdata';
import { Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { Table } from 'sql/base/browser/ui/table/table';
import { AgentViewComponent } from 'sql/workbench/contrib/jobManagement/browser/agentView.component';
import { IJobManagementService } from 'sql/workbench/services/jobManagement/common/interfaces';
import { EditOperatorAction, DeleteOperatorAction, NewOperatorAction } from 'sql/workbench/contrib/jobManagement/browser/jobActions';
import { JobManagementView } from 'sql/workbench/contrib/jobManagement/browser/jobManagementView';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IAction } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { OperatorsCacheObject } from 'sql/workbench/services/jobManagement/common/jobManagementService';
import { RowDetailView } from 'sql/base/browser/ui/table/plugins/rowDetailView';

export const VIEW_SELECTOR: string = 'joboperatorsview-component';
export const ROW_HEIGHT: number = 45;

@Component({
	selector: VIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./operatorsView.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => OperatorsViewComponent) }],
})

export class OperatorsViewComponent extends JobManagementView implements OnInit, OnDestroy {

	private columns: Array<Slick.Column<any>> = [
		{
			name: nls.localize('jobOperatorsView.name', "Name"),
			field: 'name',
			formatter: (row, cell, value, columnDef, dataContext) => this.renderName(row, cell, value, columnDef, dataContext),
			width: 200,
			id: 'name'
		},
		{ name: nls.localize('jobOperatorsView.emailAddress', "Email Address"), field: 'emailAddress', width: 200, id: 'emailAddress' },
		{ name: nls.localize('jobOperatorsView.enabled', "Enabled"), field: 'enabled', width: 200, id: 'enabled' },
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
	private _operatorsCacheObject: OperatorsCacheObject;

	private _didTabChange: boolean;
	@ViewChild('operatorsgrid') _gridEl: ElementRef;

	public operators: azdata.AgentOperatorInfo[];
	public contextAction = NewOperatorAction;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => AgentViewComponent)) _agentViewComponent: AgentViewComponent,
		@Inject(IJobManagementService) private _jobManagementService: IJobManagementService,
		@Inject(ICommandService) private _commandService: ICommandService,
		@Inject(IInstantiationService) instantiationService: IInstantiationService,
		@Inject(forwardRef(() => CommonServiceInterface)) commonService: CommonServiceInterface,
		@Inject(IContextMenuService) contextMenuService: IContextMenuService,
		@Inject(IKeybindingService) keybindingService: IKeybindingService,
		@Inject(IDashboardService) _dashboardService: IDashboardService
	) {
		super(commonService, _dashboardService, contextMenuService, keybindingService, instantiationService, _agentViewComponent);
		this._isCloud = commonService.connectionManagementService.connectionInfo.serverInfo.isCloud;
		let operatorsCacheObject = this._jobManagementService.operatorsCacheObjectMap;
		let operatorsCache = operatorsCacheObject[this._serverName];
		if (operatorsCache) {
			this._operatorsCacheObject = operatorsCache;
		} else {
			this._operatorsCacheObject = new OperatorsCacheObject();
			this._operatorsCacheObject.serverName = this._serverName;
			this._jobManagementService.addToCache(this._serverName, this._operatorsCacheObject);
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
		if (this._operatorsCacheObject.serverName === this._serverName) {
			if (this._operatorsCacheObject.operators && this._operatorsCacheObject.operators.length > 0) {
				cached = true;
				this.operators = this._operatorsCacheObject.operators;
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
			this.onOperatorsAvailable(this.operators);
			this._showProgressWheel = false;
			if (this.isVisible) {
				this._cd.detectChanges();
			}
		} else {
			let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
			this._jobManagementService.getOperators(ownerUri).then((result) => {
				if (result && result.operators) {
					self.operators = result.operators;
					self._operatorsCacheObject.operators = result.operators;
					self.onOperatorsAvailable(result.operators);
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

	private onOperatorsAvailable(operators: azdata.AgentOperatorInfo[]) {
		let items: any = operators.map((item) => {
			return {
				id: item.id,
				name: item.name,
				emailAddress: item.emailAddress,
				enabled: item.enabled
			};
		});

		this.dataView.beginUpdate();
		this.dataView.setItems(items);
		this.dataView.endUpdate();
		this._operatorsCacheObject.dataview = this.dataView;
		this._table.autosizeColumns();
		this._table.resizeCanvas();
	}

	protected getTableActions(): IAction[] {
		return [
			this._instantiationService.createInstance(EditOperatorAction),
			this._instantiationService.createInstance(DeleteOperatorAction)
		];
	}

	protected getCurrentTableObject(rowIndex: number): any {
		return (this.operators && this.operators.length >= rowIndex)
			? this.operators[rowIndex]
			: undefined;
	}

	private renderName(row, cell, value, columnDef, dataContext) {
		let resultIndicatorClass = dataContext.enabled ? 'operatorview-operatornameindicatorenabled' :
			'operatorview-operatornameindicatordisabled';
		return '<table class="operatorview-operatornametable"><tr class="operatorview-operatornamerow">' +
			'<td nowrap class=' + resultIndicatorClass + '></td>' +
			'<td nowrap class="operatorview-operatornametext">' + dataContext.name + '</td>' +
			'</tr></table>';
	}

	public async openCreateOperatorDialog() {
		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		await this._commandService.executeCommand('agent.openOperatorDialog', ownerUri);
	}
}
