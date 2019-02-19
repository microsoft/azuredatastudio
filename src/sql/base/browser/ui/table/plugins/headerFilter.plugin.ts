// Adopted and converted to typescript from https://github.com/danny-sg/slickgrid-spreadsheet-plugins/blob/master/ext.headerfilter.js
// heavily modified

import { mixin } from 'vs/base/common/objects';
import { Button } from '../../button/button';
import { attachButtonStyler } from 'sql/platform/theme/common/styler';
import { escape } from 'sql/base/common/strings';
import { IThemeService } from 'vs/platform/theme/common/themeService';

export class HeaderFilter {

	public onFilterApplied = new Slick.Event();
	public onCommand = new Slick.Event();

	private grid;
	private handler = new Slick.EventHandler();
	private defaults = {
		filterImage: 'src/sql/media/icons/filter.svg',
		sortAscImage: 'sort-asc.gif',
		sortDescImage: 'sort-desc.gif'
	};

	private $menu: JQuery<HTMLElement>;
	private options: any;
	private okButton: Button;
	private clearButton: Button;
	private cancelButton: Button;
	private workingFilters: any;
	private columnDef: any;

	constructor(options: any, private _themeService: IThemeService) {
		this.options = mixin(options, this.defaults, false);
	}

	public init(grid: Slick.Grid<any>): void {
		this.grid = grid;
		this.handler.subscribe(this.grid.onHeaderCellRendered, (e, args) => this.handleHeaderCellRendered(e, args))
			.subscribe(this.grid.onBeforeHeaderCellDestroy, (e, args) => this.handleBeforeHeaderCellDestroy(e, args))
			.subscribe(this.grid.onClick, (e) => this.handleBodyMouseDown)
			.subscribe(this.grid.onColumnsResized, () => this.columnsResized())
			.subscribe(this.grid.onKeyDown, (e) => this.handleKeyDown);
		this.grid.setColumns(this.grid.getColumns());

		$(document.body).bind('mousedown', this.handleBodyMouseDown);
		$(document.body).bind('keydown', this.handleKeyDown);
	}

	public destroy() {
		this.handler.unsubscribeAll();
		$(document.body).unbind('mousedown', this.handleBodyMouseDown);
		$(document.body).unbind('keydown', this.handleKeyDown);
	}

	private handleKeyDown = (e) => {
		if (this.$menu && (e.key === 'Escape' || e.keyCode === 27)) {
			this.hideMenu();
			e.preventDefault();
			e.stopPropagation();
		}
	}

	private handleBodyMouseDown = (e) => {
		if (this.$menu && this.$menu[0] !== e.target && !$.contains(this.$menu[0], e.target)) {
			this.hideMenu();
			e.preventDefault();
			e.stopPropagation();
		}
	}

	private hideMenu() {
		if (this.$menu) {
			this.$menu.remove();
			this.$menu = null;
		}
	}

	private handleHeaderCellRendered(e, args) {
		let column = args.column;
		if (column.id === '_detail_selector') {
			return;
		}
		let $el = $('<div></div>')
			.addClass('slick-header-menubutton')
			.data('column', column);

		$el.bind('click', (e) => this.showFilter(e)).appendTo(args.node);
	}

	private handleBeforeHeaderCellDestroy(e, args) {
		$(args.node)
			.find('.slick-header-menubutton')
			.remove();
	}

	private addMenuItem(menu, columnDef, title, command, image) {
		let $item = $('<div class="slick-header-menuitem">')
			.data('command', command)
			.data('column', columnDef)
			.bind('click', (e) => this.handleMenuItemClick(e, command, columnDef))
			.appendTo(menu);

		let $icon = $('<div class="slick-header-menuicon">')
			.appendTo($item);

		if (title === 'Sort Ascending') {
			$icon.get(0).className += ' ascending';
		} else if (title === 'Sort Descending') {
			$icon.get(0).className += ' descending';
		}

		$('<span class="slick-header-menucontent">')
			.text(title)
			.appendTo($item);
	}

	private addMenuInput(menu, columnDef) {
		const self = this;
		$('<input class="input" placeholder="Search" style="margin-top: 5px; width: 206px">')
			.data('column', columnDef)
			.bind('keyup', (e) => {
				let filterVals = this.getFilterValuesByInput($(e.target));
				self.updateFilterInputs(menu, columnDef, filterVals);
			})
			.appendTo(menu);
	}

	private updateFilterInputs(menu, columnDef, filterItems) {
		let filterOptions = '<label><input type="checkbox" value="-1" />(Select All)</label>';
		columnDef.filterValues = columnDef.filterValues || [];

		// WorkingFilters is a copy of the filters to enable apply/cancel behaviour
		this.workingFilters = columnDef.filterValues.slice(0);

		for (let i = 0; i < filterItems.length; i++) {
			let filtered = _.contains(this.workingFilters, filterItems[i]);

			filterOptions += '<label><input type="checkbox" value="' + i + '"'
				+ (filtered ? ' checked="checked"' : '')
				+ '/>' + filterItems[i] + '</label>';
		}
		let $filter = menu.find('.filter');
		$filter.empty().append($(filterOptions));

		$(':checkbox', $filter).bind('click', (e) => {
			this.workingFilters = this.changeWorkingFilter(filterItems, this.workingFilters, $(e.target));
		});
	}

	private showFilter(e) {
		let $menuButton = $(e.target);
		this.columnDef = $menuButton.data('column');

		this.columnDef.filterValues = this.columnDef.filterValues || [];

		// WorkingFilters is a copy of the filters to enable apply/cancel behaviour
		this.workingFilters = this.columnDef.filterValues.slice(0);

		let filterItems;

		if (this.workingFilters.length === 0) {
			// Filter based all available values
			filterItems = this.getFilterValues(this.grid.getData(), this.columnDef);
		}
		else {
			// Filter based on current dataView subset
			filterItems = this.getAllFilterValues(this.grid.getData().getItems(), this.columnDef);
		}

		if (!this.$menu) {
			this.$menu = $('<div class="slick-header-menu">').appendTo(document.body);
		}

		this.$menu.empty();

		this.addMenuItem(this.$menu, this.columnDef, 'Sort Ascending', 'sort-asc', this.options.sortAscImage);
		this.addMenuItem(this.$menu, this.columnDef, 'Sort Descending', 'sort-desc', this.options.sortDescImage);
		this.addMenuInput(this.$menu, this.columnDef);

		let filterOptions = '<label><input type="checkbox" value="-1" />(Select All)</label>';

		for (let i = 0; i < filterItems.length; i++) {
			let filtered = _.contains(this.workingFilters, filterItems[i]);
			if (filterItems[i] && filterItems[i].indexOf('Error:') < 0) {
				filterOptions += '<label><input type="checkbox" value="' + i + '"'
					+ (filtered ? ' checked="checked"' : '')
					+ '/>' + escape(filterItems[i]) + '</label>';
			}
		}
		let $filter = $('<div class="filter">')
			.append($(filterOptions))
			.appendTo(this.$menu);

		this.okButton = new Button(this.$menu.get(0));
		this.okButton.label = 'OK';
		this.okButton.title = 'OK';
		this.okButton.element.id = 'filter-ok-button';
		let okElement = $('#filter-ok-button');
		okElement.bind('click', (ev) => {
			this.columnDef.filterValues = this.workingFilters.splice(0);
			this.setButtonImage($menuButton, this.columnDef.filterValues.length > 0);
			this.handleApply(ev, this.columnDef);
		});

		this.clearButton = new Button(this.$menu.get(0));
		this.clearButton.label = 'Clear';
		this.clearButton.title = 'Clear';
		this.clearButton.element.id = 'filter-clear-button';
		let clearElement = $('#filter-clear-button');
		clearElement.bind('click', (ev) => {
			this.columnDef.filterValues.length = 0;
			this.setButtonImage($menuButton, false);
			this.handleApply(ev, this.columnDef);
		});

		this.cancelButton = new Button(this.$menu.get(0));
		this.cancelButton.label = 'Cancel';
		this.cancelButton.title = 'Cancel';
		this.cancelButton.element.id = 'filter-cancel-button';
		let cancelElement = $('#filter-cancel-button');
		cancelElement.bind('click', () => this.hideMenu());
		attachButtonStyler(this.okButton, this._themeService);
		attachButtonStyler(this.clearButton, this._themeService);
		attachButtonStyler(this.cancelButton, this._themeService);

		$(':checkbox', $filter).bind('click', (e) => {
			this.workingFilters = this.changeWorkingFilter(filterItems, this.workingFilters, $(e.target));
		});

		let offset = $(e.target).offset();
		let left = offset.left - this.$menu.width() + $(e.target).width() - 8;

		let menutop = offset.top + $(e.target).height();

		if (menutop + offset.top > $(window).height()) {
			menutop -= (this.$menu.height() + $(e.target).height() + 8);
		}
		this.$menu.css('top', menutop)
			.css('left', (left > 0 ? left : 0));
	}

	private columnsResized() {
		this.hideMenu();
	}

	private changeWorkingFilter(filterItems, workingFilters, $checkbox) {
		let value = $checkbox.val();
		let $filter = $checkbox.parent().parent();

		if ($checkbox.val() < 0) {
			// Select All
			if ($checkbox.prop('checked')) {
				$(':checkbox', $filter).prop('checked', true);
				workingFilters = filterItems.slice(0);
			} else {
				$(':checkbox', $filter).prop('checked', false);
				workingFilters.length = 0;
			}
		} else {
			let index = _.indexOf(workingFilters, filterItems[value]);

			if ($checkbox.prop('checked') && index < 0) {
				workingFilters.push(filterItems[value]);
				let nextRow = filterItems[(parseInt(value) + 1).toString()];
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

	private setButtonImage($el, filtered) {
		let element: HTMLElement = $el.get(0);
		if (filtered) {
			element.className += ' filtered';
		} else {
			let classList = element.classList;
			if (classList.contains('filtered')) {
				classList.remove('filtered');
			}
		}
	}

	private handleApply(e, columnDef) {
		this.hideMenu();

		this.onFilterApplied.notify({ 'grid': this.grid, 'column': columnDef }, e, self);
		e.preventDefault();
		e.stopPropagation();
	}

	private getFilterValues(dataView, column) {
		let seen = [];
		for (let i = 0; i < dataView.getLength(); i++) {
			let value = dataView.getItem(i)[column.field];

			if (!_.contains(seen, value)) {
				seen.push(value);
			}
		}
		return seen;
	}

	private getFilterValuesByInput($input) {
		let column = $input.data('column'),
			filter = $input.val(),
			dataView = this.grid.getData(),
			seen = [];

		for (let i = 0; i < dataView.getLength(); i++) {
			let value = dataView.getItem(i)[column.field];

			if (filter.length > 0) {
				let itemValue = !value ? '' : value;
				let lowercaseFilter = filter.toString().toLowerCase();
				let lowercaseVal = itemValue.toString().toLowerCase();
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

	private getAllFilterValues(data, column) {
		let seen = [];
		for (let i = 0; i < data.length; i++) {
			let value = data[i][column.field];

			if (!_.contains(seen, value)) {
				seen.push(value);
			}
		}

		return _.sortBy(seen, (v) => { return v; });
	}

	private handleMenuItemClick(e, command, columnDef) {
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