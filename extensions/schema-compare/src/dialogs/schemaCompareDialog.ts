/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../localizedConstants';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { TelemetryReporter, TelemetryViews } from '../telemetry';
import { getEndpointName, getRootPath, exists } from '../utils';
import * as mssql from '../../../mssql';

const titleFontSize: number = 13;

interface Deferred<T> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: any) => void;
}
export class SchemaCompareDialog {
	public dialog: azdata.window.Dialog;
	public dialogName: string;
	private sourceDacpacRadioButton: azdata.RadioButtonComponent;
	private sourceDatabaseRadioButton: azdata.RadioButtonComponent;
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
	private connectionId: string;
	private sourceDbEditable: string;
	private targetDbEditable: string;
	private previousSource: mssql.SchemaCompareEndpointInfo;
	private previousTarget: mssql.SchemaCompareEndpointInfo;
	private initDialogComplete: Deferred<void>;
	private initDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.initDialogComplete = { resolve, reject });

	constructor(private schemaCompareMainWindow: SchemaCompareMainWindow, private view?: azdata.ModelView) {
		this.previousSource = schemaCompareMainWindow.sourceEndpointInfo;
		this.previousTarget = schemaCompareMainWindow.targetEndpointInfo;
	}

	protected async initializeDialog(): Promise<void> {
		this.schemaCompareTab = azdata.window.createTab(loc.SchemaCompareLabel);
		await this.initializeSchemaCompareTab();
		this.dialog.content = [this.schemaCompareTab];
	}

	public async openDialog(): Promise<void> {
		// connection to use if schema compare wasn't launched from a database or no previous source/target
		let connection = await azdata.connection.getCurrentConnection();
		if (connection) {
			this.connectionId = connection.connectionId;
		}

		this.dialog = azdata.window.createModelViewDialog(loc.SchemaCompareLabel);
		await this.initializeDialog();

		this.dialog.okButton.label = loc.OkButtonText;
		this.dialog.okButton.enabled = false;
		this.dialog.okButton.onClick(async () => await this.execute());

		this.dialog.cancelButton.label = loc.CancelButtonText;
		this.dialog.cancelButton.onClick(async () => await this.cancel());

		azdata.window.openDialog(this.dialog);
		await this.initDialogPromise;
	}

	public async execute(): Promise<void> {
		if (this.sourceIsDacpac) {
			this.schemaCompareMainWindow.sourceEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Dacpac,
				serverDisplayName: '',
				serverName: '',
				databaseName: '',
				ownerUri: '',
				packageFilePath: this.sourceTextBox.value,
				connectionDetails: undefined
			};
		} else {
			let ownerUri = await azdata.connection.getUriForConnection((this.sourceServerDropdown.value as ConnectionDropdownValue).connection.connectionId);

			this.schemaCompareMainWindow.sourceEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Database,
				serverDisplayName: (this.sourceServerDropdown.value as ConnectionDropdownValue).displayName,
				serverName: (this.sourceServerDropdown.value as ConnectionDropdownValue).name,
				databaseName: this.sourceDatabaseDropdown.value.toString(),
				ownerUri: ownerUri,
				packageFilePath: '',
				connectionDetails: undefined
			};
		}

		if (this.targetIsDacpac) {
			this.schemaCompareMainWindow.targetEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Dacpac,
				serverDisplayName: '',
				serverName: '',
				databaseName: '',
				ownerUri: '',
				packageFilePath: this.targetTextBox.value,
				connectionDetails: undefined
			};
		} else {
			let ownerUri = await azdata.connection.getUriForConnection((this.targetServerDropdown.value as ConnectionDropdownValue).connection.connectionId);

			this.schemaCompareMainWindow.targetEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Database,
				serverDisplayName: (this.targetServerDropdown.value as ConnectionDropdownValue).displayName,
				serverName: (this.targetServerDropdown.value as ConnectionDropdownValue).name,
				databaseName: this.targetDatabaseDropdown.value.toString(),
				ownerUri: ownerUri,
				packageFilePath: '',
				connectionDetails: undefined
			};
		}

		TelemetryReporter.createActionEvent(TelemetryViews.SchemaCompareDialog, 'SchemaCompareStart')
			.withAdditionalProperties({
				sourceIsDacpac: this.sourceIsDacpac.toString(),
				targetIsDacpac: this.targetIsDacpac.toString()
			}).send();

		// update source and target values that are displayed
		this.schemaCompareMainWindow.updateSourceAndTarget();

		const sourceEndpointChanged = this.endpointChanged(this.previousSource, this.schemaCompareMainWindow.sourceEndpointInfo);
		const targetEndpointChanged = this.endpointChanged(this.previousTarget, this.schemaCompareMainWindow.targetEndpointInfo);

		// show recompare message if it isn't the initial population of source and target
		if (this.previousSource && this.previousTarget
			&& (sourceEndpointChanged || targetEndpointChanged)) {
			this.schemaCompareMainWindow.setButtonsForRecompare();

			let message = loc.differentSourceMessage;
			if (sourceEndpointChanged && targetEndpointChanged) {
				message = loc.differentSourceTargetMessage;
			} else if (targetEndpointChanged) {
				message = loc.differentTargetMessage;
			}

			vscode.window.showWarningMessage(message, loc.YesButtonText, loc.NoButtonText).then((result) => {
				if (result === loc.YesButtonText) {
					this.schemaCompareMainWindow.startCompare();
				}
			});
		}
	}

	private endpointChanged(previousEndpoint: mssql.SchemaCompareEndpointInfo, updatedEndpoint: mssql.SchemaCompareEndpointInfo): boolean {
		if (previousEndpoint && updatedEndpoint) {
			return getEndpointName(previousEndpoint).toLowerCase() !== getEndpointName(updatedEndpoint).toLowerCase()
				|| (previousEndpoint.serverDisplayName && updatedEndpoint.serverDisplayName && previousEndpoint.serverDisplayName.toLowerCase() !== updatedEndpoint.serverDisplayName.toLowerCase());
		}
		return false;
	}

	protected async cancel(): Promise<void> {
	}

	private async initializeSchemaCompareTab(): Promise<void> {
		this.schemaCompareTab.registerContent(async view => {
			if (isNullOrUndefined(this.view)) {
				this.view = view;
			}

			this.sourceTextBox = this.view.modelBuilder.inputBox().withProperties({
				value: this.schemaCompareMainWindow.sourceEndpointInfo ? this.schemaCompareMainWindow.sourceEndpointInfo.packageFilePath : '',
				width: 275,
				ariaLabel: loc.sourceFile
			}).component();

			this.sourceTextBox.onTextChanged(async (e) => {
				this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
			});

			this.targetTextBox = this.view.modelBuilder.inputBox().withProperties({
				value: this.schemaCompareMainWindow.targetEndpointInfo ? this.schemaCompareMainWindow.targetEndpointInfo.packageFilePath : '',
				width: 275,
				ariaLabel: loc.targetFile
			}).component();

			this.targetTextBox.onTextChanged(async () => {
				this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
			});

			this.sourceServerComponent = await this.createSourceServerDropdown();
			await this.populateServerDropdown(false);

			this.sourceDatabaseComponent = await this.createSourceDatabaseDropdown();
			if ((this.sourceServerDropdown.value as ConnectionDropdownValue)) {
				await this.populateDatabaseDropdown((this.sourceServerDropdown.value as ConnectionDropdownValue).connection, false);
			}

			this.targetServerComponent = await this.createTargetServerDropdown();
			await this.populateServerDropdown(true);

			this.targetDatabaseComponent = await this.createTargetDatabaseDropdown();
			if ((this.targetServerDropdown.value as ConnectionDropdownValue)) {
				await this.populateDatabaseDropdown((this.targetServerDropdown.value as ConnectionDropdownValue).connection, true);
			}

			this.sourceDacpacComponent = await this.createFileBrowser(false, this.schemaCompareMainWindow.sourceEndpointInfo);
			this.targetDacpacComponent = await this.createFileBrowser(true, this.schemaCompareMainWindow.targetEndpointInfo);

			let sourceRadioButtons = await this.createSourceRadiobuttons();
			let targetRadioButtons = await this.createTargetRadiobuttons();

			this.sourceNoActiveConnectionsText = await this.createNoActiveConnectionsText();
			this.targetNoActiveConnectionsText = await this.createNoActiveConnectionsText();

			let sourceComponents = [];
			let targetComponents = [];

			// start source and target with either dacpac or database selection based on what the previous value was
			if (this.schemaCompareMainWindow.sourceEndpointInfo && this.schemaCompareMainWindow.sourceEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
				sourceComponents = [
					sourceRadioButtons,
					this.sourceServerComponent,
					this.sourceDatabaseComponent
				];
			} else {
				sourceComponents = [
					sourceRadioButtons,
					this.sourceDacpacComponent,
				];
			}

			if (this.schemaCompareMainWindow.targetEndpointInfo && this.schemaCompareMainWindow.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
				targetComponents = [
					targetRadioButtons,
					this.targetServerComponent,
					this.targetDatabaseComponent
				];
			} else {
				targetComponents = [
					targetRadioButtons,
					this.targetDacpacComponent,
				];
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
			if (this.sourceIsDacpac) {
				await this.sourceDacpacRadioButton.focus();
			} else {
				await this.sourceDatabaseRadioButton.focus();
			}
			this.initDialogComplete.resolve();
		});
	}

	private createFileBrowser(isTarget: boolean, endpoint: mssql.SchemaCompareEndpointInfo): azdata.FormComponent {
		let currentTextbox = isTarget ? this.targetTextBox : this.sourceTextBox;
		if (isTarget) {
			this.targetFileButton = this.view.modelBuilder.button().withProperties({
				label: '•••',
				title: loc.selectTargetFile,
				ariaLabel: loc.selectTargetFile
			}).component();
		} else {
			this.sourceFileButton = this.view.modelBuilder.button().withProperties({
				label: '•••',
				title: loc.selectSourceFile,
				ariaLabel: loc.selectSourceFile
			}).component();
		}

		let currentButton = isTarget ? this.targetFileButton : this.sourceFileButton;

		currentButton.onDidClick(async (click) => {
			// file browser should open where the current dacpac is or the appropriate default folder
			let rootPath = getRootPath();
			let defaultUri = endpoint && endpoint.packageFilePath && await exists(endpoint.packageFilePath) ? endpoint.packageFilePath : rootPath;

			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(defaultUri),
					openLabel: loc.open,
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
			title: loc.FileTextBoxLabel,
			actions: [currentButton]
		};
	}

	private createSourceRadiobuttons(): azdata.FormComponent {
		this.sourceDacpacRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'source',
				label: loc.DacpacRadioButtonLabel
			}).component();

		this.sourceDatabaseRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'source',
				label: loc.DatabaseRadioButtonLabel
			}).component();

		// show dacpac file browser
		this.sourceDacpacRadioButton.onDidClick(async () => {
			this.sourceIsDacpac = true;
			this.formBuilder.removeFormItem(this.sourceNoActiveConnectionsText);
			this.formBuilder.removeFormItem(this.sourceServerComponent);
			this.formBuilder.removeFormItem(this.sourceDatabaseComponent);
			this.formBuilder.insertFormItem(this.sourceDacpacComponent, 2, { horizontal: true, titleFontSize: titleFontSize });
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		// show server and db dropdowns or 'No active connections' text
		this.sourceDatabaseRadioButton.onDidClick(async () => {
			this.sourceIsDacpac = false;
			if ((this.sourceServerDropdown.value as ConnectionDropdownValue)) {
				this.formBuilder.insertFormItem(this.sourceServerComponent, 2, { horizontal: true, titleFontSize: titleFontSize });
				this.formBuilder.insertFormItem(this.sourceDatabaseComponent, 3, { horizontal: true, titleFontSize: titleFontSize });
			} else {
				this.formBuilder.insertFormItem(this.sourceNoActiveConnectionsText, 2, { horizontal: true, titleFontSize: titleFontSize });
			}
			this.formBuilder.removeFormItem(this.sourceDacpacComponent);
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		// if source is currently a db, show it in the server and db dropdowns
		if (this.schemaCompareMainWindow.sourceEndpointInfo && this.schemaCompareMainWindow.sourceEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
			this.sourceDatabaseRadioButton.checked = true;
			this.sourceIsDacpac = false;
		} else {
			this.sourceDacpacRadioButton.checked = true;
			this.sourceIsDacpac = true;
		}
		let flexRadioButtonsModel = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([this.sourceDacpacRadioButton, this.sourceDatabaseRadioButton])
			.withProperties({ ariaRole: 'radiogroup' })
			.component();

		return {
			component: flexRadioButtonsModel,
			title: loc.RadioButtonsLabel
		};
	}

	private createTargetRadiobuttons(): azdata.FormComponent {
		let dacpacRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'target',
				label: loc.DacpacRadioButtonLabel
			}).component();

		let databaseRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'target',
				label: loc.DatabaseRadioButtonLabel
			}).component();

		// show dacpac file browser
		dacpacRadioButton.onDidClick(async () => {
			this.targetIsDacpac = true;
			this.formBuilder.removeFormItem(this.targetNoActiveConnectionsText);
			this.formBuilder.removeFormItem(this.targetServerComponent);
			this.formBuilder.removeFormItem(this.targetDatabaseComponent);
			this.formBuilder.addFormItem(this.targetDacpacComponent, { horizontal: true, titleFontSize: titleFontSize });
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		// show server and db dropdowns or 'No active connections' text
		databaseRadioButton.onDidClick(async () => {
			this.targetIsDacpac = false;
			this.formBuilder.removeFormItem(this.targetDacpacComponent);
			if ((this.targetServerDropdown.value as ConnectionDropdownValue)) {
				this.formBuilder.addFormItem(this.targetServerComponent, { horizontal: true, titleFontSize: titleFontSize });
				this.formBuilder.addFormItem(this.targetDatabaseComponent, { horizontal: true, titleFontSize: titleFontSize });
			} else {
				this.formBuilder.addFormItem(this.targetNoActiveConnectionsText, { horizontal: true, titleFontSize: titleFontSize });
			}
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		// if target is currently a db, show it in the server and db dropdowns
		if (this.schemaCompareMainWindow.targetEndpointInfo && this.schemaCompareMainWindow.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
			databaseRadioButton.checked = true;
			this.targetIsDacpac = false;
		} else {
			dacpacRadioButton.checked = true;
			this.targetIsDacpac = true;
		}

		let flexRadioButtonsModel = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([dacpacRadioButton, databaseRadioButton]
			)
			.withProperties({ ariaRole: 'radiogroup' })
			.component();

		return {
			component: flexRadioButtonsModel,
			title: loc.RadioButtonsLabel
		};
	}

	private async shouldEnableOkayButton(): Promise<boolean> {

		let sourcefilled = (this.sourceIsDacpac && await this.existsDacpac(this.sourceTextBox.value))
			|| (!this.sourceIsDacpac && !isNullOrUndefined(this.sourceDatabaseDropdown.value) && this.sourceDatabaseDropdown.values.findIndex(x => this.matchesValue(x, this.sourceDbEditable)) !== -1);
		let targetfilled = (this.targetIsDacpac && await this.existsDacpac(this.targetTextBox.value))
			|| (!this.targetIsDacpac && !isNullOrUndefined(this.targetDatabaseDropdown.value) && this.targetDatabaseDropdown.values.findIndex(x => this.matchesValue(x, this.targetDbEditable)) !== -1);

		return sourcefilled && targetfilled;
	}

	private async existsDacpac(filename: string): Promise<boolean> {
		return !isNullOrUndefined(filename) && await exists(filename) && (filename.toLocaleLowerCase().endsWith('.dacpac'));
	}

	protected createSourceServerDropdown(): azdata.FormComponent {
		this.sourceServerDropdown = this.view.modelBuilder.dropDown().withProperties(
			{
				editable: true,
				fireOnTextChange: true,
				ariaLabel: loc.sourceServer
			}
		).component();
		this.sourceServerDropdown.onValueChanged(async (value) => {
			if (this.sourceServerDropdown.values.findIndex(x => this.matchesValue(x, value)) === -1) {
				await this.sourceDatabaseDropdown.updateProperties({
					values: [],
					value: '  '
				});
			}
			else {
				await this.populateDatabaseDropdown((this.sourceServerDropdown.value as ConnectionDropdownValue).connection, false);
			}
		});

		return {
			component: this.sourceServerDropdown,
			title: loc.ServerDropdownLabel
		};
	}

	protected createTargetServerDropdown(): azdata.FormComponent {
		this.targetServerDropdown = this.view.modelBuilder.dropDown().withProperties(
			{
				editable: true,
				fireOnTextChange: true,
				ariaLabel: loc.targetServer
			}
		).component();
		this.targetServerDropdown.onValueChanged(async (value) => {
			if (this.targetServerDropdown.values.findIndex(x => this.matchesValue(x, value)) === -1) {
				await this.targetDatabaseDropdown.updateProperties({
					values: [],
					value: '  '
				});
			}
			else {
				await this.populateDatabaseDropdown((this.targetServerDropdown.value as ConnectionDropdownValue).connection, true);
			}
		});

		return {
			component: this.targetServerDropdown,
			title: loc.ServerDropdownLabel
		};
	}

	protected async populateServerDropdown(isTarget: boolean): Promise<void> {
		let currentDropdown = isTarget ? this.targetServerDropdown : this.sourceServerDropdown;
		let values = await this.getServerValues(isTarget);

		if (values && values.length > 0) {
			await currentDropdown.updateProperties({
				values: values,
				value: values[0]
			});
		}
	}

	protected async getServerValues(isTarget: boolean): Promise<{ connection: azdata.connection.ConnectionProfile, displayName: string, name: string }[]> {
		let cons = await azdata.connection.getConnections(/* activeConnectionsOnly */ true);
		// This user has no active connections
		if (!cons || cons.length === 0) {
			return undefined;
		}

		let endpointInfo = isTarget ? this.schemaCompareMainWindow.targetEndpointInfo : this.schemaCompareMainWindow.sourceEndpointInfo;
		// reverse list so that most recent connections are first
		cons.reverse();

		let count = -1;
		let idx = -1;
		let values = cons.map(c => {
			count++;

			let usr = c.options.user;
			let srv = c.options.server;

			if (!usr) {
				usr = loc.defaultText;
			}

			let finalName = `${srv} (${usr})`;
			// use previously selected server or current connection if there is one
			if (endpointInfo && !isNullOrUndefined(endpointInfo.serverName) && !isNullOrUndefined(endpointInfo.serverDisplayName)
				&& c.options.server.toLowerCase() === endpointInfo.serverName.toLowerCase()
				&& finalName.toLowerCase() === endpointInfo.serverDisplayName.toLowerCase()) {
				idx = count;
			}
			else if (c.connectionId === this.connectionId) {
				idx = count;
			}

			return {
				connection: c,
				displayName: finalName,
				name: srv,
				user: usr
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

	protected createSourceDatabaseDropdown(): azdata.FormComponent {
		this.sourceDatabaseDropdown = this.view.modelBuilder.dropDown().withProperties(
			{
				editable: true,
				fireOnTextChange: true,
				ariaLabel: loc.sourceDatabase
			}
		).component();
		this.sourceDatabaseDropdown.onValueChanged(async (value) => {
			this.sourceDbEditable = value;
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		return {
			component: this.sourceDatabaseDropdown,
			title: loc.DatabaseDropdownLabel
		};
	}

	protected createTargetDatabaseDropdown(): azdata.FormComponent {
		this.targetDatabaseDropdown = this.view.modelBuilder.dropDown().withProperties(
			{
				editable: true,
				fireOnTextChange: true,
				ariaLabel: loc.targetDatabase
			}
		).component();
		this.targetDatabaseDropdown.onValueChanged(async (value) => {
			this.targetDbEditable = value;
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		return {
			component: this.targetDatabaseDropdown,
			title: loc.DatabaseDropdownLabel
		};
	}

	private matchesValue(listValue: any, value: string): boolean {
		return listValue.displayName === value || listValue === value;
	}

	protected async populateDatabaseDropdown(connectionProfile: azdata.connection.ConnectionProfile, isTarget: boolean): Promise<void> {
		let currentDropdown = isTarget ? this.targetDatabaseDropdown : this.sourceDatabaseDropdown;
		await currentDropdown.updateProperties({ values: [], value: null });

		let values = [];
		try {
			values = await this.getDatabaseValues(connectionProfile.connectionId, isTarget);
		} catch (e) {
			// if the user doesn't have access to master, just set the database of the connection profile
			values = [connectionProfile.databaseName];
			console.warn(e);
		}
		if (values && values.length > 0) {
			await currentDropdown.updateProperties({
				values: values,
				value: values[0],
			});
		}
	}

	protected async getDatabaseValues(connectionId: string, isTarget: boolean): Promise<string[]> {
		let endpointInfo = isTarget ? this.schemaCompareMainWindow.targetEndpointInfo : this.schemaCompareMainWindow.sourceEndpointInfo;

		let idx = -1;
		let count = -1;
		let values = (await azdata.connection.listDatabases(connectionId)).sort((a, b) => a.localeCompare(b)).map(db => {
			count++;

			// put currently selected db at the top of the dropdown if there is one
			if (endpointInfo && endpointInfo.databaseName !== null
				&& db === endpointInfo.databaseName) {
				idx = count;
			}

			return db;
		});

		if (idx >= 0) {
			let tmp = values[0];
			values[0] = values[idx];
			values[idx] = tmp;
		}
		return values;
	}

	protected createNoActiveConnectionsText(): azdata.FormComponent {
		let noActiveConnectionsText = this.view.modelBuilder.text().withProperties({ value: loc.NoActiveConnectionsLabel }).component();

		return {
			component: noActiveConnectionsText,
			title: ''
		};
	}
}

interface ConnectionDropdownValue extends azdata.CategoryValue {
	connection: azdata.connection.ConnectionProfile;
}

function isNullOrUndefined(val: any): boolean {
	return val === null || val === undefined;
}
