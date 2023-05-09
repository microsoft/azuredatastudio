/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { EOL } from 'os';
import * as uiLoc from '../ui/localizedConstants';

export const DefaultLabelWidth = 150;
export const DefaultInputWidth = 300;
export const DefaultTableWidth = DefaultInputWidth + DefaultLabelWidth;
export const DefaultMaxTableHeight = 400;
export const DefaultMinTableRowCount = 1;
export const TableRowHeight = 25;
export const TableColumnHeaderHeight = 30;

export function getTableHeight(rowCount: number, minRowCount: number = DefaultMinTableRowCount, maxHeight: number = DefaultMaxTableHeight): number {
	return Math.min(Math.max(rowCount, minRowCount) * TableRowHeight + TableColumnHeaderHeight, maxHeight);
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

	protected validateInput(): Promise<string[]> { return Promise.resolve([]); }

	public async open(): Promise<void> {
		try {
			this.onLoadingStatusChanged(true);
			const initializeDialogPromise = new Promise<void>((async resolve => {
				await this.dialogObject.registerContent(async view => {
					this._modelView = view;
					this._formContainer = this.createFormContainer([]);
					this._loadingComponent = view.modelBuilder.loadingComponent().withItem(this._formContainer).withProps({
						loading: true,
						loadingText: uiLoc.LoadingDialogText,
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
			this.onLoadingStatusChanged(false);
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

	protected createLabelInputContainer(label: string, input: azdata.InputBoxComponent | azdata.DropDownComponent): azdata.FlexContainer {
		const labelComponent = this.modelView.modelBuilder.text().withProps({ width: DefaultLabelWidth, value: label, requiredIndicator: input.required }).component();
		const container = this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'horizontal', flexWrap: 'nowrap', alignItems: 'center' }).withItems([labelComponent], { flex: '0 0 auto' }).component();
		container.addItem(input, { flex: '1 1 auto' });
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
		return this.createInputBox(ariaLabel, textChangeHandler, value, enabled, 'password', width);
	}

	protected createInputBox(ariaLabel: string, textChangeHandler: (newValue: string) => Promise<void>, value: string = '', enabled: boolean = true, type: azdata.InputBoxInputType = 'text', width: number = DefaultInputWidth): azdata.InputBoxComponent {
		const inputbox = this.modelView.modelBuilder.inputBox().withProps({ inputType: type, enabled: enabled, ariaLabel: ariaLabel, value: value, width: width }).component();
		this.disposables.push(inputbox.onTextChanged(async () => {
			await textChangeHandler(inputbox.value!);
			this.onFormFieldChange();
			await this.runValidation(false);
		}));
		return inputbox;
	}

	protected createGroup(header: string, items: azdata.Component[], collapsible: boolean = true, collapsed: boolean = false): azdata.GroupContainer {
		return this.modelView.modelBuilder.groupContainer().withLayout({
			header: header,
			collapsible: collapsible,
			collapsed: collapsed
		}).withItems(items).component();
	}

	protected createTableList<T>(ariaLabel: string,
		columnNames: string[],
		allItems: T[],
		selectedItems: T[],
		maxHeight: number = DefaultMaxTableHeight,
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
				height: getTableHeight(data.length, DefaultMinTableRowCount, maxHeight)
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

	protected setTableData(table: azdata.TableComponent, data: any[][], maxHeight: number = DefaultMaxTableHeight) {
		table.data = data;
		table.height = getTableHeight(data.length, DefaultMinTableRowCount, maxHeight);
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

	protected createTable(ariaLabel: string, columns: azdata.TableColumn[], data: any[][], maxHeight: number = DefaultMaxTableHeight): azdata.TableComponent {
		const table = this.modelView.modelBuilder.table().withProps(
			{
				ariaLabel: ariaLabel,
				data: data,
				columns: columns,
				width: DefaultTableWidth,
				height: getTableHeight(data.length, DefaultMinTableRowCount, maxHeight)
			}
		).component();
		return table;
	}

	protected addButtonsForTable(table: azdata.TableComponent, addButtonAriaLabel: string, removeButtonAriaLabel: string, addHandler: () => Promise<void>, removeHandler: () => void): azdata.FlexContainer {
		let addButton: azdata.ButtonComponent;
		let removeButton: azdata.ButtonComponent;
		const updateButtons = () => {
			removeButton.enabled = table.selectedRows.length > 0;
		}
		addButton = this.createButton(uiLoc.AddText, addButtonAriaLabel, async () => {
			await addHandler();
			updateButtons();
		});
		removeButton = this.createButton(uiLoc.RemoveText, removeButtonAriaLabel, async () => {
			await removeHandler();
			updateButtons();
		}, false);
		this.disposables.push(table.onRowSelected(() => {
			updateButtons();
		}));
		return this.createButtonContainer([addButton, removeButton]);
	}

	protected createDropdown(ariaLabel: string, handler: (newValue: string) => Promise<void>, values: string[], value: string | undefined, enabled: boolean = true, width: number = DefaultInputWidth): azdata.DropDownComponent {
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
			enabled: enabled
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

	protected removeItem(container: azdata.DivContainer | azdata.FlexContainer, item: azdata.Component): void {
		if (container.items.indexOf(item) !== -1) {
			container.removeItem(item);
		}
	}

	protected addItem(container: azdata.DivContainer | azdata.FlexContainer, item: azdata.Component, index?: number): void {
		if (container.items.indexOf(item) === -1) {
			if (index === undefined) {
				container.addItem(item);
			} else {
				container.insertItem(item, index);
			}
		}
	}

	protected onLoadingStatusChanged(isLoading: boolean): void {
		if (this._loadingComponent) {
			this._loadingComponent.loading = isLoading;
		}
	}

	private createFormContainer(items: azdata.Component[]): azdata.DivContainer {
		return this.modelView.modelBuilder.divContainer().withLayout({ width: 'calc(100% - 20px)', height: 'calc(100% - 20px)' }).withProps({
			CSSStyles: { 'padding': '10px' }
		}).withItems(items, { CSSStyles: { 'margin-block-end': '10px' } }).component();
	}
}
