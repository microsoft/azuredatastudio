/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../common/constants';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import { PublishDatabaseDialog } from './publishDatabaseDialog';

export class PublishOptionsDialog {

	public dialog!: azdata.window.Dialog;
	private optionsTab!: azdata.window.Dialog;
	private disposableListeners: vscode.Disposable[] = [];
	private descriptionHeading!: azdata.TableComponent;
	private descriptionText!: azdata.TextComponent;
	private optionsTable!: azdata.TableComponent;
	private optionsChanged: boolean = false;
	// private optionsModel!: SchemaCompareOptionsModel;
	private optionsFlexBuilder!: azdata.FlexContainer;


	constructor(defaultOptions: mssql.DeploymentOptions, private publish: PublishDatabaseDialog) {
		//this.optionsModel = new SchemaCompareOptionsModel(defaultOptions);
	}

	protected initializeDialog(): void {
		this.optionsTab = azdata.window.createTab(constants.GeneralOptionsLabel);
		this.intializeDeploymentOptionsDialogTab();
		this.dialog.content = [this.optionsTab];
	}

	public openDialog(): void {
		let event = null;
		this.dialog = azdata.window.createModelViewDialog(constants.GeneralOptionsLabel, event);

		this.initializeDialog();

		this.dialog.okButton.label = constants.OkButtonText;
		this.dialog.okButton.onClick(async () => await this.execute());

		this.dialog.cancelButton.label = constants.CancelButtonText;
		this.dialog.cancelButton.onClick(async () => await this.cancel());

		let resetButton = azdata.window.createButton(constants.ResetButtonText);
		resetButton.onClick(async () => await this.reset());
		this.dialog.customButtons = [];
		this.dialog.customButtons.push(resetButton);

		azdata.window.openDialog(this.dialog);
	}

	private intializeDeploymentOptionsDialogTab(): void {
		this.optionsTab.registerContent(async view => {

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
			// await this.updateOptionsTable();

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

	protected cancel(): void {
		this.disposeListeners();
	}

	private async reset(): Promise<void> {
		// let service = (vscode.extensions.getExtension(mssql.extension.name).exports as mssql.IExtension).schemaCompare;
		// let result = await service.schemaCompareGetDefaultOptions();
		// this.optionsModel.deploymentOptions = result.defaultDeploymentOptions;
		// this.optionsChanged = true;

		// await this.updateOptionsTable();
		// this.optionsFlexBuilder.removeItem(this.optionsTable);
		// this.optionsFlexBuilder.insertItem(this.optionsTable, 0, { CSSStyles: { 'overflow': 'scroll', 'height': '65vh' } });

		// await this.updateObjectsTable();
		// this.objectTypesFlexBuilder.removeItem(this.objectsTable);
		// this.objectTypesFlexBuilder.addItem(this.objectsTable, { CSSStyles: { 'overflow': 'scroll', 'height': '80vh' } });
	}

	private disposeListeners(): void {
		if (this.disposableListeners) {
			this.disposableListeners.forEach(x => x.dispose());
		}
	}

}
