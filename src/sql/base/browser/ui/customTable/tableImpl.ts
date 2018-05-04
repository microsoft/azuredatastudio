/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

// import 'vs/css!./table';
import * as _ from './table';
import * as View from './tableView';
import * as Model from './tableModel';
import * as TableDefaults from './tableDefaults';
import * as WinJS from 'vs/base/common/winjs.base';
import Event, { Emitter, Relay } from 'vs/base/common/event';
import { mixin } from 'vs/base/common/objects';
import { Color } from 'vs/base/common/color';
import { ClickBehavior } from 'vs/base/parts/tree/browser/treeDefaults';

export class TableContext implements _.ITableContext {

	public table: _.ITable;
	public configuration: _.ITableConfiguration;
	public options: _.ITableOptions;

	public dataSource: _.IDataSource;
	public renderer: _.IRenderer;
	public controller: _.IController;
	// public filter: _.IFilter;
	// public sorter: _.ISorter;
	// public accessibilityProvider: _.IAccessibilityProvider;

	constructor(table: _.ITable, configuration: _.ITableConfiguration, options: _.ITableOptions = {}) {
		this.table = table;
		this.configuration = configuration;
		this.options = options;

		if (!configuration.dataSource) {
			throw new Error('You must provide a Data Source to the table.');
		}

		this.dataSource = configuration.dataSource;
		this.renderer = configuration.renderer;
		this.controller = configuration.controller || new TableDefaults.DefaultController({ clickBehavior: ClickBehavior.ON_MOUSE_UP, keyboardSupport: typeof options.keyboardSupport !== 'boolean' || options.keyboardSupport });
		// this.filter = configuration.filter || new TreeDefaults.DefaultFilter();
		// this.sorter = configuration.sorter || null;
		// this.accessibilityProvider = configuration.accessibilityProvider || new TreeDefaults.DefaultAccessibilityProvider();
	}
}

const defaultStyles: _.ITableStyles = {
	listFocusBackground: Color.fromHex('#073655'),
	listActiveSelectionBackground: Color.fromHex('#0E639C'),
	listActiveSelectionForeground: Color.fromHex('#FFFFFF'),
	listFocusAndSelectionBackground: Color.fromHex('#094771'),
	listFocusAndSelectionForeground: Color.fromHex('#FFFFFF'),
	listInactiveSelectionBackground: Color.fromHex('#3F3F46'),
	listHoverBackground: Color.fromHex('#2A2D2E'),
	listDropBackground: Color.fromHex('#383B3D')
};

export class Table implements _.ITable {

	private container: HTMLElement;

	private context: _.ITableContext;
	private model: Model.TableModel;
	private view: View.TableView;

	private _onDidChangeFocus = new Relay<_.IFocusEvent>();
	readonly onDidChangeFocus: Event<_.IFocusEvent> = this._onDidChangeFocus.event;
	private _onDidChangeSelection = new Relay<_.ISelectionEvent>();
	readonly onDidChangeSelection: Event<_.ISelectionEvent> = this._onDidChangeSelection.event;
	private _onHighlightChange = new Relay<_.IHighlightEvent>();
	readonly onDidChangeHighlight: Event<_.IHighlightEvent> = this._onHighlightChange.event;
	private _onDispose = new Emitter<void>();
	readonly onDidDispose: Event<void> = this._onDispose.event;

	constructor(container: HTMLElement, configuration: _.ITableConfiguration, options: _.ITableOptions = {}) {
		this.container = container;
		mixin(options, defaultStyles, false);

		// options.alwaysFocused = options.alwaysFocused === true ? true : false;
		// options.useShadows = options.useShadows === false ? false : true;

		this.context = new TableContext(this, configuration, options);
		this.model = new Model.TableModel(this.context);
		this.view = new View.TableView(this.context, this.container);

		this.view.setModel(this.model);

		this._onDidChangeFocus.input = this.model.onDidFocus;
		this._onDidChangeSelection.input = this.model.onDidSelect;
		this._onHighlightChange.input = this.model.onDidHighlight;
	}

	get onDidFocus(): Event<void> {
		return this.view && this.view.onDOMFocus;
	}

	get onDidBlur(): Event<void> {
		return this.view && this.view.onDOMBlur;
	}

	public setInput(input: _.ITableInput): WinJS.Promise {
		return this.model.setInput(input);
	}

	public layout(height?: number): void {
		this.view.layout(height);
	}
}
