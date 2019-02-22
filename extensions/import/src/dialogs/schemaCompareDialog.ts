/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as os from 'os';

const localize = nls.loadMessageBundle();

export class SchemaCompareDialog {

	private static readonly CompareButtonText: string = localize('schemaCompareDialog.Compare', 'Compare');
	private static readonly CancelButtonText: string = localize('schemaCompareDialog.Cancel', 'Cancel');
	private static readonly GeneralTabText: string = localize('schemaCompareDialog.General', 'General');
	private static readonly SourceTextBoxLabel: string = localize('schemaCompareDialog.SourceLabel', 'Source File');
	private static readonly TargetTextBoxLabel: string = localize('schemaCompareDialog.TargetLabel', 'Target File');
	private static readonly DacpacRadioButtonLabel: string = localize('schemaCompare.dacpacRadioButtonLabel', 'Dacpac');
	private static readonly DatabaseRadioButtonLabel: string = localize('schemaCompare.databaseButtonLabel', 'Database');
	private static readonly SourceRadioButtonsLabel: string = localize('schemaCompare.sourceButtonsLabel', 'Source Type');
	private static readonly TargetRadioButtonsLabel: string = localize('schemaCompare.targetButtonsLabel', 'Target Type');
	private static readonly NoActiveConnectionsLabel: string = localize('schemaCompare.NoActiveConnectionsText', 'No active connections');

	public dialog: sqlops.window.modelviewdialog.Dialog;
	private generalTab: sqlops.window.modelviewdialog.DialogTab;
	private sourceDacpacComponent: sqlops.FormComponent;
	private sourceTextBox: sqlops.InputBoxComponent;
	private sourceFileButton: sqlops.ButtonComponent;
	private sourceServerComponent: sqlops.FormComponent;
	private sourceServerDropdown: sqlops.DropDownComponent;
	private sourceDatabaseComponent: sqlops.FormComponent;
	private sourceDatabaseDropdown: sqlops.DropDownComponent;
	private sourceNoActiveConnectionsText: sqlops.FormComponent;
	private targetDacpacComponent: sqlops.FormComponent;
	private targetTextBox: sqlops.InputBoxComponent;
	private targetFileButton: sqlops.ButtonComponent;
	private targetServerComponent: sqlops.FormComponent;
	private targetServerDropdown: sqlops.DropDownComponent;
	private targetDatabaseComponent: sqlops.FormComponent;
	private targetDatabaseDropdown: sqlops.DropDownComponent;
	private targetNoActiveConnectionsText: sqlops.FormComponent;
	private differencesTable: sqlops.TableComponent;
	private loader: sqlops.LoadingComponent;
	private formBuilder: sqlops.FormBuilder;
	private editor: sqlops.workspace.ModelViewEditor;
	private diffEditor: sqlops.DiffEditorComponent;
	private flexModel: sqlops.FlexContainer;
	private sourceLabel: sqlops.TextComponent;
	private targetLabel: sqlops.TextComponent;
	private noDifferencesLabel: sqlops.TextComponent;
	private sourceIsDacpac: boolean;
	private targetIsDacpac: boolean;
	private database: string;
	public dialogName: string;
	private SchemaCompareActionMap: Map<Number, string>;

	constructor(public ownerUri?: string) {
		this.SchemaCompareActionMap = new Map<Number, string>();
		this.SchemaCompareActionMap[0] = localize('schemaCompare.deleteAction', '❌ Delete');
		this.SchemaCompareActionMap[1] = localize('schemaCompare.changeAction', '✎ Change');
		this.SchemaCompareActionMap[2] = localize('schemaCompare.addAction', '➕ Add');
	}

	protected async initializeDialog(dialog: sqlops.window.modelviewdialog.Dialog) {
		this.generalTab = sqlops.window.modelviewdialog.createTab(SchemaCompareDialog.GeneralTabText);
		this.initializeGeneralTab();
		this.dialog.content = [this.generalTab];
	}

	public async openDialog(p: any, dialogName?: string) {
		this.editor = sqlops.workspace.createModelViewEditor(localize('schemaCompare.Title', 'Schema Compare'), { retainContextWhenHidden: true, supportsSave: true });

		this.editor.registerContent(async view => {
			this.diffEditor = view.modelBuilder.diffeditor().withProperties({
				contentLeft: '\n',
				contentRight: '\n',
			}).component();

			this.differencesTable = view.modelBuilder.table().withProperties({
				data: [],
				height: 400
			}).component();

			this.loader = view.modelBuilder.loadingComponent().component();
			this.sourceLabel = view.modelBuilder.text().component();
			this.targetLabel = view.modelBuilder.text().component();
			this.noDifferencesLabel = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.noDifferences', 'No schema differences were found')
			}).component();

			this.flexModel = view.modelBuilder.flexContainer().component();
			this.flexModel.addItem(this.loader);
			this.flexModel.setLayout({
				flexFlow: 'column',
				alignItems: 'stretch',
				height: '100%'
			});

			await view.initializeModel(this.flexModel);
		});

		let profile = p ? <sqlops.IConnectionProfile>p.connectionProfile : undefined;
		if (profile) {
			this.database = profile.databaseName;
		}

		let event = dialogName ? dialogName : null;
		this.dialog = sqlops.window.modelviewdialog.createDialog('Schema Compare', event);

		await this.initializeDialog(this.dialog);

		this.dialog.okButton.label = SchemaCompareDialog.CompareButtonText;
		this.dialog.okButton.onClick(async () => await this.execute());

		this.dialog.cancelButton.label = SchemaCompareDialog.CancelButtonText;
		this.dialog.cancelButton.onClick(async () => await this.cancel());

		sqlops.window.modelviewdialog.openDialog(this.dialog);
	}

	protected async execute() {
		let service = await SchemaCompareDialog.getService('MSSQL');
		this.editor.openEditor();
		let sourceName: string;
		let targetName: string;

		let sourceEndpointInfo: sqlops.SchemaCompareEndpointInfo;
		if (this.sourceIsDacpac) {
			sourceName = this.sourceTextBox.value;
			sourceEndpointInfo = {
				endpointType: sqlops.SchemaCompareEndpointType.dacpac,
				databaseName: '',
				ownerUri: '',
				packageFilePath: this.sourceTextBox.value
			};
		} else {
			sourceName = (<sqlops.CategoryValue>this.sourceDatabaseDropdown.value).name;
			let ownerUri = await sqlops.connection.getUriForConnection((this.sourceServerDropdown.value as ConnectionDropdownValue).connection.connectionId);

			sourceEndpointInfo = {
				endpointType: sqlops.SchemaCompareEndpointType.database,
				databaseName: (<sqlops.CategoryValue>this.sourceDatabaseDropdown.value).name,
				ownerUri: ownerUri,
				packageFilePath: ''
			};
		}

		let targetEndpointInfo: sqlops.SchemaCompareEndpointInfo;
		if (this.targetIsDacpac) {
			targetName = this.targetTextBox.value;
			targetEndpointInfo = {
				endpointType: sqlops.SchemaCompareEndpointType.dacpac,
				databaseName: '',
				ownerUri: '',
				packageFilePath: this.targetTextBox.value
			};
		} else {
			targetName = (<sqlops.CategoryValue>this.targetDatabaseDropdown.value).name;
			let ownerUri = await sqlops.connection.getUriForConnection((this.targetServerDropdown.value as ConnectionDropdownValue).connection.connectionId);

			targetEndpointInfo = {
				endpointType: sqlops.SchemaCompareEndpointType.database,
				databaseName: (<sqlops.CategoryValue>this.targetDatabaseDropdown.value).name,
				ownerUri: ownerUri,
				packageFilePath: ''
			};
		}

		let result = await service.schemaCompare(sourceEndpointInfo, targetEndpointInfo, sqlops.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('schemaCompare.compareErrorMessage', "Schema Compare failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}

		let data = this.getAllDifferences(result.differences);

		this.differencesTable.updateProperties({
			data: data,
			columns: [
				{
					value: localize('schemaCompare.actionColumn', 'Action'),
					cssClass: 'align-with-header',
					width: 30
				},
				{
					value: localize('schemaCompare.typeColumn', 'Type'),
					cssClass: 'align-with-header',
					width: 50
				},
				{
					value: localize('schemaCompare.sourceNameColumn', 'Source Name'),
					cssClass: 'align-with-header'
				},
				{
					value: localize('schemaCompare.targetNameColumn', 'Target Name'),
					cssClass: 'align-with-header'
				}]
		});

		this.sourceLabel.updateProperties({
			value: localize('schemaCompare.source', 'Source: {0}', sourceName)
		});
		this.targetLabel.updateProperties({
			value: localize('schemaCompare.target', 'Target: {0}', targetName)
		});

		this.loader.loading = false;
		this.flexModel.removeItem(this.loader);
		if (result.differences.length > 0) {
			this.flexModel.addItem(this.sourceLabel, { flex: '1' });
			this.flexModel.addItem(this.targetLabel, { flex: '1' });
			this.flexModel.addItem(this.differencesTable, { flex: '1 1' });
			this.flexModel.addItem(this.diffEditor, { flex: '1 1' });
		} else {
			this.flexModel.addItem(this.noDifferencesLabel);
		}

		this.differencesTable.onRowSelected(e => {
			let difference = result.differences[this.differencesTable.selectedRows[0]];
			sourceText = difference.sourceScript === null ? '' : difference.sourceScript;
			targetText = difference.targetScript === null ? '' : difference.targetScript;
			this.diffEditor.contentLeft = sourceText;
			this.diffEditor.contentRight = targetText;
		});

		let sourceText = '';
		let targetText = '';

		vscode.workspace.registerTextDocumentContentProvider('source', {
			provideTextDocumentContent() {
				return sourceText;
			}
		});

		vscode.workspace.registerTextDocumentContentProvider('target', {
			provideTextDocumentContent() {
				return targetText;
			}
		});
	}

	private getAllDifferences(differences: sqlops.DiffEntry[]): string[][] {
		let data = [];
		differences.forEach(difference => {
			if (difference.differenceType === sqlops.SchemaDifferenceType.Object) {
				if (difference.sourceValue !== null || difference.targetValue !== null) {
					data.push([this.SchemaCompareActionMap[difference.updateAction], difference.name, difference.sourceValue, difference.targetValue]);
				}
			}
		});

		return data;
	}

	private static async getService(providerName: string): Promise<sqlops.DacFxServicesProvider> {
		let service = sqlops.dataprotocol.getProvider<sqlops.DacFxServicesProvider>(providerName, sqlops.DataProviderType.DacFxServicesProvider);
		return service;
	}

	protected async cancel() {
	}

	private initializeGeneralTab() {
		this.generalTab.registerContent(async view => {

			this.sourceTextBox = view.modelBuilder.inputBox().withProperties({
				width: 275,
			}).component();

			this.targetTextBox = view.modelBuilder.inputBox().withProperties({
				width: 275,
			}).component();

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

			if (this.database) {
				this.formBuilder = view.modelBuilder.formContainer()
					.withFormItems([
						sourceRadioButtons,
						this.sourceServerComponent,
						this.sourceDatabaseComponent,
						targetRadioButtons,
						this.targetDacpacComponent
					], {
							horizontal: true
						});
			} else {
				this.formBuilder = view.modelBuilder.formContainer()
					.withFormItems([
						sourceRadioButtons,
						this.sourceDacpacComponent,
						targetRadioButtons,
						this.targetDacpacComponent
					], {
							horizontal: true
						});
			}
			let formModel = this.formBuilder.component();
			await view.initializeModel(formModel);
		});
	}

	private async createFileBrowser(view: sqlops.ModelView, isTarget: boolean): Promise<sqlops.FormComponent> {
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
			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(os.homedir()),
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
			title: isTarget ? SchemaCompareDialog.TargetTextBoxLabel : SchemaCompareDialog.SourceTextBoxLabel,
			actions: [currentButton]
		};
	}

	private async createSourceRadiobuttons(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
		let dacpacRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				name: 'source',
				label: SchemaCompareDialog.DacpacRadioButtonLabel,
			}).component();

		let databaseRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				name: 'source',
				label: SchemaCompareDialog.DatabaseRadioButtonLabel,
			}).component();

		dacpacRadioButton.onDidClick(() => {
			this.sourceIsDacpac = true;
			this.formBuilder.removeFormItem(this.sourceNoActiveConnectionsText);
			this.formBuilder.removeFormItem(this.sourceServerComponent);
			this.formBuilder.removeFormItem(this.sourceDatabaseComponent);
			this.formBuilder.insertFormItem(this.sourceDacpacComponent, 1, { horizontal: true });
		});

		databaseRadioButton.onDidClick(() => {
			this.sourceIsDacpac = false;
			if ((this.sourceServerDropdown.value as ConnectionDropdownValue)) {
				this.formBuilder.insertFormItem(this.sourceServerComponent, 1, { horizontal: true, componentWidth: 300 });
				this.formBuilder.insertFormItem(this.sourceDatabaseComponent, 2, { horizontal: true, componentWidth: 300 });
			} else {
				this.formBuilder.insertFormItem(this.sourceNoActiveConnectionsText, 1, { horizontal: true });
			}
			this.formBuilder.removeFormItem(this.sourceDacpacComponent);
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
			title: SchemaCompareDialog.SourceRadioButtonsLabel
		};
	}

	private async createTargetRadiobuttons(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
		let dacpacRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				name: 'target',
				label: SchemaCompareDialog.DacpacRadioButtonLabel,
			}).component();

		let databaseRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				name: 'target',
				label: SchemaCompareDialog.DatabaseRadioButtonLabel,
			}).component();

		dacpacRadioButton.onDidClick(() => {
			this.targetIsDacpac = true;
			this.formBuilder.removeFormItem(this.targetNoActiveConnectionsText);
			this.formBuilder.removeFormItem(this.targetServerComponent);
			this.formBuilder.removeFormItem(this.targetDatabaseComponent);
			this.formBuilder.addFormItem(this.targetDacpacComponent, { horizontal: true });
		});

		databaseRadioButton.onDidClick(() => {
			this.targetIsDacpac = false;
			this.formBuilder.removeFormItem(this.targetDacpacComponent);
			if ((this.targetServerDropdown.value as ConnectionDropdownValue)) {
				this.formBuilder.addFormItem(this.targetServerComponent, { horizontal: true, componentWidth: 300 });
				this.formBuilder.addFormItem(this.targetDatabaseComponent, { horizontal: true, componentWidth: 300 });
			} else {
				this.formBuilder.addFormItem(this.targetNoActiveConnectionsText, { horizontal: true });
			}
		});

		dacpacRadioButton.checked = true;
		this.targetIsDacpac = true;
		let flexRadioButtonsModel = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([dacpacRadioButton, databaseRadioButton]
			).component();

		return {
			component: flexRadioButtonsModel,
			title: SchemaCompareDialog.TargetRadioButtonsLabel
		};
	}

	protected async createSourceServerDropdown(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
		this.sourceServerDropdown = view.modelBuilder.dropDown().component();
		this.sourceServerDropdown.onValueChanged(async () => {
			await this.populateDatabaseDropdown((this.sourceServerDropdown.value as ConnectionDropdownValue).connection.connectionId, false);
		});

		return {
			component: this.sourceServerDropdown,
			title: localize('schemaCompare.sourceServerDropdownTitle', 'Source Server')
		};
	}

	protected async createTargetServerDropdown(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
		this.targetServerDropdown = view.modelBuilder.dropDown().component();
		this.targetServerDropdown.onValueChanged(async () => {
			await this.populateDatabaseDropdown((this.targetServerDropdown.value as ConnectionDropdownValue).connection.connectionId, true);
		});

		return {
			component: this.targetServerDropdown,
			title: localize('schemaCompare.targetServerDropdownTitle', 'Target Server')
		};
	}

	protected async populateServerDropdown(isTarget: boolean): Promise<boolean> {
		let currentDropdown = isTarget ? this.targetServerDropdown : this.sourceServerDropdown;

		let values = await this.getServerValues();
		if (values === undefined) {
			return false;
		}

		currentDropdown.updateProperties({
			values: values
		});
		return true;
	}

	protected async getServerValues(): Promise<{ connection, displayName, name }[]> {
		let cons = await sqlops.connection.getActiveConnections();
		// This user has no active connections
		if (!cons || cons.length === 0) {
			return undefined;
		}

		let values = cons.map(c => {
			let db = c.options.databaseDisplayName;
			let usr = c.options.user;
			let srv = c.options.server;

			if (!db) {
				db = '<default>';
			}

			if (!usr) {
				usr = 'default';
			}

			let finalName = `${srv}, ${db} (${usr})`;
			return {
				connection: c,
				displayName: finalName,
				name: c.connectionId
			};
		});

		return values;
	}

	protected async createSourceDatabaseDropdown(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
		this.sourceDatabaseDropdown = view.modelBuilder.dropDown().component();

		return {
			component: this.sourceDatabaseDropdown,
			title: localize('schemaCompare.sourceDatabaseDropdownTitle', 'Source Database')
		};
	}

	protected async createTargetDatabaseDropdown(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
		this.targetDatabaseDropdown = view.modelBuilder.dropDown().component();

		return {
			component: this.targetDatabaseDropdown,
			title: localize('schemaCompare.targetDatabaseDropdownTitle', 'Target Database')
		};
	}

	protected async populateDatabaseDropdown(connectionId: string, isTarget: boolean): Promise<boolean> {
		let currentDropdown = isTarget ? this.targetDatabaseDropdown : this.sourceDatabaseDropdown;
		currentDropdown.updateProperties({ values: [] });

		let values = await this.getDatabaseValues(connectionId);
		currentDropdown.updateProperties({
			values: values
		});

		return true;
	}

	protected async getDatabaseValues(connectionId: string): Promise<{ displayName, name }[]> {
		let idx = -1;
		let count = -1;
		let values = (await sqlops.connection.listDatabases(connectionId)).map(db => {
			count++;
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

	protected async createNoActiveConnectionsText(view: sqlops.ModelView): Promise<sqlops.FormComponent> {
		let noActiveConnectionsText = view.modelBuilder.text().withProperties({ value: SchemaCompareDialog.NoActiveConnectionsLabel }).component();

		return {
			component: noActiveConnectionsText,
			title: ''
		};
	}
}

interface ConnectionDropdownValue extends sqlops.CategoryValue {
	connection: sqlops.connection.Connection;
}