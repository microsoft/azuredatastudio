/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IObjectManagementService } from 'mssql';
import * as vscode from 'vscode';
import { generateUuid } from 'vscode-languageclient/lib/utils/uuid';
import { getErrorMessage } from '../../utils';
import { NodeType } from '../constants';
import {
	CreateObjectOperationDisplayName, HelpText, LoadingDialogText,
	NameText,
	NewObjectDialogTitle, ObjectPropertiesDialogTitle, OkText, SelectedText, UpdateObjectOperationDisplayName, ValidationErrorSummary
} from '../localizedConstants';
import { getNodeTypeDisplayName } from '../utils';

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

export abstract class ObjectManagementDialogBase {
	protected readonly disposables: vscode.Disposable[] = [];
	protected readonly dialogObject: azdata.window.Dialog;
	protected readonly contextId: string;

	constructor(private readonly objectType: NodeType,
		docUrl: string,
		protected readonly objectManagementService: IObjectManagementService,
		protected readonly connectionUri: string,
		protected isNewObject: boolean,
		protected readonly objectName: string | undefined = undefined,
		dialogWidth: azdata.window.DialogWidth = 'narrow') {
		const objectTypeDisplayName = getNodeTypeDisplayName(objectType, true);
		const dialogTitle = isNewObject ? NewObjectDialogTitle(objectTypeDisplayName) : ObjectPropertiesDialogTitle(objectTypeDisplayName, objectName);
		this.dialogObject = azdata.window.createModelViewDialog(dialogTitle, objectType, dialogWidth);
		this.dialogObject.okButton.label = OkText;
		this.disposables.push(this.dialogObject.onClosed(async () => { await this.dispose(); }));
		const helpButton = azdata.window.createButton(HelpText, 'left');
		this.disposables.push(helpButton.onClick(async () => {
			await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(docUrl));
		}));
		this.dialogObject.customButtons = [helpButton];
		this.contextId = generateUuid();
		this.dialogObject.registerCloseValidator(async (): Promise<boolean> => {
			const confirmed = await this.onConfirmation();
			if (!confirmed) {
				return false;
			}
			return await this.runValidation();
		});
	}

	protected abstract initialize(): Promise<void>;
	protected abstract onComplete(): Promise<void>;
	protected abstract onDispose(): Promise<void>;
	protected abstract validateInput(): Promise<string[]>;

	protected async onConfirmation(): Promise<boolean> {
		return true;
	}

	public async open(): Promise<void> {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: LoadingDialogText
		}, async () => {
			await this.initialize();
		});
		const typeDisplayName = getNodeTypeDisplayName(this.objectType);
		this.dialogObject.registerOperation({
			displayName: this.isNewObject ? CreateObjectOperationDisplayName(typeDisplayName)
				: UpdateObjectOperationDisplayName(typeDisplayName, this.objectName),
			description: '',
			isCancelable: false,
			operation: async (operation: azdata.BackgroundOperation): Promise<void> => {
				try {
					await this.onComplete();
					operation.updateStatus(azdata.TaskStatus.Succeeded);
				}
				catch (err) {
					operation.updateStatus(azdata.TaskStatus.Failed, getErrorMessage(err));
				}
			}
		});
		azdata.window.openDialog(this.dialogObject);
	}

	private async dispose(): Promise<void> {
		await this.onDispose();
		this.disposables.forEach(disposable => disposable.dispose());
	}

	private async runValidation(): Promise<boolean> {
		const errors = await this.validateInput();
		if (errors.length > 0) {
			await vscode.window.showErrorMessage(ValidationErrorSummary, { modal: true, detail: errors.join('\n') });
		}
		return errors.length === 0;
	}

	protected createLabelInputContainer(view: azdata.ModelView, label: string, input: azdata.InputBoxComponent | azdata.DropDownComponent): azdata.FlexContainer {
		const labelComponent = view.modelBuilder.text().withProps({ width: DefaultLabelWidth, value: label, requiredIndicator: input.required }).component();
		const row = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'horizontal', flexWrap: 'nowrap', alignItems: 'center' }).withItems([labelComponent, input]).component();
		return row;
	}

	protected createCheckbox(view: azdata.ModelView, label: string, checked: boolean = false, enabled: boolean = true): azdata.CheckBoxComponent {
		return view.modelBuilder.checkBox().withProps({
			label: label,
			checked: checked,
			enabled: enabled
		}).component();
	}

	protected createPasswordInputBox(view: azdata.ModelView, ariaLabel: string, value: string = '', enabled: boolean = true, width: number = DefaultInputWidth): azdata.InputBoxComponent {
		return this.createInputBox(view, ariaLabel, value, enabled, 'password', width);
	}

	protected createInputBox(view: azdata.ModelView, ariaLabel: string, value: string = '', enabled: boolean = true, type: azdata.InputBoxInputType = 'text', width: number = DefaultInputWidth): azdata.InputBoxComponent {
		return view.modelBuilder.inputBox().withProps({ inputType: type, enabled: enabled, ariaLabel: ariaLabel, value: value, width: width }).component();
	}

	protected createGroup(view: azdata.ModelView, header: string, items: azdata.Component[], collapsible: boolean = true, collapsed: boolean = false): azdata.GroupContainer {
		return view.modelBuilder.groupContainer().withLayout({
			header: header,
			collapsed: false,
			collapsible: collapsible
		}).withProps({ collapsed: collapsed }).withItems(items).component();
	}

	protected createFormContainer(view: azdata.ModelView, items: azdata.Component[]): azdata.DivContainer {
		return view.modelBuilder.divContainer().withLayout({ width: 'calc(100% - 20px)', height: 'calc(100% - 20px)' }).withProps({
			CSSStyles: { 'padding': '10px' }
		}).withItems(items, { CSSStyles: { 'margin-block-end': '10px' } }).component();
	}

	protected createTableList(view: azdata.ModelView, ariaLabel: string, listValues: string[], selectedValues: string[], data?: any[][]): azdata.TableComponent {
		let tableData = data;
		if (tableData === undefined) {
			tableData = listValues.map(name => {
				const isSelected = selectedValues.indexOf(name) !== -1;
				return [isSelected, name];
			});
		}
		const table = view.modelBuilder.table().withProps(
			{
				ariaLabel: ariaLabel,
				data: tableData,
				columns: [
					{
						value: SelectedText,
						type: azdata.ColumnType.checkBox,
						options: { actionOnCheckbox: azdata.ActionOnCellCheckboxCheck.customAction }
					}, {
						value: NameText,
					}
				],
				width: DefaultTableWidth,
				height: getTableHeight(tableData.length)
			}
		).component();
		table.onCellAction((arg: azdata.ICheckboxCellActionEventArgs) => {
			const name = listValues[arg.row];
			const idx = selectedValues.indexOf(name);
			if (arg.checked && idx === -1) {
				selectedValues.push(name);
			} else if (!arg.checked && idx !== -1) {
				selectedValues.splice(idx, 1)
			}
		});
		return table;
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
}
