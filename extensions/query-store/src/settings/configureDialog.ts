/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { isNullOrUndefined } from 'util';


export class ConfigureDialog {
	public dialog: azdata.window.Dialog;
	private configureTab: azdata.window.DialogTab;
	private toDispose: vscode.Disposable[] = [];

	constructor(private view?: azdata.ModelView) {
		this.dialog = azdata.window.createModelViewDialog(constants.configure);
		this.dialog.registerCloseValidator(async () => {
			return this.validate();
		});
	}

	async validate(): Promise<boolean> {
		/*try {
			// check project extension is installed
			if (!vscode.extensions.getExtension(loc.sqlDatabaseProjectExtensionId) &&
				(this.sourceEndpointType === mssql.SchemaCompareEndpointType.Project ||
					this.targetEndpointType === mssql.SchemaCompareEndpointType.Project)) {
				this.showErrorMessage(loc.noProjectExtension);
				return false;
			}

			// check Database Schema Providers are set and valid
			if (this.sourceEndpointType === mssql.SchemaCompareEndpointType.Project) {
				try {
					await this.getDatabaseSchemaProvider(this.sourceTextBox.value);
				} catch (err) {
					this.showErrorMessage(loc.dspErrorSource);
				}
			}

			if (this.targetEndpointType === mssql.SchemaCompareEndpointType.Project) {
				try {
					await this.getDatabaseSchemaProvider(this.targetTextBox.value);
				} catch (err) {
					this.showErrorMessage(loc.dspErrorTarget);
				}
			}

			return true;
		} catch (e) {
			this.showErrorMessage(e?.message ? e.message : e);
			return false;
		}*/
		return true;
	}

	public async openDialog(): Promise<void> {


		this.dialog = azdata.window.createModelViewDialog(constants.configure);
		await this.initializeDialog();

		this.dialog.okButton.label = constants.okButtonText;
		this.dialog.okButton.enabled = false;
		this.toDispose.push(this.dialog.okButton.onClick(async () => { } /*await this.handleOkButtonClick()*/));

		this.dialog.cancelButton.label = constants.cancelButtonText;
		this.toDispose.push(this.dialog.cancelButton.onClick(async () => { }/*await this.cancel()*/));

		azdata.window.openDialog(this.dialog);
		//await this.initDialogPromise;
	}

	protected async initializeDialog(): Promise<void> {
		this.configureTab = azdata.window.createTab(constants.configure);
		await this.initializeConfigureTab();
		this.dialog.content = [this.configureTab];
	}

	private async initializeConfigureTab(): Promise<void> {
		this.configureTab.registerContent(async view => {
			if (isNullOrUndefined(this.view)) {
				this.view = view;
			}

			/*let sourceValue = '';

			if (this.schemaCompareMainWindow.sourceEndpointInfo && this.schemaCompareMainWindow.sourceEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Dacpac) {
				sourceValue = this.schemaCompareMainWindow.sourceEndpointInfo.packageFilePath;
			} else if (this.schemaCompareMainWindow.sourceEndpointInfo && this.schemaCompareMainWindow.sourceEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Project) {
				sourceValue = this.schemaCompareMainWindow.sourceEndpointInfo.projectFilePath;
			}

			this.sourceTextBox = this.view.modelBuilder.inputBox().withProps({
				value: sourceValue,
				width: this.textBoxWidth,
				ariaLabel: loc.sourceFile
			}).component();

			this.sourceTextBox.onTextChanged(async (e) => {
				this.dialog.okButton.enabled = await this.shouldEnableOkayButton();

				if (this.sourceEndpointType === mssql.SchemaCompareEndpointType.Dacpac) {
					this.sourceDacpacPath = e;
				} else if (this.sourceEndpointType === mssql.SchemaCompareEndpointType.Project) {
					this.sourceProjectFilePath = e;
				}
			});

			let targetValue = '';

			if (this.schemaCompareMainWindow.targetEndpointInfo && this.schemaCompareMainWindow.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Dacpac) {
				targetValue = this.schemaCompareMainWindow.targetEndpointInfo.packageFilePath;
			} else if (this.schemaCompareMainWindow.targetEndpointInfo && this.schemaCompareMainWindow.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Project) {
				targetValue = this.schemaCompareMainWindow.targetEndpointInfo.projectFilePath;
			}

			this.targetTextBox = this.view.modelBuilder.inputBox().withProps({
				value: targetValue,
				width: this.textBoxWidth,
				ariaLabel: loc.targetFile
			}).component();

			this.targetTextBox.onTextChanged(async (e) => {
				this.dialog.okButton.enabled = await this.shouldEnableOkayButton();

				if (this.targetEndpointType === mssql.SchemaCompareEndpointType.Dacpac) {
					this.targetDacpacPath = e;
				} else if (this.targetEndpointType === mssql.SchemaCompareEndpointType.Project) {
					this.targetProjectFilePath = e;
				}
			});

			this.sourceServerComponent = this.createSourceServerDropdown();
			this.sourceDatabaseComponent = this.createSourceDatabaseDropdown();

			this.targetServerComponent = this.createTargetServerDropdown();
			this.targetDatabaseComponent = this.createTargetDatabaseDropdown();

			this.sourceDacpacComponent = this.createFileBrowser(false, true, this.schemaCompareMainWindow.sourceEndpointInfo);
			this.targetDacpacComponent = this.createFileBrowser(true, true, this.schemaCompareMainWindow.targetEndpointInfo);

			this.sourceProjectFilePathComponent = this.createFileBrowser(false, false, this.schemaCompareMainWindow.sourceEndpointInfo);
			this.targetProjectFilePathComponent = this.createFileBrowser(true, false, this.schemaCompareMainWindow.targetEndpointInfo);

			this.targetProjectStructureComponent = this.createStructureDropdown();

			let sourceRadioButtons = this.createSourceRadioButtons();
			let targetRadioButtons = this.createTargetRadioButtons();

			let sourceComponents = [];
			let targetComponents = [];

			// start source and target with either dacpac, database, or project selection based on what the previous value was
			sourceComponents = [sourceRadioButtons];

			switch (this.sourceEndpointType) {
				case mssql.SchemaCompareEndpointType.Database:
					sourceComponents.push(
						this.sourceServerComponent,
						this.sourceDatabaseComponent);
					break;
				case mssql.SchemaCompareEndpointType.Dacpac:
					sourceComponents.push(this.sourceDacpacComponent);
					break;
				case mssql.SchemaCompareEndpointType.Project:
					sourceComponents.push(this.sourceProjectFilePathComponent);
					break;
			}

			targetComponents = [targetRadioButtons];

			switch (this.targetEndpointType) {
				case mssql.SchemaCompareEndpointType.Database:
					targetComponents.push(
						this.targetServerComponent,
						this.targetDatabaseComponent);
					break;
				case mssql.SchemaCompareEndpointType.Dacpac:
					targetComponents.push(this.targetDacpacComponent);
					break;
				case mssql.SchemaCompareEndpointType.Project:
					targetComponents.push(this.targetProjectFilePathComponent);
					targetComponents.push(this.targetProjectStructureComponent);
					break;
			}

			this.formBuilder = <azdata.FormBuilder>this.view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: loc.SourceTitle,
						components: sourceComponents
					}, {
						title: loc.TargetTitle,
						components: targetComponents
					}
				], {
					horizontal: true,
					titleFontSize: titleFontSize
				})
				.withLayout({
					width: '100%',
					padding: '10px 10px 0 30px'
				});

			let formModel = this.formBuilder.component();
			await this.view.initializeModel(formModel);

			switch (this.sourceEndpointType) {
				case (mssql.SchemaCompareEndpointType.Database):
					await this.sourceDatabaseRadioButton.focus();
					break;
				case (mssql.SchemaCompareEndpointType.Dacpac):
					await this.sourceDacpacRadioButton.focus();
					break;
				case (mssql.SchemaCompareEndpointType.Project):
					await this.sourceProjectRadioButton.focus();
					break;
			}

			this.initDialogComplete.resolve();*/
		});
	}
}
