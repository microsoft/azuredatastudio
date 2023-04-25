/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// TODO:
// 1. include server properties and other properties in the telemetry.

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { EOL } from 'os';
import * as localizedConstants from '../localizedConstants';

export const DefaultLabelWidth = 150;
export const DefaultInputWidth = 300;
export const DefaultTableWidth = DefaultInputWidth + DefaultLabelWidth;
export const DefaultTableMaxHeight = 400;
export const DefaultTableMinRowCount = 2;
export const TableRowHeight = 25;
export const TableColumnHeaderHeight = 30;

export function getTableHeight(rowCount: number, minRowCount: number = DefaultTableMinRowCount, maxHeight: number = DefaultTableMaxHeight): number {
	return Math.min(Math.max(rowCount, minRowCount) * TableRowHeight + TableColumnHeaderHeight, maxHeight);
}

export abstract class DialogBase {
	protected readonly disposables: vscode.Disposable[] = [];
	protected readonly dialogObject: azdata.window.Dialog;

	private _modelView: azdata.ModelView;
	private _loadingComponent: azdata.LoadingComponent;
	private _formContainer: azdata.DivContainer;

	constructor(title: string, name: string, width: azdata.window.DialogWidth) {
		this.dialogObject = azdata.window.createModelViewDialog(title, name, width);
		this.dialogObject.okButton.label = localizedConstants.OkText;
		this.disposables.push(this.dialogObject.onClosed(async (reason: azdata.window.CloseReason) => { await this.dispose(reason); }));
		this.dialogObject.registerCloseValidator(async (): Promise<boolean> => {
			const confirmed = await this.onConfirmation();
			if (!confirmed) {
				return false;
			}
			return await this.runValidation();
		});
		this.onLoadingStatusChanged(true);
	}

	protected async onConfirmation(): Promise<boolean> { return true; }

	protected abstract initialize(): Promise<void>;

	protected get formContainer(): azdata.DivContainer { return this._formContainer; }

	protected get modelView(): azdata.ModelView { return this._modelView; }

	protected onObjectValueChange(): void { }

	protected validateInput(): Promise<string[]> { return Promise.resolve([]); }

	public async open(): Promise<void> {
		try {
			const initializeDialogPromise = new Promise<void>((async resolve => {
				await this.dialogObject.registerContent(async view => {
					this._modelView = view;
					this._formContainer = this.createFormContainer([]);
					this._loadingComponent = view.modelBuilder.loadingComponent().withItem(this._formContainer).withProps({
						loading: true,
						loadingText: localizedConstants.LoadingDialogText,
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
		return this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'horizontal', flexWrap: 'nowrap', alignItems: 'center' }).withItems([labelComponent, input]).component()
	}

	protected createCheckbox(label: string, handler: (checked: boolean) => Promise<void>, checked: boolean = false, enabled: boolean = true): azdata.CheckBoxComponent {
		const checkbox = this.modelView.modelBuilder.checkBox().withProps({
			label: label,
			checked: checked,
			enabled: enabled
		}).component();
		this.disposables.push(checkbox.onChanged(async () => {
			await handler(checkbox.checked!);
			this.onObjectValueChange();
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
			this.onObjectValueChange();
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

	protected createFormContainer(items: azdata.Component[]): azdata.DivContainer {
		return this.modelView.modelBuilder.divContainer().withLayout({ width: 'calc(100% - 20px)', height: 'calc(100% - 20px)' }).withProps({
			CSSStyles: { 'padding': '10px' }
		}).withItems(items, { CSSStyles: { 'margin-block-end': '10px' } }).component();
	}

	protected createTableList(ariaLabel: string, valueColumnName: string, listValues: string[], selectedValues: string[], data?: any[][]): azdata.TableComponent {
		let tableData = data;
		if (tableData === undefined) {
			tableData = listValues.map(name => {
				const isSelected = selectedValues.indexOf(name) !== -1;
				return [isSelected, name];
			});
		}
		const table = this.modelView.modelBuilder.table().withProps(
			{
				ariaLabel: ariaLabel,
				data: tableData,
				columns: [
					{
						value: localizedConstants.SelectedText,
						type: azdata.ColumnType.checkBox,
						options: { actionOnCheckbox: azdata.ActionOnCellCheckboxCheck.customAction }
					}, {
						value: valueColumnName,
					}
				],
				width: DefaultTableWidth,
				height: getTableHeight(tableData.length)
			}
		).component();
		this.disposables.push(table.onCellAction!((arg: azdata.ICheckboxCellActionEventArgs) => {
			const name = listValues[arg.row];
			const idx = selectedValues.indexOf(name);
			if (arg.checked && idx === -1) {
				selectedValues.push(name);
			} else if (!arg.checked && idx !== -1) {
				selectedValues.splice(idx, 1)
			}
			this.onObjectValueChange();
		}));
		return table;
	}

	protected createTable(ariaLabel: string, columns: azdata.TableColumn[], data: any[][]): azdata.TableComponent {
		const table = this.modelView.modelBuilder.table().withProps(
			{
				ariaLabel: ariaLabel,
				data: data,
				columns: columns,
				width: DefaultTableWidth,
				height: getTableHeight(data.length)
			}
		).component();
		return table;
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
			this.onObjectValueChange();
			await this.runValidation(false);
		}));
		return dropdown;
	}

	protected createButton(label: string, handler: () => Promise<void>, enabled: boolean = true): azdata.ButtonComponent {
		const button = this.modelView.modelBuilder.button().withProps({
			label: label,
			enabled: enabled,
			secondary: true,
			CSSStyles: { 'min-width': '70px', 'margin-left': '5px' }
		}).component();
		this.disposables.push(button.onDidClick(async () => {
			await handler();
		}));
		return button;
	}

	protected createButtonContainer(items: azdata.ButtonComponent[]): azdata.FlexContainer {
		return this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'horizontal', flexWrap: 'nowrap', justifyContent: 'flex-end' }).withItems(items, { flex: '0 0 auto' }).component();
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
}
