/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as os from 'os';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { promises as fs } from 'fs';
import { Telemetry } from '../telemetry';
import { getEndpointName } from '../utils';
import * as mssql from '../../../mssql';

const localize = nls.loadMessageBundle();
const OkButtonText: string = localize('schemaCompareDialog.ok', 'OK');
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
const differentSourceMessage: string = localize('schemaCompareDialog.differentSourceMessage', 'A different source schema has been selected. Compare to see the comparison?');
const differentTargetMessage: string = localize('schemaCompareDialog.differentTargetMessage', 'A different target schema has been selected. Compare to see the comparison?');
const differentSourceTargetMessage: string = localize('schemaCompareDialog.differentSourceTargetMessage', 'Different source and target schemas have been selected. Compare to see the comparison?');
const YesButtonText: string = localize('schemaCompareDialog.Yes', 'Yes');
const NoButtonText: string = localize('schemaCompareDialog.No', 'No');
const titleFontSize: number = 13;

async function exists(path: string): Promise<boolean> {
	try {
		await fs.access(path);
		return true;
	} catch (e) {
		return false;
	}
}

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
	private connectionId: string;
	private sourceDbEditable: string;
	private targetDbEditable: string;
	private previousSource: mssql.SchemaCompareEndpointInfo;
	private previousTarget: mssql.SchemaCompareEndpointInfo;

	constructor(private schemaCompareResult: SchemaCompareMainWindow) {
		this.previousSource = schemaCompareResult.sourceEndpointInfo;
		this.previousTarget = schemaCompareResult.targetEndpointInfo;
	}

	protected initializeDialog(): void {
		this.schemaCompareTab = azdata.window.createTab(SchemaCompareLabel);
		this.initializeSchemaCompareTab();
		this.dialog.content = [this.schemaCompareTab];
	}

	public async openDialog(): Promise<void> {
		// connection to use if schema compare wasn't launched from a database or no previous source/target
		let connection = await azdata.connection.getCurrentConnection();
		if (connection) {
			this.connectionId = connection.connectionId;
		}

		this.dialog = azdata.window.createModelViewDialog(SchemaCompareLabel);
		this.initializeDialog();

		this.dialog.okButton.label = OkButtonText;
		this.dialog.okButton.enabled = false;
		this.dialog.okButton.onClick(async () => await this.execute());

		this.dialog.cancelButton.label = CancelButtonText;
		this.dialog.cancelButton.onClick(async () => await this.cancel());

		azdata.window.openDialog(this.dialog);
	}

	protected async execute(): Promise<void> {
		if (this.sourceIsDacpac) {
			this.schemaCompareResult.sourceEndpointInfo = {
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

			this.schemaCompareResult.sourceEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Database,
				serverDisplayName: (this.sourceServerDropdown.value as ConnectionDropdownValue).displayName,
				serverName: (this.sourceServerDropdown.value as ConnectionDropdownValue).name,
				databaseName: (<azdata.CategoryValue>this.sourceDatabaseDropdown.value).name,
				ownerUri: ownerUri,
				packageFilePath: '',
				connectionDetails: undefined
			};
		}

		if (this.targetIsDacpac) {
			this.schemaCompareResult.targetEndpointInfo = {
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

			this.schemaCompareResult.targetEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Database,
				serverDisplayName: (this.targetServerDropdown.value as ConnectionDropdownValue).displayName,
				serverName: (this.targetServerDropdown.value as ConnectionDropdownValue).name,
				databaseName: (<azdata.CategoryValue>this.targetDatabaseDropdown.value).name,
				ownerUri: ownerUri,
				packageFilePath: '',
				connectionDetails: undefined
			};
		}

		Telemetry.sendTelemetryEvent('SchemaCompareStart', {
			'sourceIsDacpac': this.sourceIsDacpac.toString(),
			'targetIsDacpac': this.targetIsDacpac.toString()
		});

		// update source and target values that are displayed
		this.schemaCompareResult.updateSourceAndTarget();

		const sourceEndpointChanged = this.endpointChanged(this.previousSource, this.schemaCompareResult.sourceEndpointInfo);
		const targetEndpointChanged = this.endpointChanged(this.previousTarget, this.schemaCompareResult.targetEndpointInfo);

		// show recompare message if it isn't the initial population of source and target
		if (this.previousSource && this.previousTarget
			&& (sourceEndpointChanged || targetEndpointChanged)) {
			this.schemaCompareResult.setButtonsForRecompare();

			let message = differentSourceMessage;
			if (sourceEndpointChanged && targetEndpointChanged) {
				message = differentSourceTargetMessage;
			} else if (targetEndpointChanged) {
				message = differentTargetMessage;
			}

			vscode.window.showWarningMessage(message, YesButtonText, NoButtonText).then((result) => {
				if (result === YesButtonText) {
					this.schemaCompareResult.startCompare();
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

	private initializeSchemaCompareTab(): void {
		this.schemaCompareTab.registerContent(async view => {
			this.sourceTextBox = view.modelBuilder.inputBox().withProperties({
				value: this.schemaCompareResult.sourceEndpointInfo ? this.schemaCompareResult.sourceEndpointInfo.packageFilePath : '',
				width: 275,
				ariaLabel: localize('schemaCompareDialog.sourceTextBox', "Source file")
			}).component();

			this.sourceTextBox.onTextChanged(async (e) => {
				this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
			});

			this.targetTextBox = view.modelBuilder.inputBox().withProperties({
				value: this.schemaCompareResult.targetEndpointInfo ? this.schemaCompareResult.targetEndpointInfo.packageFilePath : '',
				width: 275,
				ariaLabel: localize('schemaCompareDialog.targetTextBox', "Target file")
			}).component();

			this.targetTextBox.onTextChanged(async () => {
				this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
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

			this.sourceDacpacComponent = await this.createFileBrowser(view, false, this.schemaCompareResult.sourceEndpointInfo);
			this.targetDacpacComponent = await this.createFileBrowser(view, true, this.schemaCompareResult.targetEndpointInfo);

			let sourceRadioButtons = await this.createSourceRadiobuttons(view);
			let targetRadioButtons = await this.createTargetRadiobuttons(view);

			this.sourceNoActiveConnectionsText = await this.createNoActiveConnectionsText(view);
			this.targetNoActiveConnectionsText = await this.createNoActiveConnectionsText(view);

			let sourceComponents = [];
			let targetComponents = [];

			// start source and target with either dacpac or database selection based on what the previous value was
			if (this.schemaCompareResult.sourceEndpointInfo && this.schemaCompareResult.sourceEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
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

			if (this.schemaCompareResult.targetEndpointInfo && this.schemaCompareResult.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
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

			this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: SourceTitle,
						components: sourceComponents
					}, {
						title: TargetTitle,
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
			await view.initializeModel(formModel);
		});
	}

	private async createFileBrowser(view: azdata.ModelView, isTarget: boolean, endpoint: mssql.SchemaCompareEndpointInfo): Promise<azdata.FormComponent> {
		let currentTextbox = isTarget ? this.targetTextBox : this.sourceTextBox;
		if (isTarget) {
			this.targetFileButton = view.modelBuilder.button().withProperties({
				label: '•••',
				title: localize('schemaCompare.selectTargetFile', "Select target file"),
				ariaLabel: localize('schemaCompare.selectTargetFile', "Select target file")
			}).component();
		} else {
			this.sourceFileButton = view.modelBuilder.button().withProperties({
				label: '•••',
				title: localize('schemaCompare.selectSourceFile', "Select source file"),
				ariaLabel: localize('schemaCompare.selectSourceFile', "Select source file")
			}).component();
		}

		let currentButton = isTarget ? this.targetFileButton : this.sourceFileButton;

		currentButton.onDidClick(async (click) => {
			// file browser should open where the current dacpac is or the appropriate default folder
			let rootPath = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].name : os.homedir();
			let defaultUri = endpoint && endpoint.packageFilePath && await exists(endpoint.packageFilePath) ? endpoint.packageFilePath : rootPath;

			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(defaultUri),
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
		dacpacRadioButton.onDidClick(async () => {
			this.sourceIsDacpac = true;
			this.formBuilder.removeFormItem(this.sourceNoActiveConnectionsText);
			this.formBuilder.removeFormItem(this.sourceServerComponent);
			this.formBuilder.removeFormItem(this.sourceDatabaseComponent);
			this.formBuilder.insertFormItem(this.sourceDacpacComponent, 2, { horizontal: true, titleFontSize: titleFontSize });
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		// show server and db dropdowns or 'No active connections' text
		databaseRadioButton.onDidClick(async () => {
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
		if (this.schemaCompareResult.sourceEndpointInfo && this.schemaCompareResult.sourceEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
			databaseRadioButton.checked = true;
			databaseRadioButton.focused = true;
			this.sourceIsDacpac = false;
		} else {
			dacpacRadioButton.checked = true;
			dacpacRadioButton.focused = true;
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
		if (this.schemaCompareResult.targetEndpointInfo && this.schemaCompareResult.targetEndpointInfo.endpointType === mssql.SchemaCompareEndpointType.Database) {
			databaseRadioButton.checked = true;
			this.targetIsDacpac = false;
		} else {
			dacpacRadioButton.checked = true;
			this.targetIsDacpac = true;
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

	protected async createSourceServerDropdown(view: azdata.ModelView): Promise<azdata.FormComponent> {
		this.sourceServerDropdown = view.modelBuilder.dropDown().withProperties(
			{
				editable: true,
				fireOnTextChange: true,
				ariaLabel: localize('schemaCompareDialog.sourceServerDropdown', "Source Server")
			}
		).component();
		this.sourceServerDropdown.onValueChanged(async (value) => {
			if (this.sourceServerDropdown.values.findIndex(x => this.matchesValue(x, value)) === -1) {
				this.sourceDatabaseDropdown.updateProperties({
					values: [],
					value: '  '
				});
			}
			else {
				await this.populateDatabaseDropdown((this.sourceServerDropdown.value as ConnectionDropdownValue).connection.connectionId, false);
			}
		});

		return {
			component: this.sourceServerDropdown,
			title: ServerDropdownLabel
		};
	}

	protected async createTargetServerDropdown(view: azdata.ModelView): Promise<azdata.FormComponent> {
		this.targetServerDropdown = view.modelBuilder.dropDown().withProperties(
			{
				editable: true,
				fireOnTextChange: true,
				ariaLabel: localize('schemaCompareDialog.targetServerDropdown', "Target Server")
			}
		).component();
		this.targetServerDropdown.onValueChanged(async (value) => {
			if (this.targetServerDropdown.values.findIndex(x => this.matchesValue(x, value)) === -1) {
				this.targetDatabaseDropdown.updateProperties({
					values: [],
					value: '  '
				});
			}
			else {
				await this.populateDatabaseDropdown((this.targetServerDropdown.value as ConnectionDropdownValue).connection.connectionId, true);
			}
		});

		return {
			component: this.targetServerDropdown,
			title: ServerDropdownLabel
		};
	}

	protected async populateServerDropdown(isTarget: boolean): Promise<void> {
		let currentDropdown = isTarget ? this.targetServerDropdown : this.sourceServerDropdown;
		let values = await this.getServerValues(isTarget);

		if (values && values.length > 0) {
			currentDropdown.updateProperties({
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

		let endpointInfo = isTarget ? this.schemaCompareResult.targetEndpointInfo : this.schemaCompareResult.sourceEndpointInfo;
		// reverse list so that most recent connections are first
		cons.reverse();

		let count = -1;
		let idx = -1;
		let values = cons.map(c => {
			count++;

			let usr = c.options.user;
			let srv = c.options.server;

			if (!usr) {
				usr = localize('schemaCompareDialog.defaultUser', 'default');
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

	protected async createSourceDatabaseDropdown(view: azdata.ModelView): Promise<azdata.FormComponent> {
		this.sourceDatabaseDropdown = view.modelBuilder.dropDown().withProperties(
			{
				editable: true,
				fireOnTextChange: true,
				ariaLabel: localize('schemaCompareDialog.sourceDatabaseDropdown', "Source Database")
			}
		).component();
		this.sourceDatabaseDropdown.onValueChanged(async (value) => {
			this.sourceDbEditable = value;
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		return {
			component: this.sourceDatabaseDropdown,
			title: DatabaseDropdownLabel
		};
	}

	protected async createTargetDatabaseDropdown(view: azdata.ModelView): Promise<azdata.FormComponent> {
		this.targetDatabaseDropdown = view.modelBuilder.dropDown().withProperties(
			{
				editable: true,
				fireOnTextChange: true,
				ariaLabel: localize('schemaCompareDialog.targetDatabaseDropdown', "Target Database")
			}
		).component();
		this.targetDatabaseDropdown.onValueChanged(async (value) => {
			this.targetDbEditable = value;
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		return {
			component: this.targetDatabaseDropdown,
			title: DatabaseDropdownLabel
		};
	}

	private matchesValue(listValue: any, value: string): boolean {
		return listValue.displayName === value || listValue === value;
	}

	protected async populateDatabaseDropdown(connectionId: string, isTarget: boolean): Promise<void> {
		let currentDropdown = isTarget ? this.targetDatabaseDropdown : this.sourceDatabaseDropdown;
		currentDropdown.updateProperties({ values: [], value: null });

		let values = await this.getDatabaseValues(connectionId, isTarget);
		if (values && values.length > 0) {
			currentDropdown.updateProperties({
				values: values,
				value: values[0],
			});
		}
	}

	protected async getDatabaseValues(connectionId: string, isTarget: boolean): Promise<{ displayName, name }[]> {
		let endpointInfo = isTarget ? this.schemaCompareResult.targetEndpointInfo : this.schemaCompareResult.sourceEndpointInfo;

		let idx = -1;
		let count = -1;
		let values = (await azdata.connection.listDatabases(connectionId)).sort((a, b) => a.localeCompare(b)).map(db => {
			count++;

			// put currently selected db at the top of the dropdown if there is one
			if (endpointInfo && endpointInfo.databaseName !== null
				&& db === endpointInfo.databaseName) {
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
	connection: azdata.connection.ConnectionProfile;
}

function isNullOrUndefined(val: any): boolean {
	return val === null || val === undefined;
}
