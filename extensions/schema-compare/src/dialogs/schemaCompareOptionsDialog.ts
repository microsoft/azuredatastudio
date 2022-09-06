/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from 'mssql';
import * as loc from '../localizedConstants';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { SchemaCompareOptionsModel } from '../models/schemaCompareOptionsModel';
import { TelemetryReporter, TelemetryViews } from '../telemetry';

export class SchemaCompareOptionsDialog {
	public dialog: azdata.window.Dialog;

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
		this.dialog.okButton.onClick(() => this.execute());

		this.dialog.cancelButton.label = loc.CancelButtonText;
		this.dialog.cancelButton.onClick(() => this.cancel());

		let resetButton = azdata.window.createButton(loc.ResetButtonText);
		resetButton.onClick(async () => await this.reset());
		this.dialog.customButtons = [];
		this.dialog.customButtons.push(resetButton);

		azdata.window.openDialog(this.dialog);
	}

	protected execute(): void {
		// Update the model deploymentoptions with the updated table component values
		this.optionsModel.setDeploymentOptions();
		this.optionsModel.setIncludeObjectTypesToDeploymentOptions();
		// Set the publish deploymentoptions with the updated table component values
		this.schemaComparison.setDeploymentOptions(this.optionsModel.deploymentOptions);

		const yesItem: vscode.MessageItem = {
			title: loc.YesButtonText,
			isCloseAffordance: true
		};

		const noItem: vscode.MessageItem = {
			title: loc.NoButtonText,
			isCloseAffordance: true
		};

		if (this.optionsChanged) {
			vscode.window.showInformationMessage(loc.OptionsChangedMessage, { modal: true }, yesItem, noItem).then((result) => {
				if (result.title === loc.YesButtonText) {
					this.schemaComparison.startCompare();
				}
			});

			TelemetryReporter.sendActionEvent(TelemetryViews.SchemaCompareOptionsDialog, 'OptionsChanged');
		}

		this.disposeListeners();
	}

	protected cancel(): void {
		this.disposeListeners();
	}

	private async reset(): Promise<void> {
		let service = (vscode.extensions.getExtension(mssql.extension.name).exports as mssql.IExtension).schemaCompare;
		let result = await service.schemaCompareGetDefaultOptions();
		this.optionsModel.deploymentOptions = result.defaultDeploymentOptions;
		this.optionsChanged = true;

		// reset optionsvalueNameLookup with fresh deployment options
		this.optionsModel.setOptionsToValueNameLookup();
		this.optionsModel.setIncludeObjectTypesLookup();

		await this.updateOptionsTable();
		this.optionsFlexBuilder.removeItem(this.optionsTable);
		this.optionsFlexBuilder.insertItem(this.optionsTable, 0, { CSSStyles: { 'overflow': 'scroll', 'height': '65vh' } });

		await this.updateObjectsTable();
		this.objectTypesFlexBuilder.removeItem(this.objectsTable);
		this.objectTypesFlexBuilder.addItem(this.objectsTable, { CSSStyles: { 'overflow': 'scroll', 'height': '80vh' } });

		TelemetryReporter.sendActionEvent(TelemetryViews.SchemaCompareOptionsDialog, 'ResetOptions');
	}

	private initializeSchemaCompareOptionsDialogTab(): void {
		this.generalOptionsTab.registerContent(async view => {
			// create loading component
			const loader = view.modelBuilder.loadingComponent()
				.withProps({
					CSSStyles: {
						'margin-top': '50%'
					}
				})
				.component();

			this.optionsFlexBuilder = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column'
				}).component();

			// adding loading component to the flexcontainer
			this.optionsFlexBuilder.addItem(loader);
			await view.initializeModel(this.optionsFlexBuilder);

			this.descriptionHeading = view.modelBuilder.table().withProps({
				data: [],
				columns: [
					{
						value: 'Option Description',
						headerCssClass: 'no-borders',
						toolTip: 'Option Description'
					}
				]
			}).component();

			this.descriptionText = view.modelBuilder.text().withProps({
				value: ' '
			}).component();


			this.optionsTable = view.modelBuilder.table().component();
			await this.updateOptionsTable();

			// Get the description of the selected option
			this.disposableListeners.push(this.optionsTable.onRowSelected(async () => {
				// selectedRows[0] contains selected row number
				const row = this.optionsTable.selectedRows[0];
				// data[row][1] contains the option display name
				const displayName = this.optionsTable?.data[row!][1];
				await this.descriptionText.updateProperties({
					value: this.optionsModel.getOptionDescription(displayName)
				});
			}));

			// Update deploy options value on checkbox onchange
			this.disposableListeners.push(this.optionsTable.onCellAction((rowState) => {
				const checkboxState = <azdata.ICheckboxCellActionEventArgs>rowState;
				if (checkboxState && checkboxState.row !== undefined) {
					// data[row][1] contains the option display name
					const displayName = this.optionsTable?.data[checkboxState.row][1];
					this.optionsModel.setOptionValue(displayName, checkboxState.checked);
					this.optionsChanged = true;
				}
			}));

			this.optionsFlexBuilder.addItem(this.optionsTable, { CSSStyles: { 'overflow': 'scroll', 'height': '65vh' } });
			this.optionsFlexBuilder.addItem(this.descriptionHeading, { CSSStyles: { 'font-weight': 'bold', 'height': '30px' } });
			this.optionsFlexBuilder.addItem(this.descriptionText, { CSSStyles: { 'padding': '4px', 'margin-right': '10px', 'overflow': 'scroll', 'height': '10vh' } });
			loader.loading = false;
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

			// Update inlcude object type options value on checkbox onchange
			this.disposableListeners.push(this.objectsTable.onCellAction((rowState) => {
				let checkboxState = <azdata.ICheckboxCellActionEventArgs>rowState;
				if (checkboxState && checkboxState.row !== undefined) {
					// data[row][1] contains the include object type option display name
					const displayName = this.objectsTable?.data[checkboxState.row][1];
					this.optionsModel.setIncludeObjectTypesOptionValue(displayName, checkboxState.checked);
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
				<azdata.CheckboxColumn>
				{
					value: 'Include',
					type: azdata.ColumnType.checkBox,
					action: azdata.ActionOnCellCheckboxCheck.customAction,
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
		let data = this.optionsModel.getIncludeObjectTypesOptionsData();
		await this.objectsTable.updateProperties({
			data: data,
			columns: [
				<azdata.CheckboxColumn>
				{
					value: 'Include',
					type: azdata.ColumnType.checkBox,
					action: azdata.ActionOnCellCheckboxCheck.customAction,
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
