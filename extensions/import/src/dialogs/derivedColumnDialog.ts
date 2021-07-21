/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// TODO: return the new trans column to wizard, send finalize trans request
import * as azdata from 'azdata';
import { ImportDataModel } from '../wizard/api/models';
import * as EventEmitter from 'events';
import { FlatFileProvider } from '../services/contracts';

export class DerivedColumnDialog {
	private _dialogObject: azdata.window.Dialog;
	private _doneEmitter: EventEmitter = new EventEmitter();
	private currentTransformation: string[] = [];
	private currentDerivedColumnName: string = '';

	constructor(private _model: ImportDataModel, private _provider: FlatFileProvider) {
	}

	public openDialog(): Promise<boolean> {
		this._dialogObject = azdata.window.createModelViewDialog(
			'Derived column',
			'DerivedColumnDialog',
			'wide'
		);

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
						width: '100px'
					}
				],
			}).component();

			const columnTableData: azdata.DeclarativeTableCellValue[][] = [];
			this._model.originalProseColumns.forEach(c => {
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
				if (e.value) {
					console.group(e.value);
					transformationTable.columns.push(
						{
							displayName: this._model.proseColumns[e.row].columnName,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: '100px'
						}
					);
					for (let index = 0; index < this._model.proseDataPreview.length; index++) {
						transformationTable.dataValues[index].push({ value: this._model.proseDataPreview[index][e.row] });
					}
				}
				else {
					let removeIndex = 0;
					for (let index = 0; index < transformationTable.columns.length; index++) {
						if (this._model.proseColumns[e.row].columnName === transformationTable.columns[index].displayName) {
							removeIndex = index;
							break;
						}
					}
					transformationTable.columns.splice(removeIndex, 1);
					for (let index = 0; index < this._model.proseDataPreview.length; index++) {
						transformationTable.dataValues[index].splice(removeIndex, 1);
					}
				}
				transformationContainer.clearItems();
				transformationContainer.addItem(transformationTable);
			});


			const columnContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '150px',
			}).withProps({
				CSSStyles: {
					'overflow-y': 'scroll'
				}
			}).component();
			columnContainer.addItem(columnTable);

			const transformationTableData: azdata.DeclarativeTableCellValue[][] = [];

			const transformationTable = view.modelBuilder.declarativeTable().withProps({
				columns: [
				],
			}).component();
			for (let index = 0; index < this._model.proseDataPreview.length; index++) {
				const tableRow: azdata.DeclarativeTableCellValue[] = [];
				transformationTableData.push(tableRow);
			}
			transformationTable.dataValues = transformationTableData;



			const applyButton = view.modelBuilder.button().withProps({
				label: 'Apply'
			}).component();

			const addButton = view.modelBuilder.button().withProps({
				label: 'Add'
			}).component();

			const removeButton = view.modelBuilder.button().withProps({
				label: 'Remove'
			}).component();


			applyButton.onDidClick(async e => {
				const requiredColNames = [];
				for (let index = 0; index < transformationTable.columns.length; index++) {
					requiredColNames[index] = transformationTable.columns[index].displayName;
				}
				const transExamples = [];
				for (let index = 0; index < specifyTransTable.dataValues.length; index++) {
					transExamples[index] = specifyTransTable.dataValues[index][0].value as string;
				}
				const response = await this._provider.sendTransformationGenerationRequest({
					columnNames: requiredColNames,
					transformationExamples: transExamples
				});
				this.currentTransformation = response.transformationPreview;
				for (let index = 0; index < this.currentTransformation.length; index++) {
					previewTable.dataValues[index][0] = { value: this.currentTransformation[index] };

				}
				previewContainer.clearItems();
				previewContainer.addItem(previewTable);
			});

			addButton.onDidClick(async e => {
				if (specifyTransTable.dataValues.length < this._model.proseDataPreview.length) {
					const tableRow: azdata.DeclarativeTableCellValue[] = [];
					tableRow.push({
						value: ''
					});
					specifyTransTable.dataValues.push(tableRow);
					specifyTransContainer.clearItems();
					specifyTransContainer.addItem(specifyTransTable);
					specifyTransContainer.addItem(applyButton);
					specifyTransContainer.addItem(addButton);
					specifyTransContainer.addItem(removeButton);
				}
			});

			removeButton.onDidClick(async e => {
				if (specifyTransTable.dataValues.length > 0) {
					specifyTransTable.dataValues.pop();
					specifyTransContainer.clearItems();
					specifyTransContainer.addItem(specifyTransTable);
					specifyTransContainer.addItem(applyButton);
					specifyTransContainer.addItem(addButton);
					specifyTransContainer.addItem(removeButton);
				}
			});

			const previewTable = view.modelBuilder.declarativeTable().withProps({
				columns: [
					{
						displayName: 'Preview',
						valueType: azdata.DeclarativeDataType.string,
						isReadOnly: true,
						width: '150px'
					}
				],
			}).component();

			const previewTableData: azdata.DeclarativeTableCellValue[][] = [];
			this._model.proseDataPreview.forEach(c => {
				const tableRow: azdata.DeclarativeTableCellValue[] = [];
				tableRow.push({
					value: '-'
				});
				previewTableData.push(tableRow);
			});
			previewTable.dataValues = previewTableData;


			const specifyTransTable = view.modelBuilder.declarativeTable().withProps({
				columns: [
					{
						displayName: 'Specify Transformation',
						valueType: azdata.DeclarativeDataType.string,
						isReadOnly: false,
						width: '100px'
					}
				],
			}).component();

			const specifyTransTableData: azdata.DeclarativeTableCellValue[][] = [];
			const specifyTransTableRow: azdata.DeclarativeTableCellValue[] = [];
			specifyTransTableRow.push({
				value: ''
			});
			specifyTransTableData.push(specifyTransTableRow);
			specifyTransTable.dataValues = specifyTransTableData;


			const specifyDerivedColNameTable = view.modelBuilder.declarativeTable().withProps({
				columns: [
					{
						displayName: 'Column Name?',
						valueType: azdata.DeclarativeDataType.string,
						isReadOnly: false,
						width: '150px'
					}
				],
			}).component();

			specifyDerivedColNameTable.onDataChanged(e => {
				this.currentDerivedColumnName = specifyDerivedColNameTable.dataValues[0][0].value as string;
			});

			const specifyDerivedColNameTableData: azdata.DeclarativeTableCellValue[][] = [];
			const colNameTableRow: azdata.DeclarativeTableCellValue[] = [];
			colNameTableRow.push({
				value: ''
			});
			specifyDerivedColNameTableData.push(colNameTableRow);
			specifyDerivedColNameTable.dataValues = specifyDerivedColNameTableData;

			const transformationContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '400px'
			}).withProps({
				CSSStyles: {
					'overflow-x': 'scroll'
				}
			}).component();


			const previewContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '150px'
			}).withProps({
				CSSStyles: {
					'overflow-x': 'scroll'
				}
			}).component();
			previewContainer.addItem(previewTable);

			const specifyDerivedColNameContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '150px'
			}).withProps({
				CSSStyles: {
					'overflow-x': 'scroll'
				}
			}).component();
			specifyDerivedColNameContainer.addItem(specifyDerivedColNameTable);

			const specifyTransContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '100px'
			}).withProps({
				CSSStyles: {
					'overflow-x': 'scroll'
				}
			}).component();
			specifyTransContainer.addItem(specifyTransTable);
			specifyTransContainer.addItem(applyButton);
			specifyTransContainer.addItem(addButton);
			specifyTransContainer.addItem(removeButton);

			const flexGrid = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'row',
				height: '100%',
				width: '100%'
			}).component();
			flexGrid.addItem(columnContainer, {
				flex: '0',
				CSSStyles: {
					width: '150px'
				}
			});
			flexGrid.addItem(transformationContainer, {
				flex: '0',
				CSSStyles: {
					width: '400px'
				}
			});
			flexGrid.addItem(specifyTransContainer, {
				flex: '0',
				CSSStyles: {
					width: '100px'
				}
			});
			flexGrid.addItem(previewContainer, {
				flex: '0',
				CSSStyles: {
					width: '150px'
				}
			});
			flexGrid.addItem(specifyDerivedColNameContainer, {
				flex: '0',
				CSSStyles: {
					width: '150px'
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


		this._dialogObject.okButton.onClick(e => {
			this._doneEmitter.emit('done');
		});

		this._dialogObject.cancelButton.onClick(e => {
			this._doneEmitter.emit('close');
		});

		this._dialogObject.content = [tab];
		azdata.window.openDialog(
			this._dialogObject
		);
		return new Promise((resolve) => {
			this._doneEmitter.once('done', async () => {
				if (this.currentTransformation.length > 0) {
					await this._provider.sendTransformationFinalizationRequest({
						derivedColumnName: this.currentDerivedColumnName
					});
					this._model.transPreviews.push(this.currentTransformation);
					this._model.derivedColumnName = this.currentDerivedColumnName;
					this._model.proseColumns.push({
						columnName: this.currentDerivedColumnName,
						dataType: 'nvarchar(MAX)',
						primaryKey: false,
						nullable: true
					});
					resolve(true);
				}
				else {
					resolve(false);
				}
				azdata.window.closeDialog(this._dialogObject);
			});

			this._doneEmitter.once('close', async () => {
				resolve(false);
				azdata.window.closeDialog(this._dialogObject);
			});
		});
	}
}
