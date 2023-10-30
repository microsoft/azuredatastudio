/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';

import { ImportDataModel } from '../api/models';
import { ImportPage } from '../api/importPage';
import { TableFromFileWizard } from '../tableFromFileWizard';
import { DataSourceWizardService, ColumnDefinition, ProseDiscoveryResponse } from '../../../services/contracts';
import { getErrorMessage } from '../../../utils';
import { extensionConfigSectionName, configProseParsingMaxLines, proseMaxLinesDefault } from '../../../constants';

const localize = nls.loadMessageBundle();

export class ProsePreviewPageUiElements {
	public table: azdata.TableComponent;
	public loading: azdata.LoadingComponent;
}

export class ProsePreviewPage extends ImportPage {
	private ui: ProsePreviewPageUiElements;
	private form: azdata.FormContainer;
	private proseParsingComplete: Promise<ProseDiscoveryResponse>;

	public constructor(instance: TableFromFileWizard, wizardPage: azdata.window.WizardPage, model: ImportDataModel, view: azdata.ModelView, provider: DataSourceWizardService) {
		super(instance, wizardPage, model, view, provider);

		this.proseParsingComplete = this.doProseDiscovery();
	}

	public setUi(ui: ProsePreviewPageUiElements) {
		this.ui = ui;
	}

	async start(): Promise<boolean> {
		this.ui = new ProsePreviewPageUiElements();
		this.ui.table = this.view.modelBuilder.table().component();
		this.ui.loading = this.view.modelBuilder.loadingComponent().component();

		this.form = this.view.modelBuilder.formContainer().withFormItems([
			{
				component: this.ui.table,
				title: localize('tableFromFileImport.prosePreviewMessage', 'This operation analyzed the input file structure to generate the preview below for up to the first 50 rows.')
			}
		]).component();

		this.ui.loading.component = this.form;

		await this.view.initializeModel(this.ui.loading);

		return true;
	}

	async onPageEnter(): Promise<void> {
		if (!this.model.proseDataPreview) {
			this.ui.loading.loading = true;
			await this.handleProsePreview();
			this.ui.loading.loading = false;

			await this.populateTable(this.model.proseDataPreview, this.model.proseColumns);
		}
	}

	async onPageLeave(clickedNext: boolean): Promise<boolean> {
		if (this.ui.loading.loading) {
			return false;
		}

		if (clickedNext) {
			// Should have shown an error for these already in the loading step
			return this.model.proseDataPreview !== undefined && this.model.proseColumns !== undefined;
		} else {
			return true;
		}
	}

	private async doProseDiscovery(): Promise<ProseDiscoveryResponse> {
		let maxLines = proseMaxLinesDefault;
		let config = vscode.workspace.getConfiguration(extensionConfigSectionName);
		if (config) {
			let maxLinesConfig = config[configProseParsingMaxLines];
			if (maxLinesConfig) {
				maxLines = maxLinesConfig;
			}
		}

		let contents = await this.model.proseParsingFile.getFileLinesAsString(maxLines);

		return this.provider.sendProseDiscoveryRequest({
			filePath: undefined,
			tableName: this.model.table,
			schemaName: this.model.newSchema ? this.model.newSchema : this.model.existingSchema,
			fileType: this.model.fileType,
			fileContents: contents
		});
	}

	private async handleProsePreview() {
		let result: ProseDiscoveryResponse;
		try {
			result = await this.proseParsingComplete;
		} catch (err) {
			this.instance.showErrorMessage(getErrorMessage(err));
			return;
		}

		if (!result || !result.dataPreview) {
			this.instance.showErrorMessage(localize('tableFromFileImport.noPreviewData', 'Failed to retrieve any data from the specified file.'));
			return;
		}

		if (!result.columnInfo) {
			this.instance.showErrorMessage(localize('tableFromFileImport.noProseInfo', 'Failed to generate column information for the specified file.'));
			return;
		}

		this.model.proseDataPreview = result.dataPreview;

		this.model.proseColumns = [];
		result.columnInfo.forEach((column) => {
			this.model.proseColumns.push({
				columnName: column.name,
				dataType: column.sqlType,
				isNullable: column.isNullable,
				collationName: undefined
			});
		});

		let unquoteString = (value: string): string => {
			return value ? value.replace(/^"(.*)"$/, '$1') : undefined;
		};
		this.model.columnDelimiter = unquoteString(result.columnDelimiter);
		this.model.firstRow = result.firstRow;
		this.model.quoteCharacter = unquoteString(result.quoteCharacter);
	}

	private async populateTable(tableData: string[][], columns: ColumnDefinition[]) {
		let columnHeaders: string[] = columns ? columns.map(c => c.columnName) : undefined;

		let rows;
		const maxRows = 50;
		if (tableData && tableData.length > maxRows) {
			rows = tableData.slice(0, maxRows);
		} else {
			rows = tableData;
		}

		this.ui.table.updateProperties({
			data: rows,
			columns: columnHeaders,
			height: 600,
			width: 800
		});
	}
}
