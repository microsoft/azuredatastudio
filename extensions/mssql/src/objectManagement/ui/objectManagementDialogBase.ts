/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// TODO:
// 1. include server properties and other properties in the telemetry.

import * as azdata from 'azdata';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as vscode from 'vscode';
import { EOL } from 'os';
import { generateUuid } from 'vscode-languageclient/lib/utils/uuid';
import { getErrorMessage } from '../../utils';
import { NodeType, TelemetryActions, TelemetryViews } from '../constants';
import {
	CreateObjectOperationDisplayName, HelpText, LoadingDialogText,
	NameText,
	NewObjectDialogTitle, ObjectPropertiesDialogTitle, OkText, SelectedText, UpdateObjectOperationDisplayName
} from '../localizedConstants';
import { deepClone, getNodeTypeDisplayName, refreshNode } from '../utils';
import { TelemetryReporter } from '../../telemetry';

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

function getDialogName(type: NodeType, isNewObject: boolean): string {
	return isNewObject ? `New${type}` : `${type}Properties`
}

export abstract class ObjectManagementDialogBase<ObjectInfoType extends ObjectManagement.SqlObject, ViewInfoType extends ObjectManagement.ObjectViewInfo<ObjectInfoType>> {
	protected readonly disposables: vscode.Disposable[] = [];
	protected readonly dialogObject: azdata.window.Dialog;
	protected readonly contextId: string;
	private _viewInfo: ViewInfoType;
	private _originalObjectInfo: ObjectInfoType;
	private _modelView: azdata.ModelView;
	private _loadingComponent: azdata.LoadingComponent;
	private _formContainer: azdata.DivContainer;
	private _helpButton: azdata.window.Button;

	constructor(private readonly objectType: NodeType,
		docUrl: string,
		protected readonly objectManagementService: IObjectManagementService,
		protected readonly connectionUri: string,
		protected isNewObject: boolean,
		protected readonly objectName: string | undefined = undefined,
		protected readonly objectExplorerContext?: azdata.ObjectExplorerContext,
		dialogWidth: azdata.window.DialogWidth = 'narrow') {
		const objectTypeDisplayName = getNodeTypeDisplayName(objectType, true);
		const dialogTitle = isNewObject ? NewObjectDialogTitle(objectTypeDisplayName) : ObjectPropertiesDialogTitle(objectTypeDisplayName, objectName);
		this.dialogObject = azdata.window.createModelViewDialog(dialogTitle, getDialogName(objectType, isNewObject), dialogWidth);
		this.dialogObject.okButton.label = OkText;
		this.disposables.push(this.dialogObject.onClosed(async (reason: azdata.window.CloseReason) => { await this.dispose(reason); }));
		this._helpButton = azdata.window.createButton(HelpText, 'left');
		this.disposables.push(this._helpButton.onClick(async () => {
			await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(docUrl));
		}));
		this.dialogObject.customButtons = [this._helpButton];
		this.dialogObject.okButton.hidden = true;
		this._helpButton.hidden = true;
		this.contextId = generateUuid();
		this.dialogObject.registerCloseValidator(async (): Promise<boolean> => {
			const confirmed = await this.onConfirmation();
			if (!confirmed) {
				return false;
			}
			return await this.runValidation();
		});
	}

	protected abstract initializeData(): Promise<ViewInfoType>;
	protected abstract initializeUI(): Promise<void>;
	protected abstract onComplete(): Promise<void>;
	protected async onDispose(): Promise<void> { }
	protected abstract validateInput(): Promise<string[]>;

	/**
	 * Dispose the information related to this view in the backend service.
	 */
	protected abstract disposeView(): Promise<void>;

	protected onObjectValueChange(): void {
		this.dialogObject.okButton.enabled = JSON.stringify(this.objectInfo) !== JSON.stringify(this._originalObjectInfo);
	}

	protected async onConfirmation(): Promise<boolean> {
		return true;
	}

	protected get viewInfo(): ViewInfoType {
		return this._viewInfo;
	}

	protected get objectInfo(): ObjectInfoType {
		return this._viewInfo?.objectInfo;
	}

	protected get originalObjectInfo(): ObjectInfoType {
		return this._originalObjectInfo;
	}

	protected get formContainer(): azdata.DivContainer {
		return this._formContainer;
	}

	protected get modelView(): azdata.ModelView {
		return this._modelView;
	}

	public async open(): Promise<void> {
		try {
			const initializeViewPromise = new Promise<void>((async resolve => {
				await this.dialogObject.registerContent(async view => {
					this._modelView = view;
					resolve();
					this._formContainer = this.createFormContainer([]);
					this._loadingComponent = view.modelBuilder.loadingComponent().withItem(this._formContainer).withProps({
						loading: true,
						loadingText: LoadingDialogText,
						showText: true,
						CSSStyles: {
							width: "100%",
							height: "100%"
						}
					}).component();
					await view.initializeModel(this._loadingComponent);
				});
			}));
			azdata.window.openDialog(this.dialogObject);
			this._viewInfo = await this.initializeData();
			await initializeViewPromise;
			await this.initializeUI();
			this._originalObjectInfo = deepClone(this.objectInfo);
			const typeDisplayName = getNodeTypeDisplayName(this.objectType);
			this.dialogObject.registerOperation({
				displayName: this.isNewObject ? CreateObjectOperationDisplayName(typeDisplayName)
					: UpdateObjectOperationDisplayName(typeDisplayName, this.objectName),
				description: '',
				isCancelable: false,
				operation: async (operation: azdata.BackgroundOperation): Promise<void> => {
					const actionName = this.isNewObject ? TelemetryActions.CreateObject : TelemetryActions.UpdateObject;
					try {
						if (JSON.stringify(this.objectInfo) !== JSON.stringify(this._originalObjectInfo)) {
							const startTime = Date.now();
							await this.onComplete();
							if (this.isNewObject && this.objectExplorerContext) {
								await refreshNode(this.objectExplorerContext);
							}

							TelemetryReporter.sendTelemetryEvent(actionName, {
								objectType: this.objectType
							}, {
								elapsedTimeMs: Date.now() - startTime
							});
							operation.updateStatus(azdata.TaskStatus.Succeeded);
						}
					}
					catch (err) {
						operation.updateStatus(azdata.TaskStatus.Failed, getErrorMessage(err));
						TelemetryReporter.createErrorEvent2(TelemetryViews.ObjectManagement, actionName, err).withAdditionalProperties({
							objectType: this.objectType
						}).send();
					} finally {
						await this.disposeView();
					}
				}
			});
			this.dialogObject.okButton.hidden = false;
			this._helpButton.hidden = false;
			this._loadingComponent.loading = false;
		} catch (err) {
			const actionName = this.isNewObject ? TelemetryActions.OpenNewObjectDialog : TelemetryActions.OpenPropertiesDialog;
			TelemetryReporter.createErrorEvent2(TelemetryViews.ObjectManagement, actionName, err).withAdditionalProperties({
				objectType: this.objectType
			}).send();
			void vscode.window.showErrorMessage(getErrorMessage(err));
		}
	}

	private async dispose(reason: azdata.window.CloseReason): Promise<void> {
		await this.onDispose();
		this.disposables.forEach(disposable => disposable.dispose());
		if (reason !== 'ok') {
			await this.disposeView();
		}
	}

	protected async runValidation(showErrorMessage: boolean = true): Promise<boolean> {
		const errors = await this.validateInput();
		if (errors.length > 0 && (this.dialogObject.message || showErrorMessage)) {
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
		const row = this.modelView.modelBuilder.flexContainer().withLayout({ flexFlow: 'horizontal', flexWrap: 'nowrap', alignItems: 'center' }).withItems([labelComponent, input]).component();
		return row;
	}

	protected createCheckbox(label: string, checked: boolean = false, enabled: boolean = true): azdata.CheckBoxComponent {
		return this.modelView.modelBuilder.checkBox().withProps({
			label: label,
			checked: checked,
			enabled: enabled
		}).component();
	}

	protected createPasswordInputBox(ariaLabel: string, value: string = '', enabled: boolean = true, width: number = DefaultInputWidth): azdata.InputBoxComponent {
		return this.createInputBox(ariaLabel, value, enabled, 'password', width);
	}

	protected createInputBox(ariaLabel: string, value: string = '', enabled: boolean = true, type: azdata.InputBoxInputType = 'text', width: number = DefaultInputWidth): azdata.InputBoxComponent {
		return this.modelView.modelBuilder.inputBox().withProps({ inputType: type, enabled: enabled, ariaLabel: ariaLabel, value: value, width: width }).component();
	}

	protected createGroup(header: string, items: azdata.Component[], collapsible: boolean = true, collapsed: boolean = false): azdata.GroupContainer {
		return this.modelView.modelBuilder.groupContainer().withLayout({
			header: header,
			collapsed: false,
			collapsible: collapsible
		}).withProps({ collapsed: collapsed }).withItems(items).component();
	}

	protected createFormContainer(items: azdata.Component[]): azdata.DivContainer {
		return this.modelView.modelBuilder.divContainer().withLayout({ width: 'calc(100% - 20px)', height: 'calc(100% - 20px)' }).withProps({
			CSSStyles: { 'padding': '10px' }
		}).withItems(items, { CSSStyles: { 'margin-block-end': '10px' } }).component();
	}

	protected createTableList(ariaLabel: string, listValues: string[], selectedValues: string[], data?: any[][]): azdata.TableComponent {
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
		this.disposables.push(table.onCellAction((arg: azdata.ICheckboxCellActionEventArgs) => {
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

	protected createDropdown(ariaLabel: string, values: string[], value: string, enabled: boolean = true, width: number = DefaultInputWidth): azdata.DropDownComponent {
		// Automatically add an empty item to the beginning of the list if the current value is not specified.
		// This is needed when no meaningful default value can be provided.
		if (!value) {
			values.unshift('');
		}
		return this.modelView.modelBuilder.dropDown().withProps({
			ariaLabel: ariaLabel,
			values: values,
			value: value,
			width: DefaultInputWidth,
			enabled: enabled
		}).component();
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
