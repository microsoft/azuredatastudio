/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// TODO: move derived button here and add the new transformed column to the preview when the transformation is applied
import * as azdata from 'azdata';
import { ImportPage } from '../api/importPage';
import * as constants from '../../common/constants';
import { DerivedColumnDialog } from '../../dialogs/derivedColumnDialog';

export class ProsePreviewPage extends ImportPage {

	private _table: azdata.TableComponent;
	private _loading: azdata.LoadingComponent;
	private _form: azdata.FormContainer;
	private _refresh: azdata.ButtonComponent;
	private _resultTextComponent: azdata.TextComponent;
	private _isSuccess: boolean;
	private _createDerivedColumnButton: azdata.ButtonComponent;

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
		this.table = this.view.modelBuilder.table().withProps({
			data: undefined,
			columns: undefined,
			forceFitColumns: azdata.ColumnSizingMode.DataFit
		}).component();

		this._createDerivedColumnButton = this.view.modelBuilder.button().withProps({
			label: constants.createDerivedColumn,
			width: '200px',
			secondary: true
		}).component();

		this.refresh = this.view.modelBuilder.button().withProps({
			label: constants.refreshText,
			isFile: false,
			secondary: true
		}).component();

		this.refresh.onDidClick(async () => {
			await this.onPageEnter();
		});

		this._createDerivedColumnButton.onDidClick(async (e) => {
			const derivedColumnDialog = new DerivedColumnDialog(this.model, this.provider);
			const response = await derivedColumnDialog.openDialog();
			if (response) {
				(<string[]>this.table.columns).push(this.model.derivedColumnName);
				const newTable = this.table.data;
				const thisTrans = this.model.transPreviews[this.model.transPreviews.length - 1];
				for (let index = 0; index < thisTrans.length; index++) {
					newTable[index].push(thisTrans[index]);
				}
				this.table.updateProperties({
					data: newTable,
				});
			}
		});

		this.loading = this.view.modelBuilder.loadingComponent().component();

		this.resultTextComponent = this.view.modelBuilder.text()
			.withProps({
				value: this.isSuccess ? constants.successTitleText : constants.failureTitleText
			}).component();

		this.form = this.view.modelBuilder.formContainer().withFormItems([
			{
				component: this._createDerivedColumnButton,
				title: ''
			},
			{
				component: this.resultTextComponent,
				title: ''
			},
			{
				component: this.table,
				title: '',
				// actions: [this.refresh]
			}

		]).component();

		this.loading.component = this.form;

		await this.view.initializeModel(this.loading);

		return true;
	}

	async onPageEnter(): Promise<boolean> {
		let proseResult: boolean;
		let error: string;
		if (this.model.newFileSelected) {
			this.loading.loading = true;
			try {
				proseResult = await this.handleProse();
			} catch (ex) {
				error = ex.toString();
			}
			this.model.newFileSelected = false;
			this.loading.loading = false;
		}
		if (!this.model.newFileSelected || proseResult) {
			const tempTable = JSON.parse(JSON.stringify(this.model.proseDataPreview));
			for (let index = 0; index < this.model.transPreviews.length; index++) {
				for (let index2 = 0; index2 < this.model.proseDataPreview.length; index2++) {
					tempTable[index2].push(this.model.transPreviews[index][index2]);
				}
			}
			await this.populateTable(tempTable, this.model.proseColumns.map(c => c.columnName));
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

	override async onPageLeave(): Promise<boolean> {
		await this.emptyTable();
		return true;
	}

	override async cleanup(): Promise<boolean> {
		delete this.model.proseDataPreview;
		return true;
	}

	public override setupNavigationValidator() {
		this.instance.registerNavigationValidator((info) => {
			if (info) {
				// Prose Preview to Modify Columns
				if (info.lastPage === 1 && info.newPage === 2) {
					return this.table.data && this.table.data.length > 0;
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
		this.model.originalProseColumns = [];
		if (response.columnInfo) {
			response.columnInfo.forEach((column) => {
				this.model.proseColumns.push({
					columnName: column.name,
					dataType: column.sqlType,
					primaryKey: false,
					nullable: column.isNullable
				});
				this.model.originalProseColumns.push({
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
		this.table.updateProperties({
			data: [],
			columns: []
		});
	}
}
