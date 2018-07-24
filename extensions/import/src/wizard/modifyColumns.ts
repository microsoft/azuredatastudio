/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as path from 'path';
import * as sqlops from 'sqlops';
const localize = nls.loadMessageBundle();

export async function modifyColumns(view: sqlops.ModelView) : Promise<void> {
	let description = view.modelBuilder.text()
		.withProperties({
			value: localize('flatFileImport.verifySchemaMessage', "Please verify that the table schema generated is accurate, and if not, please make any changes.")
		}).component();
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
					categoryValues: [
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
				data: [
					['ID', 'int', false, false],
					['Name', 'nvarchar(50)', false, false],
					['Address', 'nvarchar(100)', false, false],
					['Zipcode', 'int', false, false]
				]
			}).component();

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