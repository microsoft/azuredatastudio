/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BrowserFeatures } from 'vs/base/browser/canIUse';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { Button } from 'vs/base/browser/ui/button/button';
import { Checkbox } from 'vs/base/browser/ui/checkbox/checkbox';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { SelectBox } from 'vs/base/browser/ui/selectBox/selectBox';
import { IAction } from 'vs/base/common/actions';
import { disposableTimeout } from 'vs/base/common/async';
import { Codicon } from 'vs/base/common/codicons';
import { Color, RGBA } from 'vs/base/common/color';
import { Emitter, Event } from 'vs/base/common/event';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { isIOS } from 'vs/base/common/platform';
import { isDefined, isUndefinedOrNull } from 'vs/base/common/types';
import 'vs/css!./media/settingsWidgets';
import { localize } from 'vs/nls';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { editorWidgetBorder, focusBorder, foreground, inputBackground, inputBorder, inputForeground, listActiveSelectionBackground, listActiveSelectionForeground, listDropBackground, listFocusBackground, listHoverBackground, listHoverForeground, listInactiveSelectionBackground, listInactiveSelectionForeground, registerColor, selectBackground, selectBorder, selectForeground, simpleCheckboxBackground, simpleCheckboxBorder, simpleCheckboxForeground, textLinkActiveForeground, textLinkForeground, textPreformatForeground, transparent } from 'vs/platform/theme/common/colorRegistry';
import { attachButtonStyler, attachInputBoxStyler, attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { IColorTheme, ICssStyleCollector, IThemeService, registerThemingParticipant, ThemeIcon } from 'vs/platform/theme/common/themeService';
import { settingsDiscardIcon, settingsEditIcon, settingsRemoveIcon } from 'vs/workbench/contrib/preferences/browser/preferencesIcons';

const $ = DOM.$;
export const settingsHeaderForeground = registerColor('settings.headerForeground', { light: '#444444', dark: '#e7e7e7', hc: '#ffffff' }, localize('headerForeground', "The foreground color for a section header or active title."));
export const modifiedItemIndicator = registerColor('settings.modifiedItemIndicator', {
	light: new Color(new RGBA(102, 175, 224)),
	dark: new Color(new RGBA(12, 125, 157)),
	hc: new Color(new RGBA(0, 73, 122))
}, localize('modifiedItemForeground', "The color of the modified setting indicator."));

// Enum control colors
export const settingsSelectBackground = registerColor(`settings.dropdownBackground`, { dark: selectBackground, light: selectBackground, hc: selectBackground }, localize('settingsDropdownBackground', "Settings editor dropdown background."));
export const settingsSelectForeground = registerColor('settings.dropdownForeground', { dark: selectForeground, light: selectForeground, hc: selectForeground }, localize('settingsDropdownForeground', "Settings editor dropdown foreground."));
export const settingsSelectBorder = registerColor('settings.dropdownBorder', { dark: selectBorder, light: selectBorder, hc: selectBorder }, localize('settingsDropdownBorder', "Settings editor dropdown border."));
export const settingsSelectListBorder = registerColor('settings.dropdownListBorder', { dark: editorWidgetBorder, light: editorWidgetBorder, hc: editorWidgetBorder }, localize('settingsDropdownListBorder', "Settings editor dropdown list border. This surrounds the options and separates the options from the description."));

// Bool control colors
export const settingsCheckboxBackground = registerColor('settings.checkboxBackground', { dark: simpleCheckboxBackground, light: simpleCheckboxBackground, hc: simpleCheckboxBackground }, localize('settingsCheckboxBackground', "Settings editor checkbox background."));
export const settingsCheckboxForeground = registerColor('settings.checkboxForeground', { dark: simpleCheckboxForeground, light: simpleCheckboxForeground, hc: simpleCheckboxForeground }, localize('settingsCheckboxForeground', "Settings editor checkbox foreground."));
export const settingsCheckboxBorder = registerColor('settings.checkboxBorder', { dark: simpleCheckboxBorder, light: simpleCheckboxBorder, hc: simpleCheckboxBorder }, localize('settingsCheckboxBorder', "Settings editor checkbox border."));

// Text control colors
export const settingsTextInputBackground = registerColor('settings.textInputBackground', { dark: inputBackground, light: inputBackground, hc: inputBackground }, localize('textInputBoxBackground', "Settings editor text input box background."));
export const settingsTextInputForeground = registerColor('settings.textInputForeground', { dark: inputForeground, light: inputForeground, hc: inputForeground }, localize('textInputBoxForeground', "Settings editor text input box foreground."));
export const settingsTextInputBorder = registerColor('settings.textInputBorder', { dark: inputBorder, light: inputBorder, hc: inputBorder }, localize('textInputBoxBorder', "Settings editor text input box border."));

// Number control colors
export const settingsNumberInputBackground = registerColor('settings.numberInputBackground', { dark: inputBackground, light: inputBackground, hc: inputBackground }, localize('numberInputBoxBackground', "Settings editor number input box background."));
export const settingsNumberInputForeground = registerColor('settings.numberInputForeground', { dark: inputForeground, light: inputForeground, hc: inputForeground }, localize('numberInputBoxForeground', "Settings editor number input box foreground."));
export const settingsNumberInputBorder = registerColor('settings.numberInputBorder', { dark: inputBorder, light: inputBorder, hc: inputBorder }, localize('numberInputBoxBorder', "Settings editor number input box border."));

export const focusedRowBackground = registerColor('settings.focusedRowBackground', {
	dark: Color.fromHex('#808080').transparent(0.14),
	light: transparent(listFocusBackground, .4),
	hc: null
}, localize('focusedRowBackground', "The background color of a settings row when focused."));

export const rowHoverBackground = registerColor('settings.rowHoverBackground', {
	dark: transparent(focusedRowBackground, .5),
	light: transparent(focusedRowBackground, .7),
	hc: null
}, localize('settings.rowHoverBackground', "The background color of a settings row when hovered."));

export const focusedRowBorder = registerColor('settings.focusedRowBorder', {
	dark: Color.white.transparent(0.12),
	light: Color.black.transparent(0.12),
	hc: focusBorder
}, localize('settings.focusedRowBorder', "The color of the row's top and bottom border when the row is focused."));

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const checkboxBackgroundColor = theme.getColor(settingsCheckboxBackground);
	if (checkboxBackgroundColor) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item-bool .setting-value-checkbox { background-color: ${checkboxBackgroundColor} !important; }`);
	}

	const checkboxForegroundColor = theme.getColor(settingsCheckboxForeground);
	if (checkboxForegroundColor) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item-bool .setting-value-checkbox { color: ${checkboxForegroundColor} !important; }`);
	}

	const checkboxBorderColor = theme.getColor(settingsCheckboxBorder);
	if (checkboxBorderColor) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item-bool .setting-value-checkbox { border-color: ${checkboxBorderColor} !important; }`);
	}

	const link = theme.getColor(textLinkForeground);
	if (link) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item-contents .setting-item-trust-description a { color: ${link}; }`);
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item-contents .setting-item-trust-description a > code { color: ${link}; }`);
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item-contents .setting-item-markdown a { color: ${link}; }`);
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item-contents .setting-item-markdown a > code { color: ${link}; }`);
		collector.addRule(`.monaco-select-box-dropdown-container > .select-box-details-pane > .select-box-description-markdown a { color: ${link}; }`);
		collector.addRule(`.monaco-select-box-dropdown-container > .select-box-details-pane > .select-box-description-markdown a > code { color: ${link}; }`);

		const disabledfgColor = new Color(new RGBA(link.rgba.r, link.rgba.g, link.rgba.b, 0.8));
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item.setting-item-untrusted > .setting-item-contents .setting-item-markdown a { color: ${disabledfgColor}; }`);
	}

	const activeLink = theme.getColor(textLinkActiveForeground);
	if (activeLink) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item-contents .setting-item-trust-description a:hover, .settings-editor > .settings-body > .settings-tree-container .setting-item-contents .setting-item-trust-description a:active { color: ${activeLink}; }`);
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item-contents .setting-item-trust-description a:hover > code, .settings-editor > .settings-body > .settings-tree-container .setting-item-contents .setting-item-trust-description a:active > code { color: ${activeLink}; }`);
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item-contents .setting-item-markdown a:hover, .settings-editor > .settings-body > .settings-tree-container .setting-item-contents .setting-item-markdown a:active { color: ${activeLink}; }`);
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item-contents .setting-item-markdown a:hover > code, .settings-editor > .settings-body > .settings-tree-container .setting-item-contents .setting-item-markdown a:active > code { color: ${activeLink}; }`);
		collector.addRule(`.monaco-select-box-dropdown-container > .select-box-details-pane > .select-box-description-markdown a:hover, .monaco-select-box-dropdown-container > .select-box-details-pane > .select-box-description-markdown a:active { color: ${activeLink}; }`);
		collector.addRule(`.monaco-select-box-dropdown-container > .select-box-details-pane > .select-box-description-markdown a:hover > code, .monaco-select-box-dropdown-container > .select-box-details-pane > .select-box-description-markdown a:active > code { color: ${activeLink}; }`);
	}

	const headerForegroundColor = theme.getColor(settingsHeaderForeground);
	if (headerForegroundColor) {
		collector.addRule(`.settings-editor > .settings-header > .settings-header-controls .settings-tabs-widget .action-label.checked { color: ${headerForegroundColor}; border-bottom-color: ${headerForegroundColor}; }`);
	}

	const foregroundColor = theme.getColor(foreground);
	if (foregroundColor) {
		collector.addRule(`.settings-editor > .settings-header > .settings-header-controls .settings-tabs-widget .action-label { color: ${foregroundColor}; }`);
	}

	// List control
	const listHoverBackgroundColor = theme.getColor(listHoverBackground);
	if (listHoverBackgroundColor) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item.setting-item-list .setting-list-row:hover { background-color: ${listHoverBackgroundColor}; }`);
	}

	const listHoverForegroundColor = theme.getColor(listHoverForeground);
	if (listHoverForegroundColor) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item.setting-item-list .setting-list-row:hover { color: ${listHoverForegroundColor}; }`);
	}

	const listDropBackgroundColor = theme.getColor(listDropBackground);
	if (listDropBackgroundColor) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item.setting-item-list .setting-list-row.drag-hover { background-color: ${listDropBackgroundColor}; }`);
	}

	const listSelectBackgroundColor = theme.getColor(listActiveSelectionBackground);
	if (listSelectBackgroundColor) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item.setting-item-list .setting-list-row.selected:focus { background-color: ${listSelectBackgroundColor}; }`);
	}

	const listInactiveSelectionBackgroundColor = theme.getColor(listInactiveSelectionBackground);
	if (listInactiveSelectionBackgroundColor) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item.setting-item-list .setting-list-row.selected:not(:focus) { background-color: ${listInactiveSelectionBackgroundColor}; }`);
	}

	const listInactiveSelectionForegroundColor = theme.getColor(listInactiveSelectionForeground);
	if (listInactiveSelectionForegroundColor) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item.setting-item-list .setting-list-row.selected:not(:focus) { color: ${listInactiveSelectionForegroundColor}; }`);
	}

	const listSelectForegroundColor = theme.getColor(listActiveSelectionForeground);
	if (listSelectForegroundColor) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item.setting-item-list .setting-list-row.selected:focus { color: ${listSelectForegroundColor}; }`);
	}

	const codeTextForegroundColor = theme.getColor(textPreformatForeground);
	if (codeTextForegroundColor) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item .setting-item-markdown code { color: ${codeTextForegroundColor} }`);
		collector.addRule(`.monaco-select-box-dropdown-container > .select-box-details-pane > .select-box-description-markdown code { color: ${codeTextForegroundColor} }`);
		const disabledfgColor = new Color(new RGBA(codeTextForegroundColor.rgba.r, codeTextForegroundColor.rgba.g, codeTextForegroundColor.rgba.b, 0.8));
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item.setting-item-untrusted > .setting-item-contents .setting-item-description .setting-item-markdown code { color: ${disabledfgColor} }`);
	}

	const modifiedItemIndicatorColor = theme.getColor(modifiedItemIndicator);
	if (modifiedItemIndicatorColor) {
		collector.addRule(`.settings-editor > .settings-body > .settings-tree-container .setting-item-contents > .setting-item-modified-indicator { border-color: ${modifiedItemIndicatorColor}; }`);
	}
});

type EditKey = 'none' | 'create' | number;

type RowElementGroup = {
	rowElement: HTMLElement;
	keyElement: HTMLElement;
	valueElement?: HTMLElement;
};

type IListViewItem<TDataItem extends object> = TDataItem & {
	editing?: boolean;
	selected?: boolean;
};

export class ListSettingListModel<TDataItem extends object> {
	protected _dataItems: TDataItem[] = [];
	private _editKey: EditKey | null = null;
	private _selectedIdx: number | null = null;
	private _newDataItem: TDataItem;

	get items(): IListViewItem<TDataItem>[] {
		const items = this._dataItems.map((item, i) => {
			const editing = typeof this._editKey === 'number' && this._editKey === i;
			return {
				...item,
				editing,
				selected: i === this._selectedIdx || editing
			};
		});

		if (this._editKey === 'create') {
			items.push({
				editing: true,
				selected: true,
				...this._newDataItem,
			});
		}

		return items;
	}

	constructor(newItem: TDataItem) {
		this._newDataItem = newItem;
	}

	setEditKey(key: EditKey): void {
		this._editKey = key;
	}

	setValue(listData: TDataItem[]): void {
		this._dataItems = listData;
	}

	select(idx: number | null): void {
		this._selectedIdx = idx;
	}

	getSelected(): number | null {
		return this._selectedIdx;
	}

	selectNext(): void {
		if (typeof this._selectedIdx === 'number') {
			this._selectedIdx = Math.min(this._selectedIdx + 1, this._dataItems.length - 1);
		} else {
			this._selectedIdx = 0;
		}
	}

	selectPrevious(): void {
		if (typeof this._selectedIdx === 'number') {
			this._selectedIdx = Math.max(this._selectedIdx - 1, 0);
		} else {
			this._selectedIdx = 0;
		}
	}
}

export interface ISettingListChangeEvent<TDataItem extends object> {
	originalItem: TDataItem;
	item?: TDataItem;
	targetIndex?: number;
	sourceIndex?: number;
}

export abstract class AbstractListSettingWidget<TDataItem extends object> extends Disposable {
	private listElement: HTMLElement;
	private rowElements: HTMLElement[] = [];

	protected readonly _onDidChangeList = this._register(new Emitter<ISettingListChangeEvent<TDataItem>>());
	protected readonly model = new ListSettingListModel<TDataItem>(this.getEmptyItem());
	protected readonly listDisposables = this._register(new DisposableStore());

	readonly onDidChangeList: Event<ISettingListChangeEvent<TDataItem>> = this._onDidChangeList.event;

	get domNode(): HTMLElement {
		return this.listElement;
	}

	get items(): TDataItem[] {
		return this.model.items;
	}

	get inReadMode(): boolean {
		return this.model.items.every(item => !item.editing);
	}

	constructor(
		private container: HTMLElement,
		@IThemeService protected readonly themeService: IThemeService,
		@IContextViewService protected readonly contextViewService: IContextViewService
	) {
		super();

		this.listElement = DOM.append(container, $('div'));
		this.listElement.setAttribute('role', 'list');
		this.getContainerClasses().forEach(c => this.listElement.classList.add(c));
		this.listElement.setAttribute('tabindex', '0');
		DOM.append(container, this.renderAddButton());
		this.renderList();

		this._register(DOM.addDisposableListener(this.listElement, DOM.EventType.CLICK, e => this.onListClick(e)));
		this._register(DOM.addDisposableListener(this.listElement, DOM.EventType.DBLCLICK, e => this.onListDoubleClick(e)));

		this._register(DOM.addStandardDisposableListener(this.listElement, 'keydown', (e: StandardKeyboardEvent) => {
			if (e.equals(KeyCode.UpArrow)) {
				this.selectPreviousRow();
			} else if (e.equals(KeyCode.DownArrow)) {
				this.selectNextRow();
			} else {
				return;
			}

			e.preventDefault();
			e.stopPropagation();
		}));
	}

	setValue(listData: TDataItem[]): void {
		this.model.setValue(listData);
		this.renderList();
	}

	protected abstract getEmptyItem(): TDataItem;
	protected abstract getContainerClasses(): string[];
	protected abstract getActionsForItem(item: TDataItem, idx: number): IAction[];
	protected abstract renderItem(item: TDataItem, idx: number): RowElementGroup;
	protected abstract renderEdit(item: TDataItem, idx: number): HTMLElement;
	protected abstract isItemNew(item: TDataItem): boolean;
	protected abstract addTooltipsToRow(rowElement: RowElementGroup, item: TDataItem): void;
	protected abstract getLocalizedStrings(): {
		deleteActionTooltip: string
		editActionTooltip: string
		addButtonLabel: string
	};

	protected renderHeader(): HTMLElement | undefined {
		return undefined; // {{SQL CARBON EDIT}} strict-null-checks
	}

	protected isAddButtonVisible(): boolean {
		return true;
	}

	protected renderList(): void {
		const focused = DOM.isAncestor(document.activeElement, this.listElement);

		DOM.clearNode(this.listElement);
		this.listDisposables.clear();

		const newMode = this.model.items.some(item => !!(item.editing && this.isItemNew(item)));
		this.container.classList.toggle('setting-list-hide-add-button', !this.isAddButtonVisible() || newMode);

		const header = this.renderHeader();
		const ITEM_HEIGHT = 24;
		let listHeight = ITEM_HEIGHT * this.model.items.length;

		if (header) {
			listHeight += ITEM_HEIGHT;
			this.listElement.appendChild(header);
		}

		this.rowElements = this.model.items.map((item, i) => this.renderDataOrEditItem(item, i, focused));
		this.rowElements.forEach(rowElement => this.listElement.appendChild(rowElement));

		this.listElement.style.height = listHeight + 'px';
	}

	protected createBasicSelectBox(value: IObjectEnumData): SelectBox {
		const selectBoxOptions = value.options.map(({ value, description }) => ({ text: value, description }));
		const selected = value.options.findIndex(option => value.data === option.value);

		const selectBox = new SelectBox(selectBoxOptions, selected, this.contextViewService, undefined, {
			useCustomDrawn: !(isIOS && BrowserFeatures.pointerEvents)
		});

		this.listDisposables.add(attachSelectBoxStyler(selectBox, this.themeService, {
			selectBackground: settingsSelectBackground,
			selectForeground: settingsSelectForeground,
			selectBorder: settingsSelectBorder,
			selectListBorder: settingsSelectListBorder
		}));
		return selectBox;
	}

	protected editSetting(idx: number): void {
		this.model.setEditKey(idx);
		this.renderList();
	}

	public cancelEdit(): void {
		this.model.setEditKey('none');
		this.renderList();
	}

	protected handleItemChange(originalItem: TDataItem, changedItem: TDataItem, idx: number) {
		this.model.setEditKey('none');

		this._onDidChangeList.fire({
			originalItem,
			item: changedItem,
			targetIndex: idx,
		});

		this.renderList();
	}

	protected renderDataOrEditItem(item: IListViewItem<TDataItem>, idx: number, listFocused: boolean): HTMLElement {
		const rowElement = item.editing ?
			this.renderEdit(item, idx) :
			this.renderDataItem(item, idx, listFocused);

		rowElement.setAttribute('role', 'listitem');

		return rowElement;
	}

	private renderDataItem(item: IListViewItem<TDataItem>, idx: number, listFocused: boolean): HTMLElement {
		const rowElementGroup = this.renderItem(item, idx);
		const rowElement = rowElementGroup.rowElement;

		rowElement.setAttribute('data-index', idx + '');
		rowElement.setAttribute('tabindex', item.selected ? '0' : '-1');
		rowElement.classList.toggle('selected', item.selected);

		const actionBar = new ActionBar(rowElement);
		this.listDisposables.add(actionBar);

		actionBar.push(this.getActionsForItem(item, idx), { icon: true, label: true });
		this.addTooltipsToRow(rowElementGroup, item);

		if (item.selected && listFocused) {
			this.listDisposables.add(disposableTimeout(() => rowElement.focus()));
		}

		return rowElement;
	}

	private renderAddButton(): HTMLElement {
		const rowElement = $('.setting-list-new-row');

		const startAddButton = this._register(new Button(rowElement));
		startAddButton.label = this.getLocalizedStrings().addButtonLabel;
		startAddButton.element.classList.add('setting-list-addButton');
		this._register(attachButtonStyler(startAddButton, this.themeService));

		this._register(startAddButton.onDidClick(() => {
			this.model.setEditKey('create');
			this.renderList();
		}));

		return rowElement;
	}

	private onListClick(e: MouseEvent): void {
		const targetIdx = this.getClickedItemIndex(e);
		if (targetIdx < 0) {
			return;
		}

		e.preventDefault();
		e.stopImmediatePropagation();
		if (this.model.getSelected() === targetIdx) {
			return;
		}

		this.selectRow(targetIdx);
	}

	private onListDoubleClick(e: MouseEvent): void {
		const targetIdx = this.getClickedItemIndex(e);
		if (targetIdx < 0) {
			return;
		}

		const item = this.model.items[targetIdx];
		if (item) {
			this.editSetting(targetIdx);
			e.preventDefault();
			e.stopPropagation();
		}
	}

	private getClickedItemIndex(e: MouseEvent): number {
		if (!e.target) {
			return -1;
		}

		const actionbar = DOM.findParentWithClass(e.target as HTMLElement, 'monaco-action-bar');
		if (actionbar) {
			// Don't handle doubleclicks inside the action bar
			return -1;
		}

		const element = DOM.findParentWithClass(e.target as HTMLElement, 'setting-list-row');
		if (!element) {
			return -1;
		}

		const targetIdxStr = element.getAttribute('data-index');
		if (!targetIdxStr) {
			return -1;
		}

		const targetIdx = parseInt(targetIdxStr);
		return targetIdx;
	}

	private selectRow(idx: number): void {
		this.model.select(idx);
		this.rowElements.forEach(row => row.classList.remove('selected'));

		const selectedRow = this.rowElements[this.model.getSelected()!];

		selectedRow.classList.add('selected');
		selectedRow.focus();
	}

	private selectNextRow(): void {
		this.model.selectNext();
		this.selectRow(this.model.getSelected()!);
	}

	private selectPreviousRow(): void {
		this.model.selectPrevious();
		this.selectRow(this.model.getSelected()!);
	}
}

interface IListSetValueOptions {
	showAddButton: boolean;
	keySuggester?: IObjectKeySuggester;
}

export interface IListDataItem {
	value: ObjectKey,
	sibling?: string
}

interface ListSettingWidgetDragDetails {
	element: HTMLElement;
	item: IListDataItem;
	itemIndex: number;
}

export class ListSettingWidget extends AbstractListSettingWidget<IListDataItem> {
	private keyValueSuggester: IObjectKeySuggester | undefined;
	private showAddButton: boolean = true;

	override setValue(listData: IListDataItem[], options?: IListSetValueOptions) {
		this.keyValueSuggester = options?.keySuggester;
		this.showAddButton = options?.showAddButton ?? true;
		super.setValue(listData);
	}

	protected getEmptyItem(): IListDataItem {
		return {
			value: {
				type: 'string',
				data: ''
			}
		};
	}

	protected override isAddButtonVisible(): boolean {
		return this.showAddButton;
	}

	protected getContainerClasses(): string[] {
		return ['setting-list-widget'];
	}

	protected getActionsForItem(item: IListDataItem, idx: number): IAction[] {
		return [
			{
				class: ThemeIcon.asClassName(settingsEditIcon),
				enabled: true,
				id: 'workbench.action.editListItem',
				tooltip: this.getLocalizedStrings().editActionTooltip,
				run: () => this.editSetting(idx)
			},
			{
				class: ThemeIcon.asClassName(settingsRemoveIcon),
				enabled: true,
				id: 'workbench.action.removeListItem',
				tooltip: this.getLocalizedStrings().deleteActionTooltip,
				run: () => this._onDidChangeList.fire({ originalItem: item, item: undefined, targetIndex: idx })
			}
		] as IAction[];
	}

	private dragDetails: ListSettingWidgetDragDetails | undefined;

	private getDragImage(item: IListDataItem): HTMLElement {
		const dragImage = $('.monaco-drag-image');
		dragImage.textContent = item.value.data;
		return dragImage;
	}

	protected renderItem(item: IListDataItem, idx: number): RowElementGroup {
		const rowElement = $('.setting-list-row');
		const valueElement = DOM.append(rowElement, $('.setting-list-value'));
		const siblingElement = DOM.append(rowElement, $('.setting-list-sibling'));

		valueElement.textContent = item.value.data.toString();
		siblingElement.textContent = item.sibling ? `when: ${item.sibling}` : null;

		this.addDragAndDrop(rowElement, item, idx);
		return { rowElement, keyElement: valueElement, valueElement: siblingElement };
	}

	protected addDragAndDrop(rowElement: HTMLElement, item: IListDataItem, idx: number) {
		if (this.inReadMode) {
			rowElement.draggable = true;
			rowElement.classList.add('draggable');
		} else {
			rowElement.draggable = false;
			rowElement.classList.remove('draggable');
		}

		this.listDisposables.add(DOM.addDisposableListener(rowElement, DOM.EventType.DRAG_START, (ev) => {
			this.dragDetails = {
				element: rowElement,
				item,
				itemIndex: idx
			};
			if (ev.dataTransfer) {
				ev.dataTransfer.dropEffect = 'move';
				const dragImage = this.getDragImage(item);
				document.body.appendChild(dragImage);
				ev.dataTransfer.setDragImage(dragImage, -10, -10);
				setTimeout(() => document.body.removeChild(dragImage), 0);
			}
		}));
		this.listDisposables.add(DOM.addDisposableListener(rowElement, DOM.EventType.DRAG_OVER, (ev) => {
			if (!this.dragDetails) {
				return false;
			}
			ev.preventDefault();
			if (ev.dataTransfer) {
				ev.dataTransfer.dropEffect = 'move';
			}
			return true;
		}));
		let counter = 0;
		this.listDisposables.add(DOM.addDisposableListener(rowElement, DOM.EventType.DRAG_ENTER, (ev) => {
			counter++;
			rowElement.classList.add('drag-hover');
		}));
		this.listDisposables.add(DOM.addDisposableListener(rowElement, DOM.EventType.DRAG_LEAVE, (ev) => {
			counter--;
			if (!counter) {
				rowElement.classList.remove('drag-hover');
			}
		}));
		this.listDisposables.add(DOM.addDisposableListener(rowElement, DOM.EventType.DROP, (ev) => {
			// cancel the op if we dragged to a completely different setting
			if (!this.dragDetails) {
				return false;
			}
			ev.preventDefault();
			counter = 0;
			if (this.dragDetails.element !== rowElement) {
				this._onDidChangeList.fire({
					originalItem: this.dragDetails.item,
					sourceIndex: this.dragDetails.itemIndex,
					item,
					targetIndex: idx
				});
			}
			return true;
		}));
		this.listDisposables.add(DOM.addDisposableListener(rowElement, DOM.EventType.DRAG_END, (ev) => {
			counter = 0;
			rowElement.classList.remove('drag-hover');
			if (ev.dataTransfer) {
				ev.dataTransfer.clearData();
			}
			if (this.dragDetails) {
				this.dragDetails = undefined;
			}
		}));
	}

	protected renderEdit(item: IListDataItem, idx: number): HTMLElement {
		const rowElement = $('.setting-list-edit-row');
		let valueInput: InputBox | SelectBox;
		let currentDisplayValue: string;
		let currentEnumOptions: IObjectEnumOption[] | undefined;

		if (this.keyValueSuggester) {
			const enumData = this.keyValueSuggester(this.model.items.map(({ value: { data } }) => data), idx);
			item = {
				...item,
				value: {
					type: 'enum',
					data: item.value.data,
					options: enumData ? enumData.options : []
				}
			};
		}

		switch (item.value.type) {
			case 'string':
				valueInput = this.renderInputBox(item.value, rowElement);
				break;
			case 'enum':
				valueInput = this.renderDropdown(item.value, rowElement);
				currentEnumOptions = item.value.options;
				if (item.value.options.length) {
					currentDisplayValue = this.isItemNew(item) ?
						currentEnumOptions[0].value : item.value.data;
				}
				break;
		}

		const updatedInputBoxItem = (): IListDataItem => {
			const inputBox = valueInput as InputBox;
			return {
				value: {
					type: 'string',
					data: inputBox.value
				},
				sibling: siblingInput?.value
			};
		};
		const updatedSelectBoxItem = (selectedValue: string): IListDataItem => {
			return {
				value: {
					type: 'enum',
					data: selectedValue,
					options: currentEnumOptions ?? []
				}
			};
		};
		const onKeyDown = (e: StandardKeyboardEvent) => {
			if (e.equals(KeyCode.Enter)) {
				this.handleItemChange(item, updatedInputBoxItem(), idx);
			} else if (e.equals(KeyCode.Escape)) {
				this.cancelEdit();
				e.preventDefault();
			}
			rowElement?.focus();
		};

		if (item.value.type !== 'string') {
			const selectBox = valueInput as SelectBox;
			this.listDisposables.add(
				selectBox.onDidSelect(({ selected }) => {
					currentDisplayValue = selected;
				})
			);
		} else {
			const inputBox = valueInput as InputBox;
			this.listDisposables.add(
				DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_DOWN, onKeyDown)
			);
		}

		let siblingInput: InputBox | undefined;
		if (!isUndefinedOrNull(item.sibling)) {
			siblingInput = new InputBox(rowElement, this.contextViewService, {
				placeholder: this.getLocalizedStrings().siblingInputPlaceholder
			});
			siblingInput.element.classList.add('setting-list-siblingInput');
			this.listDisposables.add(siblingInput);
			this.listDisposables.add(attachInputBoxStyler(siblingInput, this.themeService, {
				inputBackground: settingsTextInputBackground,
				inputForeground: settingsTextInputForeground,
				inputBorder: settingsTextInputBorder
			}));
			siblingInput.value = item.sibling;

			this.listDisposables.add(
				DOM.addStandardDisposableListener(siblingInput.inputElement, DOM.EventType.KEY_DOWN, onKeyDown)
			);
		} else if (valueInput instanceof InputBox) {
			valueInput.element.classList.add('no-sibling');
		}

		const okButton = this._register(new Button(rowElement));
		okButton.label = localize('okButton', "OK");
		okButton.element.classList.add('setting-list-ok-button');

		this.listDisposables.add(attachButtonStyler(okButton, this.themeService));
		this.listDisposables.add(okButton.onDidClick(() => {
			if (item.value.type === 'string') {
				this.handleItemChange(item, updatedInputBoxItem(), idx);
			} else {
				this.handleItemChange(item, updatedSelectBoxItem(currentDisplayValue), idx);
			}
		}));

		const cancelButton = this._register(new Button(rowElement, { secondary: true }));
		cancelButton.label = localize('cancelButton', "Cancel");
		cancelButton.element.classList.add('setting-list-cancel-button');

		this.listDisposables.add(attachButtonStyler(cancelButton, this.themeService));
		this.listDisposables.add(cancelButton.onDidClick(() => this.cancelEdit()));

		this.listDisposables.add(
			disposableTimeout(() => {
				valueInput.focus();
				if (valueInput instanceof InputBox) {
					valueInput.select();
				}
			})
		);

		return rowElement;
	}

	protected isItemNew(item: IListDataItem): boolean {
		return item.value.data === '';
	}

	protected addTooltipsToRow(rowElementGroup: RowElementGroup, { value, sibling }: IListDataItem) {
		const title = isUndefinedOrNull(sibling)
			? localize('listValueHintLabel', "List item `{0}`", value.data)
			: localize('listSiblingHintLabel', "List item `{0}` with sibling `${1}`", value.data, sibling);

		const { rowElement } = rowElementGroup;
		rowElement.title = title;
		rowElement.setAttribute('aria-label', rowElement.title);
	}

	protected getLocalizedStrings() {
		return {
			deleteActionTooltip: localize('removeItem', "Remove Item"),
			editActionTooltip: localize('editItem', "Edit Item"),
			addButtonLabel: localize('addItem', "Add Item"),
			inputPlaceholder: localize('itemInputPlaceholder', "String Item..."),
			siblingInputPlaceholder: localize('listSiblingInputPlaceholder', "Sibling..."),
		};
	}

	private renderInputBox(value: ObjectValue, rowElement: HTMLElement): InputBox {
		const valueInput = new InputBox(rowElement, this.contextViewService, {
			placeholder: this.getLocalizedStrings().inputPlaceholder
		});

		valueInput.element.classList.add('setting-list-valueInput');
		this.listDisposables.add(attachInputBoxStyler(valueInput, this.themeService, {
			inputBackground: settingsTextInputBackground,
			inputForeground: settingsTextInputForeground,
			inputBorder: settingsTextInputBorder
		}));
		this.listDisposables.add(valueInput);
		valueInput.value = value.data.toString();

		return valueInput;
	}

	private renderDropdown(value: ObjectKey, rowElement: HTMLElement): SelectBox {
		if (value.type !== 'enum') {
			throw new Error('Valuetype must be enum.');
		}
		const selectBox = this.createBasicSelectBox(value);

		const wrapper = $('.setting-list-object-list-row');
		selectBox.render(wrapper);
		rowElement.appendChild(wrapper);

		return selectBox;
	}
}

export class ExcludeSettingWidget extends ListSettingWidget {
	protected override getContainerClasses() {
		return ['setting-list-exclude-widget'];
	}

	protected override addDragAndDrop(rowElement: HTMLElement, item: IListDataItem, idx: number) {
		return;
	}

	protected override addTooltipsToRow(rowElementGroup: RowElementGroup, { value, sibling }: IListDataItem): void {
		const title = isUndefinedOrNull(sibling)
			? localize('excludePatternHintLabel', "Exclude files matching `{0}`", value.data)
			: localize('excludeSiblingHintLabel', "Exclude files matching `{0}`, only when a file matching `{1}` is present", value.data, sibling);

		const { rowElement } = rowElementGroup;
		rowElement.title = title;
		rowElement.setAttribute('aria-label', rowElement.title);
	}

	protected override getLocalizedStrings() {
		return {
			deleteActionTooltip: localize('removeExcludeItem', "Remove Exclude Item"),
			editActionTooltip: localize('editExcludeItem', "Edit Exclude Item"),
			addButtonLabel: localize('addPattern', "Add Pattern"),
			inputPlaceholder: localize('excludePatternInputPlaceholder', "Exclude Pattern..."),
			siblingInputPlaceholder: localize('excludeSiblingInputPlaceholder', "When Pattern Is Present..."),
		};
	}
}

interface IObjectStringData {
	type: 'string';
	data: string;
}

export interface IObjectEnumOption {
	value: string;
	description?: string
}

interface IObjectEnumData {
	type: 'enum';
	data: string;
	options: IObjectEnumOption[];
}

interface IObjectBoolData {
	type: 'boolean';
	data: boolean;
}

type ObjectKey = IObjectStringData | IObjectEnumData;
export type ObjectValue = IObjectStringData | IObjectEnumData | IObjectBoolData;
type ObjectWidget = InputBox | SelectBox;

export interface IObjectDataItem {
	key: ObjectKey;
	value: ObjectValue;
	keyDescription?: string;
	removable: boolean;
}

export interface IObjectValueSuggester {
	(key: string): ObjectValue | undefined;
}

export interface IObjectKeySuggester {
	(existingKeys: string[], idx?: number): IObjectEnumData | undefined;
}

interface IObjectSetValueOptions {
	settingKey: string;
	showAddButton: boolean;
	keySuggester: IObjectKeySuggester;
	valueSuggester: IObjectValueSuggester;
}

interface IObjectRenderEditWidgetOptions {
	isKey: boolean;
	idx: number;
	readonly originalItem: IObjectDataItem;
	readonly changedItem: IObjectDataItem;
	update(keyOrValue: ObjectKey | ObjectValue): void;
}

export class ObjectSettingDropdownWidget extends AbstractListSettingWidget<IObjectDataItem> {
	private currentSettingKey: string = '';
	private showAddButton: boolean = true;
	private keySuggester: IObjectKeySuggester = () => undefined;
	private valueSuggester: IObjectValueSuggester = () => undefined;

	override setValue(listData: IObjectDataItem[], options?: IObjectSetValueOptions): void {
		this.showAddButton = options?.showAddButton ?? this.showAddButton;
		this.keySuggester = options?.keySuggester ?? this.keySuggester;
		this.valueSuggester = options?.valueSuggester ?? this.valueSuggester;

		if (isDefined(options) && options.settingKey !== this.currentSettingKey) {
			this.model.setEditKey('none');
			this.model.select(null);
			this.currentSettingKey = options.settingKey;
		}

		super.setValue(listData);
	}

	isItemNew(item: IObjectDataItem): boolean {
		return item.key.data === '' && item.value.data === '';
	}

	protected override isAddButtonVisible(): boolean {
		return this.showAddButton;
	}

	protected getEmptyItem(): IObjectDataItem {
		return {
			key: { type: 'string', data: '' },
			value: { type: 'string', data: '' },
			removable: true,
		};
	}

	protected getContainerClasses() {
		return ['setting-list-object-widget'];
	}

	protected getActionsForItem(item: IObjectDataItem, idx: number): IAction[] {
		const actions = [
			{
				class: ThemeIcon.asClassName(settingsEditIcon),
				enabled: true,
				id: 'workbench.action.editListItem',
				tooltip: this.getLocalizedStrings().editActionTooltip,
				run: () => this.editSetting(idx)
			},
		] as IAction[];

		if (item.removable) {
			actions.push({
				class: ThemeIcon.asClassName(settingsRemoveIcon),
				enabled: true,
				id: 'workbench.action.removeListItem',
				tooltip: this.getLocalizedStrings().deleteActionTooltip,
				run: () => this._onDidChangeList.fire({ originalItem: item, item: undefined, targetIndex: idx })
			} as IAction);
		} else {
			actions.push({
				class: ThemeIcon.asClassName(settingsDiscardIcon),
				enabled: true,
				id: 'workbench.action.resetListItem',
				tooltip: this.getLocalizedStrings().resetActionTooltip,
				run: () => this._onDidChangeList.fire({ originalItem: item, item: undefined, targetIndex: idx })
			} as IAction);
		}

		return actions;
	}

	protected override renderHeader() {
		const header = $('.setting-list-row-header');
		const keyHeader = DOM.append(header, $('.setting-list-object-key'));
		const valueHeader = DOM.append(header, $('.setting-list-object-value'));
		const { keyHeaderText, valueHeaderText } = this.getLocalizedStrings();

		keyHeader.textContent = keyHeaderText;
		valueHeader.textContent = valueHeaderText;

		return header;
	}

	protected renderItem(item: IObjectDataItem, idx: number): RowElementGroup {
		const rowElement = $('.setting-list-row');
		rowElement.classList.add('setting-list-object-row');

		const keyElement = DOM.append(rowElement, $('.setting-list-object-key'));
		const valueElement = DOM.append(rowElement, $('.setting-list-object-value'));

		keyElement.textContent = item.key.data;
		valueElement.textContent = item.value.data.toString();

		return { rowElement, keyElement, valueElement };
	}

	protected renderEdit(item: IObjectDataItem, idx: number): HTMLElement {
		const rowElement = $('.setting-list-edit-row.setting-list-object-row');

		const changedItem = { ...item };
		const onKeyChange = (key: ObjectKey) => {
			changedItem.key = key;
			okButton.enabled = key.data !== '';

			const suggestedValue = this.valueSuggester(key.data) ?? item.value;

			if (this.shouldUseSuggestion(item.value, changedItem.value, suggestedValue)) {
				onValueChange(suggestedValue);
				renderLatestValue();
			}
		};
		const onValueChange = (value: ObjectValue) => {
			changedItem.value = value;
		};

		let keyWidget: ObjectWidget | undefined;
		let keyElement: HTMLElement;

		if (this.showAddButton) {
			if (this.isItemNew(item)) {
				const suggestedKey = this.keySuggester(this.model.items.map(({ key: { data } }) => data));

				if (isDefined(suggestedKey)) {
					changedItem.key = suggestedKey;
					const suggestedValue = this.valueSuggester(changedItem.key.data);
					onValueChange(suggestedValue ?? changedItem.value);
				}
			}

			const { widget, element } = this.renderEditWidget(changedItem.key, {
				idx,
				isKey: true,
				originalItem: item,
				changedItem,
				update: onKeyChange,
			});
			keyWidget = widget;
			keyElement = element;
		} else {
			keyElement = $('.setting-list-object-key');
			keyElement.textContent = item.key.data;
		}

		let valueWidget: ObjectWidget;
		const valueContainer = $('.setting-list-object-value-container');

		const renderLatestValue = () => {
			const { widget, element } = this.renderEditWidget(changedItem.value, {
				idx,
				isKey: false,
				originalItem: item,
				changedItem,
				update: onValueChange,
			});

			valueWidget = widget;

			DOM.clearNode(valueContainer);
			valueContainer.append(element);
		};

		renderLatestValue();

		rowElement.append(keyElement, valueContainer);

		const okButton = this._register(new Button(rowElement));
		okButton.enabled = changedItem.key.data !== '';
		okButton.label = localize('okButton', "OK");
		okButton.element.classList.add('setting-list-ok-button');

		this.listDisposables.add(attachButtonStyler(okButton, this.themeService));
		this.listDisposables.add(okButton.onDidClick(() => this.handleItemChange(item, changedItem, idx)));

		const cancelButton = this._register(new Button(rowElement, { secondary: true }));
		cancelButton.label = localize('cancelButton', "Cancel");
		cancelButton.element.classList.add('setting-list-cancel-button');

		this.listDisposables.add(attachButtonStyler(cancelButton, this.themeService));
		this.listDisposables.add(cancelButton.onDidClick(() => this.cancelEdit()));

		this.listDisposables.add(
			disposableTimeout(() => {
				const widget = keyWidget ?? valueWidget;

				widget.focus();

				if (widget instanceof InputBox) {
					widget.select();
				}
			})
		);

		return rowElement;
	}

	private renderEditWidget(
		keyOrValue: ObjectKey | ObjectValue,
		options: IObjectRenderEditWidgetOptions,
	) {
		switch (keyOrValue.type) {
			case 'string':
				return this.renderStringEditWidget(keyOrValue, options);
			case 'enum':
				return this.renderEnumEditWidget(keyOrValue, options);
			case 'boolean':
				return this.renderEnumEditWidget(
					{
						type: 'enum',
						data: keyOrValue.data.toString(),
						options: [{ value: 'true' }, { value: 'false' }],
					},
					options,
				);
		}
	}

	private renderStringEditWidget(
		keyOrValue: IObjectStringData,
		{ idx, isKey, originalItem, changedItem, update }: IObjectRenderEditWidgetOptions,
	) {
		const wrapper = $(isKey ? '.setting-list-object-input-key' : '.setting-list-object-input-value');
		const inputBox = new InputBox(wrapper, this.contextViewService, {
			placeholder: isKey
				? localize('objectKeyInputPlaceholder', "Key")
				: localize('objectValueInputPlaceholder', "Value"),
		});

		inputBox.element.classList.add('setting-list-object-input');

		this.listDisposables.add(attachInputBoxStyler(inputBox, this.themeService, {
			inputBackground: settingsTextInputBackground,
			inputForeground: settingsTextInputForeground,
			inputBorder: settingsTextInputBorder
		}));
		this.listDisposables.add(inputBox);
		inputBox.value = keyOrValue.data;

		this.listDisposables.add(inputBox.onDidChange(value => update({ ...keyOrValue, data: value })));

		const onKeyDown = (e: StandardKeyboardEvent) => {
			if (e.equals(KeyCode.Enter)) {
				this.handleItemChange(originalItem, changedItem, idx);
			} else if (e.equals(KeyCode.Escape)) {
				this.cancelEdit();
				e.preventDefault();
			}
		};

		this.listDisposables.add(
			DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_DOWN, onKeyDown)
		);

		return { widget: inputBox, element: wrapper };
	}

	private renderEnumEditWidget(
		keyOrValue: IObjectEnumData,
		{ isKey, changedItem, update }: IObjectRenderEditWidgetOptions,
	) {
		const selectBox = this.createBasicSelectBox(keyOrValue);

		const changedKeyOrValue = isKey ? changedItem.key : changedItem.value;
		this.listDisposables.add(
			selectBox.onDidSelect(({ selected }) =>
				update(
					changedKeyOrValue.type === 'boolean'
						? { ...changedKeyOrValue, data: selected === 'true' ? true : false }
						: { ...changedKeyOrValue, data: selected },
				)
			)
		);

		const wrapper = $('.setting-list-object-input');
		wrapper.classList.add(
			isKey ? 'setting-list-object-input-key' : 'setting-list-object-input-value',
		);

		selectBox.render(wrapper);

		// Switch to the first item if the user set something invalid in the json
		const selected = keyOrValue.options.findIndex(option => keyOrValue.data === option.value);
		if (selected === -1 && keyOrValue.options.length) {
			update(
				changedKeyOrValue.type === 'boolean'
					? { ...changedKeyOrValue, data: true }
					: { ...changedKeyOrValue, data: keyOrValue.options[0].value }
			);
		} else if (changedKeyOrValue.type === 'boolean') {
			// https://github.com/microsoft/vscode/issues/129581
			update({ ...changedKeyOrValue, data: keyOrValue.data === 'true' });
		}

		return { widget: selectBox, element: wrapper };
	}

	private shouldUseSuggestion(originalValue: ObjectValue, previousValue: ObjectValue, newValue: ObjectValue): boolean {
		// suggestion is exactly the same
		if (newValue.type !== 'enum' && newValue.type === previousValue.type && newValue.data === previousValue.data) {
			return false;
		}

		// item is new, use suggestion
		if (originalValue.data === '') {
			return true;
		}

		if (previousValue.type === newValue.type && newValue.type !== 'enum') {
			return false;
		}

		// check if all enum options are the same
		if (previousValue.type === 'enum' && newValue.type === 'enum') {
			const previousEnums = new Set(previousValue.options.map(({ value }) => value));
			newValue.options.forEach(({ value }) => previousEnums.delete(value));

			// all options are the same
			if (previousEnums.size === 0) {
				return false;
			}
		}

		return true;
	}

	protected addTooltipsToRow(rowElementGroup: RowElementGroup, item: IObjectDataItem): void {
		const { keyElement, valueElement, rowElement } = rowElementGroup;
		const accessibleDescription = localize('objectPairHintLabel', "The property `{0}` is set to `{1}`.", item.key.data, item.value.data);

		const keyDescription = this.getEnumDescription(item.key) ?? item.keyDescription ?? accessibleDescription;
		keyElement.title = keyDescription;

		const valueDescription = this.getEnumDescription(item.value) ?? accessibleDescription;
		valueElement!.title = valueDescription;

		rowElement.setAttribute('aria-label', accessibleDescription);
	}

	private getEnumDescription(keyOrValue: ObjectKey | ObjectValue): string | undefined {
		const enumDescription = keyOrValue.type === 'enum'
			? keyOrValue.options.find(({ value }) => keyOrValue.data === value)?.description
			: undefined;
		return enumDescription;
	}

	protected getLocalizedStrings() {
		return {
			deleteActionTooltip: localize('removeItem', "Remove Item"),
			resetActionTooltip: localize('resetItem', "Reset Item"),
			editActionTooltip: localize('editItem', "Edit Item"),
			addButtonLabel: localize('addItem', "Add Item"),
			keyHeaderText: localize('objectKeyHeader', "Item"),
			valueHeaderText: localize('objectValueHeader', "Value"),
		};
	}
}

interface IBoolObjectSetValueOptions {
	settingKey: string;
}

export class ObjectSettingCheckboxWidget extends AbstractListSettingWidget<IObjectDataItem> {
	private currentSettingKey: string = '';

	override setValue(listData: IObjectDataItem[], options?: IBoolObjectSetValueOptions): void {
		if (isDefined(options) && options.settingKey !== this.currentSettingKey) {
			this.model.setEditKey('none');
			this.model.select(null);
			this.currentSettingKey = options.settingKey;
		}

		super.setValue(listData);
	}

	isItemNew(item: IObjectDataItem): boolean {
		return !item.key.data && !item.value.data;
	}

	protected getEmptyItem(): IObjectDataItem {
		return {
			key: { type: 'string', data: '' },
			value: { type: 'boolean', data: false },
			removable: false
		};
	}

	protected getContainerClasses() {
		return ['setting-list-object-widget'];
	}

	protected getActionsForItem(item: IObjectDataItem, idx: number): IAction[] {
		return [];
	}

	protected override isAddButtonVisible(): boolean {
		return false;
	}

	protected override renderHeader() {
		return undefined;
	}

	protected override renderDataOrEditItem(item: IListViewItem<IObjectDataItem>, idx: number, listFocused: boolean): HTMLElement {
		const rowElement = this.renderEdit(item, idx);
		rowElement.setAttribute('role', 'listitem');
		return rowElement;
	}

	protected renderItem(item: IObjectDataItem, idx: number): RowElementGroup {
		// Return just the containers, since we always render in edit mode anyway
		const rowElement = $('.blank-row');
		const keyElement = $('.blank-row-key');
		return { rowElement, keyElement };
	}

	protected renderEdit(item: IObjectDataItem, idx: number): HTMLElement {
		const rowElement = $('.setting-list-edit-row.setting-list-object-row.setting-item-bool');

		const changedItem = { ...item };
		const onValueChange = (newValue: boolean) => {
			changedItem.value.data = newValue;
			this.handleItemChange(item, changedItem, idx);
		};
		const { element, widget: checkbox } = this.renderEditWidget((changedItem.value as IObjectBoolData).data, onValueChange);
		rowElement.appendChild(element);

		const valueElement = DOM.append(rowElement, $('.setting-list-object-value'));
		valueElement.textContent = changedItem.key.data;

		// We add the tooltips here, because the method is not called by default
		// for widgets in edit mode
		const rowElementGroup = { rowElement, keyElement: valueElement, valueElement: checkbox.domNode };
		this.addTooltipsToRow(rowElementGroup, item);

		this._register(DOM.addDisposableListener(valueElement, DOM.EventType.MOUSE_DOWN, e => {
			const targetElement = <HTMLElement>e.target;
			if (targetElement.tagName.toLowerCase() !== 'a') {
				checkbox.checked = !checkbox.checked;
				onValueChange(checkbox.checked);
			}
			DOM.EventHelper.stop(e);
		}));

		return rowElement;
	}

	private renderEditWidget(
		value: boolean,
		onValueChange: (newValue: boolean) => void
	) {
		const checkbox = new Checkbox({
			icon: Codicon.check,
			actionClassName: 'setting-value-checkbox',
			isChecked: value,
			title: ''
		});

		this.listDisposables.add(checkbox);

		const wrapper = $('.setting-list-object-input');
		wrapper.classList.add('setting-list-object-input-key-checkbox');
		checkbox.domNode.classList.add('setting-value-checkbox');
		wrapper.appendChild(checkbox.domNode);

		this._register(DOM.addDisposableListener(wrapper, DOM.EventType.MOUSE_DOWN, e => {
			checkbox.checked = !checkbox.checked;
			onValueChange(checkbox.checked);

			// Without this line, the settings editor assumes
			// we lost focus on this setting completely.
			e.stopImmediatePropagation();
		}));

		return { widget: checkbox, element: wrapper };
	}

	protected addTooltipsToRow(rowElementGroup: RowElementGroup, item: IObjectDataItem): void {
		const accessibleDescription = localize('objectPairHintLabel', "The property `{0}` is set to `{1}`.", item.key.data, item.value.data);
		const title = item.keyDescription ?? accessibleDescription;
		const { rowElement, keyElement, valueElement } = rowElementGroup;

		keyElement.title = title;
		valueElement!.setAttribute('aria-label', accessibleDescription);
		rowElement.setAttribute('aria-label', accessibleDescription);
	}

	protected getLocalizedStrings() {
		return {
			deleteActionTooltip: localize('removeItem', "Remove Item"),
			resetActionTooltip: localize('resetItem', "Reset Item"),
			editActionTooltip: localize('editItem', "Edit Item"),
			addButtonLabel: localize('addItem', "Add Item"),
			keyHeaderText: localize('objectKeyHeader', "Item"),
			valueHeaderText: localize('objectValueHeader', "Value"),
		};
	}
}
