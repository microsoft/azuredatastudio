/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../common/constants';
import * as vscode from 'vscode';
import * as mssql from 'mssql';
import { PublishDatabaseDialog } from './publishDatabaseDialog';
import { DeployOptionsModel } from '../models/options/deployOptionsModel';

export class PublishOptionsDialog {

	public dialog!: azdata.window.Dialog;
	private optionsTab: azdata.window.DialogTab | undefined;
	private disposableListeners: vscode.Disposable[] = [];
	private descriptionHeading!: azdata.TableComponent;
	private descriptionText!: azdata.TextComponent;
	private optionsTable!: azdata.TableComponent;
	private optionsModel: DeployOptionsModel;
	private optionsFlexBuilder!: azdata.FlexContainer;

	constructor(defaultOptions: mssql.DeploymentOptions, private publish: PublishDatabaseDialog) {
		this.optionsModel = new DeployOptionsModel(defaultOptions);
	}

	protected initializeDialog(): void {
		this.optionsTab = azdata.window.createTab(constants.GeneralOptions);
		this.intializeDeploymentOptionsDialogTab();
		this.dialog.content = [this.optionsTab];
	}

	public openDialog(): void {
		this.dialog = azdata.window.createModelViewDialog(constants.GeneralOptions);

		this.initializeDialog();

		this.dialog.okButton.label = constants.OkButton;
		this.dialog.okButton.onClick(async () => this.execute());

		this.dialog.cancelButton.label = constants.CancelButton;
		this.dialog.cancelButton.onClick(async () => this.cancel());

		let resetButton = azdata.window.createButton(constants.ResetButton);
		resetButton.onClick(async () => await this.reset());
		this.dialog.customButtons = [];
		this.dialog.customButtons.push(resetButton);

		azdata.window.openDialog(this.dialog);
	}

	private intializeDeploymentOptionsDialogTab(): void {
		this.optionsTab?.registerContent(async view => {
			this.descriptionHeading = view.modelBuilder.table().withProps({
				data: [],
				columns: [
					{
						value: constants.OptionDescription,
						headerCssClass: 'no-borders',
						toolTip: constants.OptionDescription
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
				let row = this.optionsTable.selectedRows![0];
				let label = this.optionsModel.optionsLabels[row];
				await this.descriptionText.updateProperties({
					value: this.optionsModel.getDescription(label)
				});
			}));

			// Update deploy options value on checkbox onchange
			this.disposableListeners.push(this.optionsTable.onCellAction!((rowState) => {
				let checkboxState = <azdata.ICheckboxCellActionEventArgs>rowState;
				if (checkboxState && checkboxState.row !== undefined) {
					let label = this.optionsModel.optionsLabels[checkboxState.row];
					this.optionsModel.optionsLookup[label] = checkboxState.checked;
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

	/*
	* Update the default options to the options table area
	*/
	private async updateOptionsTable(): Promise<void> {
		let data = this.optionsModel.getOptionsData();
		await this.optionsTable.updateProperties({
			data: data,
			columns: [
				<azdata.CheckboxColumn>
				{
					value: constants.OptionInclude,
					type: azdata.ColumnType.checkBox,
					action: azdata.ActionOnCellCheckboxCheck.customAction,
					headerCssClass: 'display-none',
					cssClass: 'no-borders align-with-header',
					width: 50
				},
				{
					value: constants.OptionName,
					headerCssClass: 'display-none',
					cssClass: 'no-borders align-with-header',
					width: 50
				}
			],
			ariaRowCount: data.length
		});
	}

	/*
	* Ok button click, will update the deployment options with selections
	*/
	protected execute(): void {
		this.optionsModel.setDeploymentOptions();
		this.publish.setDeploymentOptions(this.optionsModel.deploymentOptions);
		this.disposeListeners();
	}

	/*
	* Cancels the deploy options table dialog and its changes will be disposed
	*/
	protected cancel(): void {
		this.disposeListeners();
	}

	/*
	* Reset button click, resets all the options selection
	*/
	private async reset(): Promise<void> {
		let result = await this.publish.getDefaultDeploymentOptions();
		this.optionsModel.deploymentOptions = result;

		// This will update the Map table with default values
		this.optionsModel.InitializeUpdateOptionsMapTable();

		await this.updateOptionsTable();
		this.optionsFlexBuilder.removeItem(this.optionsTable);
		this.optionsFlexBuilder.insertItem(this.optionsTable, 0, { CSSStyles: { 'overflow': 'scroll', 'height': '65vh' } });
	}

	private disposeListeners(): void {
		this.disposableListeners.forEach(x => x.dispose());
	}
}
