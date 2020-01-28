/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { ImportDataModel } from '../api/models';
import { ImportPage } from '../api/importPage';
import { FlatFileProvider } from '../../services/contracts';
import { FlatFileWizard } from '../flatFileWizard';

const localize = nls.loadMessageBundle();

export class ProsePreviewPage extends ImportPage {

	private readonly successTitle: string = localize('flatFileImport.prosePreviewMessage', "This operation analyzed the input file structure to generate the preview below for up to the first 50 rows.");
	private readonly failureTitle: string = localize('flatFileImport.prosePreviewMessageFail', "This operation was unsuccessful. Please try a different input file.");

	private table: azdata.TableComponent;
	private loading: azdata.LoadingComponent;
	private form: azdata.FormContainer;
	private refresh: azdata.ButtonComponent;
	private resultTextComponent: azdata.TextComponent;
	private isSuccess: boolean;

	public constructor(instance: FlatFileWizard, wizardPage: azdata.window.WizardPage, model: ImportDataModel, view: azdata.ModelView, provider: FlatFileProvider) {
		super(instance, wizardPage, model, view, provider);
	}

	async start(): Promise<boolean> {
		this.table = this.view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
			data: undefined,
			columns: undefined,
			forceFitColumns: azdata.ColumnSizingMode.AutoFit
		}).component();
		this.refresh = this.view.modelBuilder.button().withProperties({
			label: localize('flatFileImport.refresh', "Refresh"),
			isFile: false
		}).component();

		this.refresh.onDidClick(async () => {
			await this.onPageEnter();
		});

		this.loading = this.view.modelBuilder.loadingComponent().component();

		this.resultTextComponent = this.view.modelBuilder.text()
			.withProperties({
				value: this.isSuccess ? this.successTitle : this.failureTitle
			}).component();

		this.form = this.view.modelBuilder.formContainer().withFormItems([
			{
				component: this.resultTextComponent,
				title: ''
			},
			{
				component: this.table,
				title: '',
				actions: [this.refresh]
			}
		]).component();

		this.loading.component = this.form;

		await this.view.initializeModel(this.loading);

		return true;
	}

	async onPageEnter(): Promise<boolean> {
		this.loading.loading = true;
		let proseResult: boolean;
		let error: string;
		try {
			proseResult = await this.handleProse();
		} catch (ex) {
			error = ex.toString();
		}

		this.loading.loading = false;
		if (proseResult) {
			await this.populateTable(this.model.proseDataPreview, this.model.proseColumns.map(c => c.columnName));
			this.isSuccess = true;
			if (this.form) {
				this.resultTextComponent.value = this.successTitle;
			}
			return true;
		} else {
			await this.populateTable([], []);
			this.isSuccess = false;
			if (this.form) {
				this.resultTextComponent.value = this.failureTitle + '\n' + (error ?? '');
			}
			return false;
		}
	}

	async onPageLeave(): Promise<boolean> {
		await this.emptyTable();
		return true;
	}

	async cleanup(): Promise<boolean> {
		delete this.model.proseDataPreview;
		return true;
	}

	public setupNavigationValidator() {
		this.instance.registerNavigationValidator((info) => {
			if (info) {
				// Prose Preview to Modify Columns
				if (info.lastPage === 1 && info.newPage === 2) {
					return !this.loading.loading && this.table.data && this.table.data.length > 0;
				}
			}
			return !this.loading.loading;
		});
	}

	private async handleProse(): Promise<boolean> {
		const response = await this.provider.sendPROSEDiscoveryRequest({
			filePath: this.model.filePath,
			tableName: this.model.table,
			schemaName: this.model.schema,
			fileType: this.model.fileType
		});

		this.model.proseDataPreview = null;
		if (response.dataPreview) {
			this.model.proseDataPreview = response.dataPreview;
		}

		this.model.proseColumns = [];
		if (response.columnInfo) {
			response.columnInfo.forEach((column) => {
				this.model.proseColumns.push({
					columnName: column.name,
					dataType: column.sqlType,
					primaryKey: false,
					nullable: column.isNullable
				});
			});
			return true;
		}

		return false;
	}

	private async populateTable(tableData: string[][], columnHeaders: string[]) {
		let rows;
		let rowsLength = tableData.length;

		if (rowsLength > 50) {
			rows = tableData;
		}
		else {
			rows = tableData.slice(0, rowsLength);
		}

		this.table.updateProperties({
			data: rows,
			columns: columnHeaders,
			height: 400,
			width: '700',
		});
	}

	private async emptyTable() {
		this.table.updateProperties([]);
	}
}
