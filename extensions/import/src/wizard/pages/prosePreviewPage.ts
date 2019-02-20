/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import { ImportDataModel } from '../api/models';
import { ImportPage } from '../api/importPage';
import { FlatFileProvider } from '../../services/contracts';
import { FlatFileWizard } from '../flatFileWizard';

const localize = nls.loadMessageBundle();

export class ProsePreviewPage extends ImportPage {
	private table: sqlops.TableComponent;
	private loading: sqlops.LoadingComponent;
	private form: sqlops.FormContainer;
	private refresh: sqlops.ButtonComponent;

	public constructor(instance: FlatFileWizard, wizardPage: sqlops.window.WizardPage, model: ImportDataModel, view: sqlops.ModelView, provider: FlatFileProvider) {
		super(instance, wizardPage, model, view, provider);
	}

	async start(): Promise<boolean> {
		this.table = this.view.modelBuilder.table().component();
		this.refresh = this.view.modelBuilder.button().withProperties({
			label: localize('flatFileImport.refresh', 'Refresh'),
			isFile: false
		}).component();

		this.refresh.onDidClick(async () => {
			this.onPageEnter();
		});

		this.loading = this.view.modelBuilder.loadingComponent().component();

		this.form = this.view.modelBuilder.formContainer().withFormItems([
			{
				component: this.table,
				title: localize('flatFileImport.prosePreviewMessage', 'This operation analyzed the input file structure to generate the preview below for up to the first 50 rows.'),
				actions: [this.refresh]
			}
		]).component();

		this.loading.component = this.form;

		await this.view.initializeModel(this.loading);

		return true;
	}

	async onPageEnter(): Promise<boolean> {
		this.loading.loading = true;
		await this.handleProse();
		await this.populateTable(this.model.proseDataPreview, this.model.proseColumns.map(c => c.columnName));
		this.loading.loading = false;

		return true;
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
			return !this.loading.loading;
		});
	}

	private async handleProse() {
		await this.provider.sendPROSEDiscoveryRequest({
			filePath: this.model.filePath,
			tableName: this.model.table,
			schemaName: this.model.schema,
			fileType: this.model.fileType
		}).then((result) => {
			this.model.proseDataPreview = result.dataPreview;
			this.model.proseColumns = [];
			result.columnInfo.forEach((column) => {
				this.model.proseColumns.push({
					columnName: column.name,
					dataType: column.sqlType,
					primaryKey: false,
					nullable: column.isNullable
				});
			});
		});
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
