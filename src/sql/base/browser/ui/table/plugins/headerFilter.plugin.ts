// Adopted and converted to typescript from https://github.com/danny-sg/slickgrid-spreadsheet-plugins/blob/master/ext.headerfilter.js
// heavily modified

import { IButtonStyles } from 'vs/base/browser/ui/button/button';
import { localize } from 'vs/nls';

import { Button } from 'sql/base/browser/ui/button/button';
import { escape } from 'sql/base/common/strings';
import { addDisposableListener } from 'vs/base/browser/dom';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { withNullAsUndefined } from 'vs/base/common/types';

interface IExtendedColumn<T> extends Slick.Column<T> {
	filterValues?: Array<string>;
}

export class HeaderFilter<T extends Slick.SlickData> {

	public onFilterApplied = new Slick.Event();
	public onCommand = new Slick.Event();

	private grid: Slick.Grid<T>;
	private handler = new Slick.EventHandler();

	private $menu?: JQuery<HTMLElement>;
	private okButton: Button;
	private clearButton: Button;
	private cancelButton: Button;
	private workingFilters: Array<string>;
	private columnDef: IExtendedColumn<T>;
	private buttonStyles: IButtonStyles;

	private disposableStore = new DisposableStore();

	public init(grid: Slick.Grid<T>): void {
		this.grid = grid;
		this.handler.subscribe(this.grid.onHeaderCellRendered, (e: Event, args: Slick.OnHeaderCellRenderedEventArgs<T>) => this.handleHeaderCellRendered(e, args))
			.subscribe(this.grid.onBeforeHeaderCellDestroy, (e: Event, args: Slick.OnBeforeHeaderCellDestroyEventArgs<T>) => this.handleBeforeHeaderCellDestroy(e, args))
			.subscribe(this.grid.onClick, (e: MouseEvent) => this.handleBodyMouseDown(e))
			.subscribe(this.grid.onColumnsResized, () => this.columnsResized())
			.subscribe(this.grid.onKeyDown, (e: KeyboardEvent) => this.handleKeyDown(e));
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
		if (this.$menu) {
			this.$menu.remove();
			this.$menu = undefined;
		}
	}

	private handleHeaderCellRendered(e: Event, args: Slick.OnHeaderCellRenderedEventArgs<T>) {
		const column = args.column;
		if (column.id === '_detail_selector') {
			return;
		}
		const $el = jQuery('<div tabIndex="0"></div>')
			.addClass('slick-header-menubutton')
			.data('column', column);

		$el.bind('click', (e: KeyboardEvent) => this.showFilter(e)).appendTo(args.node);
		$el.bind('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.keyCode === 13) {
				this.showFilter(e);
			}
		}).appendTo(args.node);
	}

	private handleBeforeHeaderCellDestroy(e: Event, args: Slick.OnBeforeHeaderCellDestroyEventArgs<T>) {
		jQuery(args.node)
			.find('.slick-header-menubutton')
			.remove();
	}

	private addMenuItem(menu: JQuery<HTMLElement>, columnDef: Slick.Column<T>, title: string, command: string) {
		const $item = jQuery('<div class="slick-header-menuitem">')
			.data('command', command)
			.data('column', columnDef)
			.bind('click', (e) => this.handleMenuItemClick(e, command, columnDef))
			.appendTo(menu);

		const $icon = jQuery('<div class="slick-header-menuicon">')
			.appendTo($item);

		if (title === 'Sort Ascending') {
			$icon.get(0).className += ' ascending';
		} else if (title === 'Sort Descending') {
			$icon.get(0).className += ' descending';
		}

		jQuery('<span class="slick-header-menucontent">')
			.text(title)
			.appendTo($item);
	}

	private addMenuInput(menu: JQuery<HTMLElement>, columnDef: Slick.Column<T>) {
		const self = this;
		jQuery('<input class="input" placeholder="Search" style="margin-top: 5px; width: 206px">')
			.data('column', columnDef)
			.bind('keyup', (e) => {
				const filterVals = this.getFilterValuesByInput(jQuery(e.target));
				self.updateFilterInputs(menu, columnDef, filterVals);
			})
			.appendTo(menu);
	}

	private updateFilterInputs(menu: JQuery<HTMLElement>, columnDef: IExtendedColumn<T>, filterItems: Array<string>) {
		let filterOptions = '<label><input type="checkbox" value="-1" />(Select All)</label>';
		columnDef.filterValues = columnDef.filterValues || [];

		// WorkingFilters is a copy of the filters to enable apply/cancel behaviour
		this.workingFilters = columnDef.filterValues.slice(0);

		for (let i = 0; i < filterItems.length; i++) {
			const filtered = _.contains(this.workingFilters, filterItems[i]);

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

	private showFilter(e: KeyboardEvent) {
		const target = withNullAsUndefined(e.target);
		const $menuButton = jQuery(target);
		this.columnDef = $menuButton.data('column');

		this.columnDef.filterValues = this.columnDef.filterValues || [];

		// WorkingFilters is a copy of the filters to enable apply/cancel behaviour
		this.workingFilters = this.columnDef.filterValues.slice(0);

		let filterItems: Array<string>;

		if (this.workingFilters.length === 0) {
			// Filter based all available values
			filterItems = this.getFilterValues(this.grid.getData() as Slick.DataProvider<T>, this.columnDef);
		}
		else {
			// Filter based on current dataView subset
			filterItems = this.getAllFilterValues((this.grid.getData() as Slick.DataProvider<T>).getItems(), this.columnDef);
		}

		if (!this.$menu) {
			this.$menu = jQuery('<div class="slick-header-menu">').appendTo(document.body);
		}

		this.$menu.empty();

		this.addMenuItem(this.$menu, this.columnDef, 'Sort Ascending', 'sort-asc');
		this.addMenuItem(this.$menu, this.columnDef, 'Sort Descending', 'sort-desc');
		this.addMenuInput(this.$menu, this.columnDef);

		let filterOptions = '<label><input type="checkbox" value="-1" />(Select All)</label>';

		for (let i = 0; i < filterItems.length; i++) {
			const filtered = _.contains(this.workingFilters, filterItems[i]);
			if (filterItems[i] && filterItems[i].indexOf('Error:') < 0) {
				filterOptions += '<label><input type="checkbox" value="' + i + '"'
					+ (filtered ? ' checked="checked"' : '')
					+ '/>' + escape(filterItems[i]) + '</label>';
			}
		}
		const $filter = jQuery('<div class="filter">')
			.append(jQuery(filterOptions))
			.appendTo(this.$menu);

		this.okButton = new Button(this.$menu.get(0));
		this.okButton.label = localize('headerFilter.ok', "OK");
		this.okButton.title = localize('headerFilter.ok', "OK");
		this.okButton.element.id = 'filter-ok-button';
		const okElement = jQuery('#filter-ok-button');
		okElement.bind('click', (ev) => {
			this.columnDef.filterValues = this.workingFilters.splice(0);
			this.setButtonImage($menuButton, this.columnDef.filterValues.length > 0);
			this.handleApply(ev, this.columnDef);
		});

		this.clearButton = new Button(this.$menu.get(0));
		this.clearButton.label = localize('headerFilter.clear', "Clear");
		this.clearButton.title = localize('headerFilter.clear', "Clear");
		this.clearButton.element.id = 'filter-clear-button';
		const clearElement = jQuery('#filter-clear-button');
		clearElement.bind('click', (ev) => {
			this.columnDef.filterValues!.length = 0;
			this.setButtonImage($menuButton, false);
			this.handleApply(ev, this.columnDef);
		});

		this.cancelButton = new Button(this.$menu.get(0));
		this.cancelButton.label = localize('headerFilter.cancel', "Cancel");
		this.cancelButton.title = localize('headerFilter.cancel', "Cancel");
		this.cancelButton.element.id = 'filter-cancel-button';
		const cancelElement = jQuery('#filter-cancel-button');
		cancelElement.bind('click', () => this.hideMenu());

		this.applyStyles();

		jQuery(':checkbox', $filter).bind('click', (e) => {
			this.workingFilters = this.changeWorkingFilter(filterItems, this.workingFilters, jQuery(target));
		});

		const offset = jQuery(target).offset();
		const left = offset.left - this.$menu.width() + jQuery(target).width() - 8;

		let menutop = offset.top + jQuery(target).height();

		if (menutop + offset.top > jQuery(window).height()) {
			menutop -= (this.$menu.height() + jQuery(target).height() + 8);
		}
		this.$menu.css('top', menutop)
			.css('left', (left > 0 ? left : 0));
	}

	public style(styles: IButtonStyles): void {
		this.buttonStyles = styles;
		this.applyStyles();
	}

	private applyStyles() {
		if (this.buttonStyles) {
			const styles = this.buttonStyles;
			if (this.okButton) {
				this.okButton.style(styles);
			}

			if (this.clearButton) {
				this.clearButton.style(styles);
			}

			if (this.cancelButton) {
				this.cancelButton.style(styles);
			}
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
			const index = _.indexOf(workingFilters, filterItems[value]);

			if ($checkbox.prop('checked') && index < 0) {
				workingFilters.push(filterItems[value]);
				const nextRow = filterItems[(parseInt(<string><any>value) + 1).toString()]; // for some reason parseInt is defined as only supporting strings even though it works fine for numbers
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

	private handleApply(e: JQuery.Event<HTMLElement, null>, columnDef: Slick.Column<T>) {
		this.hideMenu();

		this.onFilterApplied.notify({ 'grid': this.grid, 'column': columnDef }, e, self);
		e.preventDefault();
		e.stopPropagation();
	}

	private getFilterValues(dataView: Slick.DataProvider<T>, column: Slick.Column<T>): Array<any> {
		const seen: Array<string> = [];
		for (let i = 0; i < dataView.getLength(); i++) {
			const value = dataView.getItem(i)[column.field!];

			if (!_.contains(seen, value)) {
				seen.push(value);
			}
		}
		return seen;
	}

	private getFilterValuesByInput($input: JQuery<HTMLElement>): Array<string> {
		const column = $input.data('column'),
			filter = $input.val() as string,
			dataView = this.grid.getData() as Slick.DataProvider<T>,
			seen: Array<any> = [];

		for (let i = 0; i < dataView.getLength(); i++) {
			const value = dataView.getItem(i)[column.field];

			if (filter.length > 0) {
				const itemValue = !value ? '' : value;
				const lowercaseFilter = filter.toString().toLowerCase();
				const lowercaseVal = itemValue.toString().toLowerCase();
				if (!_.contains(seen, value) && lowercaseVal.indexOf(lowercaseFilter) > -1) {
					seen.push(value);
				}
			}
			else {
				if (!_.contains(seen, value)) {
					seen.push(value);
				}
			}
		}

		return _.sortBy(seen, (v) => { return v; });
	}

	private getAllFilterValues(data: Array<Slick.SlickData>, column: Slick.Column<T>) {
		const seen: Array<any> = [];
		for (let i = 0; i < data.length; i++) {
			const value = data[i][column.field!];

			if (!_.contains(seen, value)) {
				seen.push(value);
			}
		}

		return _.sortBy(seen, (v) => { return v; });
	}

	private handleMenuItemClick(e: JQuery.Event<HTMLElement, null>, command: string, columnDef: Slick.Column<T>) {
		this.hideMenu();

		this.onCommand.notify({
			'grid': this.grid,
			'column': columnDef,
			'command': command
		}, e, self);

		e.preventDefault();
		e.stopPropagation();
	}
}
