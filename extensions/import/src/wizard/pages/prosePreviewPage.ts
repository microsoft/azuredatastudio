/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ImportPage } from '../api/importPage';
import * as constants from '../../common/constants';

export class ProsePreviewPage extends ImportPage {

	private _table: azdata.TableComponent;
	private _loading: azdata.LoadingComponent;
	private _form: azdata.FormContainer;
	private _refresh: azdata.ButtonComponent;
	private _resultTextComponent: azdata.TextComponent;
	private isSuccess: boolean;

	public get table(): azdata.TableComponent {
		return this._table;
	}

	public get loading(): azdata.LoadingComponent {
		return this._loading;
	}

	public get form(): azdata.FormContainer {
		return this._form;
	}

	public get refresh(): azdata.ButtonComponent {
		return this._refresh;
	}

	public get resultTextComponent(): azdata.TextComponent {
		return this._resultTextComponent;
	}

	async start(): Promise<boolean> {
		this._table = this.view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
			data: undefined,
			columns: undefined,
			forceFitColumns: azdata.ColumnSizingMode.DataFit
		}).component();
		this._refresh = this.view.modelBuilder.button().withProperties({
			label: constants.refreshText,
			isFile: false
		}).component();

		this._refresh.onDidClick(async () => {
			await this.onPageEnter();
		});

		this._loading = this.view.modelBuilder.loadingComponent().component();

		this._resultTextComponent = this.view.modelBuilder.text()
			.withProperties({
				value: this.isSuccess ? constants.successTitleText : constants.failureTitleText
			}).component();

		this._form = this.view.modelBuilder.formContainer().withFormItems([
			{
				component: this._resultTextComponent,
				title: ''
			},
			{
				component: this._table,
				title: '',
				actions: [this._refresh]
			}
		]).component();

		this._loading.component = this._form;

		await this.view.initializeModel(this._loading);

		return true;
	}

	async onPageEnter(): Promise<boolean> {
		this._loading.loading = true;
		let proseResult: boolean;
		let error: string;
		try {
			proseResult = await this.handleProse();
		} catch (ex) {
			error = ex.toString();
		}

		this._loading.loading = false;
		if (proseResult) {
			await this.populateTable(this.model.proseDataPreview, this.model.proseColumns.map(c => c.columnName));
			this.isSuccess = true;
			if (this._form) {
				this._resultTextComponent.value = constants.successTitleText;
			}
			return true;
		} else {
			await this.populateTable([], []);
			this.isSuccess = false;
			if (this._form) {
				this._resultTextComponent.value = constants.failureTitleText + '\n' + (error ?? '');
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
					return !this._loading.loading && this._table.data && this._table.data.length > 0;
				}
			}
			return !this._loading.loading;
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

		this._table.updateProperties({
			data: rows,
			columns: columnHeaders,
			height: 400,
			width: '700',
		});
	}

	private async emptyTable() {
		this._table.updateProperties([]);
	}
}
