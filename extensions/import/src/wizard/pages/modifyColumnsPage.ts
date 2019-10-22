/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { ColumnMetadata, ImportDataModel } from '../api/models';
import { ImportPage } from '../api/importPage';
import { FlatFileProvider } from '../../services/contracts';
import { FlatFileWizard } from '../flatFileWizard';

const localize = nls.loadMessageBundle();

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
	private table: azdata.DeclarativeTableComponent;
	private loading: azdata.LoadingComponent;
	private text: azdata.TextComponent;
	private form: azdata.FormContainer;

	public constructor(instance: FlatFileWizard, wizardPage: azdata.window.WizardPage, model: ImportDataModel, view: azdata.ModelView, provider: FlatFileProvider) {
		super(instance, wizardPage, model, view, provider);
	}


	private static convertMetadata(column: ColumnMetadata): any[] {
		return [column.columnName, column.dataType, false, column.nullable];
	}

	async start(): Promise<boolean> {
		this.loading = this.view.modelBuilder.loadingComponent().component();
		this.table = this.view.modelBuilder.declarativeTable().component();
		this.text = this.view.modelBuilder.text().component();

		this.table.onDataChanged((e) => {
			this.model.proseColumns = [];
			this.table.data.forEach((row) => {
				this.model.proseColumns.push({
					columnName: row[0],
					dataType: row[1],
					primaryKey: row[2],
					nullable: row[3]
				});
			});
		});


		this.form = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					{
						component: this.text,
						title: ''
					},
					{
						component: this.table,
						title: ''
					}
				], {
				horizontal: false,
				componentWidth: '100%'
			}).component();

		this.loading.component = this.form;
		await this.view.initializeModel(this.form);
		return true;
	}

	async onPageEnter(): Promise<boolean> {
		this.loading.loading = true;
		await this.populateTable();
		this.instance.changeNextButtonLabel(localize('flatFileImport.importData', 'Import Data'));
		this.loading.loading = false;

		return true;
	}

	async onPageLeave(): Promise<boolean> {
		this.instance.changeNextButtonLabel(localize('flatFileImport.next', 'Next'));
		return undefined;
	}

	async cleanup(): Promise<boolean> {
		delete this.model.proseColumns;
		this.instance.changeNextButtonLabel(localize('flatFileImport.next', 'Next'));

		return true;
	}

	public setupNavigationValidator() {
		this.instance.registerNavigationValidator((info) => {
			return !this.loading.loading && this.table.data && this.table.data.length > 0;
		});
	}

	private async populateTable() {
		let data: any[][] = [];

		this.model.proseColumns.forEach((column) => {
			data.push(ModifyColumnsPage.convertMetadata(column));
		});

		this.table.updateProperties({
			height: 400,
			columns: [{
				displayName: localize('flatFileImport.columnName', 'Column Name'),
				valueType: azdata.DeclarativeDataType.string,
				width: '150px',
				isReadOnly: false
			}, {
				displayName: localize('flatFileImport.dataType', 'Data Type'),
				valueType: azdata.DeclarativeDataType.editableCategory,
				width: '150px',
				isReadOnly: false,
				categoryValues: this.categoryValues
			}, {
				displayName: localize('flatFileImport.primaryKey', 'Primary Key'),
				valueType: azdata.DeclarativeDataType.boolean,
				width: '100px',
				isReadOnly: false
			}, {
				displayName: localize('flatFileImport.allowNulls', 'Allow Nulls'),
				valueType: azdata.DeclarativeDataType.boolean,
				isReadOnly: false,
				width: '100px'
			}],
			data: data
		});


	}

}
