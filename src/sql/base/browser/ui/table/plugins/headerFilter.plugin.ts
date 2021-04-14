// Adopted and converted to typescript from https://github.com/danny-sg/slickgrid-spreadsheet-plugins/blob/master/ext.headerfilter.js
// heavily modified

import { IButtonStyles } from 'vs/base/browser/ui/button/button';
import { localize } from 'vs/nls';

import { Button } from 'sql/base/browser/ui/button/button';
import { FilterableColumn } from 'sql/base/browser/ui/table/interfaces';
import { escape } from 'sql/base/common/strings';
import { addDisposableListener } from 'vs/base/browser/dom';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { withNullAsUndefined } from 'vs/base/common/types';
import { IDisposableDataProvider } from 'sql/base/common/dataProvider';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { IInputBoxStyles, InputBox } from 'sql/base/browser/ui/inputBox/inputBox';

export type HeaderFilterCommands = 'sort-asc' | 'sort-desc';

export interface CommandEventArgs<T extends Slick.SlickData> {
	grid: Slick.Grid<T>,
	column: Slick.Column<T>,
	command: HeaderFilterCommands
}

export interface ITableFilterStyle extends IButtonStyles, IInputBoxStyles { }

const ShowFilterText: string = localize('headerFilter.showFilter', "Show Filter");

export class HeaderFilter<T extends Slick.SlickData> {

	public onFilterApplied = new Slick.Event<{ grid: Slick.Grid<T>, column: FilterableColumn<T> }>();
	public onCommand = new Slick.Event<CommandEventArgs<T>>();

	private grid!: Slick.Grid<T>;
	private handler = new Slick.EventHandler();

	private $menu?: JQuery<HTMLElement>;
	private okButton?: Button;
	private clearButton?: Button;
	private cancelButton?: Button;
	private sortAscButton?: Button;
	private sortDescButton?: Button;
	private searchInputBox?: InputBox;
	private workingFilters!: Array<string>;
	private columnDef!: FilterableColumn<T>;
	private filterStyles?: ITableFilterStyle;
	private disposableStore = new DisposableStore();
	private _enabled: boolean = true;

	constructor(private readonly contextViewProvider: IContextViewProvider) {
	}

	public init(grid: Slick.Grid<T>): void {
		this.grid = grid;
		this.handler.subscribe(this.grid.onHeaderCellRendered, (e: Event, args: Slick.OnHeaderCellRenderedEventArgs<T>) => this.handleHeaderCellRendered(e, args))
			.subscribe(this.grid.onBeforeHeaderCellDestroy, (e: Event, args: Slick.OnBeforeHeaderCellDestroyEventArgs<T>) => this.handleBeforeHeaderCellDestroy(e, args))
			.subscribe(this.grid.onClick, (e: DOMEvent) => this.handleBodyMouseDown(e as MouseEvent))
			.subscribe(this.grid.onColumnsResized, () => this.columnsResized())
			.subscribe(this.grid.onKeyDown, (e: DOMEvent) => this.handleKeyDown(e as KeyboardEvent));
		this.grid.setColumns(this.grid.getColumns());

		this.disposableStore.add(addDisposableListener(document.body, 'mousedown', e => this.handleBodyMouseDown(e)));
		this.disposableStore.add(addDisposableListener(document.body, 'keydown', e => this.handleKeyDown(e)));
	}

	public destroy() {
		this.handler.unsubscribeAll();
		this.disposableStore.dispose();
	}

	private handleKeyDown(e: KeyboardEvent): void {
		if (this.$menu && (e.key === 'Escape' || e.keyCode === 27)) {
			this.hideMenu();
			e.preventDefault();
			e.stopPropagation();
		}
	}

	private handleBodyMouseDown(e: MouseEvent): void {
		if (this.$menu && this.$menu[0] !== e.target && !jQuery.contains(this.$menu[0], e.target as Element)) {
			this.hideMenu();
			e.preventDefault();
			e.stopPropagation();
		}
	}

	private hideMenu() {
		this.contextViewProvider.hideContextView();
	}

	private handleHeaderCellRendered(e: Event, args: Slick.OnHeaderCellRenderedEventArgs<T>) {
		if (!this.enabled) {
			return;
		}
		const column = args.column as FilterableColumn<T>;
		if (column.id === '_detail_selector') {
			return;
		}
		if ((<FilterableColumn<T>>column).filterable === false) {
			return;
		}
		if (args.node.classList.contains('slick-header-with-filter')) {
			// the the filter button has already being added to the header
			return;
		}
		args.node.classList.add('slick-header-with-filter');
		const $el = jQuery(`<button aria-label="${ShowFilterText}" title="${ShowFilterText}"></button>`)
			.addClass('slick-header-menubutton')
			.data('column', column);
		this.setButtonImage($el, column.filterValues?.length > 0);

		$el.click(async (e: JQuery.Event) => {
			e.stopPropagation();
			e.preventDefault();
			await this.showFilter($el[0]);
		});
		$el.appendTo(args.node);
	}

	private handleBeforeHeaderCellDestroy(e: Event, args: Slick.OnBeforeHeaderCellDestroyEventArgs<T>) {
		jQuery(args.node)
			.find('.slick-header-menubutton')
			.remove();
	}

	private createButtonMenuItem(menu: HTMLElement, columnDef: Slick.Column<T>, title: string, command: HeaderFilterCommands, iconClass: string): Button {
		const buttonContainer = document.createElement('div');
		menu.appendChild(buttonContainer);
		const button = new Button(buttonContainer);
		button.icon = { classNames: `slick-header-menuicon ${iconClass}` };
		button.label = title;
		button.onDidClick(async () => {
			await this.handleMenuItemClick(command, columnDef);
		});
		return button;
	}

	private createSearchInput(menu: JQuery<HTMLElement>, columnDef: Slick.Column<T>): InputBox {
		const inputContainer = document.createElement('div');
		inputContainer.style.width = '206px';
		inputContainer.style.marginTop = '5px';
		menu[0].appendChild(inputContainer);
		const input = new InputBox(inputContainer, this.contextViewProvider, {
			placeholder: localize('table.searchPlaceHolder', "Search")
		});
		input.onDidChange(async (newString) => {
			const filterVals = await this.getFilterValuesByInput(columnDef, newString);
			this.updateFilterInputs(menu, columnDef, filterVals);
		});
		return input;
	}

	private updateFilterInputs(menu: JQuery<HTMLElement>, columnDef: FilterableColumn<T>, filterItems: Array<string>) {
		let filterOptions = '<label><input type="checkbox" value="-1" />(Select All)</label>';
		columnDef.filterValues = columnDef.filterValues || [];

		// WorkingFilters is a copy of the filters to enable apply/cancel behaviour
		this.workingFilters = columnDef.filterValues.slice(0);

		for (let i = 0; i < filterItems.length; i++) {
			const filtered = this.workingFilters.some(x => x === filterItems[i]);

			filterOptions += '<label><input type="checkbox" value="' + i + '"'
				+ (filtered ? ' checked="checked"' : '')
				+ '/>' + filterItems[i] + '</label>';
		}
		const $filter = menu.find('.filter');
		$filter.empty().append(jQuery(filterOptions));

		jQuery(':checkbox', $filter).bind('click', (e) => {
			this.workingFilters = this.changeWorkingFilter(filterItems, this.workingFilters, jQuery(e.target));
		});
	}

	private async showFilter(filterButton: HTMLElement): Promise<void> {
		await this.createFilterMenu(filterButton);
		const menuElement = this.$menu[0];
		// Get the absolute coordinates of the filter button
		const offset = jQuery(filterButton).offset();
		// Calculate the position of menu item
		let menuleft = offset.left - menuElement.offsetWidth + filterButton.offsetWidth;
		let menutop = offset.top + filterButton.offsetHeight;
		// Make sure the entire menu is on screen.
		// If there is not enough vertical space under the filter button, we will move up the menu.
		// If the left of the menu is off screen (negative value), we will show the menu next to the left edge of window.
		// We don't really consider the case when there is not enough space to show the entire menu since in that case the application is not usable already.
		if (menutop + menuElement.offsetHeight > window.innerHeight) {
			menutop = window.innerHeight - menuElement.offsetHeight;
		}
		menuleft = menuleft > 0 ? menuleft : 0;

		this.contextViewProvider.showContextView({
			getAnchor: () => {
				return {
					x: menuleft,
					y: menutop
				};
			},
			render: (container: HTMLElement) => {
				container.appendChild(menuElement);
				return {
					dispose: () => {
						if (this.$menu) {
							this.$menu.remove();
							this.$menu = undefined;
						}
					}
				};
			},
			focus: () => {
				this.okButton.focus();
			}
		});
	}

	private async createFilterMenu(filterButton: HTMLElement) {
		const target = withNullAsUndefined(filterButton);
		const $menuButton = jQuery(target);
		this.columnDef = $menuButton.data('column');

		this.columnDef.filterValues = this.columnDef.filterValues || [];

		// WorkingFilters is a copy of the filters to enable apply/cancel behaviour
		this.workingFilters = this.columnDef.filterValues.slice(0);

		let filterItems: Array<string>;

		const provider = this.grid.getData() as IDisposableDataProvider<T>;

		if (provider.getColumnValues) {
			if (this.workingFilters.length === 0) {
				filterItems = await provider.getColumnValues(this.columnDef);
			} else {
				filterItems = await provider.getFilteredColumnValues(this.columnDef);
			}
		} else {
			if (this.workingFilters.length === 0) {
				// Filter based all available values
				filterItems = this.getFilterValues(this.grid.getData() as Slick.DataProvider<T>, this.columnDef);
			}
			else {
				// Filter based on current dataView subset
				filterItems = this.getAllFilterValues((this.grid.getData() as Slick.DataProvider<T>).getItems(), this.columnDef);
			}
		}

		if (!this.$menu) {
			// first add it to the document so that we can get the actual size of the menu
			// later, it will be added to the correct container
			this.$menu = jQuery('<div class="slick-header-menu">').appendTo(document.body);
		}

		this.$menu.empty();

		this.sortAscButton = this.createButtonMenuItem(this.$menu[0], this.columnDef, localize('table.sortAscending', "Sort Ascending"), 'sort-asc', 'ascending');
		this.sortDescButton = this.createButtonMenuItem(this.$menu[0], this.columnDef, localize('table.sortDescending', "Sort Descending"), 'sort-desc', 'descending');
		this.searchInputBox = this.createSearchInput(this.$menu, this.columnDef);

		let filterOptions = '<label class="filter-option"><input type="checkbox" value="-1" />(Select All)</label>';

		for (let i = 0; i < filterItems.length; i++) {
			const filtered = this.workingFilters.some(x => x === filterItems[i]);
			if (filterItems[i] && filterItems[i].indexOf('Error:') < 0) {
				filterOptions += '<label class="filter-option"><input type="checkbox" value="' + i + '"'
					+ (filtered ? ' checked="checked"' : '')
					+ '/>' + escape(filterItems[i]) + '</label>';
			}
		}
		const $filter = jQuery('<div class="filter">')
			.append(jQuery(filterOptions))
			.appendTo(this.$menu);

		const $buttonContainer = jQuery('<div class="filter-menu-button-container">').appendTo(this.$menu);
		const $okButtonDiv = jQuery('<div class="filter-menu-button">').appendTo($buttonContainer);
		const $clearButtonDiv = jQuery('<div class="filter-menu-button">').appendTo($buttonContainer);
		const $cancelButtonDiv = jQuery('<div class="filter-menu-button">').appendTo($buttonContainer);
		this.okButton = new Button($okButtonDiv.get(0));
		this.okButton.label = localize('headerFilter.ok', "OK");
		this.okButton.title = localize('headerFilter.ok', "OK");
		this.okButton.element.id = 'filter-ok-button';
		this.okButton.onDidClick(() => {
			this.columnDef.filterValues = this.workingFilters.splice(0);
			this.setButtonImage($menuButton, this.columnDef.filterValues.length > 0);
			this.handleApply(this.columnDef);
		});

		this.clearButton = new Button($clearButtonDiv.get(0), { secondary: true });
		this.clearButton.label = localize('headerFilter.clear', "Clear");
		this.clearButton.title = localize('headerFilter.clear', "Clear");
		this.clearButton.element.id = 'filter-clear-button';
		this.okButton.onDidClick(() => {
			this.columnDef.filterValues!.length = 0;
			this.setButtonImage($menuButton, false);
			this.handleApply(this.columnDef);
		});

		this.cancelButton = new Button($cancelButtonDiv.get(0), { secondary: true });
		this.cancelButton.label = localize('headerFilter.cancel', "Cancel");
		this.cancelButton.title = localize('headerFilter.cancel', "Cancel");
		this.cancelButton.element.id = 'filter-cancel-button';
		this.cancelButton.onDidClick(() => {
			this.hideMenu();
		});

		this.applyStyles();

		jQuery(':checkbox', $filter).bind('click', (e) => {
			this.workingFilters = this.changeWorkingFilter(filterItems, this.workingFilters, jQuery(e.target));
		});
	}

	public style(styles: ITableFilterStyle): void {
		this.filterStyles = styles;
		this.applyStyles();
	}

	private applyStyles() {
		if (this.filterStyles) {
			this.okButton?.style(this.filterStyles);
			this.cancelButton?.style(this.filterStyles);
			this.clearButton?.style(this.filterStyles);
			this.sortAscButton?.style(this.filterStyles);
			this.sortDescButton?.style(this.filterStyles);
			this.searchInputBox?.style(this.filterStyles);
		}
	}

	private columnsResized() {
		this.hideMenu();
	}

	private changeWorkingFilter(filterItems: Array<string>, workingFilters: Array<string>, $checkbox: JQuery<HTMLElement>) {
		const value = $checkbox.val() as number;
		const $filter = $checkbox.parent().parent();

		if ($checkbox.val() as number < 0) {
			// Select All
			if ($checkbox.prop('checked')) {
				jQuery(':checkbox', $filter).prop('checked', true);
				workingFilters = filterItems.slice(0);
			} else {
				jQuery(':checkbox', $filter).prop('checked', false);
				workingFilters.length = 0;
			}
		} else {
			const index = workingFilters.indexOf(filterItems[value]);

			if ($checkbox.prop('checked') && index < 0) {
				workingFilters.push(filterItems[value]);
				const nextRow = filterItems[Number((parseInt(<string><any>value) + 1).toString())]; // for some reason parseInt is defined as only supporting strings even though it works fine for numbers
				if (nextRow && nextRow.indexOf('Error:') >= 0) {
					workingFilters.push(nextRow);
				}
			}
			else {
				if (index > -1) {
					workingFilters.splice(index, 1);
				}
			}
		}

		return workingFilters;
	}

	private setButtonImage($el: JQuery<HTMLElement>, filtered: boolean) {
		const element: HTMLElement = $el.get(0);
		if (filtered) {
			element.className += ' filtered';
		} else {
			const classList = element.classList;
			if (classList.contains('filtered')) {
				classList.remove('filtered');
			}
		}
	}

	private handleApply(columnDef: Slick.Column<T>) {
		this.hideMenu();
		const provider = this.grid.getData() as IDisposableDataProvider<T>;

		if (provider.filter) {
			provider.filter(this.grid.getColumns());
			this.grid.invalidateAllRows();
			this.grid.updateRowCount();
			this.grid.render();
		}
		this.onFilterApplied.notify({ grid: this.grid, column: columnDef });
	}

	private getFilterValues(dataView: Slick.DataProvider<T>, column: Slick.Column<T>): Array<any> {
		const seen: Set<string> = new Set();
		dataView.getItems().forEach(items => {
			const value = items[column.field!];
			const valueArr = value instanceof Array ? value : [value];
			valueArr.forEach(v => seen.add(v));
		});

		return Array.from(seen);
	}

	private async getFilterValuesByInput(column: Slick.Column<T>, filter: string): Promise<Array<string>> {
		const dataView = this.grid.getData() as IDisposableDataProvider<T>,
			seen: Set<any> = new Set();

		let columnValues: any[];
		if (dataView.getColumnValues) {
			columnValues = await dataView.getColumnValues(this.columnDef);
		} else {
			columnValues = dataView.getItems().map(item => item[column.field]);
		}

		columnValues.forEach(value => {
			const valueArr = value instanceof Array ? value : [(!value ? '' : value)];
			if (filter.length > 0) {
				const lowercaseFilter = filter.toString().toLowerCase();
				valueArr.map(v => v.toLowerCase()).forEach((lowerVal, index) => {
					if (lowerVal.indexOf(lowercaseFilter) > -1) {
						seen.add(valueArr[index]);
					}
				});
			} else {
				valueArr.forEach(v => seen.add(v));
			}
		});

		return Array.from(seen).sort((v) => { return v; });
	}

	private getAllFilterValues(data: Array<T>, column: Slick.Column<T>) {
		const seen: Set<any> = new Set();

		data.forEach(items => {
			const value = items[column.field!];
			const valueArr = value instanceof Array ? value : [value];
			valueArr.forEach(v => seen.add(v));
		});

		return Array.from(seen).sort((v) => { return v; });
	}

	private async handleMenuItemClick(command: HeaderFilterCommands, columnDef: Slick.Column<T>) {
		this.hideMenu();
		const provider = this.grid.getData() as IDisposableDataProvider<T>;

		if (provider.sort && (command === 'sort-asc' || command === 'sort-desc')) {
			await provider.sort({
				grid: this.grid,
				multiColumnSort: false,
				sortCol: this.columnDef,
				sortAsc: command === 'sort-asc'
			});
			this.grid.invalidateAllRows();
			this.grid.updateRowCount();
			this.grid.render();
		}
		this.onCommand.notify({
			grid: this.grid,
			column: columnDef,
			command: command
		});
	}

	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(value: boolean) {
		if (this._enabled !== value) {
			this._enabled = value;
			// force the table header to redraw.
			this.grid.getColumns().forEach((column) => {
				this.grid.updateColumnHeader(column.id);
			});
		}
	}
}
