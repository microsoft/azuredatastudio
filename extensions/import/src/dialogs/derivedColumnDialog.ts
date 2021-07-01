/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ImportDataModel } from '../wizard/api/models';
import * as EventEmitter from 'events';

export class DerivedColumnDialog {
	private _dialogObject: azdata.window.Dialog;
	private _doneEmitter: EventEmitter = new EventEmitter();

	constructor(private _model: ImportDataModel) {
	}

	public openDialog(): Promise<void> {
		this._dialogObject = azdata.window.createModelViewDialog(
			'Derived column',
			'DerivedColumnDialog',
			'wide'
		);

		this._dialogObject.okButton.onClick(e => {
			this._doneEmitter.emit('done');
		});

		this._dialogObject.cancelButton.onClick(e => {
			this._doneEmitter.emit('done');
		});

		let tab = azdata.window.createTab('');
		tab.registerContent(async (view: azdata.ModelView) => {
			const columnTable = view.modelBuilder.declarativeTable().withProps({
				columns: [
					{
						displayName: '',
						valueType: azdata.DeclarativeDataType.boolean,
						isReadOnly: false,
						width: '50px'
					},
					{
						displayName: 'Column',
						valueType: azdata.DeclarativeDataType.string,
						isReadOnly: true,
						width: '150px'
					}
				],
			}).component();

			const columnTableData: azdata.DeclarativeTableCellValue[][] = [];
			this._model.proseColumns.forEach(c => {
				const tableRow: azdata.DeclarativeTableCellValue[] = [];
				tableRow.push({
					value: false
				});
				tableRow.push({
					value: c.columnName
				});
				columnTableData.push(tableRow);
			});

			columnTable.dataValues = columnTableData;

			columnTable.onDataChanged(e => {
				//TODO: Add or remove columns and data from the transformation table
				console.log(e);


			});

			const columnContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '200px',
			}).withProps({
				CSSStyles: {
					'border-right': '1px solid',
					'overflow-y': 'scroll'
				}
			}).component();
			columnContainer.addItem(columnTable);


			const transformationTable = view.modelBuilder.declarativeTable().withProps({
				columns: [
				],
			}).component();

			const button = view.modelBuilder.button().withProps({
				label: 'Apply'
			}).component();

			const previewTable = view.modelBuilder.declarativeTable().withProps({
				columns: [
				],
			}).component();

			const transformationContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '500px'
			}).withItems([
				transformationTable,
				previewTable
			]).withProps({
				CSSStyles: {
					'overflow-x': 'scroll'
				}
			}).component();



			const flexGrid = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'row',
				height: '100%',
				width: '100%'
			}).component();
			flexGrid.addItem(columnContainer, {
				flex: '0',
				CSSStyles: {
					width: '200px'
				}
			});
			flexGrid.addItem(transformationContainer, {
				flex: '0',
				CSSStyles: {
					width: '500px'
				}
			});
			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: flexGrid
					}
				],
				{
					horizontal: false
				}
			);
			const form = formBuilder.withLayout({ width: '100%' }).component();
			return view.initializeModel(form);
		});
		this._dialogObject.content = [tab];
		azdata.window.openDialog(
			this._dialogObject
		);
		return new Promise((resolve) => {
			this._doneEmitter.once('done', async () => {
				azdata.window.closeDialog(this._dialogObject);
				resolve();
			});
		});
	}
}
