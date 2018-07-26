/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as path from 'path';
import * as sqlops from 'sqlops';
import { ImportDataModel, ColumnMetadata } from './dataModel';
import { DeferredPromise } from './flatFileWizard';
import { PROSEDiscoveryResponse } from '../services/contracts';
const localize = nls.loadMessageBundle();

const categoryValues = [
	{ name: 'bigint', displayName: 'bigint' },
	{ name: 'binary(50)', displayName: 'binary(50)' },
	{ name: 'bit', displayName: 'bit' },
	{ name: 'char(10)', displayName: 'char(10)' },
	{ name: 'date', displayName: 'date' },
	{ name: 'datetime', displayName: 'datetime' },
	{ name: 'datetime2(7)', displayName: 'datetime2(7)' },
	{ name: 'datetimeoffset(7)', displayName: 'datetimeoffset(7)' },
	{ name: 'decimal(18, 10)', displayName: 'decimal(18, 10)'},
	{ name: 'float', displayName: 'float'},
	{ name: 'geography', displayName: 'geography'},
	{ name: 'geometry', displayName: 'geometry'},
	{ name: 'hierarchyid', displayName: 'hierarchyid'},
	{ name: 'int', displayName: 'int'},
	{ name: 'money', displayName: 'money'},
	{ name: 'nchar(10)', displayName: 'nchar(10)'},
	{ name: 'ntext', displayName: 'ntext'},
	{ name: 'numeric(18, 0)', displayName: 'numeric(18, 0)'},
	{ name: 'nvarchar(50)', displayName: 'nvarchar(50)'},
	{ name: 'nvarchar(MAX)', displayName: 'nvarchar(MAX)'},
	{ name: 'real', displayName: 'real'},
	{ name: 'smalldatetime', displayName: 'smalldatetime'},
	{ name: 'smallint', displayName: 'smallint'},
	{ name: 'smallmoney', displayName: 'smallmoney'},
	{ name: 'sql_variant', displayName: 'sql_variant'},
	{ name: 'text', displayName: 'text'},
	{ name: 'time(7)', displayName: 'time(7)'},
	{ name: 'timestamp', displayName: 'timestamp'},
	{ name: 'tinyint', displayName: 'tinyint'},
	{ name: 'uniqueidentifier', displayName: 'uniqueidentifier'},
	{ name: 'varbinary(50)', displayName: 'varbinary(50)'},
	{ name: 'varbinary(MAX)', displayName: 'varbinary(MAX)'},
	{ name: 'varchar(50)', displayName: 'varchar(50)'},
	{ name: 'varchar(MAX)', displayName: 'varchar(MAX)'}
];


export async function modifyColumns(view: sqlops.ModelView, data: ImportDataModel, previewReadyPromise: DeferredPromise<PROSEDiscoveryResponse>) : Promise<void> {
	let formWrapper = view.modelBuilder.loadingComponent().component();
	formWrapper.loading = true;

	previewReadyPromise.promise.then(async () => {
		let description = view.modelBuilder.text()
		.withProperties({
			value: localize('flatFileImport.verifySchemaMessage', "Please verify that the table schema generated is accurate, and if not, please make any changes.")
		}).component();

		if (!data.proseColumns || data.proseColumns.length === 0) {
			let errorMsg = view.modelBuilder.text()
				.withProperties({
					value: localize('flatFileImport.dataModelError',"No data available")
				}).component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: description,
					title: ''
				},{
					component: errorMsg,
					title: 'Error'
				}], {
						horizontal: false,
						componentWidth: 400
					}).component();

			let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
			formWrapper.loading = false;
			return await view.initializeModel(formWrapper);
		}
		let declarativeTable = view.modelBuilder.declarativeTable()
				.withProperties({
					height: 400,
					columns: [{
						displayName: 'Column Name',
						valueType: sqlops.DeclarativeDataType.string,
						width: '150px',
						isReadOnly: false
					}, {
						displayName: 'Data Type',
						valueType: sqlops.DeclarativeDataType.editableCategory,
						width: '150px',
						isReadOnly: false,
						categoryValues: categoryValues
					}, {
						displayName: 'Primary Key',
						valueType: sqlops.DeclarativeDataType.boolean,
						width: '100px',
						isReadOnly: false
					}, {
						displayName: 'Allow Null',
						valueType: sqlops.DeclarativeDataType.boolean,
						isReadOnly: false,
						width: '100px'
					}
					],
					data: []
				}).component();

		data.proseColumns.forEach((v) => {declarativeTable.data.push(MetadataConverter(v));});

		declarativeTable.onDataChanged((e) => {
			data.proseColumns = [];
			declarativeTable.data.forEach((row) => {
				data.proseColumns.push({
					columnName: row[0],
					dataType: row[1],
					primaryKey: row[2],
					nullable: row[3]
				});
			});
		});

		let formModel = view.modelBuilder.formContainer()
			.withFormItems([{
				component: description,
				title: ''
			},{
				component: declarativeTable,
				title: ''
			}], {
					horizontal: false,
					componentWidth: '100%'
				}).component();
		formWrapper.component = formModel;
		formWrapper.loading = false;
	});

	await view.initializeModel(formWrapper);
}

// takes one line of input from PROSE and turns it into data for a row
export function MetadataConverter(column: ColumnMetadata): any[]{
	return [ column.columnName, column.dataType, false, column.nullable];
}

