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
	private _isSuccess: boolean;

	public get table(): azdata.TableComponent {
		return this._table;
	}

	public set table(table: azdata.TableComponent) {
		this._table = table;
	}

	public get loading(): azdata.LoadingComponent {
		return this._loading;
	}

	public set loading(loading: azdata.LoadingComponent) {
		this._loading = loading;
	}

	public get form(): azdata.FormContainer {
		return this._form;
	}

	public set form(form: azdata.FormContainer) {
		this._form = form;
	}

	public get refresh(): azdata.ButtonComponent {
		return this._refresh;
	}

	public set refresh(refresh: azdata.ButtonComponent) {
		this._refresh = refresh;
	}

	public get resultTextComponent(): azdata.TextComponent {
		return this._resultTextComponent;
	}

	public set resultTextComponent(resultTextComponent: azdata.TextComponent) {
		this._resultTextComponent = resultTextComponent;
	}

	public get isSuccess(): boolean {
		return this._isSuccess;
	}

	public set isSuccess(isSuccess: boolean) {
		this._isSuccess = isSuccess;
	}

	async start(): Promise<boolean> {
		this.table = this.view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
			data: undefined,
			columns: undefined,
			forceFitColumns: azdata.ColumnSizingMode.DataFit
		}).component();
		this.refresh = this.view.modelBuilder.button().withProperties({
			label: constants.refreshText,
			isFile: false
		}).component();

		this.refresh.onDidClick(async () => {
			await this.onPageEnter();
		});

		this.loading = this.view.modelBuilder.loadingComponent().component();

		this.resultTextComponent = this.view.modelBuilder.text()
			.withProperties({
				value: this.isSuccess ? constants.successTitleText : constants.failureTitleText
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
				this.resultTextComponent.value = constants.successTitleText;
			}
			return true;
		} else {
			await this.populateTable([], []);
			this.isSuccess = false;
			if (this.form) {
				this.resultTextComponent.value = constants.failureTitleText + '\n' + (error ?? '');
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
