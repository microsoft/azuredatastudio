/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { ActionBar } from 'sql/base/browser/ui/taskbar/actionbar';
import { IColorTheme, ICssStyleCollector, IThemeService, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { localize } from 'vs/nls';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { Action } from 'vs/base/common/actions';
import { Codicon } from 'vs/base/common/codicons';
import { filterIconClassNames, propertiesSearchDescription, searchPlaceholder, sortAlphabeticallyIconClassNames, sortByDisplayOrderIconClassNames, sortReverseAlphabeticallyIconClassNames } from 'sql/workbench/contrib/executionPlan/browser/constants';
import { attachInputBoxStyler, attachTableStyler } from 'sql/platform/theme/common/styler';
import { RESULTS_GRID_DEFAULTS } from 'sql/workbench/common/constants';
import { contrastBorder, inputBackground, listHoverBackground, listInactiveSelectionBackground } from 'vs/platform/theme/common/colorRegistry';
import { TreeGrid } from 'sql/base/browser/ui/table/treeGrid';
import { ISashEvent, IVerticalSashLayoutProvider, Orientation, Sash } from 'vs/base/browser/ui/sash/sash';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { isString } from 'vs/base/common/types';
import { CopyKeybind } from 'sql/base/browser/ui/table/plugins/copyKeybind.plugin';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { deepClone } from 'vs/base/common/objects';
import { Disposable } from 'vs/base/common/lifecycle';

export abstract class ExecutionPlanPropertiesViewBase extends Disposable implements IVerticalSashLayoutProvider {
	// Title bar with close button action
	private _titleBarContainer!: HTMLElement;
	private _titleBarTextContainer!: HTMLElement;
	private _titleBarActionsContainer!: HTMLElement;
	private _titleActions: ActionBar;


	// search bar and functrion
	private _propertiesSearchInput: InputBox;
	private _propertiesSearchInputContainer: HTMLElement;

	private _searchAndActionBarContainer: HTMLElement;

	// Header container
	private _headerContainer: HTMLElement;

	// Properties actions
	private _headerActionsContainer!: HTMLElement;
	private _headerActions: ActionBar;

	// Properties table
	private _tableComponent: TreeGrid<Slick.SlickData>;
	private _tableContainer!: HTMLElement;

	private _tableWidth;
	private _tableHeight;

	public sortType: PropertiesSortType = PropertiesSortType.DisplayOrder;

	public resizeSash: Sash;

	private _selectionModel: CellSelectionModel<Slick.SlickData>;

	private _tableData: Slick.SlickData[];

	constructor(
		public _parentContainer: HTMLElement,
		private _themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextMenuService private _contextMenuService: IContextMenuService,
		@IContextViewService private _contextViewService: IContextViewService
	) {
		super();
		const sashContainer = DOM.$('.properties-sash');
		this._parentContainer.appendChild(sashContainer);

		this.resizeSash = this._register(new Sash(sashContainer, this, { orientation: Orientation.VERTICAL, size: 3 }));
		let originalWidth = 0;

		this._register(this.resizeSash.onDidStart((e: ISashEvent) => {
			originalWidth = this._parentContainer.clientWidth;
		}));

		this._register(this.resizeSash.onDidChange((evt: ISashEvent) => {
			const change = evt.startX - evt.currentX;
			const newWidth = originalWidth + change;

			if (newWidth < 200) {
				return;
			}

			this._parentContainer.style.flex = `0 0 ${newWidth}px`;
			propertiesContent.style.width = `${newWidth}px`;
		}));

		const propertiesContent = DOM.$('.properties-content');
		this._parentContainer.appendChild(propertiesContent);

		this._titleBarContainer = DOM.$('.title');
		propertiesContent.appendChild(this._titleBarContainer);

		this._titleBarTextContainer = DOM.$('h3');
		this._titleBarTextContainer.classList.add('text');
		this._titleBarTextContainer.innerText = localize('nodePropertyViewTitle', "Properties");
		this._titleBarContainer.appendChild(this._titleBarTextContainer);


		this._titleBarActionsContainer = DOM.$('.action-bar');
		this._titleBarContainer.appendChild(this._titleBarActionsContainer);
		this._titleActions = this._register(new ActionBar(this._titleBarActionsContainer, {
			orientation: ActionsOrientation.HORIZONTAL, context: this
		}));
		this._titleActions.pushAction([this._register(new ClosePropertyViewAction())], { icon: true, label: false });

		this._headerContainer = DOM.$('.header');
		propertiesContent.appendChild(this._headerContainer);

		this._searchAndActionBarContainer = DOM.$('.search-action-bar-container');
		propertiesContent.appendChild(this._searchAndActionBarContainer);

		this._headerActionsContainer = DOM.$('.table-action-bar');
		this._searchAndActionBarContainer.appendChild(this._headerActionsContainer);

		this._headerActions = this._register(new ActionBar(this._headerActionsContainer, {
			orientation: ActionsOrientation.HORIZONTAL, context: this
		}));

		this._headerActions.pushAction([
			this._register(new SortPropertiesByDisplayOrderAction()),
			this._register(new SortPropertiesAlphabeticallyAction()),
			this._register(new SortPropertiesReverseAlphabeticallyAction()),
			this._register(new ExpandAllPropertiesAction()),
			this._register(new CollapseAllPropertiesAction())
		], { icon: true, label: false });

		this._propertiesSearchInputContainer = DOM.$('.table-search');
		this._propertiesSearchInputContainer.classList.add('codicon', filterIconClassNames);

		this._propertiesSearchInput = this._register(new InputBox(this._propertiesSearchInputContainer, this._contextViewService, {
			ariaDescription: propertiesSearchDescription,
			placeholder: searchPlaceholder
		}));

		this._register(attachInputBoxStyler(this._propertiesSearchInput, this._themeService));
		this._propertiesSearchInput.element.classList.add('codicon', filterIconClassNames);
		this._searchAndActionBarContainer.appendChild(this._propertiesSearchInputContainer);
		this._register(this._propertiesSearchInput.onDidChange(e => {
			this.searchTable(e);
		}));

		this._tableContainer = DOM.$('.table-container');
		propertiesContent.appendChild(this._tableContainer);

		const table = DOM.$('.table');
		this._tableContainer.appendChild(table);

		this._selectionModel = new CellSelectionModel<Slick.SlickData>();

		this._tableComponent = this._register(new TreeGrid(table, {
			columns: []
		}, {
			rowHeight: RESULTS_GRID_DEFAULTS.rowHeight,
			forceFitColumns: true,
			defaultColumnWidth: 120,
			editable: true,
			autoEdit: false
		}));

		this._register(attachTableStyler(this._tableComponent, this._themeService));
		this._tableComponent.setSelectionModel(this._selectionModel);

		const contextMenuAction = [
			this._register(this._instantiationService.createInstance(CopyTableData)),
		];

		this._register(this._tableComponent.onContextMenu(e => {
			this._contextMenuService.showContextMenu({
				getAnchor: () => e.anchor,
				getActions: () => contextMenuAction,
				getActionsContext: () => this.getCopyString()
			});
		}));

		let copyHandler = new CopyKeybind<any>();
		this._tableComponent.registerPlugin(copyHandler);

		this._register(copyHandler.onCopy(e => {
			this._instantiationService.createInstance(CopyTableData).run(this.getCopyString());
		}));

		new ResizeObserver((e) => {
			this.resizeSash.layout();
			this.resizeTable();
		}).observe(_parentContainer);
	}

	public getCopyString(): string {
		let csvString = '';

		const selectedDataRange = this._selectionModel.getSelectedRanges()[0];
		if (selectedDataRange) {
			const data = [];

			for (let rowIndex = selectedDataRange.fromRow; rowIndex <= selectedDataRange.toRow; rowIndex++) {
				const dataRow = this._tableComponent.getData().getItem(rowIndex);
				const row = [];
				for (let colIndex = selectedDataRange.fromCell; colIndex <= selectedDataRange.toCell; colIndex++) {
					const dataItem = dataRow[this._tableComponent.grid.getColumns()[colIndex].field];
					if (dataItem) {
						row.push(isString(dataItem) ? dataItem : dataItem.displayText ?? dataItem.text ?? dataItem.title);
					} else {
						row.push('');
					}
				}
				data.push(row);
			}

			csvString = data.map(row =>
				row.map(x => `${x}`).join('\t')
			).join('\n');
		}

		return csvString;
	}

	getVerticalSashLeft(sash: Sash): number {
		return 0;
	}
	getVerticalSashTop?(sash: Sash): number {
		return 0;
	}
	getVerticalSashHeight?(sash: Sash): number {
		return this._parentContainer.clientHeight;
	}

	public setTitle(v: string): void {
		this._titleBarTextContainer.innerText = v;
	}

	public setHeader(c: HTMLElement): void {
		this._headerContainer.appendChild(c);
	}

	public set tableHeight(value: number) {
		if (this.tableHeight !== value) {
			this._tableHeight = value;
		}
	}

	public set tableWidth(value: number) {
		if (this._tableWidth !== value) {
			this._tableWidth = value;
		}
	}

	public get tableWidth(): number {
		return this._tableWidth;
	}

	public get tableHeight(): number {
		return this._tableHeight;
	}

	public abstract refreshPropertiesTable();

	public toggleVisibility(): void {
		this._parentContainer.style.display = this._parentContainer.style.display === 'none' ? 'flex' : 'none';
	}

	public populateTable(columns: Slick.Column<Slick.SlickData>[], data: { [key: string]: string }[]) {
		this._tableComponent.columns = columns;
		this._tableContainer.scrollTo(0, 0);
		this._tableData = data;
		this._propertiesSearchInput.value = '';
		this._tableComponent.setData(this.flattenTableData(data, -1));
		this.resizeTable();
	}

	private repopulateTable() {
		this._tableComponent.setData(this.flattenTableData(this._tableData, -1));
		this.resizeTable();
	}

	public updateTableColumns(columns: Slick.Column<Slick.SlickData>[]) {
		this._tableComponent.columns = columns;
	}

	public setPropertyRowsExpanded(expand: boolean): void {
		this.setPropertyRowsExpandedHelper(this._tableComponent.getData().getItems(), expand);
		this.repopulateTable();
	}

	/**
	 * Expands or collapses the rows of the properties table recursively.
	 *
	 * @param rows The rows to be expanded or collapsed.
	 * @param expand Flag indicating if the rows should be expanded or collapsed.
	 */
	private setPropertyRowsExpandedHelper(rows: Slick.SlickData[], expand: boolean): void {
		rows.forEach(row => {
			if (row.treeGridChildren && row.treeGridChildren.length > 0) {
				row.expanded = expand;

				this.setPropertyRowsExpandedHelper(row.treeGridChildren, expand);
			}
		});
	}

	private resizeTable(): void {
		const spaceOccupied = (this._titleBarContainer.getBoundingClientRect().height
			+ this._headerContainer.getBoundingClientRect().height
			+ this._headerActionsContainer.getBoundingClientRect().height);

		this.tableHeight = (this._parentContainer.getBoundingClientRect().height - spaceOccupied - 15);
		this.tableWidth = (this._parentContainer.getBoundingClientRect().width - 15);
		this._tableComponent.layout(new DOM.Dimension(this._tableWidth, this._tableHeight));
		this._tableComponent.resizeCanvas();
	}

	private searchTable(searchString: string): void {
		if (searchString === '') {
			this._tableComponent.setData(this.flattenTableData(this._tableData, -1));
		} else {
			this._tableComponent.setData(
				this.flattenTableData(
					this.searchNestedTableData(searchString, this._tableData).data,
					-1)
			);
		}

		this._tableComponent.rerenderGrid();
	}

	private searchNestedTableData(search: string, data: Slick.SlickData[]): { include: boolean, data: Slick.SlickData[] } {
		let resultData: Slick.SlickData[] = [];
		data.forEach(dataRow => {
			let includeRow = false;

			const columns = this._tableComponent.grid.getColumns();
			for (let i = 0; i < columns.length; i++) {
				let dataValue = '';

				let rawDataValue = dataRow[columns[i].field];
				if (isString(rawDataValue)) {
					dataValue = rawDataValue;
				} else if (rawDataValue !== undefined) {
					dataValue = rawDataValue.text ?? rawDataValue.title;
				}

				if (dataValue?.toLowerCase().includes(search.toLowerCase())) {
					includeRow = true;
					break;
				}
			}

			const rowClone = deepClone(dataRow);
			if (rowClone['treeGridChildren'] !== undefined) {
				const result = this.searchNestedTableData(search, rowClone['treeGridChildren']);
				rowClone['treeGridChildren'] = result.data;
				includeRow = includeRow || result.include;
			}

			if (includeRow) {
				if (rowClone['treeGridChildren'] !== undefined) {
					rowClone['expanded'] = true;
				}

				resultData.push(rowClone);
			}
		});

		return { include: resultData.length > 0, data: resultData };
	}

	private flattenTableData(nestedData: Slick.SlickData[], parentIndex: number, rows: Slick.SlickData[] = []): Slick.SlickData[] {
		if (nestedData === undefined || nestedData.length === 0) {
			return rows;
		}

		nestedData.forEach((dataRow) => {
			rows.push(dataRow);
			dataRow['parent'] = parentIndex;

			if (dataRow['treeGridChildren']) {
				this.flattenTableData(dataRow['treeGridChildren'], rows.length - 1, rows);
			}
		});

		return rows;
	}
}


export class ClosePropertyViewAction extends Action {
	public static ID = 'ep.propertiesView.close';
	public static LABEL = localize('executionPlanPropertyViewClose', "Close");

	constructor() {
		super(ClosePropertyViewAction.ID, ClosePropertyViewAction.LABEL, Codicon.close.classNames);
	}

	public override async run(context: ExecutionPlanPropertiesViewBase): Promise<void> {
		context.toggleVisibility();
	}
}


export class SortPropertiesAlphabeticallyAction extends Action {
	public static ID = 'ep.propertiesView.sortByAlphabet';
	public static LABEL = localize('executionPlanPropertyViewSortAlphabetically', "Alphabetical");

	constructor() {
		super(SortPropertiesAlphabeticallyAction.ID, SortPropertiesAlphabeticallyAction.LABEL, sortAlphabeticallyIconClassNames);
	}

	public override async run(context: ExecutionPlanPropertiesViewBase): Promise<void> {
		context.sortType = PropertiesSortType.Alphabetical;
		context.refreshPropertiesTable();
	}
}

export class SortPropertiesReverseAlphabeticallyAction extends Action {
	public static ID = 'ep.propertiesView.sortByAlphabet';
	public static LABEL = localize('executionPlanPropertyViewSortReverseAlphabetically', "Reverse Alphabetical");

	constructor() {
		super(SortPropertiesReverseAlphabeticallyAction.ID, SortPropertiesReverseAlphabeticallyAction.LABEL, sortReverseAlphabeticallyIconClassNames);
	}

	public override async run(context: ExecutionPlanPropertiesViewBase): Promise<void> {
		context.sortType = PropertiesSortType.ReverseAlphabetical;
		context.refreshPropertiesTable();
	}
}

export class SortPropertiesByDisplayOrderAction extends Action {
	public static ID = 'ep.propertiesView.sortByDisplayOrder';
	public static LABEL = localize('executionPlanPropertyViewSortByDisplayOrder', "Importance");

	constructor() {
		super(SortPropertiesByDisplayOrderAction.ID, SortPropertiesByDisplayOrderAction.LABEL, sortByDisplayOrderIconClassNames);
	}

	public override async run(context: ExecutionPlanPropertiesViewBase): Promise<void> {
		context.sortType = PropertiesSortType.DisplayOrder;
		context.refreshPropertiesTable();
	}
}

export enum PropertiesSortType {
	DisplayOrder,
	Alphabetical,
	ReverseAlphabetical
}

export class ExpandAllPropertiesAction extends Action {
	public static ID = 'ep.propertiesView.expandAllProperties';
	public static LABEL = localize('executionPlanExpandAllProperties', 'Expand All');

	constructor() {
		super(ExpandAllPropertiesAction.ID, ExpandAllPropertiesAction.LABEL, Codicon.expandAll.classNames);
	}

	public override async run(context: ExecutionPlanPropertiesViewBase): Promise<void> {
		context.setPropertyRowsExpanded(true);
	}
}

export class CollapseAllPropertiesAction extends Action {
	public static ID = 'ep.propertiesView.collapseAllProperties';
	public static LABEL = localize('executionPlanCollapseAllProperties', 'Collapse All');

	constructor() {
		super(CollapseAllPropertiesAction.ID, CollapseAllPropertiesAction.LABEL, Codicon.collapseAll.classNames);
	}

	public override async run(context: ExecutionPlanPropertiesViewBase): Promise<void> {
		context.setPropertyRowsExpanded(false);
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {

	const menuBackgroundColor = theme.getColor(listHoverBackground);
	if (menuBackgroundColor) {
		collector.addRule(`
		.properties .title,
		.properties .table-action-bar {
			background-color: ${menuBackgroundColor};
		}
		`);
	}

	const widgetBorderColor = theme.getColor(contrastBorder);
	if (widgetBorderColor) {
		collector.addRule(`
		.properties .title,
		.properties .table-action-bar,
		.mxTooltip {
			border: 1px solid ${widgetBorderColor};
		}
		`);
	}

	const parentRowBackground = theme.getColor(listInactiveSelectionBackground);
	if (parentRowBackground) {
		collector.addRule(`
		.eps-container .ui-widget-content.slick-row[aria-expanded="true"],
		.eps-container .ui-widget-content.slick-row[aria-expanded="false"] {
			background-color: ${parentRowBackground};
		}
		`);
	}

	const searchBarBackground = theme.getColor(inputBackground);
	if (inputBackground) {
		collector.addRule(`
		.eps-container .properties .search-action-bar-container .table-search {
			background-color: ${searchBarBackground};
		}
		`);
	}
});


export class CopyTableData extends Action {
	public static ID = 'ep.CopyTableData';
	public static LABEL = localize('ep.topOperationsCopyTableData', "Copy");

	constructor(
		@IClipboardService private _clipboardService: IClipboardService
	) {
		super(CopyTableData.ID, CopyTableData.LABEL, '');
	}

	public override async run(context: string): Promise<void> {

		this._clipboardService.writeText(context);
	}
}
