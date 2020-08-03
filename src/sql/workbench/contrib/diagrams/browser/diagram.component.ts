/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, Inject, forwardRef, ChangeDetectorRef, Injectable, OnInit, ViewChild, ElementRef, } from '@angular/core';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { localize } from 'vs/nls';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { ServerInfo } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { GetDiagramModelAction } from 'sql/workbench/contrib/diagrams/browser/diagramActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Action } from 'vs/base/common/actions';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { attachSelectBoxStyler, attachTableStyler } from 'sql/platform/theme/common/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { PanelComponent, IPanelOptions, NavigationBarLayout } from 'sql/base/browser/ui/panel/panel.component';
import { Table } from 'sql/base/browser/ui/table/table';

const LocalizedStrings = {
	SECTION_TITLE_API: localize('asmt.section.api.title', "API information"),
	API_VERSION: localize('asmt.apiversion', "API Version:"),
	DEFAULT_RULESET_VERSION: localize('asmt.rulesetversion', "Default Ruleset Version:"),
	SECTION_TITLE_SQL_SERVER: localize('asmt.section.instance.title', "SQL Server Instance Details"),
	SERVER_VERSION: localize('asmt.serverversion', "Version:"),
	SERVER_EDITION: localize('asmt.serveredition', "Edition:"),
	SERVER_INSTANCENAME: localize('asmt.instancename', "Instance Name:"),
	SERVER_OSVERSION: localize('asmt.osversion', "OS Version:")
};

export const DASHBOARD_SELECTOR: string = 'diagram-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./diagram.component.html'))
})

@Injectable()
export class DiagramComponent extends AngularDisposable implements OnInit {

	protected localizedStrings = LocalizedStrings;
	connectionInfo: ServerInfo = null;
	instanceName: string = '';
	private _columnGrid: Table<any>;
	private columnGridDataView: Slick.Data.DataView<any>;
	private _actionBar: Taskbar;
	private _selectBox: SelectBox;

	public showDatabase = true;
	public showSchema = false;
	public showTable = false;
	public selectedOption = 'Database';
	public granularityOptions = ['Database', 'Schema', 'Table'];

	@ViewChild(PanelComponent) private _panel: PanelComponent;
	@ViewChild('diagramActionbarContainer') protected actionBarContainer: ElementRef;
	@ViewChild('dropDown', { read: ElementRef }) private _dropdownContainer: ElementRef;
	@ViewChild('columnGrid') protected _columnGridContainer: ElementRef;

	public readonly visualTitle: string = 'Visual';
	public readonly contextualTitle: string = 'Contextual';
	public columnGridColumns: Array<Slick.Column<any>> = [
		{
			name: '',
			field: 'iconImage',
			width: 80,
			id: 'iconImage'
		},
		{
			name: 'Name',
			field: 'columnName',
			width: 80,
			id: 'columnName'
		},
		{
			name: 'Type',
			field: 'columnType',
			width: 80,
			id: 'columnType'
		}
	];
	public columnGridData = [
		{
			id: 1,
			iconImage: 'PK',
			columnName: 'EmployeeID',
			columnType: 'int',
		},
		{
			id: 2,
			iconImage: 'FK',
			columnName: 'ManagerID',
			columnType: 'int',
		},
		{
			id: 3,
			iconImage: '',
			columnName: 'Location',
			columnType: 'varchar'
		}
	];

	public readonly panelOpt: IPanelOptions = {
		alwaysShowTabs: true,
		layout: NavigationBarLayout.horizontal,
		showIcon: true
	};

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService
	) {
		super();
	}

	ngOnInit() {
		this.initActionBar();
		this.initDropdown();
		this.initColumnGrid();
	}

	private initDropdown() {
		if (this._dropdownContainer) {
			this._selectBox = new SelectBox(['Database', 'Schema', 'Table'], 'Database',
				this.contextViewService, this._dropdownContainer.nativeElement);
			this._selectBox.render(this._dropdownContainer.nativeElement);
			this._register(this._selectBox);
			this._register(attachSelectBoxStyler(this._selectBox, this.themeService));
			this._selectBox.onDidSelect(e => {
				this.changeGranularityView(e.selected);
			});
		}
	}

	private initColumnGrid() {
		let columns = this.columnGridColumns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});

		let columnGridOptions = <Slick.GridOptions<any>>{
			syncColumnCellResize: true,
			enableColumnReorder: false,
			rowHeight: 25,
			enableCellNavigation: true,
			forceFitColumns: false
		};

		this.columnGridDataView = new Slick.Data.DataView({
			inlineFilters: false
		});

		this.columnGridDataView.setItems(this.columnGridData);

		if (this._columnGridContainer) {
			this._columnGrid = new Table(
				this._columnGridContainer.nativeElement,
				{ columns },
				columnGridOptions
			);
			this._columnGrid.grid.setData(this.columnGridDataView, true);
			this._register(this._columnGrid);
			this._register(attachTableStyler(this._columnGrid, this.themeService));
			this._cd.detectChanges();
		}
	}

	private changeGranularityView(view: any) {
		switch (view) {
			case 'Database': {
				this.showDatabase = true;
				this.showSchema = false;
				this.showTable = false;
				this._cd.detectChanges();
				break;
			}
			case 'Schema': {
				this.showDatabase = false;
				this.showSchema = true;
				this.showTable = false;
				this._cd.detectChanges();
				break;
			}
			case 'Table': {
				this.showDatabase = false;
				this.showSchema = false;
				this.showTable = true;
				this._cd.detectChanges();
				break;
			}
			default: {
				this.showDatabase = true;
				this.showSchema = false;
				this.showTable = false;
				break;
			}
		}
	}

	private initActionBar(): void {
		const getModelAction: Action = this._instantiationService.createInstance(GetDiagramModelAction,
			GetDiagramModelAction.ID, GetDiagramModelAction.LABEL);
		const taskbar: HTMLElement = <HTMLElement>this.actionBarContainer.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this._actionBar.setContent([
			{ action: getModelAction },
		]);
		this._actionBar.context = this._commonService.connectionManagementService.connectionInfo.ownerUri;
	}

	public layout() {
		this._panel.layout();
	}
}


