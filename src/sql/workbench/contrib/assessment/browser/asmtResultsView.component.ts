/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/asmt';
import 'vs/css!./media/detailview';

import * as nls from 'vs/nls';
import * as azdata from 'azdata';
import * as dom from 'vs/base/browser/dom';
import { Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, OnInit, OnDestroy, AfterContentChecked } from '@angular/core';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { Table } from 'sql/base/browser/ui/table/table';
import { AsmtViewComponent } from 'sql/workbench/contrib/assessment/browser/asmtView.component';
import { HeaderFilter } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { attachButtonStyler } from 'sql/platform/theme/common/styler';
import { find } from 'vs/base/common/arrays';
import { RowDetailView, ExtendedItem } from 'sql/base/browser/ui/table/plugins/rowDetailView';
import {
	IAsmtActionInfo,
	AsmtServerSelectItemsAction,
	AsmtServerInvokeItemsAction,
	AsmtDatabaseSelectItemsAction,
	AsmtDatabaseInvokeItemsAction,
	AsmtExportAsScriptAction,
	AsmtSamplesLinkAction
} from 'sql/workbench/contrib/assessment/browser/asmtActions';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { IAction } from 'vs/base/common/actions';
import * as Utils from 'sql/platform/connection/common/utils';
import { escape } from 'sql/base/common/strings';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { AssessmentType, AssessmentTargetType, TELEMETRY_VIEW_EVENT } from 'sql/workbench/contrib/assessment/browser/consts';


export const ASMTRESULTSVIEW_SELECTOR: string = 'asmt-results-view-component';
export const ROW_HEIGHT: number = 25;
export const ACTIONBAR_PADDING: number = 10;

const PLACEHOLDER_LABEL = nls.localize('asmt.NoResultsInitial', "Nothing to show. Invoke assessment to get results");
const PLACEHOLDER_NO_RESULTS_LABEL = nls.localize('asmt.TargetComplient', "is totally compliant with the best practices. Good job!");
const COLUMN_MESSAGE_ID: string = 'message';

const COLUMN_MESSAGE_TITLE: { [mode: number]: string } = {
	[AssessmentType.AvailableRules]: nls.localize('asmt.column.displayName', "Display Name"),
	[AssessmentType.InvokeAssessment]: nls.localize('asmt.column.message', "Message"),
};
const TARGET_ICON_CLASS: { [targetType: number]: string } = {
	[AssessmentTargetType.Database]: 'defaultDatabaseIcon',
	[AssessmentTargetType.Server]: 'defaultServerIcon'
};

enum AssessmentResultItemKind {
	RealResult = 0,
	Warning = 1,
	Error = 2
}

const KIND_CLASS: { [kind: number]: string } = {
	[AssessmentResultItemKind.Error]: 'error-val',
	[AssessmentResultItemKind.Warning]: 'warning-val',
	[AssessmentResultItemKind.RealResult]: ''
};


export interface IAssessmentComponent {
	showProgress(mode: AssessmentType): any;
	showInitialResults(result: azdata.AssessmentResult, method: AssessmentType): any;
	appendResults(result: azdata.AssessmentResult, method: AssessmentType): any;
	stopProgress(mode: AssessmentType): any;
	resultItems: azdata.AssessmentResultItem[];
	isActive: boolean;
}


@Component({
	selector: ASMTRESULTSVIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./asmtResultsView.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => AsmtResultsViewComponent) }],
})

export class AsmtResultsViewComponent extends TabChild implements IAssessmentComponent, OnInit, OnDestroy, AfterContentChecked {
	protected _parentComponent: AsmtViewComponent;
	protected _table: Table<any>;
	protected _visibilityElement: ElementRef;
	protected isVisible: boolean = false;
	protected isInitialized: boolean = false;
	protected isRefreshing: boolean = false;
	protected _actionBar: Taskbar;

	private columns: Array<Slick.Column<any>> = [
		{
			name: nls.localize('asmt.column.target', "Target"),
			formatter: this.renderTarget,
			field: 'targetName',
			width: 80,
			id: 'target'
		},
		{ name: nls.localize('asmt.column.severity', "Serverity"), field: 'severity', maxWidth: 90, id: 'severity' },
		{
			name: nls.localize('asmt.column.message', "Message"),
			field: 'message',
			width: 300,
			id: COLUMN_MESSAGE_ID,
			formatter: (_row, _cell, _value, _columnDef, dataContext) => this.appendHelplink(dataContext.message, dataContext.helpLink, dataContext.kind, this.wrapByKind),
		},
		{
			name: nls.localize('asmt.column.tags', "Tags"),
			field: 'tags',
			width: 80,
			id: 'tags',
			formatter: (row, cell, value, columnDef, dataContext) => this.renderTags(row, cell, value, columnDef, dataContext)
		},
		{ name: nls.localize('asmt.column.checkId', "Check ID"), field: 'checkId', maxWidth: 140, id: 'checkId' }
	];
	private dataView: any;
	private filterPlugin: any;
	private isServerMode: boolean;
	private rowDetail: RowDetailView<Slick.SlickData>;
	private exportActionItem: IAction;
	private gridPlaceholder: JQuery<HTMLElement>;
	private placeholderNoResultsLabel: string;
	private spinner: { [mode: number]: HTMLElement } = Object.create(null);
	private lastInvokedResults: azdata.AssessmentResultItem[];

	@ViewChild('resultsgrid') _gridEl: ElementRef;
	@ViewChild('actionbarContainer') protected actionBarContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => AsmtViewComponent)) private _asmtViewComponent: AsmtViewComponent,
		@Inject(IWorkbenchThemeService) private _themeService: IWorkbenchThemeService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IDashboardService) _dashboardService: IDashboardService,
		@Inject(IAdsTelemetryService) private _telemetryService: IAdsTelemetryService
	) {
		super();
		let self = this;
		let profile = this._commonService.connectionManagementService.connectionInfo.connectionProfile;

		this.isServerMode = !profile.databaseName || Utils.isMaster(profile);

		if (this.isServerMode) {
			this.placeholderNoResultsLabel = `${nls.localize('instance', "Instance")} ${profile.serverName} ${PLACEHOLDER_NO_RESULTS_LABEL}`;
		} else {
			this.placeholderNoResultsLabel = `${nls.localize('database', "Database")} ${profile.databaseName} ${PLACEHOLDER_NO_RESULTS_LABEL}`;
		}

		_dashboardService.onLayout((d) => {
			self.layout();
		});
	}

	ngOnInit(): void {
		this._visibilityElement = this._gridEl;
		this._parentComponent = this._asmtViewComponent;
		this._telemetryService.sendViewEvent(TELEMETRY_VIEW_EVENT);
	}

	ngOnDestroy(): void {
		this.isVisible = false;
	}

	ngAfterContentChecked(): void {
		if (this._visibilityElement && this._parentComponent) {
			if (this.isVisible === false && this._visibilityElement.nativeElement.offsetParent !== null) {
				this.isVisible = true;
				if (!this.isInitialized) {
					this.initializeComponent();
					this.layout();
					this.isInitialized = true;
				}
			} else if (this.isVisible === true && this._visibilityElement.nativeElement.offsetParent === null) {
				this.isVisible = false;
			}
		}
	}

	public get resultItems(): azdata.AssessmentResultItem[] {
		return this.lastInvokedResults;
	}

	public get isActive(): boolean {
		return this.isVisible;
	}

	public layout(): void {
		let asmtViewToolbar = jQuery(`${ASMTRESULTSVIEW_SELECTOR} .asmt-actionbar-container`).get(0);
		let statusBar = jQuery('.part.statusbar').get(0);

		if (asmtViewToolbar && statusBar) {
			let toolbarBottom = asmtViewToolbar.getBoundingClientRect().bottom + ACTIONBAR_PADDING;
			let statusTop = statusBar.getBoundingClientRect().top;
			this._table.layout(new dom.Dimension(
				dom.getContentWidth(this._gridEl.nativeElement),
				statusTop - toolbarBottom));

			let gridCanvasWidth = this._table.grid.getCanvasNode().clientWidth;
			this.gridPlaceholder.css('left', `${((gridCanvasWidth - this.gridPlaceholder.width()) / 2).toString()}px`);

		}
	}

	public showProgress(mode: AssessmentType) {
		this.spinner[mode].style.visibility = 'visible';

		if (this.isVisible) {
			this._cd.detectChanges();
		}
	}

	public showInitialResults(result: azdata.AssessmentResult, method: AssessmentType) {
		if (result) {
			if (method === AssessmentType.InvokeAssessment) {
				this.lastInvokedResults = result.items;
			} else {
				this.lastInvokedResults = [];
			}

			this.displayResults(result.items, method);
			if (result.items.length > 0) {
				this._asmtViewComponent.displayAssessmentInfo(result.apiVersion, result.items[0].rulesetVersion);
			}
		}

		if (this.isVisible) {
			this._cd.detectChanges();
		}

		this._table.grid.invalidate();
	}

	public appendResults(result: azdata.AssessmentResult, method: AssessmentType) {
		if (method === AssessmentType.InvokeAssessment) {
			this.lastInvokedResults.push(...result.items);
		}

		if (result) {
			this.dataView.beginUpdate();
			result.items.forEach((asmtResult, index) => {
				this.dataView.addItem(this.convertToDataViewItems(asmtResult, index, method));
			});

			this.dataView.reSort();
			this.dataView.endUpdate();
			this.dataView.refresh();
			this._table.autosizeColumns();
			this._table.resizeCanvas();
		}

		if (this.isVisible) {
			this._cd.detectChanges();
		}

		this._table.grid.invalidate();
	}

	public stopProgress(mode: AssessmentType) {
		this.spinner[mode].style.visibility = 'hidden';
		if (this.isVisible) {
			this._cd.detectChanges();
		}
	}

	private initializeComponent() {
		let columns = this.columns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});
		let options = <Slick.GridOptions<any>>{
			syncColumnCellResize: true,
			enableColumnReorder: false,
			rowHeight: ROW_HEIGHT,
			enableCellNavigation: true,
			forceFitColumns: false
		};

		this.dataView = new Slick.Data.DataView({ inlineFilters: false });

		let rowDetail = new RowDetailView({
			cssClass: '_detail_selector',
			process: (item) => {
				(<any>rowDetail).onAsyncResponse.notify({
					'itemDetail': item,
				}, undefined, this);
			},
			useRowClick: true,
			panelRows: 2,
			postTemplate: (itemDetail) => this.appendHelplink(itemDetail.description, itemDetail.helpLink, itemDetail.kind, this.wrapByKind),
			preTemplate: () => '',
			loadOnce: true
		});

		this.rowDetail = rowDetail;
		let columnDef = this.rowDetail.getColumnDefinition();
		columnDef.formatter = (row, cell, value, columnDef, dataContext) => this.detailSelectionFormatter(row, cell, value, columnDef, dataContext as ExtendedItem<Slick.SlickData>);
		columns.unshift(columnDef);

		let filterPlugin = new HeaderFilter<{ inlineFilters: false }>();
		this._register(attachButtonStyler(filterPlugin, this._themeService));
		this.filterPlugin = filterPlugin;
		this.filterPlugin.onFilterApplied.subscribe((e, args) => {
			let filterValues = args.column.filterValues;
			if (filterValues) {
				this.dataView.refresh();
				this._table.grid.resetActiveCell();
			}
		});
		this.filterPlugin.onCommand.subscribe((e, args: any) => {
			this.columnSort(args.column.field, args.command === 'sort-asc');
		});

		// we need to be able to show distinct array values in filter dialog for columns with array data
		filterPlugin['getFilterValues'] = this.getFilterValues;
		filterPlugin['getAllFilterValues'] = this.getAllFilterValues;
		filterPlugin['getFilterValuesByInput'] = this.getFilterValuesByInput;

		jQuery(this._gridEl.nativeElement).empty();
		jQuery(this.actionBarContainer.nativeElement).empty();


		if (this.isServerMode) {
			this.initActionBar(
				this._instantiationService.createInstance(AsmtServerInvokeItemsAction),
				this._instantiationService.createInstance(AsmtServerSelectItemsAction));
		} else {
			let databaseSelectAsmt = this._instantiationService.createInstance(AsmtDatabaseSelectItemsAction);
			let databaseInvokeAsmt = this._instantiationService.createInstance(AsmtDatabaseInvokeItemsAction);
			this.initActionBar(databaseInvokeAsmt, databaseSelectAsmt);

			let connectionInfo = this._commonService.connectionManagementService.connectionInfo;
			databaseSelectAsmt.label = `${AsmtDatabaseSelectItemsAction.LABEL} ${nls.localize('for', "for")} ${connectionInfo.connectionProfile.databaseName}`;
			databaseInvokeAsmt.label = `${AsmtDatabaseInvokeItemsAction.LABEL} ${nls.localize('for', "for")} ${connectionInfo.connectionProfile.databaseName}`;
		}

		this._table = new Table(this._gridEl.nativeElement, { columns }, options);
		this._table.grid.setData(this.dataView, true);
		this._table.registerPlugin(<any>this.rowDetail);
		this._table.registerPlugin(filterPlugin);

		this.gridPlaceholder = jQuery(this._table.grid.getCanvasNode()).html('<span class=\'placeholder\'></span>').find('.placeholder');
		this.gridPlaceholder.text(PLACEHOLDER_LABEL);
	}

	private initActionBar(invokeAction: IAction, selectAction: IAction) {
		this.exportActionItem = this._instantiationService.createInstance(AsmtExportAsScriptAction);

		let taskbar = <HTMLElement>this.actionBarContainer.nativeElement;
		this._actionBar = new Taskbar(taskbar);
		this.spinner[AssessmentType.InvokeAssessment] = Taskbar.createTaskbarSpinner();
		this.spinner[AssessmentType.AvailableRules] = Taskbar.createTaskbarSpinner();

		this._actionBar.setContent([
			{ action: invokeAction },
			{ element: this.spinner[AssessmentType.InvokeAssessment] },
			{ action: selectAction },
			{ element: this.spinner[AssessmentType.AvailableRules] },
			{ action: this.exportActionItem },
			{ action: this._instantiationService.createInstance(AsmtSamplesLinkAction) }
		]);

		let connectionInfo = this._commonService.connectionManagementService.connectionInfo;
		let context: IAsmtActionInfo = { component: this, ownerUri: Utils.generateUri(connectionInfo.connectionProfile.clone(), 'dashboard'), connectionId: connectionInfo.connectionProfile.id };
		this._actionBar.context = context;
		this.exportActionItem.enabled = false;
	}

	private convertToDataViewItems(asmtResult: azdata.AssessmentResultItem, index: number, method: AssessmentType) {
		return {
			id: `${asmtResult.targetType}${this.escapeId(asmtResult.targetName)}${asmtResult.checkId}${index}`,
			severity: asmtResult.level,
			message: method === AssessmentType.InvokeAssessment ? asmtResult.message : asmtResult.displayName,
			tags: this.clearOutDefaultRuleset(asmtResult.tags),
			checkId: asmtResult.checkId,
			targetName: asmtResult.targetName,
			targetType: asmtResult.targetType,
			helpLink: asmtResult.helpLink,
			description: method === AssessmentType.InvokeAssessment ? asmtResult.message : asmtResult.description,
			mode: method,
			kind: asmtResult.kind !== undefined ? asmtResult.kind : AssessmentResultItemKind.RealResult
		};
	}

	private displayResults(results: azdata.AssessmentResultItem[], method: AssessmentType) {
		this._table.grid.updateColumnHeader(COLUMN_MESSAGE_ID, COLUMN_MESSAGE_TITLE[method]);

		let resultViews = results.map((item, index) => this.convertToDataViewItems(item, index, method));

		this.dataView.beginUpdate();
		this.dataView.setItems(resultViews);
		this.dataView.setFilter((item) => this.filter(item));
		this.dataView.endUpdate();
		this.dataView.refresh();

		this._table.autosizeColumns();
		this._table.resizeCanvas();
		this.exportActionItem.enabled = (results.length > 0 && method === AssessmentType.InvokeAssessment);

		if (results.length > 0) {
			this.gridPlaceholder.hide();
		} else {
			this.gridPlaceholder.text(this.placeholderNoResultsLabel);
		}
	}

	private escapeId(value: string): string {
		return escape(value).replace(/[*//]/g, function (match) {
			switch (match) {
				case '*':
				case '/':
					return '_';
				default:
					return match;
			}
		});
	}

	private clearOutDefaultRuleset(tags: string[]): string[] {
		let idx = tags.indexOf('DefaultRuleset');
		if (idx > -1) {
			tags.splice(idx, 1);
		}
		return tags;
	}

	private columnSort(field: string, isAscending: boolean) {
		this.dataView.sort((item1, item2) => {
			if (item1.checkId === undefined || item2.checkId === undefined) {
				return;
			}
			switch (field) {
				case 'tags':
					return item1.tags.toString().localeCompare(item2.tags.toString());
				case 'targetName':
					if (item1.targetType > item2.targetType) {
						return 1;
					} else if (item1.targetType < item2.targetType) {
						return -1;
					} else {
						return item1.targetName.localeCompare(item2.targetName);
					}
			}
			return item1[field].localeCompare(item2[field]);
		}, isAscending);
	}

	private filter(item: any) {
		let columns = this._table.grid.getColumns();
		let value = true;
		for (let i = 0; i < columns.length; i++) {
			let col: any = columns[i];
			let filterValues = col.filterValues;
			if (filterValues && filterValues.length > 0) {
				if (item._parent) {
					value = value && find(filterValues, x => x === item._parent[col.field]);
				} else {
					let colValue = item[col.field];
					if (colValue instanceof Array) {
						value = value && find(filterValues, x => colValue.indexOf(x) >= 0);
					} else {
						value = value && find(filterValues, x => x === colValue);
					}
				}
			}
		}
		return value;
	}

	private wrapByKind(kind: AssessmentResultItemKind, element: string): string {
		if (kind !== AssessmentResultItemKind.RealResult) {
			return `<span class='${KIND_CLASS[kind]}'>${element}</span>`;
		}
		return element;
	}

	private appendHelplink(msg: string, helpLink: string, kind: AssessmentResultItemKind, wrapByKindFunc): string {
		if (msg !== undefined) {
			return `${wrapByKindFunc(kind, escape(msg))}<a class='helpLink' href='${helpLink}' \>${nls.localize('asmt.learnMore', "Learn More")}</a>`;
		}
		return undefined;
	}


	private renderTags(_row, _cell, _value, _columnDef, dataContext) {
		if (dataContext.tags !== undefined) {
			return dataContext.tags.join(`, `);
		}
		return dataContext.tags;
	}

	private renderTarget(_row, _cell, _value, _columnDef, dataContext) {
		return `<div class='carbon-taskbar'><span class='action-label codicon ${TARGET_ICON_CLASS[dataContext.targetType]}'>${dataContext.targetName}</span></div>`;
	}

	private detailSelectionFormatter(_row: number, _cell: number, _value: any, _columnDef: Slick.Column<Slick.SlickData>, dataContext: Slick.SlickData): string | undefined {

		if (dataContext._collapsed === undefined) {
			dataContext._collapsed = true;
			dataContext._sizePadding = 0;	//the required number of pading rows
			dataContext._height = 0;	//the actual height in pixels of the detail field
			dataContext._isPadding = false;
			dataContext._parent = undefined;
		}

		if (dataContext._isPadding === true) {
			//render nothing
		} else if (dataContext._collapsed) {
			return '<div class=\'detailView-toggle expand\'></div>';
		} else {
			const html: Array<string> = [];
			const rowHeight = ROW_HEIGHT;
			const bottomMargin = 5;
			html.push('<div class="detailView-toggle collapse"></div></div>');

			html.push(`<div id='cellDetailView_${dataContext.id}' class='dynamic-cell-detail' `);   //apply custom css to detail
			html.push(`style=\'height:${dataContext._height}px;`); //set total height of padding
			html.push(`top:${rowHeight}px'>`);             //shift detail below 1st row
			html.push(`<div id='detailViewContainer_${dataContext.id}"'  class='detail-container' style='max-height:${(dataContext._height! - rowHeight + bottomMargin)}px'>`); //sub ctr for custom styling
			html.push(`<div id='innerDetailView_${dataContext.id}'>${dataContext._detailContent!}</div></div>`);
			return html.join('');
		}
		return undefined;
	}

	private getFilterValues(dataView: Slick.DataProvider<Slick.SlickData>, column: Slick.Column<any>): Array<any> {
		const seen: Array<string> = [];
		for (let i = 0; i < dataView.getLength(); i++) {
			const value = dataView.getItem(i)[column.field!];
			if (value instanceof Array) {
				for (let item = 0; item < value.length; item++) {
					if (!seen.some(x => x === value[item])) {
						seen.push(value[item]);
					}
				}
			} else {
				if (!seen.some(x => x === value)) {
					seen.push(value);
				}
			}
		}
		return seen;
	}

	private getAllFilterValues(data: Array<Slick.SlickData>, column: Slick.Column<any>) {
		const seen: Array<any> = [];
		for (let i = 0; i < data.length; i++) {
			const value = data[i][column.field!];
			if (value instanceof Array) {
				for (let item = 0; item < value.length; item++) {
					if (!seen.some(x => x === value[item])) {
						seen.push(value[item]);
					}
				}
			} else {
				if (!seen.some(x => x === value)) {
					seen.push(value);
				}
			}
		}

		return seen.sort((v) => { return v; });
	}

	private getFilterValuesByInput($input: JQuery<HTMLElement>): Array<string> {
		const column = $input.data('column'),
			filter = $input.val() as string,
			dataView = this['grid'].getData() as Slick.DataProvider<Slick.SlickData>,
			seen: Array<any> = [];

		for (let i = 0; i < dataView.getLength(); i++) {
			const value = dataView.getItem(i)[column.field];
			if (value instanceof Array) {
				if (filter.length > 0) {
					const itemValue = !value ? [] : value;
					const lowercaseFilter = filter.toString().toLowerCase();
					const lowercaseVals = itemValue.map(v => v.toLowerCase());
					for (let valIdx = 0; valIdx < value.length; valIdx++) {
						if (!seen.some(x => x === value[valIdx]) && lowercaseVals[valIdx].indexOf(lowercaseFilter) > -1) {
							seen.push(value[valIdx]);
						}
					}
				}
				else {
					for (let item = 0; item < value.length; item++) {
						if (!seen.some(x => x === value[item])) {
							seen.push(value[item]);
						}
					}
				}

			} else {
				if (filter.length > 0) {
					const itemValue = !value ? '' : value;
					const lowercaseFilter = filter.toString().toLowerCase();
					const lowercaseVal = itemValue.toString().toLowerCase();

					if (!seen.some(x => x === value) && lowercaseVal.indexOf(lowercaseFilter) > -1) {
						seen.push(value);
					}
				}
				else {
					if (!seen.some(x => x === value)) {
						seen.push(value);
					}
				}
			}
		}

		return seen.sort((v) => { return v; });
	}
}
