/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import * as sqldbproj from 'sqldbproj';
import * as mssql from 'mssql';
import * as loc from '../localizedConstants';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { TelemetryReporter, TelemetryViews } from '../telemetry';
import { getEndpointName, getRootPath, exists, getAzdataApi, getSchemaCompareEndpointString } from '../utils';

const titleFontSize: number = 13;

interface Deferred<T> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: any) => void;
}

export class SchemaCompareDialog {
	public dialog: azdata.window.Dialog;
	public dialogName: string;
	private schemaCompareTab: azdata.window.DialogTab;
	private sourceDacpacRadioButton: azdata.RadioButtonComponent;
	private sourceDatabaseRadioButton: azdata.RadioButtonComponent;
	private sourceProjectRadioButton: azdata.RadioButtonComponent;
	private sourceDacpacComponent: azdata.FormComponent;
	private sourceProjectFilePathComponent: azdata.FormComponent;
	private sourceTextBox: azdata.InputBoxComponent;
	private sourceFileButton: azdata.ButtonComponent;
	private sourceServerComponent: azdata.FormComponent;
	protected sourceServerDropdown: azdata.DropDownComponent;
	private sourceConnectionButton: azdata.ButtonComponent;
	private sourceDatabaseComponent: azdata.FormComponent;
	private sourceDatabaseDropdown: azdata.DropDownComponent;
	private sourceEndpointType: mssql.SchemaCompareEndpointType;
	private sourceDbEditable: string;
	private sourceDacpacPath: string;
	private sourceProjectFilePath: string;
	private targetDacpacComponent: azdata.FormComponent;
	private targetProjectFilePathComponent: azdata.FormComponent;
	private targetProjectStructureComponent: azdata.FormComponent;
	private targetTextBox: azdata.InputBoxComponent;
	private targetFileButton: azdata.ButtonComponent;
	private targetStructureDropdown: azdata.DropDownComponent;
	private targetServerComponent: azdata.FormComponent;
	protected targetServerDropdown: azdata.DropDownComponent;
	private targetConnectionButton: azdata.ButtonComponent;
	private targetDatabaseComponent: azdata.FormComponent;
	private targetDatabaseDropdown: azdata.DropDownComponent;
	private targetDacpacPath: string;
	private targetProjectFilePath: string;
	private targetEndpointType: mssql.SchemaCompareEndpointType;
	private targetDbEditable: string;
	private previousSource: mssql.SchemaCompareEndpointInfo;
	private previousTarget: mssql.SchemaCompareEndpointInfo;
	private formBuilder: azdata.FormBuilder;
	private connectionId: string;
	private toDispose: vscode.Disposable[] = [];
	private initDialogComplete: Deferred<void>;
	private initDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.initDialogComplete = { resolve, reject });

	private textBoxWidth: number = 280;

	public promise;
	public promise2;

	constructor(private schemaCompareMainWindow: SchemaCompareMainWindow, private view?: azdata.ModelView, private extensionContext?: vscode.ExtensionContext) {
		this.previousSource = schemaCompareMainWindow.sourceEndpointInfo;
		this.previousTarget = schemaCompareMainWindow.targetEndpointInfo;

		this.dialog = azdata.window.createModelViewDialog(loc.SchemaCompareLabel);
		this.dialog.registerCloseValidator(async () => {
			return this.validate();
		});
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
			this.connectionId = connection.connectionId;	// current active connection
		}

		this.dialog = azdata.window.createModelViewDialog(loc.SchemaCompareLabel);
		await this.initializeDialog();

		this.dialog.okButton.label = loc.OkButtonText;
		this.dialog.okButton.enabled = false;
		this.toDispose.push(this.dialog.okButton.onClick(async () => await this.handleOkButtonClick()));

		this.dialog.cancelButton.label = loc.CancelButtonText;
		this.toDispose.push(this.dialog.cancelButton.onClick(async () => await this.cancel()));

		azdata.window.openDialog(this.dialog);
		await this.initDialogPromise;
	}

	public async execute(): Promise<void> {
		if (this.sourceEndpointType === mssql.SchemaCompareEndpointType.Database) {
			const sourceServerDropdownValue = this.sourceServerDropdown.value as ConnectionDropdownValue;
			const ownerUri = await azdata.connection.getUriForConnection(sourceServerDropdownValue.connection.connectionId);

			this.schemaCompareMainWindow.sourceEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Database,
				serverDisplayName: sourceServerDropdownValue.displayName,
				serverName: sourceServerDropdownValue.name,
				databaseName: this.sourceDatabaseDropdown.value.toString(),
				ownerUri: ownerUri,
				projectFilePath: '',
				targetScripts: [],
				extractTarget: mssql.ExtractTarget.schemaObjectType,
				packageFilePath: '',
				dataSchemaProvider: '',
				connectionDetails: undefined,
				connectionName: sourceServerDropdownValue.connection.options.connectionName
			};
		} else if (this.sourceEndpointType === mssql.SchemaCompareEndpointType.Dacpac) {
			this.schemaCompareMainWindow.sourceEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Dacpac,
				serverDisplayName: '',
				serverName: '',
				databaseName: '',
				ownerUri: '',
				projectFilePath: '',
				targetScripts: [],
				extractTarget: mssql.ExtractTarget.schemaObjectType,
				dataSchemaProvider: '',
				packageFilePath: this.sourceTextBox.value,
				connectionDetails: undefined
			};
		} else {
			this.schemaCompareMainWindow.sourceEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Project,
				projectFilePath: this.sourceTextBox.value,
				targetScripts: await this.getProjectScriptFiles(this.sourceTextBox.value),
				dataSchemaProvider: await this.getDatabaseSchemaProvider(this.sourceTextBox.value),
				extractTarget: mssql.ExtractTarget.schemaObjectType,
				serverDisplayName: '',
				serverName: '',
				databaseName: '',
				ownerUri: '',
				packageFilePath: '',
				connectionDetails: undefined
			};
		}

		if (this.targetEndpointType === mssql.SchemaCompareEndpointType.Database) {
			const targetServerDropdownValue = this.targetServerDropdown.value as ConnectionDropdownValue;
			const ownerUri = await azdata.connection.getUriForConnection(targetServerDropdownValue.connection.connectionId);

			this.schemaCompareMainWindow.targetEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Database,
				serverDisplayName: targetServerDropdownValue.displayName,
				serverName: targetServerDropdownValue.name,
				databaseName: this.targetDatabaseDropdown.value.toString(),
				ownerUri: ownerUri,
				projectFilePath: '',
				extractTarget: mssql.ExtractTarget.schemaObjectType,
				targetScripts: [],
				packageFilePath: '',
				dataSchemaProvider: '',
				connectionDetails: undefined,
				connectionName: targetServerDropdownValue.connection.options.connectionName
			};
		} else if (this.targetEndpointType === mssql.SchemaCompareEndpointType.Dacpac) {
			this.schemaCompareMainWindow.targetEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Dacpac,
				serverDisplayName: '',
				serverName: '',
				databaseName: '',
				ownerUri: '',
				projectFilePath: '',
				extractTarget: mssql.ExtractTarget.schemaObjectType,
				targetScripts: [],
				dataSchemaProvider: '',
				packageFilePath: this.targetTextBox.value,
				connectionDetails: undefined
			};
		} else {
			this.schemaCompareMainWindow.targetEndpointInfo = {
				endpointType: mssql.SchemaCompareEndpointType.Project,
				projectFilePath: this.targetTextBox.value,
				extractTarget: mapExtractTargetEnum(<string>this.targetStructureDropdown!.value),
				targetScripts: await this.getProjectScriptFiles(this.targetTextBox.value),
				dataSchemaProvider: await this.getDatabaseSchemaProvider(this.targetTextBox.value),
				serverDisplayName: '',
				serverName: '',
				databaseName: '',
				ownerUri: '',
				packageFilePath: '',
				connectionDetails: undefined
			};
		}

		TelemetryReporter.createActionEvent(TelemetryViews.SchemaCompareDialog, 'SchemaCompareStart')
			.withAdditionalProperties({
				sourceEndpointType: getSchemaCompareEndpointString(this.sourceEndpointType),
				targetEndpointType: getSchemaCompareEndpointString(this.targetEndpointType)
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
		this.dispose();
	}

	private async initializeSchemaCompareTab(): Promise<void> {
		this.schemaCompareTab.registerContent(async view => {
			if (isNullOrUndefined(this.view)) {
				this.view = view;
			}

			let sourceValue = '';

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

			this.initDialogComplete.resolve();
		});
	}

	private createFileBrowser(isTarget: boolean, dacpac: boolean, endpoint: mssql.SchemaCompareEndpointInfo): azdata.FormComponent {
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
		const filter = dacpac ? 'dacpac' : 'sqlproj';

		currentButton.onDidClick(async () => {
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
						'Files': [filter],
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

	private createStructureDropdown(): azdata.FormComponent {
		const value = !this.schemaCompareMainWindow.targetEndpointInfo ? loc.schemaObjectType : mapExtractTargetToString(this.schemaCompareMainWindow.targetEndpointInfo.extractTarget);
		this.targetStructureDropdown = this.view.modelBuilder.dropDown().withProps({
			editable: true,
			fireOnTextChange: true,
			ariaLabel: loc.targetStructure,
			width: this.textBoxWidth,
			values: [loc.file, loc.flat, loc.objectType, loc.schema, loc.schemaObjectType],
			value: value,
		}).component();

		return {
			component: this.targetStructureDropdown,
			title: loc.StructureDropdownLabel,
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

		this.sourceProjectRadioButton = this.view.modelBuilder.radioButton()
			.withProps({
				name: 'source',
				label: loc.ProjectRadioButtonLabel
			}).component();

		// show dacpac file browser
		this.sourceDacpacRadioButton.onDidClick(async () => {
			this.sourceEndpointType = mssql.SchemaCompareEndpointType.Dacpac;
			this.sourceTextBox.value = this.sourceDacpacPath;
			this.formBuilder.removeFormItem(this.sourceServerComponent);
			this.formBuilder.removeFormItem(this.sourceDatabaseComponent);
			this.formBuilder.removeFormItem(this.sourceProjectFilePathComponent);
			this.formBuilder.insertFormItem(this.sourceDacpacComponent, 2, { horizontal: true, titleFontSize: titleFontSize });
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		// show server and db dropdowns
		this.sourceDatabaseRadioButton.onDidClick(async () => {
			this.sourceEndpointType = mssql.SchemaCompareEndpointType.Database;
			this.formBuilder.insertFormItem(this.sourceServerComponent, 2, { horizontal: true, titleFontSize: titleFontSize });
			this.formBuilder.insertFormItem(this.sourceDatabaseComponent, 3, { horizontal: true, titleFontSize: titleFontSize });
			this.formBuilder.removeFormItem(this.sourceDacpacComponent);
			this.formBuilder.removeFormItem(this.sourceProjectFilePathComponent);

			await this.populateServerDropdown(false);
		});

		// show project directory browser
		this.sourceProjectRadioButton.onDidClick(async () => {
			this.sourceEndpointType = mssql.SchemaCompareEndpointType.Project;
			this.sourceTextBox.value = this.sourceProjectFilePath;
			this.formBuilder.removeFormItem(this.sourceServerComponent);
			this.formBuilder.removeFormItem(this.sourceDatabaseComponent);
			this.formBuilder.removeFormItem(this.sourceDacpacComponent);
			this.formBuilder.insertFormItem(this.sourceProjectFilePathComponent, 2, { horizontal: true, titleFontSize: titleFontSize });
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		this.sourceEndpointType = this.schemaCompareMainWindow.sourceEndpointInfo?.endpointType ?? mssql.SchemaCompareEndpointType.Database; // default to database if no specific source is passed

		switch (this.sourceEndpointType) {
			case mssql.SchemaCompareEndpointType.Dacpac:
				this.sourceDacpacRadioButton.checked = true;
				break;
			case mssql.SchemaCompareEndpointType.Project:
				this.sourceProjectRadioButton.checked = true;
				break;
			case mssql.SchemaCompareEndpointType.Database:
				this.sourceDatabaseRadioButton.checked = true;
				break;
		}

		let radioButtons = [this.sourceDatabaseRadioButton, this.sourceDacpacRadioButton];

		if (vscode.extensions.getExtension(loc.sqlDatabaseProjectExtensionId)) {
			radioButtons.push(this.sourceProjectRadioButton);
		}

		let flexRadioButtonsModel = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems(radioButtons)
			.withProps({ ariaRole: 'radiogroup' })
			.component();

		return {
			component: flexRadioButtonsModel,
			title: loc.RadioButtonsLabel
		};
	}

	private createTargetRadioButtons(): azdata.FormComponent {
		let targetDacpacRadioButton = this.view.modelBuilder.radioButton()
			.withProps({
				name: 'target',
				label: loc.DacpacRadioButtonLabel
			}).component();

		let targetDatabaseRadioButton = this.view.modelBuilder.radioButton()
			.withProps({
				name: 'target',
				label: loc.DatabaseRadioButtonLabel
			}).component();

		let targetProjectRadioButton = this.view.modelBuilder.radioButton()
			.withProps({
				name: 'target',
				label: loc.ProjectRadioButtonLabel
			}).component();

		// show dacpac file browser
		targetDacpacRadioButton.onDidClick(async () => {
			this.targetEndpointType = mssql.SchemaCompareEndpointType.Dacpac;
			this.targetTextBox.value = this.targetDacpacPath;
			this.formBuilder.removeFormItem(this.targetServerComponent);
			this.formBuilder.removeFormItem(this.targetDatabaseComponent);
			this.formBuilder.removeFormItem(this.targetProjectFilePathComponent);
			this.formBuilder.removeFormItem(this.targetProjectStructureComponent);
			this.formBuilder.addFormItem(this.targetDacpacComponent, { horizontal: true, titleFontSize: titleFontSize });
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});

		// show server and db dropdowns
		targetDatabaseRadioButton.onDidClick(async () => {
			this.targetEndpointType = mssql.SchemaCompareEndpointType.Database;
			this.formBuilder.removeFormItem(this.targetDacpacComponent);
			this.formBuilder.removeFormItem(this.targetProjectFilePathComponent);
			this.formBuilder.removeFormItem(this.targetProjectStructureComponent);
			this.formBuilder.addFormItem(this.targetServerComponent, { horizontal: true, titleFontSize: titleFontSize });
			this.formBuilder.addFormItem(this.targetDatabaseComponent, { horizontal: true, titleFontSize: titleFontSize });

			await this.populateServerDropdown(true);
		});

		// show project directory browser
		targetProjectRadioButton.onDidClick(async () => {
			this.targetEndpointType = mssql.SchemaCompareEndpointType.Project;
			this.targetTextBox.value = this.targetProjectFilePath;
			this.formBuilder.removeFormItem(this.targetServerComponent);
			this.formBuilder.removeFormItem(this.targetDatabaseComponent);
			this.formBuilder.removeFormItem(this.targetDacpacComponent);
			this.formBuilder.addFormItem(this.targetProjectFilePathComponent, { horizontal: true, titleFontSize: titleFontSize });
			this.formBuilder.addFormItem(this.targetProjectStructureComponent, { horizontal: true, titleFontSize: titleFontSize });
			this.dialog.okButton.enabled = await this.shouldEnableOkayButton();
		});


		this.targetEndpointType = this.schemaCompareMainWindow.targetEndpointInfo?.endpointType ?? mssql.SchemaCompareEndpointType.Database; // default to database if no specific target is passed

		switch (this.targetEndpointType) {
			case mssql.SchemaCompareEndpointType.Dacpac:
				targetDacpacRadioButton.checked = true;
				break;
			case mssql.SchemaCompareEndpointType.Project:
				targetProjectRadioButton.checked = true;
				break;
			case mssql.SchemaCompareEndpointType.Database:
				targetDatabaseRadioButton.checked = true;
				break;
		}

		let radioButtons = [targetDatabaseRadioButton, targetDacpacRadioButton];

		if (vscode.extensions.getExtension(loc.sqlDatabaseProjectExtensionId)) {
			radioButtons.push(targetProjectRadioButton);
		}

		let flexRadioButtonsModel = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems(radioButtons)
			.withProps({ ariaRole: 'radiogroup' })
			.component();

		return {
			component: flexRadioButtonsModel,
			title: loc.RadioButtonsLabel
		};
	}

	private async shouldEnableOkayButton(): Promise<boolean> {
		let sourcefilled = (this.sourceEndpointType === mssql.SchemaCompareEndpointType.Dacpac && await this.existsDacpac(this.sourceTextBox.value))
			|| (this.sourceEndpointType === mssql.SchemaCompareEndpointType.Project && await this.existsProjectFile(this.sourceTextBox.value))
			|| (this.sourceEndpointType === mssql.SchemaCompareEndpointType.Database && !isNullOrUndefined(this.sourceDatabaseDropdown.value) && this.sourceDatabaseDropdown.values.findIndex(x => this.matchesValue(x, this.sourceDbEditable)) !== -1);
		let targetfilled = (this.targetEndpointType === mssql.SchemaCompareEndpointType.Dacpac && await this.existsDacpac(this.targetTextBox.value))
			|| (this.targetEndpointType === mssql.SchemaCompareEndpointType.Project && await this.existsProjectFile(this.targetTextBox.value))
			|| (this.targetEndpointType === mssql.SchemaCompareEndpointType.Database && !isNullOrUndefined(this.targetDatabaseDropdown.value) && this.targetDatabaseDropdown.values.findIndex(x => this.matchesValue(x, this.targetDbEditable)) !== -1);

		return sourcefilled && targetfilled;
	}

	public async handleOkButtonClick(): Promise<void> {
		await this.execute();
		this.dispose();
	}

	protected showErrorMessage(message: string): void {
		this.dialog.message = {
			text: message,
			level: getAzdataApi()!.window.MessageLevel.Error
		};
	}

	async validate(): Promise<boolean> {
		try {
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
		}
	}

	private dispose(): void {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	private async existsDacpac(filename: string): Promise<boolean> {
		return !isNullOrUndefined(filename) && await exists(filename) && (filename.toLocaleLowerCase().endsWith('.dacpac'));
	}

	private async existsProjectFile(filename: string): Promise<boolean> {
		return !isNullOrUndefined(filename) && await exists(filename) && (filename.toLocaleLowerCase().endsWith('.sqlproj'));
	}

	private async getProjectScriptFiles(projectFilePath: string): Promise<string[]> {
		const databaseProjectsExtension = vscode.extensions.getExtension(loc.sqlDatabaseProjectExtensionId);

		if (databaseProjectsExtension) {
			return await (await databaseProjectsExtension.activate() as sqldbproj.IExtension).getProjectScriptFiles(projectFilePath);
		}
	}

	private async getDatabaseSchemaProvider(projectFilePath: string): Promise<string> {
		const databaseProjectsExtension = vscode.extensions.getExtension(loc.sqlDatabaseProjectExtensionId);

		if (databaseProjectsExtension) {
			return await (await databaseProjectsExtension.activate() as sqldbproj.IExtension).getProjectDatabaseSchemaProvider(projectFilePath);
		}
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

			// use current connection else use previously selected server if there is one
			if ((c.connectionId === this.connectionId) ||
				(endpointInfo && !isNullOrUndefined(endpointInfo.serverName) && !isNullOrUndefined(endpointInfo.serverDisplayName)
					&& c.options.server.toLowerCase() === endpointInfo.serverName.toLowerCase()
					&& finalName.toLowerCase() === endpointInfo.serverDisplayName.toLowerCase()
					&& idx === -1)) { // select previous server only if current connection hasn't been set already
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

/**
 * Function to map folder structure string to enum
 * @param inputTarget folder structure in string
 * @returns folder structure in enum format
 */
export function mapExtractTargetEnum(inputTarget: string): mssql.ExtractTarget {
	switch (inputTarget) {
		case loc.file: return mssql.ExtractTarget.file;
		case loc.flat: return mssql.ExtractTarget.flat;
		case loc.objectType: return mssql.ExtractTarget.objectType;
		case loc.schema: return mssql.ExtractTarget.schema;
		case loc.schemaObjectType:
		default: return mssql.ExtractTarget.schemaObjectType;
	}
}

export function mapExtractTargetToString(inputTarget: mssql.ExtractTarget) {
	switch (inputTarget) {
		case mssql.ExtractTarget.file: return loc.file;
		case mssql.ExtractTarget.flat: return loc.flat;
		case mssql.ExtractTarget.objectType: return loc.objectType;
		case mssql.ExtractTarget.schema: return loc.schema;
		case mssql.ExtractTarget.schemaObjectType:
		default: return loc.schemaObjectType;
	}
}
