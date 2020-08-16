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
import { SelectBox, ISelectBoxOptionsWithLabel } from 'sql/base/browser/ui/selectBox/selectBox';
import { attachSelectBoxStyler, attachTableStyler, attachInputBoxStyler } from 'sql/platform/theme/common/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { Table } from 'sql/base/browser/ui/table/table';
import PropertiesContainerComponent from 'sql/workbench/browser/modelComponents/propertiesContainer.component';
import { PropertyItem } from 'sql/base/browser/ui/propertiesContainer/propertiesContainer.component';
import { KeyCode } from 'vs/base/common/keyCodes';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';


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

	public notDemo = false;
	protected localizedStrings = LocalizedStrings;
	connectionInfo: ServerInfo = null;
	instanceName: string = '';
	private _columnGrid: Table<any>;
	private columnGridDataView: Slick.Data.DataView<any>;
	private _relationshipGrid: Table<any>;
	private relationshipGridDataView: Slick.Data.DataView<any>;
	private _actionBar: Taskbar;
	private _selectBox: SelectBox;
	private _searchBar: InputBox;

	private _schemaTableGrid: Table<any>;
	public schemaTableGridDataView: Slick.Data.DataView<Slick.SlickData>;

	public showDatabase = true;
	public showSchema = false;
	public showTable = false;
	public selectedOption = 'Database';
	public granularityOptions = ['Database', 'Schema', 'Table'];
	public row: number;
	public cell: number;

	@ViewChild('diagramActionbarContainer') protected actionBarContainer: ElementRef;
	@ViewChild('dropDown', { read: ElementRef }) private _dropdownContainer: ElementRef;
	@ViewChild('searchBar') protected _searchBarContainer: ElementRef;

	@ViewChild('columnGrid') protected _columnGridContainer: ElementRef;
	@ViewChild('relationshipGrid') protected _relationshipGridContainer: ElementRef;
	@ViewChild('tableProperties') private _tableProperties: PropertiesContainerComponent;

	@ViewChild('schemaProperties') private _schemaProperties: PropertiesContainerComponent;
	@ViewChild('schemaTableGrid') protected _schemaTableGridContainer: ElementRef;

	@ViewChild('dbProperties') private _dbProperties: PropertiesContainerComponent;
	@ViewChild('dbTableGrid') protected _dbTableGridContainer: ElementRef;
	@ViewChild('dbSchemaGrid') protected _dbSchemaGridContainer: ElementRef;


	public readonly visualTitle: string = 'Visual';
	public readonly contextualTitle: string = 'Contextual';

	public columnGridColumns: Array<Slick.Column<any>> = [
		{
			name: '',
			field: 'iconImage',
			width: 20,
			id: 'iconImage'
		},
		{
			name: 'Name',
			field: 'columnName',
			width: 70,
			id: 'columnName'
		},
		{
			name: 'Type',
			field: 'columnType',
			width: 40,
			id: 'columnType'
		}
	];
	public employeeGridItems = [
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

	public relationshipGridColumns: Array<Slick.Column<any>> = [

		{
			name: 'Table',
			field: 'tableName',
			width: 80,
			id: 'tableName'
		},
		{
			name: 'Cardinality',
			field: 'cardinality',
			width: 80,
			id: 'columnName'
		},
		{
			name: 'Reference',
			field: 'reference',
			width: 300,
			id: 'reference'
		}
	];

	public employeeRelationshipItems = [
		{
			id: 1,
			tableName: 'Department',
			cardinality: 'One to many',
			reference: 'Employee.DepartmentID (*:1) Department.DepartmentID',
		},
		/*{
			id: 2,
			tableName: 'EmployeeHistory',
			cardinality: 'One to one',
			reference: 'EmployeeHistory.EmployeeID (1:1) Employee.EmployeeID',
		}*/
	];

	public employeePropertyItems: PropertyItem[] = [
		{
			displayName: 'Schema',
			value: 'Dbo'
		},
		{
			displayName: 'Column Count',
			value: '3'
		},
		{
			displayName: 'Size',
			value: '40 Bytes'
		}
	];

	public departmentGridItems = [
		{
			id: 1,
			iconImage: 'PK',
			columnName: 'DepartmentID',
			columnType: 'int',
		},
		{
			id: 2,
			iconImage: '',
			columnName: 'Name',
			columnType: 'varchar'
		},
		{
			id: 3,
			iconImage: '',
			columnName: 'Organizations',
			columnType: 'varchar'
		},

	];

	public departmentPropertyItems: PropertyItem[] = [
		{
			displayName: 'Schema',
			value: 'Sys'
		},
		{
			displayName: 'Column Count',
			value: '3'
		},
		{
			displayName: 'Size',
			value: '60 Bytes'
		}
	];

	public departmentRelationshipItems = [
		{
			id: 1,
			tableName: 'Employee',
			cardinality: 'Many to one',
			reference: 'Employee.DepartmentID (*:1) Department.DepartmentID',
		}
		/*,
		{
			id: 2,
			tableName: 'EmployeeHistory',
			cardinality: 'One to one',
			reference: 'EmployeeHistory.EmployeeID (1:1) Employee.EmployeeID',
		},*/
	];

	public employeeTableModel = {
		name: 'Employee',
		columnItems: this.employeeGridItems,
		propertyItems: this.employeePropertyItems,
		relationshipItems: this.employeeRelationshipItems,
	};

	public departmentTableModel = {
		name: 'Department',
		columnItems: this.departmentGridItems,
		propertyItems: this.departmentPropertyItems,
		relationshipItems: this.departmentRelationshipItems,
	};

	public tableModels: Map<string, any> =
		new Map()
			.set(this.employeeTableModel.name, this.employeeTableModel)
			.set(this.departmentTableModel.name, this.departmentTableModel);

	public currTableModel = this.tableModels.get('Department');

	public dboPropertyItems: PropertyItem[] = [
		{
			displayName: 'Owner',
			value: 'Dbo'
		},
		{
			displayName: 'ID',
			value: '1'
		}
	];

	public sysPropertyItems: PropertyItem[] = [
		{
			displayName: 'Owner',
			value: 'Sys'
		},
		{
			displayName: 'ID',
			value: '2'
		}
	];

	public schemaTableGridColumns: Array<Slick.Column<any>> = [
		{
			name: 'Table',
			field: 'tableName',
			width: 80,
			id: 'tableName'
		},
		{
			name: 'Column Count',
			field: 'columnCount',
			width: 80,
			id: 'columnCount'
		}
	];

	public dboTableItems = [
		{
			id: 1,
			tableName: 'Employee',
			columnCount: 3
		}
	];

	public sysTableItems = [
		{
			id: 1,
			tableName: 'Department',
			columnCount: 3
		}
	];

	public dboSchemaModel = {
		name: 'Dbo',
		propertyItems: this.dboPropertyItems,
		tableItems: this.dboTableItems
	};

	public sysSchemaModel = {
		name: 'Sys',
		propertyItems: this.sysPropertyItems,
		tableItems: this.sysTableItems
	};

	public dbTableGridColumns: Array<Slick.Column<any>> = [

		{
			name: 'Table',
			field: 'tableName',
			width: 80,
			id: 'tableName'
		},
		{
			name: 'Schema',
			field: 'schema',
			width: 80,
			id: 'schema'
		},
		{
			name: 'Column Count',
			field: 'columnCount',
			width: 80,
			id: 'columnCount'
		}
	];

	public dbSchemaGridColumns: Array<Slick.Column<any>> = [

		{
			name: 'Schema',
			field: 'schemaName',
			width: 80,
			id: 'schemaName'
		},
		{
			name: 'Owner',
			field: 'owner',
			width: 80,
			id: 'owner'
		},
		{
			name: 'Owner ID',
			field: 'ownerID',
			width: 80,
			id: 'ownerID'
		}
	];

	public dbPropertyItems: PropertyItem[] = [
		{
			displayName: 'Server',
			value: 'SQL Server'
		},
		{
			displayName: 'Table Count',
			value: '3'
		},
		{
			displayName: 'Size',
			value: '60 Bytes'
		}
	];

	public dbTableItems = [
		{
			id: 1,
			tableName: 'Employee',
			schema: 'Dbo',
			columnCount: 3,
		},
		{
			id: 2,
			tableName: 'Department',
			schema: 'Sys',
			columnCount: 3,
		}
	];


	public dbSchemaItems = [
		{
			id: 1,
			schemaName: 'Dbo',
			owner: 'Dbo',
			ownerId: 1,
		},
		{
			id: 2,
			schemaName: 'Sys',
			owner: 'Sys',
			ownerId: 2,
		}
	];

	public schemaModels: Map<string, any> =
		new Map()
			.set(this.dboSchemaModel.name, this.dboSchemaModel)
			.set(this.sysSchemaModel.name, this.sysSchemaModel);

	public currSchemaModel = this.schemaModels.get('Dbo');
	dbSchemaGridDataView: Slick.Data.DataView<Slick.SlickData>;
	private _dbSchemaGrid: Table<any>;
	dbTableGridDataView: Slick.Data.DataView<Slick.SlickData>;
	private _dbTableGrid: Table<any>;

	public dbModel = {
		name: 'Adventure Works',
		propertyItems: this.dbPropertyItems,
		schemaItems: this.dbSchemaItems,
		tableItems: this.dbTableItems
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
		this.initSearchBar();
	}

	ngAfterViewInit() {
		this.initDbProperties();
		this.initDbSchemaGrid();
		this.initDbTableGrid();
	}

	private initDropdown() {
		if (this._dropdownContainer) {
			let selectBoxOptions: ISelectBoxOptionsWithLabel = {
				labelText: 'Granularity Selector',
				labelOnTop: true
			};
			this._selectBox = new SelectBox(['Database', 'Schema', 'Table'], 'Database',
				this.contextViewService, this._dropdownContainer.nativeElement, selectBoxOptions);
			this._selectBox.render(this._dropdownContainer.nativeElement);
			this._register(this._selectBox);
			this._register(attachSelectBoxStyler(this._selectBox, this.themeService));
			this._selectBox.setAriaLabel('Granularity Dropdown');
			this._selectBox.onDidSelect(e => {
				this.changeGranularityView(e.selected);
			});
		}
	}

	private initSearchBar() {
		if (this._searchBarContainer) {
			this._searchBar = new InputBox(this._searchBarContainer.nativeElement,
				this.contextViewService);
		}
		this._register(this._searchBar);
		this._register(attachInputBoxStyler(this._searchBar, this.themeService));
		this._searchBar.setAriaLabel('Table Search Bar');
		this._searchBar.setPlaceHolder('Search tables');
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
			forceFitColumns: false,
		};

		this.columnGridDataView = new Slick.Data.DataView({
			inlineFilters: false
		});

		if (this._columnGridContainer) {
			this._columnGrid = new Table(
				this._columnGridContainer.nativeElement,
				{ columns },
				columnGridOptions
			);
			this._columnGrid.grid.setData(this.columnGridDataView, true);
			this.columnGridDataView.beginUpdate();
			this.columnGridDataView.setItems(this.currTableModel.columnItems);
			this.columnGridDataView.endUpdate();
			this._columnGrid.autosizeColumns();
			this._columnGrid.resizeCanvas();
			this._register(attachTableStyler(this._columnGrid, this.themeService));
		}
	}

	private initRelationshipGrid() {
		let columns = this.relationshipGridColumns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});

		let relationshipGridOptions = <Slick.GridOptions<any>>{
			syncColumnCellResize: true,
			enableColumnReorder: false,
			rowHeight: 25,
			enableCellNavigation: true,
			forceFitColumns: false
		};

		this.relationshipGridDataView = new Slick.Data.DataView({
			inlineFilters: false
		});

		if (this._relationshipGridContainer) {
			this._relationshipGrid = new Table(
				this._relationshipGridContainer.nativeElement,
				{ columns },
				relationshipGridOptions
			);
			this._relationshipGrid.grid.setData(this.relationshipGridDataView, true);
			this.relationshipGridDataView.beginUpdate();
			this.relationshipGridDataView.setItems(this.currTableModel.relationshipItems);
			this.relationshipGridDataView.endUpdate();
			this._relationshipGrid.autosizeColumns();
			this._relationshipGrid.resizeCanvas();
			this._register(attachTableStyler(this._relationshipGrid, this.themeService));
			this._register(this._relationshipGrid.onClick((e) => {
				if (e.cell) {
					let row = this._relationshipGrid.grid.getDataItem(e.cell.row);
					let field = this._relationshipGrid.grid.getColumns()[e.cell.cell].field;
					let value = row[field];
					this.row = e.cell.row;
					this.cell = e.cell.cell;
					this._cd.detectChanges();
					if (e.cell.row === 0 && e.cell.cell === 0) {
						this._cd.detectChanges();
						this.updateTablePage(value);
						this._cd.detectChanges();
					}
				}
			}));
		}
	}

	private updateTablePage(tableName: string) {
		this.currTableModel = this.tableModels.get(tableName);
		this._tableProperties.propertyItems = this.currTableModel.propertyItems;

		this.relationshipGridDataView.beginUpdate();
		this.relationshipGridDataView.setItems(this.currTableModel.relationshipItems);
		this.relationshipGridDataView.endUpdate();
		this.relationshipGridDataView.refresh();
		this._relationshipGrid.grid.setData(this.relationshipGridDataView, true);
		this._relationshipGrid.autosizeColumns();
		this._relationshipGrid.resizeCanvas();

		this.columnGridDataView.beginUpdate();
		this.columnGridDataView.setItems(this.currTableModel.columnItems);
		this.columnGridDataView.endUpdate();
		this.columnGridDataView.refresh();
		this._columnGrid.grid.setData(this.columnGridDataView, true);
		this._columnGrid.autosizeColumns();
		this._columnGrid.resizeCanvas();
	}

	private initTableProperties() {
		this._tableProperties.propertyItems = this.currTableModel.propertyItems;
		this._cd.detectChanges();
	}

	private initSchemaProperties() {
		this._schemaProperties.propertyItems = this.currSchemaModel.propertyItems;
		this._cd.detectChanges();
	}

	private initSchemaTablesGrid() {
		let columns = this.schemaTableGridColumns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});

		let schemaTableGridOptions = <Slick.GridOptions<any>>{
			syncColumnCellResize: true,
			enableColumnReorder: false,
			rowHeight: 25,
			enableCellNavigation: true,
			forceFitColumns: false
		};

		this.schemaTableGridDataView = new Slick.Data.DataView({
			inlineFilters: false
		});

		if (this._schemaTableGridContainer) {
			this._schemaTableGrid = new Table(
				this._schemaTableGridContainer.nativeElement,
				{ columns },
				schemaTableGridOptions
			);
			this._schemaTableGrid.grid.setData(this.schemaTableGridDataView, true);
			this.schemaTableGridDataView.beginUpdate();
			this.schemaTableGridDataView.setItems(this.currSchemaModel.tableItems);
			this.schemaTableGridDataView.endUpdate();
			this._schemaTableGrid.autosizeColumns();
			this._schemaTableGrid.resizeCanvas();
			this._register(attachTableStyler(this._schemaTableGrid, this.themeService));
			this._schemaTableGrid.ariaLabel = 'Schemas Grid';
			this._register(this._schemaTableGrid.onClick((e) => {
				if (e.cell) {
					let row = this._schemaTableGrid.grid.getDataItem(e.cell.row);
					let field = this._schemaTableGrid.grid.getColumns()[e.cell.cell].field;
					let value = row[field];
					this.row = e.cell.row;
					this.cell = e.cell.cell;
					this._cd.detectChanges();
					if (e.cell.row === 0 && e.cell.cell === 0) {
						this._cd.detectChanges();
						this.updateSchemaPage(value);
						this._cd.detectChanges();
					}
				}
			}));
		}
	}

	private updateSchemaPage(tableName: string) {
		this._selectBox.select(2);
		this.changeGranularityView('Table');
		this.updateTablePage(tableName);
	}

	private initDbProperties() {
		this._dbProperties.propertyItems = this.dbPropertyItems;
		this._cd.detectChanges();
	}

	private initDbSchemaGrid() {
		let columns = this.dbSchemaGridColumns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});

		let dbSchemaGridOptions = <Slick.GridOptions<any>>{
			syncColumnCellResize: true,
			enableColumnReorder: false,
			rowHeight: 25,
			enableCellNavigation: true,
			forceFitColumns: false
		};

		this.dbSchemaGridDataView = new Slick.Data.DataView({
			inlineFilters: false
		});

		if (this._dbSchemaGridContainer) {
			this._dbSchemaGrid = new Table(
				this._dbSchemaGridContainer.nativeElement,
				{ columns },
				dbSchemaGridOptions
			);
			this._dbSchemaGrid.grid.setData(this.dbSchemaGridDataView, true);
			this.dbSchemaGridDataView.beginUpdate();
			this.dbSchemaGridDataView.setItems(this.dbModel.schemaItems);
			this.dbSchemaGridDataView.endUpdate();
			this._dbSchemaGrid.autosizeColumns();
			this._dbSchemaGrid.resizeCanvas();
			this._dbSchemaGrid.ariaLabel = 'Schemas Grid';
			this._dbSchemaGrid.grid.onKeyDown.subscribe(e => {
				let event = new StandardKeyboardEvent(<unknown>e as KeyboardEvent);
				if (event.equals(KeyCode.Enter)) {
					this._selectBox.select(1);
					this.changeGranularityView('Schema');
				}
			});
			this._register(attachTableStyler(this._dbSchemaGrid, this.themeService));
			this._register(this._dbSchemaGrid.onClick((e) => {
				if (e.cell) {
					let row = this._dbSchemaGrid.grid.getDataItem(e.cell.row);
					let field = this._dbSchemaGrid.grid.getColumns()[e.cell.cell].field;
					let value = row[field];
					this.row = e.cell.row;
					this.cell = e.cell.cell;
					if (e.cell.cell === 0) {
						this._cd.detectChanges();
						this._selectBox.select(1);
						this.currSchemaModel = this.schemaModels.get(value);
						this.changeGranularityView('Schema');
						this._cd.detectChanges();
					}
				}
			}));
		}
	}

	private initDbTableGrid() {
		let columns = this.dbTableGridColumns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});

		let dbTableGridOptions = <Slick.GridOptions<any>>{
			syncColumnCellResize: true,
			enableColumnReorder: false,
			rowHeight: 25,
			enableCellNavigation: true,
			forceFitColumns: false
		};

		this.dbTableGridDataView = new Slick.Data.DataView({
			inlineFilters: false
		});

		if (this._dbTableGridContainer) {
			this._dbTableGrid = new Table(
				this._dbTableGridContainer.nativeElement,
				{ columns },
				dbTableGridOptions
			);
			this._dbTableGrid.grid.setData(this.dbTableGridDataView, true);
			this.dbTableGridDataView.beginUpdate();
			this.dbTableGridDataView.setItems(this.dbModel.tableItems);
			this.dbTableGridDataView.endUpdate();
			this._dbTableGrid.autosizeColumns();
			this._dbTableGrid.resizeCanvas();
			this._register(attachTableStyler(this._dbTableGrid, this.themeService));
			this._register(this._dbTableGrid.onClick((e) => {
				if (e.cell) {
					let row = this._dbTableGrid.grid.getDataItem(e.cell.row);
					let field = this._dbTableGrid.grid.getColumns()[e.cell.cell].field;
					let value = row[field];
					this.row = e.cell.row;
					this.cell = e.cell.cell;
					this._cd.detectChanges();
					if (e.cell.cell === 0) {
						this._cd.detectChanges();
						this._selectBox.select(2);
						this.currTableModel = this.tableModels.get(value);
						this.changeGranularityView('Table');
						this._cd.detectChanges();
					}
				}
			}));
		}
	}

	private changeGranularityView(view: any) {
		switch (view) {
			case 'Database': {
				this.showDatabase = true;
				this.showSchema = false;
				this.showTable = false;
				this._cd.detectChanges();
				this.initDbProperties();
				this.initDbSchemaGrid();
				this.initDbTableGrid();
				break;
			}
			case 'Schema': {
				this.showSchema = true;
				this.showDatabase = false;
				this.showTable = false;
				this._cd.detectChanges();
				this.initSchemaProperties();
				this.initSchemaTablesGrid();
				break;
			}
			case 'Table': {
				this.showTable = true;
				this.showDatabase = false;
				this.showSchema = false;
				this._cd.detectChanges();
				this.initColumnGrid();
				this.initRelationshipGrid();
				this.initTableProperties();
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

	}
}


