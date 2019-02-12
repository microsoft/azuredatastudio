/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

const localize = nls.loadMessageBundle();

export class SchemaCompareDialog {

	private static readonly CompareButtonText: string = localize('schemaCompareDialog.Compare', 'Compare');
	private static readonly CancelButtonText: string = localize('schemaCompareDialog.Cancel', 'Cancel');
	private static readonly GeneralTabText: string = localize('schemaCompareDialog.General', 'General');
	private static readonly SourceTextBoxLabel: string = localize('schemaCompareDialog.SourceLabel', 'Source');
	private static readonly TargetTextBoxLabel: string = localize('schemaCompareDialog.TargetLabel', 'Target');

	public dialog: sqlops.window.modelviewdialog.Dialog;
	private generalTab: sqlops.window.modelviewdialog.DialogTab;
	private sourceTextBox: sqlops.InputBoxComponent;
	private targetTextBox: sqlops.InputBoxComponent;
	protected fileTextBox: sqlops.InputBoxComponent;

	// Dialog Name for Telemetry
	public dialogName: string;

	constructor(public ownerUri?: string) {
	}

	protected async initializeDialog(dialog: sqlops.window.modelviewdialog.Dialog) {
		this.generalTab = sqlops.window.modelviewdialog.createTab(SchemaCompareDialog.GeneralTabText);

		this.initializeGeneralTab();

		this.dialog.content = [this.generalTab];
	}

	public async openDialog(dialogName?: string) {
		console.error('opening dialog');
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

		let sourceText = `CREATE TABLE [dbo].[ATable] (
			[ID]        INT        NOT NULL,
			[ADate]     DATE       NOT NULL,
			[col3]      NCHAR (10) NULL,
			PRIMARY KEY CLUSTERED ([ID] ASC)
		);`;
		let targetText = `CREATE TABLE [dbo].[ATable] (
			[ID]        INT        NOT NULL,
			[ADate]     DATE       NOT NULL,
			[DayOfYear] AS         ([dbo].[CalcDayOfYear]([ADate])) PERSISTED,
			PRIMARY KEY CLUSTERED ([ID] ASC)
		);`;

		let targetRegistration = vscode.workspace.registerTextDocumentContentProvider('target', {
			provideTextDocumentContent(uri) {
				return targetText;
			}
		});

		let sourceRegistration = vscode.workspace.registerTextDocumentContentProvider('source', {
			provideTextDocumentContent(uri) {
				return sourceText;
			}
		});

		const title = 'Object Definitions';
		vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse('target:'),vscode.Uri.parse('source:'), title);

		let sourceEndpointInfo: sqlops.SchemaCompareEndpointInfo = {
			endpointType: sqlops.SchemaCompareEndpointType.dacpac,
			databaseName: path.parse(this.sourceTextBox.value).name,
			ownerUri: '',
			packageFilePath: this.sourceTextBox.value
		};

		let targetEndpointInfo: sqlops.SchemaCompareEndpointInfo = {
			endpointType: sqlops.SchemaCompareEndpointType.dacpac,
			databaseName: path.parse(this.targetTextBox.value).name,
			ownerUri: '',
			packageFilePath: this.targetTextBox.value
		};

		let result = await service.schemaCompare(sourceEndpointInfo, targetEndpointInfo, sqlops.TaskExecutionMode.execute);
		if (!result || !result.success) {
				vscode.window.showErrorMessage(
					localize('schemaCompare.compareErrorMessage', "Schema Compare failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}

		console.error('result.areEqual is: ' + result.areEqual);
		console.error('num of differences: ' + result.differences.length);
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
				width: 350,
				required: true
			},).component();

			this.targetTextBox = view.modelBuilder.inputBox().withProperties({
				width: 350,
				required: true
			}).component();

			let sourceComponent = await this.createFileBrowser(view, this.sourceTextBox, SchemaCompareDialog.SourceTextBoxLabel);
			let targetComponent = await this.createFileBrowser(view, this.targetTextBox, SchemaCompareDialog.TargetTextBoxLabel);

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([
				sourceComponent,
				targetComponent
			], {
				horizontal: true
			}).withLayout({
				 width: 350,
				}).component();

			await view.initializeModel(formModel);
		});
	}

	private async createFileBrowser(view: sqlops.ModelView, textbox: sqlops.InputBoxComponent, title: string): Promise<sqlops.FormComponent> {
		let fileButton = view.modelBuilder.button().withProperties({
			label: '•••',
		}).component();

		fileButton.onDidClick(async (click) => {
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
			textbox.value = fileUri.fsPath;
		});

		textbox.onTextChanged(async () => {
		});

		return {
			component: textbox,
			title: title,
			actions: [fileButton]
		};
	}
}