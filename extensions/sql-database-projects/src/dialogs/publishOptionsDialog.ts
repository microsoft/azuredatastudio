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
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';

export class PublishOptionsDialog {

	public dialog!: azdataType.window.Dialog;
	private optionsTab: azdataType.window.DialogTab | undefined;
	private disposableListeners: vscode.Disposable[] = [];
	private descriptionHeading: azdataType.TableComponent | undefined;
	private descriptionText: azdataType.TextComponent | undefined;
	private optionsTable: azdataType.TableComponent | undefined;
	public optionsModel: DeployOptionsModel;
	private optionsFlexBuilder: azdataType.FlexContainer | undefined;
	private optionsChanged: boolean = false;
	private isResetOptionsClicked: boolean = false;
	private excludeObjectTypesOptionsTab: azdataType.window.DialogTab | undefined;
	private excludeObjectTypesOptionsTable: azdataType.TableComponent | undefined;
	private excludeObjectTypesOptionsFlexBuilder: azdataType.FlexContainer | undefined;

	constructor(defaultOptions: mssql.DeploymentOptions, private publish: PublishDatabaseDialog) {
		this.optionsModel = new DeployOptionsModel(defaultOptions);
	}

	protected initializeDialog(): void {
		this.optionsTab = utils.getAzdataApi()!.window.createTab(constants.PublishOptions);
		this.excludeObjectTypesOptionsTab = utils.getAzdataApi()!.window.createTab(constants.ExcludeObjectTypeTab);
		this.initializeDeploymentOptionsDialogTab();
		this.initializeExcludeObjectTypesOptionsDialogTab();
		this.dialog.content = [this.optionsTab, this.excludeObjectTypesOptionsTab];
	}

	public openDialog(): void {
		this.dialog = utils.getAzdataApi()!.window.createModelViewDialog(constants.AdvancedPublishOptions);

		this.initializeDialog();

		this.dialog.okButton.label = constants.okString;
		this.dialog.okButton.onClick(() => this.execute());

		this.dialog.cancelButton.label = constants.cancelButtonText;
		this.dialog.cancelButton.onClick(() => this.cancel());

		let resetButton = utils.getAzdataApi()!.window.createButton(constants.ResetButton);
		resetButton.onClick(async () => await this.reset());
		// If options values already modified then enable the reset button
		resetButton.enabled = this.publish.publishOptionsModified;
		this.dialog.customButtons = [resetButton];

		utils.getAzdataApi()!.window.openDialog(this.dialog);
	}

	private initializeDeploymentOptionsDialogTab(): void {
		this.optionsTab?.registerContent(async view => {
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
				// selectedRows[0] contains selected row number
				const row = this.optionsTable?.selectedRows![0];
				// data[row][1] contains the option display name
				const displayName = this.optionsTable?.data[row!][1];
				await this.descriptionText?.updateProperties({
					value: this.optionsModel.getOptionDescription(displayName)
				});
			}));

			// Update deploy options value on checkbox onchange
			this.disposableListeners.push(this.optionsTable.onCellAction!((rowState) => {
				const checkboxState = <azdataType.ICheckboxCellActionEventArgs>rowState;
				if (checkboxState && checkboxState.row !== undefined) {
					// data[row][1] contains the option display name
					const displayName = this.optionsTable?.data[checkboxState.row][1];
					this.optionsModel.setOptionValue(displayName, checkboxState.checked);
					this.optionsChanged = true;
					// customButton[0] is the reset button, enabling it when option checkbox is changed
					this.dialog.customButtons[0].enabled = true;
				}
			}));

			this.optionsFlexBuilder.addItem(this.optionsTable, { CSSStyles: { 'overflow': 'scroll', 'height': '65vh', 'padding-top': '2px' } });
			this.optionsFlexBuilder.addItem(this.descriptionHeading, { CSSStyles: { 'font-weight': 'bold', 'height': '30px' } });
			this.optionsFlexBuilder.addItem(this.descriptionText, { CSSStyles: { 'padding': '4px', 'margin-right': '10px', 'overflow': 'scroll', 'height': '10vh' } });
			loader.loading = false;
			await view.initializeModel(this.optionsFlexBuilder);
			// focus the first option
			await this.optionsTable.focus();
		});
	}

	private initializeExcludeObjectTypesOptionsDialogTab(): void {
		this.excludeObjectTypesOptionsTab?.registerContent(async view => {
			this.excludeObjectTypesOptionsTable = view.modelBuilder.table().component();
			await this.updateExcludeObjectsTable();

			// Update exclude type options value on checkbox onchange
			this.disposableListeners.push(this.excludeObjectTypesOptionsTable!.onCellAction!((rowState) => {
				const checkboxState = <azdataType.ICheckboxCellActionEventArgs>rowState;
				if (checkboxState && checkboxState.row !== undefined) {
					// data[row][1] contains the exclude type option display name
					const displayName = this.excludeObjectTypesOptionsTable?.data[checkboxState.row][1];
					this.optionsModel.setExcludeObjectTypesOptionValue(displayName, checkboxState.checked);
					this.optionsChanged = true;
					// customButton[0] is the reset button, enabling it when option checkbox is changed
					this.dialog.customButtons[0].enabled = true;
				}
			}));

			this.excludeObjectTypesOptionsFlexBuilder = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column'
				}).component();

			this.excludeObjectTypesOptionsFlexBuilder.addItem(this.excludeObjectTypesOptionsTable, { CSSStyles: { 'overflow': 'scroll', 'height': '80vh', 'padding-top': '2px' } });
			await view.initializeModel(this.excludeObjectTypesOptionsFlexBuilder);
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
	* Update the default options to the exclude objects table area
	*/
	private async updateExcludeObjectsTable(): Promise<void> {
		const data = this.optionsModel.getExcludeObjectTypesOptionsData();
		await this.excludeObjectTypesOptionsTable?.updateProperties({
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
	* Ok button click, will update the deployment options with selections
	*/
	protected execute(): void {
		// Update the model deploymentoptions with the updated options/excludeObjects table component values
		this.optionsModel.setDeploymentOptions();
		this.optionsModel.setExcludeObjectTypesToDeploymentOptions();
		// Set the publish deploymentoptions with the updated table component values
		this.publish.setDeploymentOptions(this.optionsModel.deploymentOptions);
		this.disposeListeners();

		if (this.optionsChanged) {
			TelemetryReporter.sendActionEvent(TelemetryViews.PublishOptionsDialog, TelemetryActions.optionsChanged);
		}
		// When options are Reset to default and clicked Ok, seting optionsChanged flag to false
		// When options are Reset to default and options are changed and then clicked Ok, seting optionsChanged flag to the state of the option change
		this.publish.publishOptionsModified = this.isResetOptionsClicked && !this.optionsChanged ? false : (this.optionsChanged || this.publish.publishOptionsModified);
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

		// reset optionsvalueNameLookup and excludeObjectTypesLookup with default deployment options
		this.optionsModel.setOptionsToValueNameLookup();
		this.optionsModel.setExcludeObjectTypesLookup();

		await this.updateOptionsTable();
		this.optionsFlexBuilder?.removeItem(this.optionsTable!);
		this.optionsFlexBuilder?.insertItem(this.optionsTable!, 0, { CSSStyles: { 'overflow': 'scroll', 'height': '65vh', 'padding-top': '2px' } });
		TelemetryReporter.sendActionEvent(TelemetryViews.PublishOptionsDialog, TelemetryActions.resetOptions);

		await this.updateExcludeObjectsTable();
		this.excludeObjectTypesOptionsFlexBuilder?.removeItem(this.excludeObjectTypesOptionsTable!);
		this.excludeObjectTypesOptionsFlexBuilder?.addItem(this.excludeObjectTypesOptionsTable!, { CSSStyles: { 'overflow': 'scroll', 'height': '80vh', 'padding-top': '2px' } });

		// setting optionsChanged to false when reset click, if optionsChanged is true during execute, that means there is an option changed after reset
		this.isResetOptionsClicked = true;
		this.optionsChanged = false;
	}

	private disposeListeners(): void {
		this.disposableListeners.forEach(x => x.dispose());
	}
}
