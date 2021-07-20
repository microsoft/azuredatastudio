/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../localizedConstants';
import * as path from 'path';
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
	protected sourceServerDropdown: azdata.DropDownComponent;
	private sourceConnectionButton: azdata.ButtonComponent;
	private sourceDatabaseComponent: azdata.FormComponent;
	private sourceDatabaseDropdown: azdata.DropDownComponent;
	private targetDacpacComponent: azdata.FormComponent;
	private targetTextBox: azdata.InputBoxComponent;
	private targetFileButton: azdata.ButtonComponent;
	private targetServerComponent: azdata.FormComponent;
	protected targetServerDropdown: azdata.DropDownComponent;
	private targetConnectionButton: azdata.ButtonComponent;
	private targetDatabaseComponent: azdata.FormComponent;
	private targetDatabaseDropdown: azdata.DropDownComponent;
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

	private textBoxWidth: number = 280;

	public promise;
	public promise2;

	constructor(private schemaCompareMainWindow: SchemaCompareMainWindow, private view?: azdata.ModelView, private extensionContext?: vscode.ExtensionContext) {
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
			const sourceServerDropdownValue = this.sourceServerDropdown.value as ConnectionDropdownValue;
			const ownerUri = await azdata.connection.getUriForConnection(sourceServerDropdownValue.connection.connectionId);

			this.schemaCompareMainWindow.sourceEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Database,
				serverDisplayName: sourceServerDropdownValue.displayName,
				serverName: sourceServerDropdownValue.name,
				databaseName: this.sourceDatabaseDropdown.value.toString(),
				ownerUri: ownerUri,
				packageFilePath: '',
				connectionDetails: undefined,
				connectionName: sourceServerDropdownValue.connection.options.connectionName
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
			const targetServerDropdownValue = this.targetServerDropdown.value as ConnectionDropdownValue;
			const ownerUri = await azdata.connection.getUriForConnection(targetServerDropdownValue.connection.connectionId);

			this.schemaCompareMainWindow.targetEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Database,
				serverDisplayName: targetServerDropdownValue.displayName,
				serverName: targetServerDropdownValue.name,
				databaseName: this.targetDatabaseDropdown.value.toString(),
				ownerUri: ownerUri,
				packageFilePath: '',
				connectionDetails: undefined,
				connectionName: targetServerDropdownValue.connection.options.connectionName
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

			this.sourceTextBox = this.view.modelBuilder.inputBox().withProps({
				value: this.schemaCompareMainWindow.sourceEndpointInfo ? this.schemaCompareMainWindow.sourceEndpointInfo.packageFilePath : '',
				width: this.textBoxWidth,
				ariaLabel: loc.sourceFile
			}).component();

			this.sourceTextBox.onTextChanged(async (e) => {
				this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
			});

			this.targetTextBox = this.view.modelBuilder.inputBox().withProps({
				value: this.schemaCompareMainWindow.targetEndpointInfo ? this.schemaCompareMainWindow.targetEndpointInfo.packageFilePath : '',
				width: this.textBoxWidth,
				ariaLabel: loc.targetFile
			}).component();

			this.targetTextBox.onTextChanged(async () => {
				this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
			});

			this.sourceServerComponent = this.createSourceServerDropdown();

			this.sourceDatabaseComponent = this.createSourceDatabaseDropdown();

			this.targetServerComponent = this.createTargetServerDropdown();

			this.targetDatabaseComponent = this.createTargetDatabaseDropdown();

			this.sourceDacpacComponent = this.createFileBrowser(false, this.schemaCompareMainWindow.sourceEndpointInfo);
			this.targetDacpacComponent = this.createFileBrowser(true, this.schemaCompareMainWindow.targetEndpointInfo);

			let sourceRadioButtons = this.createSourceRadioButtons();
			let targetRadioButtons = this.createTargetRadioButtons();

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
			this.targetFileButton = this.view.modelBuilder.button().withProps({
				title: loc.selectTargetFile,
				ariaLabel: loc.selectTargetFile,
				secondary: true,
				iconPath: path.join(this.extensionContext.extensionPath, 'media', 'folder.svg')
			}).component();
		} else {
			this.sourceFileButton = this.view.modelBuilder.button().withProps({
				title: loc.selectSourceFile,
				ariaLabel: loc.selectSourceFile,
				secondary: true,
				iconPath: path.join(this.extensionContext.extensionPath, 'media', 'folder.svg')
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

	private createSourceRadioButtons(): azdata.FormComponent {
		this.sourceDacpacRadioButton = this.view.modelBuilder.radioButton()
			.withProps({
				name: 'source',
				label: loc.DacpacRadioButtonLabel
			}).component();

		this.sourceDatabaseRadioButton = this.view.modelBuilder.radioButton()
			.withProps({
				name: 'source',
				label: loc.DatabaseRadioButtonLabel
			}).component();

		// show dacpac file browser
		this.sourceDacpacRadioButton.onDidClick(async () => {
			this.sourceIsDacpac = true;
			this.formBuilder.removeFormItem(this.sourceServerComponent);
			this.formBuilder.removeFormItem(this.sourceDatabaseComponent);
			this.formBuilder.insertFormItem(this.sourceDacpacComponent, 2, { horizontal: true, titleFontSize: titleFontSize });
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		// show server and db dropdowns
		this.sourceDatabaseRadioButton.onDidClick(async () => {
			this.sourceIsDacpac = false;
			this.formBuilder.insertFormItem(this.sourceServerComponent, 2, { horizontal: true, titleFontSize: titleFontSize });
			this.formBuilder.insertFormItem(this.sourceDatabaseComponent, 3, { horizontal: true, titleFontSize: titleFontSize });
			this.formBuilder.removeFormItem(this.sourceDacpacComponent);

			await this.populateServerDropdown(false);
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
			.withProps({ ariaRole: 'radiogroup' })
			.component();

		return {
			component: flexRadioButtonsModel,
			title: loc.RadioButtonsLabel
		};
	}

	private createTargetRadioButtons(): azdata.FormComponent {
		let dacpacRadioButton = this.view.modelBuilder.radioButton()
			.withProps({
				name: 'target',
				label: loc.DacpacRadioButtonLabel
			}).component();

		let databaseRadioButton = this.view.modelBuilder.radioButton()
			.withProps({
				name: 'target',
				label: loc.DatabaseRadioButtonLabel
			}).component();

		// show dacpac file browser
		dacpacRadioButton.onDidClick(async () => {
			this.targetIsDacpac = true;
			this.formBuilder.removeFormItem(this.targetServerComponent);
			this.formBuilder.removeFormItem(this.targetDatabaseComponent);
			this.formBuilder.addFormItem(this.targetDacpacComponent, { horizontal: true, titleFontSize: titleFontSize });
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		// show server and db dropdowns
		databaseRadioButton.onDidClick(async () => {
			this.targetIsDacpac = false;
			this.formBuilder.removeFormItem(this.targetDacpacComponent);
			this.formBuilder.addFormItem(this.targetServerComponent, { horizontal: true, titleFontSize: titleFontSize });
			this.formBuilder.addFormItem(this.targetDatabaseComponent, { horizontal: true, titleFontSize: titleFontSize });

			await this.populateServerDropdown(true);
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
			.withProps({ ariaRole: 'radiogroup' })
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
		this.sourceServerDropdown = this.view.modelBuilder.dropDown().withProps(
			{
				editable: true,
				fireOnTextChange: true,
				ariaLabel: loc.sourceServer,
				width: this.textBoxWidth
			}
		).component();

		this.sourceConnectionButton = this.createConnectionButton(false);

		this.sourceServerDropdown.onValueChanged(async (value) => {
			if (value.selected && this.sourceServerDropdown.values.findIndex(x => this.matchesValue(x, value.selected)) === -1) {
				await this.sourceDatabaseDropdown.updateProperties({
					values: [],
					value: '  '
				});
			}
			else {
				this.sourceConnectionButton.iconPath = path.join(this.extensionContext.extensionPath, 'media', 'connect.svg');
				await this.populateDatabaseDropdown((this.sourceServerDropdown.value as ConnectionDropdownValue).connection, false);
			}
		});

		// don't await so that dialog loading won't be blocked. Dropdown will show loading indicator until it is populated
		this.populateServerDropdown(false);

		return {
			component: this.sourceServerDropdown,
			title: loc.ServerDropdownLabel,
			actions: [this.sourceConnectionButton]
		};
	}

	private createConnectionButton(isTarget: boolean): azdata.ButtonComponent {
		const selectConnectionButton = this.view.modelBuilder.button().withProps({
			ariaLabel: loc.selectConnection,
			iconPath: path.join(this.extensionContext.extensionPath, 'media', 'selectConnection.svg'),
			height: '20px',
			width: '20px'
		}).component();

		selectConnectionButton.onDidClick(async () => {
			await this.connectionButtonClick(isTarget);
			selectConnectionButton.iconPath = path.join(this.extensionContext.extensionPath, 'media', 'connect.svg');
		});

		return selectConnectionButton;
	}

	public async connectionButtonClick(isTarget: boolean): Promise<void> {
		let connection = await azdata.connection.openConnectionDialog();
		if (connection) {
			this.connectionId = connection.connectionId;
			this.promise = this.populateServerDropdown(isTarget);
			this.promise2 = this.populateServerDropdown(!isTarget, true);		// passively populate the other server dropdown as well to add the new connections
		}
	}

	protected createTargetServerDropdown(): azdata.FormComponent {
		this.targetServerDropdown = this.view.modelBuilder.dropDown().withProps(
			{
				editable: true,
				fireOnTextChange: true,
				ariaLabel: loc.targetServer,
				width: this.textBoxWidth
			}
		).component();

		this.targetConnectionButton = this.createConnectionButton(true);

		this.targetServerDropdown.onValueChanged(async (value) => {
			if (value.selected && this.targetServerDropdown.values.findIndex(x => this.matchesValue(x, value.selected)) === -1) {
				await this.targetDatabaseDropdown.updateProperties({
					values: [],
					value: '  '
				});
			}
			else {
				this.targetConnectionButton.iconPath = path.join(this.extensionContext.extensionPath, 'media', 'connect.svg');
				await this.populateDatabaseDropdown((this.targetServerDropdown.value as ConnectionDropdownValue).connection, true);
			}
		});

		// don't await so that dialog loading won't be blocked. Dropdown will show loading indicator until it is populated
		this.populateServerDropdown(true);

		return {
			component: this.targetServerDropdown,
			title: loc.ServerDropdownLabel,
			actions: [this.targetConnectionButton]
		};
	}

	protected async populateServerDropdown(isTarget: boolean, passivelyPopulate: boolean = false): Promise<void> {
		const currentDropdown = isTarget ? this.targetServerDropdown : this.sourceServerDropdown;

		if (passivelyPopulate && isNullOrUndefined(currentDropdown.value)) {
			passivelyPopulate = false;		// Populate the dropdown if it is empty
		}

		currentDropdown.loading = true;
		const values = await this.getServerValues(isTarget);

		if (values && values.length > 0) {
			if (passivelyPopulate) {	// only update the dropdown values, not the selected value
				await currentDropdown.updateProperties({
					values: values
				});
			} else {
				await currentDropdown.updateProperties({
					values: values,
					value: values[0]
				});
			}
		}

		currentDropdown.loading = false;

		if (!passivelyPopulate && currentDropdown.value) {
			await this.populateDatabaseDropdown((currentDropdown.value as ConnectionDropdownValue).connection, isTarget);
		}
	}

	protected async getServerValues(isTarget: boolean): Promise<{ connection: azdata.connection.ConnectionProfile, displayName: string, name: string }[]> {
		let cons = await azdata.connection.getConnections(/* activeConnectionsOnly */ true);
		// This user has no active connections
		if (!cons || cons.length === 0) {
			return undefined;
		}

		// Update connection icon to "connected" state
		let connectionButton = isTarget ? this.targetConnectionButton : this.sourceConnectionButton;
		connectionButton.iconPath = path.join(this.extensionContext.extensionPath, 'media', 'connect.svg');

		let endpointInfo = isTarget ? this.schemaCompareMainWindow.targetEndpointInfo : this.schemaCompareMainWindow.sourceEndpointInfo;
		// reverse list so that most recent connections are first
		cons.reverse();

		let count = -1;
		let idx = -1;
		let values = cons.map(c => {
			count++;

			let usr = c.options.user;

			if (!usr) {
				usr = loc.defaultText;
			}

			let srv = c.options.server;

			let finalName = `${srv} (${usr})`;

			if (c.options.connectionName) {
				finalName = c.options.connectionName;
			}

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
		this.sourceDatabaseDropdown = this.view.modelBuilder.dropDown().withProps(
			{
				editable: true,
				fireOnTextChange: true,
				ariaLabel: loc.sourceDatabase,
				width: this.textBoxWidth
			}
		).component();
		this.sourceDatabaseDropdown.onValueChanged(async (value) => {
			this.sourceDbEditable = value as string;
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		return {
			component: this.sourceDatabaseDropdown,
			title: loc.DatabaseDropdownLabel
		};
	}

	protected createTargetDatabaseDropdown(): azdata.FormComponent {
		this.targetDatabaseDropdown = this.view.modelBuilder.dropDown().withProps(
			{
				editable: true,
				fireOnTextChange: true,
				ariaLabel: loc.targetDatabase,
				width: this.textBoxWidth
			}
		).component();
		this.targetDatabaseDropdown.onValueChanged(async (value) => {
			this.targetDbEditable = value as string;
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
		const currentDropdown = isTarget ? this.targetDatabaseDropdown : this.sourceDatabaseDropdown;
		currentDropdown.loading = true;
		await currentDropdown.updateProperties({
			values: [],
			value: undefined
		});

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

		this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		currentDropdown.loading = false;
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
}

export interface ConnectionDropdownValue extends azdata.CategoryValue {
	connection: azdata.connection.ConnectionProfile;
}

function isNullOrUndefined(val: any): boolean {
	return val === null || val === undefined;
}

