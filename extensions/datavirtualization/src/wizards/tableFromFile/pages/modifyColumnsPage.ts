/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';

import { ImportDataModel } from '../api/models';
import { ImportPage } from '../api/importPage';
import { TableFromFileWizard } from '../tableFromFileWizard';
import { DataSourceWizardService, ColumnDefinition } from '../../../services/contracts';

const localize = nls.loadMessageBundle();

export class ModifyColumnsPageUiElements {
	public table: azdata.DeclarativeTableComponent;
	public loading: azdata.LoadingComponent;
	public text: azdata.TextComponent;
}

export class ModifyColumnsPage extends ImportPage {
	private readonly categoryValues = [
		{ name: 'bigint', displayName: 'bigint' },
		{ name: 'binary(50)', displayName: 'binary(50)' },
		{ name: 'bit', displayName: 'bit' },
		{ name: 'char(10)', displayName: 'char(10)' },
		{ name: 'date', displayName: 'date' },
		{ name: 'datetime', displayName: 'datetime' },
		{ name: 'datetime2(7)', displayName: 'datetime2(7)' },
		{ name: 'datetimeoffset(7)', displayName: 'datetimeoffset(7)' },
		{ name: 'decimal(18, 10)', displayName: 'decimal(18, 10)' },
		{ name: 'float', displayName: 'float' },
		{ name: 'geography', displayName: 'geography' },
		{ name: 'geometry', displayName: 'geometry' },
		{ name: 'hierarchyid', displayName: 'hierarchyid' },
		{ name: 'int', displayName: 'int' },
		{ name: 'money', displayName: 'money' },
		{ name: 'nchar(10)', displayName: 'nchar(10)' },
		{ name: 'ntext', displayName: 'ntext' },
		{ name: 'numeric(18, 0)', displayName: 'numeric(18, 0)' },
		{ name: 'nvarchar(50)', displayName: 'nvarchar(50)' },
		{ name: 'nvarchar(MAX)', displayName: 'nvarchar(MAX)' },
		{ name: 'real', displayName: 'real' },
		{ name: 'smalldatetime', displayName: 'smalldatetime' },
		{ name: 'smallint', displayName: 'smallint' },
		{ name: 'smallmoney', displayName: 'smallmoney' },
		{ name: 'sql_variant', displayName: 'sql_variant' },
		{ name: 'text', displayName: 'text' },
		{ name: 'time(7)', displayName: 'time(7)' },
		{ name: 'timestamp', displayName: 'timestamp' },
		{ name: 'tinyint', displayName: 'tinyint' },
		{ name: 'uniqueidentifier', displayName: 'uniqueidentifier' },
		{ name: 'varbinary(50)', displayName: 'varbinary(50)' },
		{ name: 'varbinary(MAX)', displayName: 'varbinary(MAX)' },
		{ name: 'varchar(50)', displayName: 'varchar(50)' },
		{ name: 'varchar(MAX)', displayName: 'varchar(MAX)' }
	];
	private ui: ModifyColumnsPageUiElements;
	private form: azdata.FormContainer;

	public constructor(instance: TableFromFileWizard, wizardPage: azdata.window.WizardPage, model: ImportDataModel, view: azdata.ModelView, provider: DataSourceWizardService) {
		super(instance, wizardPage, model, view, provider);
	}

	public setUi(ui: ModifyColumnsPageUiElements) {
		this.ui = ui;
	}

	private static convertMetadata(column: ColumnDefinition): any[] {
		return [column.columnName, column.dataType, column.isNullable];
	}

	async start(): Promise<boolean> {
		this.ui = new ModifyColumnsPageUiElements();
		this.ui.loading = this.view.modelBuilder.loadingComponent().component();
		this.ui.table = this.view.modelBuilder.declarativeTable().component();
		this.ui.text = this.view.modelBuilder.text().component();

		this.ui.table.onDataChanged((e) => {
			this.model.proseColumns = [];
			this.ui.table.data.forEach((row) => {
				this.model.proseColumns.push({
					columnName: row[0],
					dataType: row[1],
					isNullable: row[2],
					collationName: undefined
				});
			});
		});

		this.form = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					{
						component: this.ui.text,
						title: ''
					},
					{
						component: this.ui.table,
						title: ''
					}
				], {
				horizontal: false,
				componentWidth: '100%'
			}).component();

		this.ui.loading.component = this.form;
		await this.view.initializeModel(this.form);
		return true;
	}

	async onPageEnter(): Promise<void> {
		this.ui.loading.loading = true;
		await this.populateTable();
		this.ui.loading.loading = false;
	}

	async onPageLeave(clickedNext: boolean): Promise<boolean> {
		if (this.ui.loading.loading) {
			return false;
		}
		return true;
	}

	private async populateTable() {
		let data: any[][] = [];

		this.model.proseColumns.forEach((column) => {
			data.push(ModifyColumnsPage.convertMetadata(column));
		});

		this.ui.table.updateProperties({
			columns: [{
				displayName: localize('tableFromFileImport.columnName', 'Column Name'),
				valueType: azdata.DeclarativeDataType.string,
				width: '150px',
				isReadOnly: false
			}, {
				displayName: localize('tableFromFileImport.dataType', 'Data Type'),
				valueType: azdata.DeclarativeDataType.editableCategory,
				width: '150px',
				isReadOnly: false,
				categoryValues: this.categoryValues
			}, {
				displayName: localize('tableFromFileImport.allowNulls', 'Allow Nulls'),
				valueType: azdata.DeclarativeDataType.boolean,
				isReadOnly: false,
				width: '100px'
			}],
			data: data
		});
	}
}
