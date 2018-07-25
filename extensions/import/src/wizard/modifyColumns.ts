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
const localize = nls.loadMessageBundle();

export async function modifyColumns(view: sqlops.ModelView, data: ImportDataModel) : Promise<void> {
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
				columns: [{
					displayName: 'Column Name',
					valueType: sqlops.DeclarativeDataType.string,
					width: '120px',
					isReadOnly: false
				}, {
					displayName: 'Data Type',
					valueType: sqlops.DeclarativeDataType.category,
					width: '100px',
					isReadOnly: false,
					editable: true,
					categoryValues: [
						// this should be read in from a constants file
						{ name: 'int', displayName: 'int' },
						{ name: 'char', displayName: 'char' },
						{ name: 'nvarchar(50)', displayName: 'nvarchar(50)'},
						{ name: 'nvarchar(100)', displayName: 'nvarchar(100)'}
					]
				}, {
					displayName: 'Primary Key',
					valueType: sqlops.DeclarativeDataType.boolean,
					width: '20px',
					isReadOnly: false
				}, {
					displayName: 'Allow Null',
					valueType: sqlops.DeclarativeDataType.boolean,
					isReadOnly: false,
					width: '20px'
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
				componentWidth: 400
			}).component();

	let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
	formWrapper.loading = false;
	await view.initializeModel(formWrapper);
}
/*
	export interface DeclarativeTableColumn {
		displayName: string;
		categoryValues: CategoryValue[];
		valueType: DeclarativeDataType;
		isReadOnly: boolean;
		width: number | string;
	}
*/


// takes one line of input from PROSE and turns it into data for a row
export function MetadataConverter(column: ColumnMetadata): any[]{
	return [ column.columnName, column.dataType, false, column.nullable];
}