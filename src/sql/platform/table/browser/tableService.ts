/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Table, DefaultStyleController, ITableOptions } from 'sql/base/browser/ui/table/highPerf/tableWidget';
import { RawContextKey, IContextKey, ContextKeyExpr, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { DisposableStore, IDisposable, combinedDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { createStyleSheet } from 'vs/base/browser/dom';
import { attachHighPerfTableStyler as attachTableStyler, defaultHighPerfTableStyles, IHighPerfTableStyleOverrides } from 'sql/platform/theme/common/styler';
import { InputFocusedContextKey } from 'vs/platform/contextkey/common/contextkeys';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ITableDataSource, ITableColumn } from 'sql/base/browser/ui/table/highPerf/table';
import { computeStyles } from 'vs/platform/theme/common/styler';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';

export const ITableService = createDecorator<ITableService>('tableService');

export type TableWidget = Table<any>;

export interface ITableService {

	_serviceBrand: undefined;

	/**
	 * Returns the currently focused table widget if any.
	 */
	readonly lastFocusedTable: TableWidget | undefined;
}

interface IRegisteredTable {
	widget: TableWidget;
	extraContextKeys?: (IContextKey<boolean>)[];
}

export class TableService implements ITableService {

	_serviceBrand: undefined;

	private disposables = new DisposableStore();
	private tables: IRegisteredTable[] = [];
	private _lastFocusedWidget: TableWidget | undefined = undefined;

	get lastFocusedTable(): TableWidget | undefined {
		return this._lastFocusedWidget;
	}

	constructor(@IThemeService themeService: IThemeService) {
		// create a shared default tree style sheet for performance reasons
		const styleController = new DefaultStyleController(createStyleSheet(), '');
		this.disposables.add(attachTableStyler(styleController, themeService));
	}

	register(widget: TableWidget, extraContextKeys?: (IContextKey<boolean>)[]): IDisposable {
		if (this.tables.some(l => l.widget === widget)) {
			throw new Error('Cannot register the same widget multiple times');
		}

		// Keep in our tables table
		const registeredTable: IRegisteredTable = { widget, extraContextKeys };
		this.tables.push(registeredTable);

		// Check for currently being focused
		if (widget.getHTMLElement() === document.activeElement) {
			this._lastFocusedWidget = widget;
		}

		return combinedDisposable(
			widget.onDidFocus(() => this._lastFocusedWidget = widget),
			toDisposable(() => this.tables.splice(this.tables.indexOf(registeredTable), 1)),
			widget.onDidDispose(() => {
				this.tables = this.tables.filter(l => l !== registeredTable);
				if (this._lastFocusedWidget === widget) {
					this._lastFocusedWidget = undefined;
				}
			})
		);
	}

	dispose(): void {
		this.disposables.dispose();
	}
}

const RawWorkbenchTableFocusContextKey = new RawContextKey<boolean>('tableFocus', true);
export const WorkbenchTableFocusContextKey = ContextKeyExpr.and(RawWorkbenchTableFocusContextKey, ContextKeyExpr.not(InputFocusedContextKey));
export const WorkbenchTableHasSelectionOrFocus = new RawContextKey<boolean>('tableHasSelectionOrFocus', false);
export const WorkbenchTableDoubleSelection = new RawContextKey<boolean>('tableDoubleSelection', false);
export const WorkbenchTableMultiSelection = new RawContextKey<boolean>('tableMultiSelection', false);
export const WorkbenchTableSupportsKeyboardNavigation = new RawContextKey<boolean>('tableSupportsKeyboardNavigation', true);
export const WorkbenchTableAutomaticKeyboardNavigationKey = 'tableAutomaticKeyboardNavigation';
export const WorkbenchTableAutomaticKeyboardNavigation = new RawContextKey<boolean>(WorkbenchTableAutomaticKeyboardNavigationKey, true);
export let didBindWorkbenchTableAutomaticKeyboardNavigation = false;

function createScopedContextKeyService(contextKeyService: IContextKeyService, widget: TableWidget): IContextKeyService {
	const result = contextKeyService.createScoped(widget.getHTMLElement());
	RawWorkbenchTableFocusContextKey.bindTo(result);
	return result;
}

export const multiSelectModifierSettingKey = 'workbench.table.multiSelectModifier';
export const openModeSettingKey = 'workbench.table.openMode';
export const horizontalScrollingKey = 'workbench.table.horizontalScrolling';
export const keyboardNavigationSettingKey = 'workbench.table.keyboardNavigation';
export const automaticKeyboardNavigationSettingKey = 'workbench.table.automaticKeyboardNavigation';

function useAltAsMultipleSelectionModifier(configurationService: IConfigurationService): boolean {
	return configurationService.getValue(multiSelectModifierSettingKey) === 'alt';
}

function toWorkbenchTableOptions<T>(options: ITableOptions<T>): [ITableOptions<T>, IDisposable] {
	const disposables = new DisposableStore();
	const result = { ...options };

	return [result, disposables];
}

export interface IWorkbenchTableOptions<T> extends ITableOptions<T> {
	readonly overrideStyles?: IHighPerfTableStyleOverrides;
}

export class WorkbenchTable<T> extends Table<T> {

	readonly contextKeyService: IContextKeyService;
	private readonly configurationService: IConfigurationService;

	private tableHasSelectionOrFocus: IContextKey<boolean>;
	private tableDoubleSelection: IContextKey<boolean>;
	private tableMultiSelection: IContextKey<boolean>;

	private _useAltAsMultipleSelectionModifier: boolean;

	constructor(
		user: string,
		container: HTMLElement,
		columns: ITableColumn<T, any>[],
		dataSource: ITableDataSource<T>,
		options: IWorkbenchTableOptions<T>,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ITableService tableService: ITableService,
		@IThemeService themeService: IThemeService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		const [workbenchTableOptions, workbenchTableOptionsDisposable] = toWorkbenchTableOptions(options);

		super(user, container, columns, dataSource,
			{
				keyboardSupport: false,
				...computeStyles(themeService.getColorTheme(), defaultHighPerfTableStyles),
				...workbenchTableOptions
			}
		);

		this.disposables.add(workbenchTableOptionsDisposable);

		this.contextKeyService = createScopedContextKeyService(contextKeyService, this);
		this.configurationService = configurationService;

		this.tableHasSelectionOrFocus = WorkbenchTableHasSelectionOrFocus.bindTo(this.contextKeyService);
		this.tableDoubleSelection = WorkbenchTableDoubleSelection.bindTo(this.contextKeyService);
		this.tableMultiSelection = WorkbenchTableMultiSelection.bindTo(this.contextKeyService);

		this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);

		this.disposables.add(this.contextKeyService);
		this.disposables.add((tableService as TableService).register(this));

		if (options.overrideStyles) {
			this.disposables.add(attachTableStyler(this, themeService, options.overrideStyles));
		}

		this.disposables.add(this.onSelectionChange(() => {
			const selection = this.getSelection();
			const focus = this.getFocus();

			this.tableHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
			this.tableMultiSelection.set(selection.length > 1);
			this.tableDoubleSelection.set(selection.length === 2);
		}));
		this.disposables.add(this.onFocusChange(() => {
			const selection = this.getSelection();
			const focus = this.getFocus();

			this.tableHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
		}));

		this.registerListeners();
	}

	private registerListeners(): void {
		this.disposables.add(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
				this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(this.configurationService);
			}
		}));
	}

	get useAltAsMultipleSelectionModifier(): boolean {
		return this._useAltAsMultipleSelectionModifier;
	}
}

registerSingleton(ITableService, TableService, true);
