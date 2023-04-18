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
	NewObjectDialogTitle, NoScriptGeneratedErrorMessage, ObjectPropertiesDialogTitle, OkText, ScriptError, ScriptGeneratedText, ScriptText, SelectedText, UpdateObjectOperationDisplayName
} from '../localizedConstants';
import { deepClone, getNodeTypeDisplayName, refreshNode } from '../utils';
import { TelemetryReporter } from '../../telemetry';
import { providerId } from '../../constants';

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

export interface ObjectManagementDialogOptions {
	connectionUri: string;
	database?: string;
	objectType: NodeType;
	isNewObject: boolean;
	parentUrn: string;
	objectUrn?: string;
	objectExplorerContext?: azdata.ObjectExplorerContext;
	width?: azdata.window.DialogWidth;
	objectName?: string;
}

export abstract class ObjectManagementDialogBase<ObjectInfoType extends ObjectManagement.SqlObject, ViewInfoType extends ObjectManagement.ObjectViewInfo<ObjectInfoType>> {
	protected readonly disposables: vscode.Disposable[] = [];
	protected readonly dialogObject: azdata.window.Dialog;
	private _contextId: string;
	private _viewInfo: ViewInfoType;
	private _originalObjectInfo: ObjectInfoType;
	private _modelView: azdata.ModelView;
	private _loadingComponent: azdata.LoadingComponent;
	private _formContainer: azdata.DivContainer;
	private _helpButton: azdata.window.Button;
	private _scriptButton: azdata.window.Button;

	constructor(protected readonly objectManagementService: IObjectManagementService, protected readonly options: ObjectManagementDialogOptions) {
		this.options.width = this.options.width || 'narrow';
		const objectTypeDisplayName = getNodeTypeDisplayName(options.objectType, true);
		const dialogTitle = options.isNewObject ? NewObjectDialogTitle(objectTypeDisplayName) : ObjectPropertiesDialogTitle(objectTypeDisplayName, options.objectName);
		this.dialogObject = azdata.window.createModelViewDialog(dialogTitle, getDialogName(options.objectType, options.isNewObject), options.width);
		this.dialogObject.okButton.label = OkText;
		this.disposables.push(this.dialogObject.onClosed(async (reason: azdata.window.CloseReason) => { await this.dispose(reason); }));
		this._helpButton = azdata.window.createButton(HelpText, 'left');
		this.disposables.push(this._helpButton.onClick(async () => {
			await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(this.docUrl));
		}));
		this._scriptButton = azdata.window.createButton(ScriptText, 'left');
		this.disposables.push(this._scriptButton.onClick(async () => { await this.onScriptButtonClick(); }));
		this.dialogObject.customButtons = [this._helpButton, this._scriptButton];
		this.updateLoadingStatus(true);
		this._contextId = generateUuid();
		this.dialogObject.registerCloseValidator(async (): Promise<boolean> => {
			const confirmed = await this.onConfirmation();
			if (!confirmed) {
				return false;
			}
			return await this.runValidation();
		});
	}

	protected abstract initializeUI(): Promise<void>;
	protected abstract validateInput(): Promise<string[]>;
	protected abstract get docUrl(): string;

	protected postInitializeData(): void {

	}
	protected onObjectValueChange(): void {
		this.dialogObject.okButton.enabled = this.isDirty;
	}

	protected async onConfirmation(): Promise<boolean> {
		return true;
	}

	protected get viewInfo(): ViewInfoType {
		return this._viewInfo;
	}

	protected get objectInfo(): ObjectInfoType {
		return this._viewInfo.objectInfo;
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
			await this.initializeData();
			await initializeViewPromise;
			await this.initializeUI();
			this._originalObjectInfo = deepClone(this.objectInfo);
			const typeDisplayName = getNodeTypeDisplayName(this.options.objectType);
			this.dialogObject.registerOperation({
				displayName: this.options.isNewObject ? CreateObjectOperationDisplayName(typeDisplayName)
					: UpdateObjectOperationDisplayName(typeDisplayName, this.options.objectName),
				description: '',
				isCancelable: false,
				operation: async (operation: azdata.BackgroundOperation): Promise<void> => {
					const actionName = this.options.isNewObject ? TelemetryActions.CreateObject : TelemetryActions.UpdateObject;
					try {
						if (JSON.stringify(this.objectInfo) !== JSON.stringify(this._originalObjectInfo)) {
							const startTime = Date.now();
							await this.objectManagementService.save(this._contextId, this.objectInfo);
							if (this.options.isNewObject && this.options.objectExplorerContext) {
								await refreshNode(this.options.objectExplorerContext);
							}

							TelemetryReporter.sendTelemetryEvent(actionName, {
								objectType: this.options.objectType
							}, {
								elapsedTimeMs: Date.now() - startTime
							});
							operation.updateStatus(azdata.TaskStatus.Succeeded);
						}
					}
					catch (err) {
						operation.updateStatus(azdata.TaskStatus.Failed, getErrorMessage(err));
						TelemetryReporter.createErrorEvent2(TelemetryViews.ObjectManagement, actionName, err).withAdditionalProperties({
							objectType: this.options.objectType
						}).send();
					} finally {
						await this.disposeView();
					}
				}
			});
			this.updateLoadingStatus(false);
		} catch (err) {
			const actionName = this.options.isNewObject ? TelemetryActions.OpenNewObjectDialog : TelemetryActions.OpenPropertiesDialog;
			TelemetryReporter.createErrorEvent2(TelemetryViews.ObjectManagement, actionName, err).withAdditionalProperties({
				objectType: this.options.objectType
			}).send();
			void vscode.window.showErrorMessage(getErrorMessage(err));
			azdata.window.closeDialog(this.dialogObject);
		}
	}

	private async dispose(reason: azdata.window.CloseReason): Promise<void> {
		this.disposables.forEach(disposable => disposable.dispose());
		if (reason !== 'ok') {
			await this.disposeView();
		}
	}

	private async disposeView(): Promise<void> {
		await this.objectManagementService.disposeView(this._contextId);
	}

	private async initializeData(): Promise<void> {
		const viewInfo = await this.objectManagementService.initializeView(this._contextId, this.options.objectType, this.options.connectionUri, this.options.database, this.options.isNewObject, this.options.parentUrn, this.options.objectUrn);
		this._viewInfo = viewInfo as ViewInfoType;
		this.postInitializeData();
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
			collapsible: collapsible,
			collapsed: collapsed
		}).withItems(items).component();
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

	protected createDropdown(ariaLabel: string, values: string[], value: string | undefined, enabled: boolean = true, width: number = DefaultInputWidth): azdata.DropDownComponent {
		// Automatically add an empty item to the beginning of the list if the current value is not specified.
		// This is needed when no meaningful default value can be provided.
		// Create a new array so that the original array isn't modified.
		const dropdownValues = [];
		dropdownValues.push(...values);
		if (!value) {
			dropdownValues.unshift('');
		}
		return this.modelView.modelBuilder.dropDown().withProps({
			ariaLabel: ariaLabel,
			values: dropdownValues,
			value: value,
			width: width,
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

	private updateLoadingStatus(isLoading: boolean): void {
		this._scriptButton.enabled = !isLoading;
		this._helpButton.enabled = !isLoading;
		this.dialogObject.okButton.enabled = isLoading ? false : this.isDirty;
		if (this._loadingComponent) {
			this._loadingComponent.loading = isLoading;
		}
	}

	private async onScriptButtonClick(): Promise<void> {
		this.updateLoadingStatus(true);
		try {
			const isValid = await this.runValidation();
			if (!isValid) {
				return;
			}
			const script = await this.objectManagementService.script(this._contextId, this.objectInfo);
			if (!script) {
				throw new Error(NoScriptGeneratedErrorMessage);
			}
			await azdata.queryeditor.openQueryDocument({ content: script }, providerId);
			this.dialogObject.message = {
				text: ScriptGeneratedText,
				level: azdata.window.MessageLevel.Information
			};
		} catch (err) {
			this.dialogObject.message = {
				text: ScriptError(getErrorMessage(err)),
				level: azdata.window.MessageLevel.Error
			};
		} finally {
			this.updateLoadingStatus(false);
		}
	}

	private get isDirty(): boolean {
		return JSON.stringify(this.objectInfo) !== JSON.stringify(this._originalObjectInfo);
	}
}
