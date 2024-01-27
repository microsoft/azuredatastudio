/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { EOL } from 'os';
import * as uiLoc from '../ui/localizedConstants';
import { IconPathHelper } from '../iconHelper';

export const DefaultLabelWidth = 150;
export const DefaultInputWidth = 300;
export const DefaultLongInputWidth = 440;
export const DefaultButtonWidth = 100;
export const DefaultColumnCheckboxWidth = 150;
export const DefaultTableWidth = DefaultInputWidth + DefaultLabelWidth;
export const DefaultMaxTableRowCount = 10;
export const DefaultMinTableRowCount = 1;
const TableRowHeight = 25;
const TableColumnHeaderHeight = 30;

export const tableHeader = { 'border-color': '#ccc', 'color': '#666666', 'font-weight': 'normal' };
export const tableRow = { 'border-color': '#ccc' };

export function getTableHeight(rowCount: number, minRowCount: number = DefaultMinTableRowCount, maxRowCount: number = DefaultMaxTableRowCount): number {
	return Math.min(Math.max(rowCount, minRowCount), maxRowCount) * TableRowHeight + TableColumnHeaderHeight;
}

export interface DialogButton {
	buttonAriaLabel: string;
	buttonHandler: (button: azdata.ButtonComponent) => Promise<void>,
	enabled?: boolean
}

export type TableListItemEnabledStateGetter<T> = (item: T) => boolean;
export type TableListItemValueGetter<T> = (item: T) => string[];
export type TableListItemComparer<T> = (item1: T, item2: T) => boolean;
export const DefaultTableListItemEnabledStateGetter: TableListItemEnabledStateGetter<any> = (item: any) => true;
export const DefaultTableListItemValueGetter: TableListItemValueGetter<any> = (item: any) => [item?.toString() ?? ''];
export const DefaultTableListItemComparer: TableListItemComparer<any> = (item1: any, item2: any) => item1 === item2;

export abstract class DialogBase<DialogResult> {
	protected readonly disposables: vscode.Disposable[] = [];
	protected readonly dialogObject: azdata.window.Dialog;

	private _modelView: azdata.ModelView;
	private _loadingComponent: azdata.LoadingComponent;
	private _formContainer: azdata.DivContainer;
	private _closePromise: Promise<DialogResult | undefined>;

	constructor(title: string, name: string, width: azdata.window.DialogWidth = 'narrow', style: azdata.window.DialogStyle = 'flyout') {
		this.dialogObject = azdata.window.createModelViewDialog(title, name, width, style);
		this.dialogObject.okButton.label = uiLoc.OkText;
		this.dialogObject.registerCloseValidator(async (): Promise<boolean> => {
			const confirmed = await this.onConfirmation();
			if (!confirmed) {
				return false;
			}
			return await this.runValidation();
		});
		this._closePromise = new Promise<DialogResult | undefined>(resolve => {
			this.disposables.push(this.dialogObject.onClosed(async (reason: azdata.window.CloseReason) => {
				await this.dispose(reason);
				const result = reason === 'ok' ? this.dialogResult : undefined;
				resolve(result);
			}));
		});
	}

	public waitForClose(): Promise<DialogResult | undefined> {
		return this._closePromise;
	}

	protected get dialogResult(): DialogResult | undefined { return undefined; }

	protected async onConfirmation(): Promise<boolean> { return true; }

	protected abstract initialize(): Promise<void>;

	protected get formContainer(): azdata.DivContainer { return this._formContainer; }

	protected get modelView(): azdata.ModelView { return this._modelView; }

	protected onFormFieldChange(): void { }

	protected removeButtonEnabled(table: azdata.TableComponent): boolean { return true; }

	protected addButtonEnabled(table: azdata.TableComponent): boolean { return true; }

	protected validateInput(): Promise<string[]> { return Promise.resolve([]); }

	public async open(): Promise<void> {
		try {
			this.updateLoadingStatus(true);
			const initializeDialogPromise = new Promise<void>((async resolve => {
				this.dialogObject.registerContent(async view => {
					this._modelView = view;
					this._formContainer = this.createFormContainer([]);
					this.disposables.push(this._formContainer);
					this._loadingComponent = view.modelBuilder.loadingComponent().withItem(this._formContainer).withProps({
						loading: true,
						loadingText: uiLoc.LoadingDialogText,
						loadingCompletedText: uiLoc.LoadingDialogCompletedText,
						showText: true,
						CSSStyles: {
							width: "100%",
							height: "100%"
						}
					}).component();
					await view.initializeModel(this._loadingComponent);
					resolve();
				});
			}));
			azdata.window.openDialog(this.dialogObject);
			await initializeDialogPromise;
			await this.initialize();
			this.updateLoadingStatus(false);
		} catch (err) {
			azdata.window.closeDialog(this.dialogObject);
			throw err;
		}
	}

	protected async dispose(reason: azdata.window.CloseReason): Promise<void> {
		this.disposables.forEach(disposable => disposable.dispose());
	}

	protected async runValidation(showErrorMessage: boolean = true): Promise<boolean> {
		const errors = await this.validateInput();
		if (errors.length > 0 && (this.dialogObject.message?.text || showErrorMessage)) {
			this.dialogObject.message = {
				text: errors.join(EOL),
				level: azdata.window.MessageLevel.Error
			};
		} else {
			this.dialogObject.message = undefined;
		}
		return errors.length === 0;
	}

	protected createLabelInputContainer(label: string, component: azdata.Component | azdata.Component[], required: boolean = false): azdata.FlexContainer {
		let container: azdata.FlexContainer = undefined;
		if (Array.isArray(component)) {
			const labelComponent = this.modelView.modelBuilder.text().withProps({ width: DefaultLabelWidth - 40, value: label, requiredIndicator: required, CSSStyles: { 'padding-right': '10px' } }).component();
			container = this.modelView.modelBuilder.flexContainer().withItems([labelComponent, ...component], { CSSStyles: { 'margin-right': '5px', 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		} else {
			let props: azdata.TextComponentProperties;
			if (required) {
				props = { width: DefaultLabelWidth, value: label, requiredIndicator: required };
			} else {
				// The required label adds extra padding to the text component, so we need to modify the width and the padding of optional labels to fix the misalignment.
				props = { width: DefaultLabelWidth - 10, value: label, requiredIndicator: required, CSSStyles: { 'padding-right': '10px' } };
			}
			const labelComponent = this.modelView.modelBuilder.text().withProps(props).component();
			container = this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'horizontal', flexWrap: 'nowrap', alignItems: 'center' }).withItems([labelComponent], { flex: '0 0 auto' }).component();
			container.addItem(component, { flex: '1 1 auto' });
		}
		return container;
	}

	protected createCheckbox(label: string, handler: (checked: boolean) => Promise<void>, checked: boolean = false, enabled: boolean = true): azdata.CheckBoxComponent {
		const checkbox = this.modelView.modelBuilder.checkBox().withProps({
			label: label,
			checked: checked,
			enabled: enabled
		}).component();
		this.disposables.push(checkbox.onChanged(async () => {
			await handler(checkbox.checked!);
			this.onFormFieldChange();
			await this.runValidation(false);
		}));
		return checkbox;
	}

	protected createPasswordInputBox(ariaLabel: string, textChangeHandler: (newValue: string) => Promise<void>, value: string = '', enabled: boolean = true, width: number = DefaultInputWidth): azdata.InputBoxComponent {
		return this.createInputBox(textChangeHandler, {
			ariaLabel: ariaLabel,
			value: value,
			enabled: enabled,
			inputType: 'password',
			width: width
		});
	}

	/**
	 * Creates an input box. If properties are not passed in, then an input box is created with the following default properties:
	 * inputType - text
	 * width - DefaultInputWidth
	 * value - empty
	 * enabled - true
	 * @param textChangeHandler - Function called on text changed.
	 * @param properties - Inputbox properties.
	 * @param customValidation - Dynamic validation function.
	 */
	protected createInputBox(textChangeHandler: (newValue: string) => Promise<void>, properties: azdata.InputBoxProperties, customValidation?: () => Promise<boolean>): azdata.InputBoxComponent {
		properties.width = properties.width ?? DefaultInputWidth;
		properties.inputType = properties.inputType ?? 'text';
		properties.value = properties.value ?? '';
		properties.enabled = properties.enabled ?? true;
		properties.required = properties.required;
		const inputbox = this.modelView.modelBuilder.inputBox().withProps(properties);
		if (customValidation) {
			inputbox.withValidation(customValidation);
		}
		const inputBoxComponent = inputbox.component();
		this.disposables.push(inputBoxComponent.onTextChanged(async () => {
			await textChangeHandler(inputBoxComponent.value!);
			this.onFormFieldChange();
			await this.runValidation(false);
		}));
		return inputBoxComponent;
	}

	protected createGroup(header: string, items: azdata.Component[], collapsible: boolean = true, collapsed: boolean = false): azdata.GroupContainer {
		return this.modelView.modelBuilder.groupContainer().withLayout({
			header: header,
			collapsible: collapsible,
			collapsed: collapsed
		}).withItems(items).component();
	}

	protected createTab(id: string, title: string, content?: azdata.Component): azdata.Tab {
		return {
			title: title,
			content: content,
			id: id
		};
	}

	protected createTableList<T>(ariaLabel: string,
		columnNames: string[],
		allItems: T[],
		selectedItems: T[],
		maxRowCount: number = DefaultMaxTableRowCount,
		enabledStateGetter: TableListItemEnabledStateGetter<T> = DefaultTableListItemEnabledStateGetter,
		rowValueGetter: TableListItemValueGetter<T> = DefaultTableListItemValueGetter,
		itemComparer: TableListItemComparer<T> = DefaultTableListItemComparer): azdata.TableComponent {
		const data = this.getDataForTableList(allItems, selectedItems, enabledStateGetter, rowValueGetter, itemComparer);
		const table = this.modelView.modelBuilder.table().withProps(
			{
				ariaLabel: ariaLabel,
				data: data,
				columns: [
					{
						value: uiLoc.SelectText,
						type: azdata.ColumnType.checkBox,
						options: { actionOnCheckbox: azdata.ActionOnCellCheckboxCheck.customAction }
					}, ...columnNames.map(name => {
						return { value: name };
					})
				],
				width: DefaultTableWidth,
				height: getTableHeight(data.length, DefaultMinTableRowCount, maxRowCount)
			}
		).component();
		this.disposables.push(table.onCellAction!((arg: azdata.ICheckboxCellActionEventArgs) => {
			const item = allItems[arg.row];
			const idx = selectedItems.findIndex(i => itemComparer(i, item));
			if (arg.checked && idx === -1) {
				selectedItems.push(item);
			} else if (!arg.checked && idx !== -1) {
				selectedItems.splice(idx, 1)
			}
			this.onFormFieldChange();
		}));
		return table;
	}

	protected createDeclarativeTableList<T>(ariaLabel: string,
		columnNames: string[],
		allItems: T[],
		selectedItems: T[],
		maxRowCount: number = DefaultMaxTableRowCount,
		enabledStateGetter: TableListItemEnabledStateGetter<T> = DefaultTableListItemEnabledStateGetter,
		rowValueGetter: TableListItemValueGetter<T> = DefaultTableListItemValueGetter,
		itemComparer: TableListItemComparer<T> = DefaultTableListItemComparer): azdata.DeclarativeTableComponent {
		const data = this.getDataForDeclarativeTableList(allItems, selectedItems, enabledStateGetter, rowValueGetter, itemComparer);
		const declarativeTable = this.modelView.modelBuilder.declarativeTable().withProps(
			{
				ariaLabel: ariaLabel,
				dataValues: data,
				columns: [
					{
						displayName: uiLoc.SelectText,
						valueType: azdata.DeclarativeDataType.boolean,
						isReadOnly: false,
						width: '20%',
						headerCssStyles: { ...tableHeader, 'text-align': 'center' }
					}, ...columnNames.map(name => {
						return {
							displayName: name,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: `${80 / columnNames.length - 1}%`,
							headerCssStyles: { ...tableHeader, 'text-align': 'left' }
						};
					})
				],
				width: DefaultTableWidth,
				height: getTableHeight(data.length, DefaultMinTableRowCount, maxRowCount)
			}
		).component();

		this.disposables.push(declarativeTable.onDataChanged!((changedData) => {
			const item = allItems[changedData.row];
			const idx = selectedItems.findIndex(i => itemComparer(i, item));
			if (changedData.value && idx === -1) {
				selectedItems.push(item);
			} else if (!changedData.value && idx !== -1) {
				selectedItems.splice(idx, 1)
			}
			this.onFormFieldChange();
		}));

		return declarativeTable;
	}

	protected async setTableData(table: azdata.TableComponent, data: any[][], maxRowCount: number = DefaultMaxTableRowCount): Promise<void> {
		await table.updateProperties({
			data: data,
			height: getTableHeight(data?.length, DefaultMinTableRowCount, maxRowCount)
		});
	}

	protected getDataForTableList<T>(
		allItems: T[],
		selectedItems: T[],
		enabledStateGetter: TableListItemEnabledStateGetter<T> = DefaultTableListItemEnabledStateGetter,
		rowValueGetter: TableListItemValueGetter<T> = DefaultTableListItemValueGetter,
		itemComparer: TableListItemComparer<T> = DefaultTableListItemComparer): any[][] {
		return allItems.map(item => {
			const idx = selectedItems.findIndex(i => itemComparer(i, item));
			const stateColumnValue = { checked: idx !== -1, enabled: enabledStateGetter(item) };
			return [stateColumnValue, ...rowValueGetter(item)];
		});
	}

	protected getDataForDeclarativeTableList<T>(
		allItems: T[],
		selectedItems: T[],
		enabledStateGetter: TableListItemEnabledStateGetter<T> = DefaultTableListItemEnabledStateGetter,
		rowValueGetter: TableListItemValueGetter<T> = DefaultTableListItemValueGetter,
		itemComparer: TableListItemComparer<T> = DefaultTableListItemComparer): any[][] {
		return allItems.map(item => {
			const idx = selectedItems.findIndex(i => itemComparer(i, item));
			const stateColumnValue = { value: idx !== -1, enabled: enabledStateGetter(item), style: tableRow, ariaLabel: item };
			return [stateColumnValue, ...rowValueGetter(item).map(item => { return { value: item, style: tableRow } })];
		});
	}

	protected createTable(ariaLabel: string, columns: string[] | azdata.TableColumn[], data: any[][], maxRowCount: number = DefaultMaxTableRowCount): azdata.TableComponent {
		const table = this.modelView.modelBuilder.table().withProps(
			{
				ariaLabel: ariaLabel,
				data: data,
				columns: columns,
				width: DefaultTableWidth,
				height: getTableHeight(data.length, DefaultMinTableRowCount, maxRowCount)
			}
		).component();
		return table;
	}

	protected addButtonsForTable(table: azdata.TableComponent, addbutton: DialogButton, removeButton: DialogButton, editButton: DialogButton = undefined): azdata.FlexContainer {
		let addButtonComponent: azdata.ButtonComponent;
		let editButtonComponent: azdata.ButtonComponent;
		let removeButtonComponent: azdata.ButtonComponent;
		let buttonComponents: azdata.ButtonComponent[] = [];
		const updateButtons = (isRemoveEnabled: boolean = undefined) => {
			this.onFormFieldChange();
			const tableSelectedRowsLengthCheck = table.selectedRows?.length === 1 && table.selectedRows[0] !== -1 && table.selectedRows[0] < table.data.length;
			if (editButton !== undefined) {
				editButtonComponent.enabled = tableSelectedRowsLengthCheck;
			}
			addButtonComponent.enabled = this.addButtonEnabled(table);
			removeButtonComponent.enabled = !!isRemoveEnabled && tableSelectedRowsLengthCheck;
		}
		addButtonComponent = this.createButton(uiLoc.AddText, addbutton.buttonAriaLabel, async () => {
			await addbutton.buttonHandler(addButtonComponent);
			updateButtons();
		}, addbutton.enabled ?? true);
		buttonComponents.push(addButtonComponent);

		if (editButton !== undefined) {
			editButtonComponent = this.createButton(uiLoc.EditText, editButton.buttonAriaLabel, async () => {
				await editButton.buttonHandler(editButtonComponent);
				updateButtons();
			}, false);
			buttonComponents.push(editButtonComponent);
		}

		removeButtonComponent = this.createButton(uiLoc.RemoveText, removeButton.buttonAriaLabel, async () => {
			await removeButton.buttonHandler(removeButtonComponent);
			if (table.selectedRows.length === 1 && table.selectedRows[0] >= table.data.length) {
				table.selectedRows = [table.data.length - 1];
			}
			updateButtons();
		}, false);
		buttonComponents.push(removeButtonComponent);

		this.disposables.push(table.onRowSelected(() => {
			const isRemoveButtonEnabled = this.removeButtonEnabled(table);
			updateButtons(isRemoveButtonEnabled);
		}));

		return this.createButtonContainer(buttonComponents)
	}

	protected createDropdown(ariaLabel: string, handler: (newValue: string) => Promise<void>, values: string[], value: string | undefined, enabled: boolean = true, width: number = DefaultInputWidth, editable?: boolean, strictSelection?: boolean): azdata.DropDownComponent {
		// Automatically add an empty item to the beginning of the list if the current value is not specified.
		// This is needed when no meaningful default value can be provided.
		// Create a new array so that the original array isn't modified.
		const dropdownValues = [];
		dropdownValues.push(...values);
		if (!value) {
			dropdownValues.unshift('');
		}
		const dropdown = this.modelView.modelBuilder.dropDown().withProps({
			ariaLabel: ariaLabel,
			values: dropdownValues,
			value: value,
			width: width,
			enabled: enabled,
			editable: editable,
			strictSelection: strictSelection
		}).component();
		this.disposables.push(dropdown.onValueChanged(async () => {
			await handler(<string>dropdown.value!);
			this.onFormFieldChange();
			await this.runValidation(false);
		}));
		return dropdown;
	}

	protected createButton(label: string, ariaLabel: string, handler: () => Promise<void>, enabled: boolean = true): azdata.ButtonComponent {
		const button = this.modelView.modelBuilder.button().withProps({
			label: label,
			ariaLabel: ariaLabel,
			enabled: enabled,
			secondary: true,
			CSSStyles: { 'min-width': '70px', 'margin-left': '5px' }
		}).component();
		this.disposables.push(button.onDidClick(async () => {
			await handler();
		}));
		return button;
	}

	protected createButtonContainer(items: azdata.ButtonComponent[], justifyContent: azdata.JustifyContentType = 'flex-end'): azdata.FlexContainer {
		return this.modelView.modelBuilder.flexContainer().withProps({
			CSSStyles: { 'margin': '5px 0' }
		}).withLayout({
			flexFlow: 'horizontal',
			flexWrap: 'nowrap',
			justifyContent: justifyContent
		}).withItems(items, { flex: '0 0 auto' }).component();
	}

	protected createHorizontalContainer(header: string, items: azdata.Component[]): azdata.FlexContainer {
		return this.modelView.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '5px', 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
	}

	protected createBrowseButton(handler: () => Promise<void>, enabled: boolean = true): azdata.ButtonComponent {
		const button = this.dialogObject.modelView.modelBuilder.button().withProps({
			ariaLabel: 'browse',
			iconPath: IconPathHelper.folder,
			width: '18px',
			height: '20px',
			enabled: enabled
		}).component();
		this.disposables.push(button.onDidClick(async () => {
			await handler();
		}));
		return button;
	}

	protected createRadioButton(label: string, groupName: string, checked: boolean, handler: (checked: boolean) => Promise<void>, enabled: boolean = true): azdata.RadioButtonComponent {
		const radio = this.modelView.modelBuilder.radioButton().withProps({
			label: label,
			name: groupName,
			checked: checked,
			enabled: enabled
		}).component();
		this.disposables.push(radio.onDidChangeCheckedState(async checked => {
			await handler(checked);
			this.onFormFieldChange();
			await this.runValidation(false);
		}));
		return radio;
	}

	protected removeItem(container: azdata.DivContainer | azdata.FlexContainer, item: azdata.Component): void {
		if (container.items.indexOf(item) !== -1) {
			container.removeItem(item);
		}
	}

	protected addItem(container: azdata.DivContainer | azdata.FlexContainer, item: azdata.Component, itemLayout?: azdata.FlexItemLayout, index?: number): void {
		if (container.items.indexOf(item) === -1) {
			if (index === undefined) {
				container.addItem(item, itemLayout);
			} else {
				container.insertItem(item, index, itemLayout);
			}
		}
	}

	protected updateLoadingStatus(isLoading: boolean, loadingText: string = uiLoc.LoadingDialogText, loadingCompletedText: string = uiLoc.LoadingDialogCompletedText): void {
		if (this._loadingComponent) {
			this._loadingComponent.loadingText = loadingText;
			this._loadingComponent.loadingCompletedText = loadingCompletedText;
			this._loadingComponent.loading = isLoading;
		}
	}

	private createFormContainer(items: azdata.Component[]): azdata.DivContainer {
		return this.modelView.modelBuilder.divContainer().withLayout({ width: 'calc(100% - 20px)', height: 'calc(100% - 20px)' }).withProps({
			CSSStyles: { 'padding': '10px' }
		}).withItems(items, this.getSectionItemLayout()).component();
	}

	protected getSectionItemLayout(): azdata.FlexItemLayout {
		return { CSSStyles: { 'margin-block-end': '5px' } };
	}

	protected createHyperlink(label: string, url: string): azdata.HyperlinkComponent {
		return this.modelView.modelBuilder.hyperlink().withProps({ label: label, ariaLabel: label, url: url, showLinkIcon: true }).component();
	}
}
