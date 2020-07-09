/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ColumnMetadata, ColumnMetadataArray } from '../api/models';
import { ImportPage } from '../api/importPage';
import * as constants from '../../common/constants';

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

	private _table: azdata.DeclarativeTableComponent;
	private _loading: azdata.LoadingComponent;
	private _text: azdata.TextComponent;
	private _form: azdata.FormContainer;

	public get table(): azdata.DeclarativeTableComponent {
		return this._table;
	}

	public set table(table: azdata.DeclarativeTableComponent) {
		this._table = table;
	}

	public get loading(): azdata.LoadingComponent {
		return this._loading;
	}

	public set loading(loading: azdata.LoadingComponent) {
		this._loading = loading;
	}

	public get text(): azdata.TextComponent {
		return this._text;
	}

	public set text(text: azdata.TextComponent) {
		this._text = text;
	}

	public get form(): azdata.FormContainer {
		return this._form;
	}

	public set form(form: azdata.FormContainer) {
		this._form = form;
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
		this.instance.changeNextButtonLabel(constants.importDataText);
		this.loading.loading = false;

		return true;
	}

	async onPageLeave(): Promise<boolean> {
		this.instance.changeNextButtonLabel(constants.nextText);
		return undefined;
	}

	async cleanup(): Promise<boolean> {
		delete this.model.proseColumns;
		this.instance.changeNextButtonLabel(constants.nextText);

		return true;
	}

	public setupNavigationValidator() {
		this.instance.registerNavigationValidator((info) => {
			return !this.loading.loading && this.table.data && this.table.data.length > 0;
		});
	}

	private async populateTable() {
		let data: ColumnMetadataArray[] = [];

		this.model.proseColumns.forEach((column) => {
			data.push(ModifyColumnsPage.convertMetadata(column));
		});

		this.table.updateProperties({
			columns: [{
				displayName: constants.columnNameText,
				valueType: azdata.DeclarativeDataType.string,
				width: '150px',
				isReadOnly: false
			}, {
				displayName: constants.dataTypeText,
				valueType: azdata.DeclarativeDataType.editableCategory,
				width: '150px',
				isReadOnly: false,
				categoryValues: this.categoryValues
			}, {
				displayName: constants.primaryKeyText,
				valueType: azdata.DeclarativeDataType.boolean,
				width: '100px',
				isReadOnly: false,
				showCheckAll: true
			}, {
				displayName: constants.allowNullsText,
				valueType: azdata.DeclarativeDataType.boolean,
				isReadOnly: false,
				width: '100px',
				showCheckAll: true
			}],
			data: data
		});
	}
}
