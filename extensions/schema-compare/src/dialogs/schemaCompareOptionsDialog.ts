/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import * as loc from '../localizedConstants';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { isNullOrUndefined } from 'util';
import { SchemaCompareOptionsModel } from '../models/schemaCompareOptionsModel';

export class SchemaCompareOptionsDialog {
	public dialog: azdata.window.Dialog;
	public deploymentOptions: mssql.DeploymentOptions;

	private generalOptionsTab: azdata.window.DialogTab;
	private objectTypesTab: azdata.window.DialogTab;
	private optionsFlexBuilder: azdata.FlexContainer;
	private objectTypesFlexBuilder: azdata.FlexContainer;

	private descriptionHeading: azdata.TableComponent;
	private descriptionText: azdata.TextComponent;
	private optionsTable: azdata.TableComponent;
	private objectsTable: azdata.TableComponent;
	private disposableListeners: vscode.Disposable[] = [];

	private optionsChanged: boolean = false;

	private optionsModel: SchemaCompareOptionsModel;

	constructor(defaultOptions: mssql.DeploymentOptions, private schemaComparison: SchemaCompareMainWindow) {
		this.deploymentOptions = defaultOptions;
		this.optionsModel = new SchemaCompareOptionsModel(defaultOptions);
	}

	protected initializeDialog(): void {
		this.generalOptionsTab = azdata.window.createTab(loc.GeneralOptionsLabel);
		this.objectTypesTab = azdata.window.createTab(loc.ObjectTypesOptionsLabel);
		this.initializeSchemaCompareOptionsDialogTab();
		this.initializeSchemaCompareObjectTypesDialogTab();
		this.dialog.content = [this.generalOptionsTab, this.objectTypesTab];
	}

	public openDialog(): void {
		let event = null;
		this.dialog = azdata.window.createModelViewDialog(loc.OptionsLabel, event);

		this.initializeDialog();

		this.dialog.okButton.label = loc.OkButtonText;
		this.dialog.okButton.onClick(async () => await this.execute());

		this.dialog.cancelButton.label = loc.CancelButtonText;
		this.dialog.cancelButton.onClick(async () => await this.cancel());

		let resetButton = azdata.window.createButton(loc.ResetButtonText);
		resetButton.onClick(async () => await this.reset());
		this.dialog.customButtons = [];
		this.dialog.customButtons.push(resetButton);

		azdata.window.openDialog(this.dialog);
	}

	protected execute(): void {
		this.optionsModel.setDeploymentOptions();
		this.optionsModel.setObjectTypeOptions();
		this.schemaComparison.setDeploymentOptions(this.deploymentOptions);

		if (this.optionsChanged) {
			vscode.window.showWarningMessage(loc.OptionsChangedMessage, loc.YesButtonText, loc.NoButtonText).then((result) => {
				if (result === loc.YesButtonText) {
					this.schemaComparison.startCompare();
				}
			});
		}
		this.disposeListeners();
	}

	protected cancel(): void {
		this.disposeListeners();
	}

	private async reset(): Promise<void> {
		let service = (vscode.extensions.getExtension(mssql.extension.name).exports as mssql.IExtension).schemaCompare;
		let result = await service.schemaCompareGetDefaultOptions();
		this.deploymentOptions = result.defaultDeploymentOptions;
		this.optionsChanged = true;

		await this.updateOptionsTable();
		this.optionsFlexBuilder.removeItem(this.optionsTable);
		this.optionsFlexBuilder.insertItem(this.optionsTable, 0, { CSSStyles: { 'overflow': 'scroll', 'height': '65vh' } });

		await this.updateObjectsTable();
		this.objectTypesFlexBuilder.removeItem(this.objectsTable);
		this.objectTypesFlexBuilder.addItem(this.objectsTable, { CSSStyles: { 'overflow': 'scroll', 'height': '80vh' } });
	}

	private initializeSchemaCompareOptionsDialogTab(): void {
		this.generalOptionsTab.registerContent(async view => {

			this.descriptionHeading = view.modelBuilder.table().withProperties({
				columns: [
					{
						value: 'Option Description',
						headerCssClass: 'no-borders',
						toolTip: 'Option Description'
					}
				]
			}).component();

			this.descriptionText = view.modelBuilder.text().withProperties({
				value: ' '
			}).component();


			this.optionsTable = view.modelBuilder.table().component();
			await this.updateOptionsTable();

			this.disposableListeners.push(this.optionsTable.onRowSelected(async () => {
				let row = this.optionsTable.selectedRows[0];
				let label = this.optionsModel.optionsLabels[row];
				await this.descriptionText.updateProperties({
					value: this.optionsModel.getDescription(label)
				});
			}));

			this.disposableListeners.push(this.optionsTable.onCellAction((rowState) => {
				let checkboxState = <azdata.ICheckboxCellActionEventArgs>rowState;
				if (checkboxState && checkboxState.row !== undefined) {
					let label = this.optionsModel.optionsLabels[checkboxState.row];
					this.optionsModel.optionsLookup[label] = checkboxState.checked;
					this.optionsChanged = true;
				}
			}));

			this.optionsFlexBuilder = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column'
				}).component();

			this.optionsFlexBuilder.addItem(this.optionsTable, { CSSStyles: { 'overflow': 'scroll', 'height': '65vh' } });
			this.optionsFlexBuilder.addItem(this.descriptionHeading, { CSSStyles: { 'font-weight': 'bold', 'height': '30px' } });
			this.optionsFlexBuilder.addItem(this.descriptionText, { CSSStyles: { 'padding': '4px', 'margin-right': '10px', 'overflow': 'scroll', 'height': '10vh' } });
			await view.initializeModel(this.optionsFlexBuilder);
			await this.optionsTable.focus();
		});
	}

	private initializeSchemaCompareObjectTypesDialogTab(): void {
		this.objectTypesTab.registerContent(async view => {

			this.objectTypesFlexBuilder = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column'
				}).component();

			this.objectsTable = view.modelBuilder.table().component();
			await this.updateObjectsTable();

			this.disposableListeners.push(this.objectsTable.onCellAction((rowState) => {
				let checkboxState = <azdata.ICheckboxCellActionEventArgs>rowState;
				if (checkboxState && checkboxState.row !== undefined) {
					let label = this.optionsModel.objectTypeLabels[checkboxState.row];
					this.optionsModel.objectsLookup[label] = checkboxState.checked;
					this.optionsChanged = true;
				}
			}));

			this.objectTypesFlexBuilder.addItem(this.objectsTable, { CSSStyles: { 'overflow': 'scroll', 'height': '80vh' } });

			await view.initializeModel(this.objectTypesFlexBuilder);
		});
	}

	private disposeListeners(): void {
		if (this.disposableListeners) {
			this.disposableListeners.forEach(x => x.dispose());
		}
	}

	private async updateOptionsTable(): Promise<void> {
		let data = this.optionsModel.getOptionsData();
		await this.optionsTable.updateProperties({
			data: data,
			columns: [
				{
					value: 'Include',
					type: azdata.ColumnType.checkBox,
					options: { actionOnCheckbox: azdata.ActionOnCellCheckboxCheck.customAction },
					headerCssClass: 'display-none',
					cssClass: 'no-borders align-with-header',
					width: 50
				},
				{
					value: 'Option Name',
					headerCssClass: 'display-none',
					cssClass: 'no-borders align-with-header',
					width: 50
				}
			],
			ariaRowCount: data.length
		});
	}

	private async updateObjectsTable(): Promise<void> {
		let data = this.optionsModel.getObjectsData();
		await this.objectsTable.updateProperties({
			data: data,
			columns: [
				{
					value: 'Include',
					type: azdata.ColumnType.checkBox,
					options: { actionOnCheckbox: azdata.ActionOnCellCheckboxCheck.customAction },
					headerCssClass: 'display-none',
					cssClass: 'no-borders align-with-header',
					width: 50
				},
				{
					value: 'Option Name',
					headerCssClass: 'display-none',
					cssClass: 'no-borders align-with-header',
					width: 50
				}
			],
			ariaRowCount: data.length
		});
	}
}
