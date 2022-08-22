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
import { sortAlphabeticallyIconClassNames, sortByDisplayOrderIconClassNames, sortReverseAlphabeticallyIconClassNames } from 'sql/workbench/contrib/executionPlan/browser/constants';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { RESULTS_GRID_DEFAULTS } from 'sql/workbench/common/constants';
import { contrastBorder, listHoverBackground } from 'vs/platform/theme/common/colorRegistry';
import { TreeGrid } from 'sql/base/browser/ui/table/treeGrid';
import { ISashEvent, IVerticalSashLayoutProvider, Orientation, Sash } from 'vs/base/browser/ui/sash/sash';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { isString } from 'vs/base/common/types';
import { CopyKeybind } from 'sql/base/browser/ui/table/plugins/copyKeybind.plugin';

export abstract class ExecutionPlanPropertiesViewBase implements IVerticalSashLayoutProvider {
	// Title bar with close button action
	private _titleBarContainer!: HTMLElement;
	private _titleBarTextContainer!: HTMLElement;
	private _titleBarActionsContainer!: HTMLElement;
	private _titleActions: ActionBar;

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

	constructor(
		public _parentContainer: HTMLElement,
		private _themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextMenuService private _contextMenuService: IContextMenuService
	) {

		const sashContainer = DOM.$('.properties-sash');
		this._parentContainer.appendChild(sashContainer);

		this.resizeSash = new Sash(sashContainer, this, { orientation: Orientation.VERTICAL, size: 3 });
		let originalWidth = 0;
		this.resizeSash.onDidStart((e: ISashEvent) => {
			originalWidth = this._parentContainer.clientWidth;
		});
		this.resizeSash.onDidChange((evt: ISashEvent) => {
			const change = evt.startX - evt.currentX;
			const newWidth = originalWidth + change;
			if (newWidth < 200) {
				return;
			}
			this._parentContainer.style.flex = `0 0 ${newWidth}px`;
			propertiesContent.style.width = `${newWidth}px`;
		});
		this.resizeSash.onDidEnd(() => {
		});

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
		this._titleActions = new ActionBar(this._titleBarActionsContainer, {
			orientation: ActionsOrientation.HORIZONTAL, context: this
		});
		this._titleActions.pushAction([new ClosePropertyViewAction()], { icon: true, label: false });

		this._headerContainer = DOM.$('.header');
		propertiesContent.appendChild(this._headerContainer);

		this._headerActionsContainer = DOM.$('.table-action-bar');
		propertiesContent.appendChild(this._headerActionsContainer);
		this._headerActions = new ActionBar(this._headerActionsContainer, {
			orientation: ActionsOrientation.HORIZONTAL, context: this
		});
		this._headerActions.pushAction([new SortPropertiesByDisplayOrderAction(), new SortPropertiesAlphabeticallyAction(), new SortPropertiesReverseAlphabeticallyAction()], { icon: true, label: false });


		this._tableContainer = DOM.$('.table-container');
		propertiesContent.appendChild(this._tableContainer);

		const table = DOM.$('.table');
		this._tableContainer.appendChild(table);

		this._selectionModel = new CellSelectionModel<Slick.SlickData>();

		this._tableComponent = new TreeGrid(table, {
			columns: []
		}, {
			rowHeight: RESULTS_GRID_DEFAULTS.rowHeight,
			forceFitColumns: true,
			defaultColumnWidth: 120,
			editable: true,
			autoEdit: false
		});
		attachTableStyler(this._tableComponent, this._themeService);
		this._tableComponent.setSelectionModel(this._selectionModel);

		const contextMenuAction = [
			this._instantiationService.createInstance(CopyTableData),
		];

		this._tableComponent.onContextMenu(e => {
			this._contextMenuService.showContextMenu({
				getAnchor: () => e.anchor,
				getActions: () => contextMenuAction,
				getActionsContext: () => this.getCopyString()
			});
		});

		let copyHandler = new CopyKeybind<any>();
		this._tableComponent.registerPlugin(copyHandler);

		copyHandler.onCopy(e => {
			this._instantiationService.createInstance(CopyTableData).run(this.getCopyString());
		});

		new ResizeObserver((e) => {
			this.resizeSash.layout();
			this.resizeTable();
		}).observe(_parentContainer);
	}


	public getCopyString(): string {
		const selectedDataRange = this._selectionModel.getSelectedRanges()[0];
		let csvString = '';
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
		this._tableComponent.setData(data);
		this.resizeTable();
	}

	public updateTableColumns(columns: Slick.Column<Slick.SlickData>[]) {
		this._tableComponent.columns = columns;
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
		super(SortPropertiesAlphabeticallyAction.ID, SortPropertiesAlphabeticallyAction.LABEL, sortReverseAlphabeticallyIconClassNames);
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
