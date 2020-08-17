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
import { DiagramRequestResult } from 'sql/workbench/api/common/sqlExtHostTypes';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import PropertiesContainerComponent from 'sql/workbench/browser/modelComponents/propertiesContainer.component';
import { PropertyItem } from 'sql/base/browser/ui/propertiesContainer/propertiesContainer.component';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IDiagramService, DiagramRequestParams, DiagramObject } from 'sql/workbench/services/diagrams/common/interfaces';
import GraphModel from 'sql/workbench/contrib/diagrams/browser/graphModel';
import { TitledComponent } from 'sql/workbench/browser/modelComponents/titledComponent';
import GroupModel from 'sql/workbench/contrib/diagrams/browser/groupModel';
import NodeModel from 'sql/workbench/contrib/diagrams/browser/nodeModel';

const LocalizedStrings = {
	//SECTION_TITLE_API: localize('asmt.section.api.title', "API information"),
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
	private _graphTitle: TitledComponent;

	private _schemaTableGrid: Table<any>;
	public schemaTableGridDataView: Slick.Data.DataView<Slick.SlickData>;

	public graphInit = false;
	public showDatabase = true;
	public showSchema = false;
	public showTable = false;
	public selectedOption = 'Database';
	public granularityOptions = ['Database', 'Schema', 'Table'];
	public row: number;
	public cell: number;

	public diagramMetadata: DiagramRequestResult;
	public graphModel: GraphModel;
	public groupModel: GroupModel;
	public nodeModel: NodeModel;

	@ViewChild('diagramActionbarContainer') protected actionBarContainer: ElementRef;
	@ViewChild('dropDown', { read: ElementRef }) private _dropdownContainer: ElementRef;
	@ViewChild('searchBar') protected _searchBarContainer: ElementRef;

	@ViewChild('nodeInfoGrid') protected _nodeInfoContainer: ElementRef;
	@ViewChild('relatedNodesGrid') protected _relatedNodesContainer: ElementRef;
	@ViewChild('nodeProperties') private _nodeProperties: PropertiesContainerComponent;

	@ViewChild('groupProperties') private _groupProperties: PropertiesContainerComponent;
	@ViewChild('groupNodesGrid') protected _groupNodesContainer: ElementRef;

	@ViewChild('graphProperties') private _graphProperties: PropertiesContainerComponent;
	@ViewChild('graphNodesGrid') protected _graphNodesContainer: ElementRef;
	@ViewChild('graphGroupsGrid') protected _graphGroupsContainer: ElementRef;

	/*const LocalizedStrings = {
		SECTION_TITLE_API: localize('asmt.section.api.title', "API information"),
		API_VERSION: localize('asmt.apiversion', "API Version:"),
		DEFAULT_RULESET_VERSION: localize('asmt.rulesetversion', "Default Ruleset Version:"),
		SECTION_TITLE_SQL_SERVER: localize('asmt.section.instance.title', "SQL Server Instance Details"),
		SERVER_VERSION: localize('asmt.serverversion', "Version:"),
		SERVER_EDITION: localize('asmt.serveredition', "Edition:"),
		SERVER_INSTANCENAME: localize('asmt.instancename', "Instance Name:"),
		SERVER_OSVERSION: localize('asmt.osversion', "OS Version:")
	};*/


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

	public gridOptions = <Slick.GridOptions<any>>{
		syncColumnCellResize: true,
		enableColumnReorder: false,
		rowHeight: 25,
		enableCellNavigation: true,
		forceFitColumns: false
	};

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
		schemaItems: this.dbSchemaItems,
		tableItems: this.dbTableItems
	};
	private _graphGroups: Table<any>;
	graphGroupsDataView: Slick.Data.DataView<Slick.SlickData>;
	graphNodesDataView: Slick.Data.DataView<Slick.SlickData>;
	private _graphNodes: Table<any>;
	groupNodesDataView: Slick.Data.DataView<Slick.SlickData>;
	private _groupNodes: Table<any>;
	nodeInfoDataView: Slick.Data.DataView<Slick.SlickData>;
	private _nodeInfo: Table<any>;
	relatedNodesDataView: Slick.Data.DataView<Slick.SlickData>;
	private _relatedNodes: Table<any>;



	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IDiagramService) private diagramService: IDiagramService,
	) {
		super();
	}

	ngOnInit() {
		this.initSearchBar();
		this.initDropdown();
	}

	ngAfterViewInit() {
		this.initGraphView();
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

	private changeGranularityView(view: any) {
		switch (view) {
			case 'Database': {
				this.showDatabase = true;
				this.showSchema = false;
				this.showTable = false;
				this._cd.detectChanges();
				this._graphProperties.propertyItems = this.graphModel.propertyItems;
				this.initGraphGroupsGrid();
				this.initGraphNodesGrid();
				break;
			}
			case 'Schema': {
				this.showDatabase = false;
				this.showTable = false;
				this._cd.detectChanges();
				if (this.groupModel === undefined) {
					this.initGroupView();
					this.showSchema = true;
				}
				else {
					this.showSchema = true;
					this._cd.detectChanges();
					this.initGroupProperties();
					this.initGroupNodesGrid();
				}
				this._cd.detectChanges();
				break;
			}
			case 'Table': {
				this.showDatabase = false;
				this.showSchema = false;
				this._cd.detectChanges();
				if (this.nodeModel === undefined) {
					this.initNodeView();
					this.showTable = true;
				}
				else {
					this.showTable = true;
					this._cd.detectChanges();
					this.initNodeProperties();
					this.initNodeInfoGrid();
					this.initRelatedNodesGrid();
				}
				this._cd.detectChanges();
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
		this._actionBar.context = {
			ownerUri: this._commonService.connectionManagementService.connectionInfo.ownerUri,
			component: this,
			databaseName: 'Keep_WideWorldImporters',
			schemaName: undefined,
			tableName: undefined,
			diagramView: DiagramObject.Database
		};

	}

	private async initNodeView(): Promise<void> {
		let diagramModelParams: DiagramRequestParams = {
			ownerUri: this._commonService.connectionManagementService.connectionInfo.ownerUri,
			schema: 'Application',
			server: undefined,
			database: 'Keep_WideWorldImporters',
			table: 'Cities',
			diagramView: DiagramObject.Table
		};
		const result: DiagramRequestResult = await this.diagramService.getDiagramModel(diagramModelParams);
		this.nodeModel = new NodeModel('Cities', result.metadata);
		this._cd.detectChanges();
		this.initNodeProperties();
		this.initNodeInfoGrid();
		this.initRelatedNodesGrid();
	}

	private initNodeProperties() {
		this._nodeProperties.propertyItems = this.nodeModel.propertyItems;
	}

	private initNodeInfoGrid() {
		let columns = this.nodeModel.infoColumns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});

		this.nodeInfoDataView = new Slick.Data.DataView({
			inlineFilters: false
		});

		if (this._nodeInfoContainer) {
			this._nodeInfo = new Table(
				this._nodeInfoContainer.nativeElement,
				{ columns },
				this.gridOptions
			);
			this._nodeInfo.grid.setData(this.nodeInfoDataView, true);
			this.nodeInfoDataView.beginUpdate();
			this.nodeInfoDataView.setItems(this.nodeModel.infoItems);
			this.nodeInfoDataView.endUpdate();
			this._nodeInfo.autosizeColumns();
			this._nodeInfo.resizeCanvas();
			this._nodeInfo.ariaLabel = this.nodeModel.infoName + ' Grid';
			this._register(attachTableStyler(this._nodeInfo, this.themeService));
		}
	}

	private initRelatedNodesGrid() {
		let columns = this.nodeModel.relatedNodesColumns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});

		this.relatedNodesDataView = new Slick.Data.DataView({
			inlineFilters: false
		});

		if (this._relatedNodesContainer) {
			this._relatedNodes = new Table(
				this._relatedNodesContainer.nativeElement,
				{ columns },
				this.gridOptions
			);
			this._relatedNodes.grid.setData(this.relatedNodesDataView, true);
			this.relatedNodesDataView.beginUpdate();
			this.relatedNodesDataView.setItems(this.nodeModel.relatedNodesItems);
			this.relatedNodesDataView.endUpdate();
			this._relatedNodes.autosizeColumns();
			this._relatedNodes.resizeCanvas();
			this._relatedNodes.ariaLabel = this.nodeModel.relatedNodesName + ' Grid';
			/*this._graphGroups.grid.onKeyDown.subscribe(e => {
				let event = new StandardKeyboardEvent(<unknown>e as KeyboardEvent);
				if (event.equals(KeyCode.Enter)) {
					this._selectBox.select(1);
					this.changeGranularityView('Schema');
				}
			});*/
			this._register(attachTableStyler(this._relatedNodes, this.themeService));
			/*this._register(this._dbSchemaGrid.onClick((e) => {
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
			}));*/
		}
	}

	private async initGroupView(): Promise<void> {
		let diagramModelParams: DiagramRequestParams = {
			ownerUri: this._commonService.connectionManagementService.connectionInfo.ownerUri,
			schema: 'Application',
			server: undefined,
			database: 'Keep_WideWorldImporters',
			table: undefined,
			diagramView: DiagramObject.Schema
		};
		const result: DiagramRequestResult = await this.diagramService.getDiagramModel(diagramModelParams);
		this.groupModel = new GroupModel('Application', result.metadata);
		this._cd.detectChanges();
		this.initGroupProperties();
		this.initGroupNodesGrid();
	}

	private initGroupNodesGrid() {
		let columns = this.groupModel.nodesColumns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});

		this.groupNodesDataView = new Slick.Data.DataView({
			inlineFilters: false
		});

		if (this._groupNodesContainer) {
			this._groupNodes = new Table(
				this._groupNodesContainer.nativeElement,
				{ columns },
				this.gridOptions
			);
			this._groupNodes.grid.setData(this.groupNodesDataView, true);
			this.groupNodesDataView.beginUpdate();
			this.groupNodesDataView.setItems(this.groupModel.nodeItems);
			this.groupNodesDataView.endUpdate();
			this._groupNodes.autosizeColumns();
			this._groupNodes.resizeCanvas();
			this._groupNodes.ariaLabel = this.groupModel.nodesName + ' Grid';
			/*this._graphGroups.grid.onKeyDown.subscribe(e => {
				let event = new StandardKeyboardEvent(<unknown>e as KeyboardEvent);
				if (event.equals(KeyCode.Enter)) {
					this._selectBox.select(1);
					this.changeGranularityView('Schema');
				}
			});*/
			this._register(attachTableStyler(this._groupNodes, this.themeService));
			/*this._register(this._dbSchemaGrid.onClick((e) => {
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
			}));*/
		}
	}

	private initGroupProperties() {
		this._groupProperties.propertyItems = this.groupModel.propertyItems;
	}

	private async initGraphView(): Promise<void> {
		let diagramModelParams: DiagramRequestParams = {
			ownerUri: this._commonService.connectionManagementService.connectionInfo.ownerUri,
			schema: undefined,
			server: undefined,
			database: 'Keep_WideWorldImporters',
			table: undefined,
			diagramView: DiagramObject.Database
		};
		const result: DiagramRequestResult = await this.diagramService.getDiagramModel(diagramModelParams);
		this.graphModel = new GraphModel('Keep_WideWorldImporters', result.metadata);
		this.graphInit = true;
		this._cd.detectChanges();
		this._graphProperties.propertyItems = this.graphModel.propertyItems;
		this.initGraphGroupsGrid();
		this.initGraphNodesGrid();
		this._cd.detectChanges();
	}
	private initGraphProperties() {
		this._graphProperties.propertyItems = this.graphModel.propertyItems;
	}

	private initGraphGroupsGrid() {
		let columns = this.graphModel.groupsColumns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});

		this.graphGroupsDataView = new Slick.Data.DataView({
			inlineFilters: false
		});

		if (this._graphGroupsContainer) {
			this._graphGroups = new Table(
				this._graphGroupsContainer.nativeElement,
				{ columns },
				this.gridOptions
			);
			this._graphGroups.grid.setData(this.graphGroupsDataView, true);
			this.graphGroupsDataView.beginUpdate();
			this.graphGroupsDataView.setItems(this.graphModel.groupsItems);
			this.graphGroupsDataView.endUpdate();
			this._graphGroups.autosizeColumns();
			this._graphGroups.resizeCanvas();
			this._graphGroups.ariaLabel = this.graphModel.groupsName + ' Grid';
			/*this._graphGroups.grid.onKeyDown.subscribe(e => {
				let event = new StandardKeyboardEvent(<unknown>e as KeyboardEvent);
				if (event.equals(KeyCode.Enter)) {
					this._selectBox.select(1);
					this.changeGranularityView('Schema');
				}
			});*/
			this._register(attachTableStyler(this._graphGroups, this.themeService));
			/*this._register(this._dbSchemaGrid.onClick((e) => {
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
			}));*/
		}
	}

	private initGraphNodesGrid() {
		let columns = this.graphModel.nodesColumns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});

		this.graphNodesDataView = new Slick.Data.DataView({
			inlineFilters: false
		});

		if (this._graphNodesContainer) {
			this._graphNodes = new Table(
				this._graphNodesContainer.nativeElement,
				{ columns },
				this.gridOptions
			);
			this._graphNodes.grid.setData(this.graphNodesDataView, true);
			this.graphNodesDataView.beginUpdate();
			this.graphNodesDataView.setItems(this.graphModel.nodeItems);
			this.graphNodesDataView.endUpdate();
			this._graphNodes.autosizeColumns();
			this._graphNodes.resizeCanvas();
			this._graphNodes.ariaLabel = this.graphModel.nodesName + ' Grid';
			/*this._graphGroups.grid.onKeyDown.subscribe(e => {
				let event = new StandardKeyboardEvent(<unknown>e as KeyboardEvent);
				if (event.equals(KeyCode.Enter)) {
					this._selectBox.select(1);
					this.changeGranularityView('Schema');
				}
			});*/
			this._register(attachTableStyler(this._graphNodes, this.themeService));
			/*this._register(this._dbSchemaGrid.onClick((e) => {
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
			}));*/
		}
	}

	public layout() {

	}
}


