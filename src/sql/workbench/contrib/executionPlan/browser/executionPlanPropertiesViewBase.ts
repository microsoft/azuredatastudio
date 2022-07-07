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

	constructor(
		public _parentContainer: HTMLElement,
		private _themeService: IThemeService
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

		this._tableComponent = new TreeGrid(table, {
			columns: []
		}, {
			rowHeight: RESULTS_GRID_DEFAULTS.rowHeight,
			forceFitColumns: true,
			defaultColumnWidth: 120
		});
		attachTableStyler(this._tableComponent, this._themeService);

		new ResizeObserver((e) => {
			this.resizeSash.layout();
			this.resizeTable();
		}).observe(_parentContainer);
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

