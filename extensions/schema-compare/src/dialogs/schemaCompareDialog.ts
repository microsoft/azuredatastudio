/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as os from 'os';
import { SchemaCompareResult } from '../schemaCompareResult';
import { isNullOrUndefined } from 'util';
import { existsSync } from 'fs';

const localize = nls.loadMessageBundle();
const OkButtonText: string = localize('schemaCompareDialog.ok', 'Ok');
const CancelButtonText: string = localize('schemaCompareDialog.cancel', 'Cancel');
const SourceTitle: string = localize('schemaCompareDialog.SourceTitle', 'Source');
const TargetTitle: string = localize('schemaCompareDialog.TargetTitle', 'Target');
const FileTextBoxLabel: string = localize('schemaCompareDialog.fileTextBoxLabel', 'File');
const DacpacRadioButtonLabel: string = localize('schemaCompare.dacpacRadioButtonLabel', 'Data-tier Application File (.dacpac)');
const DatabaseRadioButtonLabel: string = localize('schemaCompare.databaseButtonLabel', 'Database');
const RadioButtonsLabel: string = localize('schemaCompare.radioButtonsLabel', 'Type');
const ServerDropdownLabel: string = localize('schemaCompareDialog.serverDropdownTitle', 'Server');
const DatabaseDropdownLabel: string = localize('schemaCompareDialog.databaseDropdownTitle', 'Database');
const NoActiveConnectionsLabel: string = localize('schemaCompare.noActiveConnectionsText', 'No active connections');
const SchemaCompareLabel: string = localize('schemaCompare.dialogTitle', 'Schema Compare');
const titleFontSize: number = 13;

export class SchemaCompareDialog {
	public dialog: azdata.window.Dialog;
	public dialogName: string;
	private schemaCompareTab: azdata.window.DialogTab;
	private sourceDacpacComponent: azdata.FormComponent;
	private sourceTextBox: azdata.InputBoxComponent;
	private sourceFileButton: azdata.ButtonComponent;
	private sourceServerComponent: azdata.FormComponent;
	private sourceServerDropdown: azdata.DropDownComponent;
	private sourceDatabaseComponent: azdata.FormComponent;
	private sourceDatabaseDropdown: azdata.DropDownComponent;
	private sourceNoActiveConnectionsText: azdata.FormComponent;
	private targetDacpacComponent: azdata.FormComponent;
	private targetTextBox: azdata.InputBoxComponent;
	private targetFileButton: azdata.ButtonComponent;
	private targetServerComponent: azdata.FormComponent;
	private targetServerDropdown: azdata.DropDownComponent;
	private targetDatabaseComponent: azdata.FormComponent;
	private targetDatabaseDropdown: azdata.DropDownComponent;
	private targetNoActiveConnectionsText: azdata.FormComponent;
	private formBuilder: azdata.FormBuilder;
	private sourceIsDacpac: boolean;
	private targetIsDacpac: boolean;
	private database: string;
	private connectionId: string;

	protected initializeDialog(): void {
		this.schemaCompareTab = azdata.window.createTab(SchemaCompareLabel);
		this.initializeSchemaCompareTab();
		this.dialog.content = [this.schemaCompareTab];
	}

	public async openDialog(context: any, dialogName?: string): Promise<void> {
		let profile = context ? <azdata.IConnectionProfile>context.connectionProfile : undefined;
		if (profile) {
			this.database = profile.databaseName;
			this.connectionId = profile.id;
		} else {
			let connection = await azdata.connection.getCurrentConnection();
			if (connection) {
				this.connectionId = connection.connectionId;
				this.database = undefined;
			}
		}

		let event = dialogName ? dialogName : null;
		this.dialog = azdata.window.createModelViewDialog(SchemaCompareLabel, event);

		this.initializeDialog();

		this.dialog.okButton.label = OkButtonText;
		this.dialog.okButton.enabled = false;
		this.dialog.okButton.onClick(async () => await this.execute());

		this.dialog.cancelButton.label = CancelButtonText;
		this.dialog.cancelButton.onClick(async () => await this.cancel());

		azdata.window.openDialog(this.dialog);
	}

	protected async execute(): Promise<void> {
		let sourceName: string;
		let targetName: string;

		let sourceEndpointInfo: azdata.SchemaCompareEndpointInfo;
		if (this.sourceIsDacpac) {
			sourceName = this.sourceTextBox.value;
			sourceEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.Dacpac,
				serverName: '',
				databaseName: '',
				ownerUri: '',
				packageFilePath: this.sourceTextBox.value
			};
		} else {
			sourceName = (this.sourceServerDropdown.value as ConnectionDropdownValue).name + '.' + (<azdata.CategoryValue>this.sourceDatabaseDropdown.value).name;
			let ownerUri = await azdata.connection.getUriForConnection((this.sourceServerDropdown.value as ConnectionDropdownValue).connection.connectionId);

			sourceEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.Database,
				serverName: (this.sourceServerDropdown.value as ConnectionDropdownValue).name,
				databaseName: (<azdata.CategoryValue>this.sourceDatabaseDropdown.value).name,
				ownerUri: ownerUri,
				packageFilePath: ''
			};
		}

		let targetEndpointInfo: azdata.SchemaCompareEndpointInfo;
		if (this.targetIsDacpac) {
			targetName = this.targetTextBox.value;
			targetEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.Dacpac,
				serverName: '',
				databaseName: '',
				ownerUri: '',
				packageFilePath: this.targetTextBox.value
			};
		} else {
			targetName = (this.targetServerDropdown.value as ConnectionDropdownValue).name + '.' + (<azdata.CategoryValue>this.targetDatabaseDropdown.value).name;
			let ownerUri = await azdata.connection.getUriForConnection((this.targetServerDropdown.value as ConnectionDropdownValue).connection.connectionId);

			targetEndpointInfo = {
				endpointType: azdata.SchemaCompareEndpointType.Database,
				serverName: (this.targetServerDropdown.value as ConnectionDropdownValue).name,
				databaseName: (<azdata.CategoryValue>this.targetDatabaseDropdown.value).name,
				ownerUri: ownerUri,
				packageFilePath: ''
			};
		}

		let schemaCompareResult = new SchemaCompareResult(sourceName, targetName, sourceEndpointInfo, targetEndpointInfo);
		schemaCompareResult.start();
	}

	protected async cancel(): Promise<void> {
	}

	private initializeSchemaCompareTab(): void {
		this.schemaCompareTab.registerContent(async view => {
			this.sourceTextBox = view.modelBuilder.inputBox().withProperties({
				width: 275
			}).component();

			this.sourceTextBox.onTextChanged((e) => {
				this.dialog.okButton.enabled = this.shouldEnableOkayButton();
			});

			this.targetTextBox = view.modelBuilder.inputBox().withProperties({
				width: 275
			}).component();

			this.targetTextBox.onTextChanged(() => {
				this.dialog.okButton.enabled = this.shouldEnableOkayButton();
			});

			this.sourceServerComponent = await this.createSourceServerDropdown(view);
			await this.populateServerDropdown(false);

			this.sourceDatabaseComponent = await this.createSourceDatabaseDropdown(view);
			if ((this.sourceServerDropdown.value as ConnectionDropdownValue)) {
				await this.populateDatabaseDropdown((this.sourceServerDropdown.value as ConnectionDropdownValue).connection.connectionId, false);
			}

			this.targetServerComponent = await this.createTargetServerDropdown(view);
			await this.populateServerDropdown(true);

			this.targetDatabaseComponent = await this.createTargetDatabaseDropdown(view);
			if ((this.targetServerDropdown.value as ConnectionDropdownValue)) {
				await this.populateDatabaseDropdown((this.targetServerDropdown.value as ConnectionDropdownValue).connection.connectionId, true);
			}

			this.sourceDacpacComponent = await this.createFileBrowser(view, false);
			this.targetDacpacComponent = await this.createFileBrowser(view, true);

			let sourceRadioButtons = await this.createSourceRadiobuttons(view);
			let targetRadioButtons = await this.createTargetRadiobuttons(view);

			this.sourceNoActiveConnectionsText = await this.createNoActiveConnectionsText(view);
			this.targetNoActiveConnectionsText = await this.createNoActiveConnectionsText(view);

			// if schema compare was launched from a db context menu, set that db as the source
			if (this.database) {
				this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
					.withFormItems([
						{
							title: SourceTitle,
							components: [
								sourceRadioButtons,
								this.sourceServerComponent,
								this.sourceDatabaseComponent
							]
						}, {
							title: TargetTitle,
							components: [
								targetRadioButtons,
								this.targetDacpacComponent
							]
						}
					], {
							horizontal: true,
							titleFontSize: titleFontSize
						})
					.withLayout({
						width: '100%',
						padding: '10px 10px 0 30px'
					});
			} else {
				this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
					.withFormItems([
						{
							title: SourceTitle,
							components: [
								sourceRadioButtons,
								this.sourceDacpacComponent,
							]
						}, {
							title: TargetTitle,
							components: [
								targetRadioButtons,
								this.targetDacpacComponent
							]
						}
					], {
							horizontal: true,
							titleFontSize: titleFontSize
						})
					.withLayout({
						width: '100%',
						padding: '10px 10px 0 30px'
					});
			}
			let formModel = this.formBuilder.component();
			await view.initializeModel(formModel);
		});
	}

	private async createFileBrowser(view: azdata.ModelView, isTarget: boolean): Promise<azdata.FormComponent> {
		let currentTextbox = isTarget ? this.targetTextBox : this.sourceTextBox;
		if (isTarget) {
			this.targetFileButton = view.modelBuilder.button().withProperties({
				label: '•••',
			}).component();
		} else {
			this.sourceFileButton = view.modelBuilder.button().withProperties({
				label: '•••',
			}).component();
		}

		let currentButton = isTarget ? this.targetFileButton : this.sourceFileButton;

		currentButton.onDidClick(async (click) => {
			let rootPath = vscode.workspace.rootPath ? vscode.workspace.rootPath : os.homedir();
			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(rootPath),
					openLabel: localize('schemaCompare.openFile', 'Open'),
					filters: {
						'dacpac Files': ['dacpac'],
					}
				}
			);

			if (!fileUris || fileUris.length === 0) {
				return;
			}

			let fileUri = fileUris[0];
			currentTextbox.value = fileUri.fsPath;
		});

		return {
			component: currentTextbox,
			title: FileTextBoxLabel,
			actions: [currentButton]
		};
	}

	private async createSourceRadiobuttons(view: azdata.ModelView): Promise<azdata.FormComponent> {
		let dacpacRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				name: 'source',
				label: DacpacRadioButtonLabel
			}).component();

		let databaseRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				name: 'source',
				label: DatabaseRadioButtonLabel
			}).component();

		// show dacpac file browser
		dacpacRadioButton.onDidClick(() => {
			this.sourceIsDacpac = true;
			this.formBuilder.removeFormItem(this.sourceNoActiveConnectionsText);
			this.formBuilder.removeFormItem(this.sourceServerComponent);
			this.formBuilder.removeFormItem(this.sourceDatabaseComponent);
			this.formBuilder.insertFormItem(this.sourceDacpacComponent, 2, { horizontal: true, titleFontSize: titleFontSize });
			this.dialog.okButton.enabled = this.shouldEnableOkayButton();
		});

		// show server and db dropdowns or 'No active connections' text
		databaseRadioButton.onDidClick(() => {
			this.sourceIsDacpac = false;
			if ((this.sourceServerDropdown.value as ConnectionDropdownValue)) {
				this.formBuilder.insertFormItem(this.sourceServerComponent, 2, { horizontal: true, titleFontSize: titleFontSize });
				this.formBuilder.insertFormItem(this.sourceDatabaseComponent, 3, { horizontal: true, titleFontSize: titleFontSize });
			} else {
				this.formBuilder.insertFormItem(this.sourceNoActiveConnectionsText, 2, { horizontal: true, titleFontSize: titleFontSize });
			}
			this.formBuilder.removeFormItem(this.sourceDacpacComponent);
			this.dialog.okButton.enabled = this.shouldEnableOkayButton();
		});

		if (this.database) {
			databaseRadioButton.checked = true;
			this.sourceIsDacpac = false;
		} else {
			dacpacRadioButton.checked = true;
			this.sourceIsDacpac = true;
		}
		let flexRadioButtonsModel = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([dacpacRadioButton, databaseRadioButton]
			).component();

		return {
			component: flexRadioButtonsModel,
			title: RadioButtonsLabel
		};
	}

	private async createTargetRadiobuttons(view: azdata.ModelView): Promise<azdata.FormComponent> {
		let dacpacRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				name: 'target',
				label: DacpacRadioButtonLabel
			}).component();

		let databaseRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				name: 'target',
				label: DatabaseRadioButtonLabel
			}).component();

		// show dacpac file browser
		dacpacRadioButton.onDidClick(() => {
			this.targetIsDacpac = true;
			this.formBuilder.removeFormItem(this.targetNoActiveConnectionsText);
			this.formBuilder.removeFormItem(this.targetServerComponent);
			this.formBuilder.removeFormItem(this.targetDatabaseComponent);
			this.formBuilder.addFormItem(this.targetDacpacComponent, { horizontal: true, titleFontSize: titleFontSize });
			this.dialog.okButton.enabled = this.shouldEnableOkayButton();
		});

		// show server and db dropdowns or 'No active connections' text
		databaseRadioButton.onDidClick(() => {
			this.targetIsDacpac = false;
			this.formBuilder.removeFormItem(this.targetDacpacComponent);
			if ((this.targetServerDropdown.value as ConnectionDropdownValue)) {
				this.formBuilder.addFormItem(this.targetServerComponent, { horizontal: true, titleFontSize: titleFontSize });
				this.formBuilder.addFormItem(this.targetDatabaseComponent, { horizontal: true, titleFontSize: titleFontSize });
			} else {
				this.formBuilder.addFormItem(this.targetNoActiveConnectionsText, { horizontal: true, titleFontSize: titleFontSize });
			}
			this.dialog.okButton.enabled = this.shouldEnableOkayButton();
		});

		dacpacRadioButton.checked = true;
		this.targetIsDacpac = true;
		let flexRadioButtonsModel = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([dacpacRadioButton, databaseRadioButton]
			).component();

		return {
			component: flexRadioButtonsModel,
			title: RadioButtonsLabel
		};
	}

	private shouldEnableOkayButton(): boolean {
		let sourcefilled = (this.sourceIsDacpac && this.existsDacpac(this.sourceTextBox.value)) || (!this.sourceIsDacpac && !isNullOrUndefined(this.sourceDatabaseDropdown.value));
		let targetfilled = (this.targetIsDacpac && this.existsDacpac(this.targetTextBox.value)) || (!this.targetIsDacpac && !isNullOrUndefined(this.targetDatabaseDropdown.value));

		return sourcefilled && targetfilled;
	}

	private existsDacpac(filename: string): boolean {
		return !isNullOrUndefined(filename) && existsSync(filename) && (filename.toLocaleLowerCase().endsWith('.dacpac'));
	}

	protected async createSourceServerDropdown(view: azdata.ModelView): Promise<azdata.FormComponent> {
		this.sourceServerDropdown = view.modelBuilder.dropDown().component();
		this.sourceServerDropdown.onValueChanged(async () => {
			await this.populateDatabaseDropdown((this.sourceServerDropdown.value as ConnectionDropdownValue).connection.connectionId, false);
		});

		return {
			component: this.sourceServerDropdown,
			title: ServerDropdownLabel
		};
	}

	protected async createTargetServerDropdown(view: azdata.ModelView): Promise<azdata.FormComponent> {
		this.targetServerDropdown = view.modelBuilder.dropDown().component();
		this.targetServerDropdown.onValueChanged(async () => {
			await this.populateDatabaseDropdown((this.targetServerDropdown.value as ConnectionDropdownValue).connection.connectionId, true);
		});

		return {
			component: this.targetServerDropdown,
			title: ServerDropdownLabel
		};
	}

	protected async populateServerDropdown(isTarget: boolean): Promise<void> {
		let currentDropdown = isTarget ? this.targetServerDropdown : this.sourceServerDropdown;
		let values = await this.getServerValues();

		currentDropdown.updateProperties({
			values: values
		});
	}

	protected async getServerValues(): Promise<{ connection: azdata.connection.Connection, displayName: string, name: string }[]> {
		let cons = await azdata.connection.getActiveConnections();
		// This user has no active connections
		if (!cons || cons.length === 0) {
			return undefined;
		}

		// reverse list so that most recent connections are first
		cons.reverse();

		let count = -1;
		let idx = -1;
		let values = cons.map(c => {
			count++;

			if (c.connectionId === this.connectionId) {
				idx = count;
			}

			let usr = c.options.user;
			let srv = c.options.server;

			if (!usr) {
				usr = localize('schemaCompareDialog.defaultUser', 'default');
			}

			let finalName = `${srv} (${usr})`;
			return {
				connection: c,
				displayName: finalName,
				name: srv
			};
		});

		// move server of current connection to the top of the list so it is the default
		if (idx >= 1) {
			let tmp = values[0];
			values[0] = values[idx];
			values[idx] = tmp;
		}

		values = values.reduce((uniqueValues, conn) => {
			let exists = uniqueValues.find(x => x.displayName === conn.displayName);
			if (!exists) {
				uniqueValues.push(conn);
			}
			return uniqueValues;
		}, []);

		return values;
	}

	protected async createSourceDatabaseDropdown(view: azdata.ModelView): Promise<azdata.FormComponent> {
		this.sourceDatabaseDropdown = view.modelBuilder.dropDown().component();
		this.sourceDatabaseDropdown.onValueChanged(() => {
			this.dialog.okButton.enabled = this.shouldEnableOkayButton();
		});

		return {
			component: this.sourceDatabaseDropdown,
			title: DatabaseDropdownLabel
		};
	}

	protected async createTargetDatabaseDropdown(view: azdata.ModelView): Promise<azdata.FormComponent> {
		this.targetDatabaseDropdown = view.modelBuilder.dropDown().component();
		this.targetDatabaseDropdown.onValueChanged(() => {
			this.dialog.okButton.enabled = this.shouldEnableOkayButton();
		});

		return {
			component: this.targetDatabaseDropdown,
			title: DatabaseDropdownLabel
		};
	}

	protected async populateDatabaseDropdown(connectionId: string, isTarget: boolean): Promise<void> {
		let currentDropdown = isTarget ? this.targetDatabaseDropdown : this.sourceDatabaseDropdown;
		currentDropdown.updateProperties({ values: [] });

		let values = await this.getDatabaseValues(connectionId);
		currentDropdown.updateProperties({
			values: values
		});
	}

	protected async getDatabaseValues(connectionId: string): Promise<{ displayName, name }[]> {
		let idx = -1;
		let count = -1;
		let values = (await azdata.connection.listDatabases(connectionId)).map(db => {
			count++;
			// if schema compare was launched from a db context menu, set that db at the top of the dropdown
			if (this.database && db === this.database) {
				idx = count;
			}

			return {
				displayName: db,
				name: db
			};
		});

		if (idx >= 0) {
			let tmp = values[0];
			values[0] = values[idx];
			values[idx] = tmp;
		}
		return values;
	}

	protected async createNoActiveConnectionsText(view: azdata.ModelView): Promise<azdata.FormComponent> {
		let noActiveConnectionsText = view.modelBuilder.text().withProperties({ value: NoActiveConnectionsLabel }).component();

		return {
			component: noActiveConnectionsText,
			title: ''
		};
	}
}

interface ConnectionDropdownValue extends azdata.CategoryValue {
	connection: azdata.connection.Connection;
}