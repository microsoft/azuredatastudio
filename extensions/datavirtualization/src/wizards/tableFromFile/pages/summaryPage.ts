/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';

import { ImportDataModel } from '../api/models';
import { ImportPage } from '../api/importPage';
import { TableFromFileWizard } from '../tableFromFileWizard';
import { DataSourceWizardService } from '../../../services/contracts';

const localize = nls.loadMessageBundle();

export class SummaryPageUiElements {
	public table: azdata.TableComponent;
}

export class SummaryPage extends ImportPage {
	private ui: SummaryPageUiElements;
	private form: azdata.FormContainer;

	public constructor(instance: TableFromFileWizard, wizardPage: azdata.window.WizardPage, model: ImportDataModel, view: azdata.ModelView, provider: DataSourceWizardService) {
		super(instance, wizardPage, model, view, provider);
	}

	public setUi(ui: SummaryPageUiElements) {
		this.ui = ui;
	}

	async start(): Promise<boolean> {
		this.ui = new SummaryPageUiElements();
		this.ui.table = this.view.modelBuilder.table().component();

		this.form = this.view.modelBuilder.formContainer().withFormItems(
			[{
				component: this.ui.table,
				title: localize('tableFromFileImport.importInformation', 'Data Virtualization information')
			}]
		).component();

		await this.view.initializeModel(this.form);
		return true;
	}

	async onPageEnter(): Promise<void> {
		this.instance.changeDoneButtonLabel(localize('tableFromFileImport.importData', 'Virtualize Data'));
		this.instance.setGenerateScriptVisibility(true);

		this.populateTable();
	}

	async onPageLeave(clickedNext: boolean): Promise<boolean> {
		this.instance.changeDoneButtonLabel(localize('tableFromFileImport.next', 'Next'));
		this.instance.setGenerateScriptVisibility(false);
		return true;
	}

	private populateTable() {
		let sourceTitle = this.model.parentFile.isFolder
			? localize('tableFromFileImport.summaryFolderName', 'Source Folder')
			: localize('tableFromFileImport.summaryFileName', 'Source File');

		this.ui.table.updateProperties({
			data: [
				[localize('tableFromFileImport.serverName', 'Server name'), this.model.serverConn.serverName],
				[localize('tableFromFileImport.databaseName', 'Database name'), this.model.database],
				[localize('tableFromFileImport.tableName', 'Table name'), this.model.table],
				[localize('tableFromFileImport.tableSchema', 'Table schema'), this.model.newSchema ? this.model.newSchema : this.model.existingSchema],
				[localize('tableFromFileImport.fileFormat', 'File format name'), this.model.fileFormat],
				[sourceTitle, this.model.parentFile.filePath]
			],
			columns: ['Object type', 'Name'],
			width: 600,
			height: 200
		});
	}
}
