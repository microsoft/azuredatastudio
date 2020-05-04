/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../common/constants';
import * as path from 'path';
import { Project } from '../models/project';

export class DeployDatabaseDialog {
	public dialog: azdata.window.Dialog;
	private deployTab: azdata.window.DialogTab;
	private targetConnectionTextBox: azdata.InputBoxComponent;
	private targetDatabaseTextBox: azdata.InputBoxComponent;
	private deployScriptNameTextBox: azdata.InputBoxComponent;
	private formBuilder!: azdata.FormBuilder;

	private connection: azdata.connection.ConnectionProfile;

	constructor(private project: Project) {
		this.dialog = azdata.window.createModelViewDialog(constants.deployDialogName);
		this.deployTab = azdata.window.createTab(constants.deployDialogName);
	}

	public async openDialog(): Promise<void> {
		this.initializeDialog();
		this.dialog.okButton.label = constants.deployDialogOkButtonText;
		this.dialog.okButton.enabled = true;
		this.dialog.okButton.onClick(async () => await this.deploy());

		this.dialog.cancelButton.label = constants.cancelButtonText;
		this.dialog.cancelButton.onClick(async () => await this.cancel());
		this.dialog.cancelButton.onClick(async () => await this.cancel());

		let generateScriptButton = azdata.window.createButton(constants.generateScriptButtonText);
		generateScriptButton.onClick(async () => await this.generateScript());
		generateScriptButton.enabled = false;

		this.dialog.customButtons = [];
		this.dialog.customButtons.push(generateScriptButton);

		azdata.window.openDialog(this.dialog);
	}


	private initializeDialog() {
		this.initializeDeployTab();
		this.dialog.content = [this.deployTab];
	}

	private initializeDeployTab(): void {
		this.deployTab.registerContent(async view => {
			this.targetConnectionTextBox = view.modelBuilder.inputBox().withProperties({
				value: '',
				ariaLabel: constants.targetConnectionLabel,
				required: true
			}).component();

			this.targetConnectionTextBox.onTextChanged(() => {
				this.tryEnableGenerateScriptButton();
			});

			let selectConnectionButton = this.createSelectConnectionButton(view);
			let clearButton = this.createClearButton(view);

			this.targetDatabaseTextBox = view.modelBuilder.inputBox().withProperties({
				value: this.getDefaultDatabaseName(),
				ariaLabel: constants.databaseNameLabel,
				required: true
			}).component();

			this.targetDatabaseTextBox.onTextChanged(() => {
				this.tryEnableGenerateScriptButton();
			});

			this.deployScriptNameTextBox = view.modelBuilder.inputBox().withProperties({
				value: this.getDefaultScriptName(),
				ariaLabel: constants.deployScriptNameLabel
			}).component();

			this.deployScriptNameTextBox.onTextChanged(() => {
				this.tryEnableGenerateScriptButton();
			});

			this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: constants.targetDatabaseSettings,
						components: [
							{
								title: constants.targetConnectionLabel,
								component: this.targetConnectionTextBox,
								actions: [selectConnectionButton, clearButton]
							},
							{
								title: constants.databaseNameLabel,
								component: this.targetDatabaseTextBox
							},
							{
								title: constants.deployScriptNameLabel,
								component: this.deployScriptNameTextBox
							}
						]
					}
				], {
					horizontal: false
				})
				.withLayout({
					width: '100%'
				});

			let formModel = this.formBuilder.component();
			await view.initializeModel(formModel);
		});
	}

	private async deploy(): Promise<void> {
		// TODO: hook up with build and deploy
	}

	private async generateScript(): Promise<void> {
		// TODO: hook up with build and generate script
		azdata.window.closeDialog(this.dialog);
	}

	private async cancel(): Promise<void> {
	}

	private getDefaultDatabaseName(): string {
		return path.basename(this.project.projectFolderPath);
	}

	private getDefaultScriptName(): string {
		return this.getDefaultDatabaseName() + '.sql';
	}

	private createSelectConnectionButton(view: azdata.ModelView): azdata.Component {
		let selectConnectionButton = view.modelBuilder.button().withProperties({
			label: constants.selectConnectionButtonText,
			title: constants.selectConnectionButtonText,
			ariaLabel: constants.selectConnectionButtonText
		}).component();

		selectConnectionButton.onDidClick(async () => {
			this.connection = <azdata.connection.ConnectionProfile><any>await azdata.connection.openConnectionDialog();
			this.targetConnectionTextBox.value = await azdata.connection.getConnectionString(this.connection.connectionId, false);

			// change the database inputbox value to the connection's database if there is one
			if (this.connection.options.database) {
				this.targetDatabaseTextBox.value = this.connection.options.database;
			}
		});

		return selectConnectionButton;
	}

	private createClearButton(view: azdata.ModelView): azdata.Component {
		let clearButton = view.modelBuilder.button().withProperties({
			label: constants.clearButtonText,
			title: constants.clearButtonText,
			ariaLabel: constants.clearButtonText
		}).component();

		clearButton.onDidClick(() => {
			this.targetConnectionTextBox.value = '';
		});

		return clearButton;
	}

	// only enable Generate Script button if the connection, database, and deploy script name are specified
	private tryEnableGenerateScriptButton(): void {
		if (this.targetConnectionTextBox.value && this.targetDatabaseTextBox.value && this.deployScriptNameTextBox.value) {
			this.dialog.customButtons[0].enabled = true;
		} else {
			this.dialog.customButtons[0].enabled = false;
		}
	}
}
