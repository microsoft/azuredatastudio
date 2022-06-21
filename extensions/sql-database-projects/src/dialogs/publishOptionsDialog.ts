/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../common/constants';
import * as vscode from 'vscode';
import * as mssql from 'mssql';
import * as utils from '../common/utils';
import type * as azdataType from 'azdata';
import { PublishDatabaseDialog } from './publishDatabaseDialog';
import { DeployOptionsModel } from '../models/options/deployOptionsModel';

export class PublishOptionsDialog {

	public dialog!: azdataType.window.Dialog;
	private optionsTab: azdataType.window.DialogTab | undefined;
	private includeObjectTypesTab: azdataType.window.DialogTab | undefined;
	private disposableListeners: vscode.Disposable[] = [];
	private descriptionHeading: azdataType.TableComponent | undefined;
	private descriptionText: azdataType.TextComponent | undefined;
	private optionsTable: azdataType.TableComponent | undefined;
	private includeObjectsTable: azdataType.TableComponent | undefined;
	public optionsModel: DeployOptionsModel;
	private optionsFlexBuilder: azdataType.FlexContainer | undefined;
	private includeObjectTypesFlexBuilder: azdataType.FlexContainer | undefined;

	constructor(defaultOptions: mssql.DeploymentOptions, private publish: PublishDatabaseDialog) {
		this.optionsModel = new DeployOptionsModel(defaultOptions);
	}

	protected initializeDialog(): void {
		this.optionsTab = utils.getAzdataApi()!.window.createTab(constants.publishOptions);
		this.includeObjectTypesTab = utils.getAzdataApi()!.window.createTab(constants.IncludeObjectTypesOptionsLabel);
		this.intializeDeploymentOptionsDialogTab();
		this.initializePublishingOptionsIncludeObjectTypesDialogTab();
		this.dialog.content = [this.optionsTab, this.includeObjectTypesTab];
	}

	public openDialog(): void {
		this.dialog = utils.getAzdataApi()!.window.createModelViewDialog(constants.publishOptions);

		this.initializeDialog();

		this.dialog.okButton.label = constants.okString;
		this.dialog.okButton.onClick(() => this.execute());

		this.dialog.cancelButton.label = constants.cancelButtonText;
		this.dialog.cancelButton.onClick(() => this.cancel());

		let resetButton = utils.getAzdataApi()!.window.createButton(constants.ResetButton);
		resetButton.onClick(async () => await this.reset());
		this.dialog.customButtons = [resetButton];

		utils.getAzdataApi()!.window.openDialog(this.dialog);
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
				const row = this.optionsTable?.selectedRows![0];
				const label = this.optionsModel.optionsLabels[row!];
				await this.descriptionText?.updateProperties({
					value: this.optionsModel.getDescription(label)
				});
			}));

			// Update deploy options value on checkbox onchange
			this.disposableListeners.push(this.optionsTable.onCellAction!((rowState) => {
				const checkboxState = <azdataType.ICheckboxCellActionEventArgs>rowState;
				if (checkboxState && checkboxState.row !== undefined) {
					const label = this.optionsModel.optionsLabels[checkboxState.row];
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
			// focus the first option
			await this.optionsTable.focus();
		});
	}

	private initializePublishingOptionsIncludeObjectTypesDialogTab(): void {
		this.includeObjectTypesTab!.registerContent(async view => {
			this.includeObjectTypesFlexBuilder = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column'
				}).component();

			this.includeObjectsTable = view.modelBuilder.table().component();
			await this.updateObjectsTable();

			this.disposableListeners.push(this.includeObjectsTable.onCellAction!((rowState) => {
				let checkboxState = <azdataType.ICheckboxCellActionEventArgs>rowState;
				if (checkboxState && checkboxState.row !== undefined) {
					let label = this.optionsModel.includeObjectTypeLabels[checkboxState.row];
					this.optionsModel.includeObjectsLookup?.set(label, checkboxState.checked);
				}
			}));

			this.includeObjectTypesFlexBuilder.addItem(this.includeObjectsTable, { CSSStyles: { 'overflow': 'scroll', 'height': '80vh' } });

			await view.initializeModel(this.includeObjectTypesFlexBuilder);
		});
	}
	/*
	* Update the default options to the options table area
	*/
	private async updateOptionsTable(): Promise<void> {
		const data = this.optionsModel.getOptionsData();
		await this.optionsTable?.updateProperties({
			data: data,
			columns: [
				<azdataType.CheckboxColumn>
				{
					value: constants.OptionInclude,
					type: utils.getAzdataApi()!.ColumnType.checkBox,
					action: utils.getAzdataApi()!.ActionOnCellCheckboxCheck.customAction,
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
	* Update the default options to the object types table area
	*/
	private async updateObjectsTable(): Promise<void> {
		let data = this.optionsModel.getObjectsData();
		await this.includeObjectsTable!.updateProperties({
			data: data,
			columns: [
				<azdataType.CheckboxColumn>
				{
					value: constants.OptionInclude,
					type: utils.getAzdataApi()!.ColumnType.checkBox,
					action: utils.getAzdataApi()!.ActionOnCellCheckboxCheck.customAction,
					headerCssClass: 'display-none',
					cssClass: 'no-borders align-with-header align-with-text',
					width: 50
				},
				{
					value: constants.OptionName,
					headerCssClass: 'display-none',
					cssClass: 'no-borders align-with-header vertical-align-middle',
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
		const result = await this.publish.getDefaultDeploymentOptions();
		this.optionsModel.deploymentOptions = result;

		// This will update the Map table with default values
		this.optionsModel.InitializeUpdateOptionsMapTable();

		await this.updateOptionsTable();
		this.optionsFlexBuilder?.removeItem(this.optionsTable!);
		this.optionsFlexBuilder?.insertItem(this.optionsTable!, 0, { CSSStyles: { 'overflow': 'scroll', 'height': '65vh' } });
	}

	private disposeListeners(): void {
		this.disposableListeners.forEach(x => x.dispose());
	}
}
