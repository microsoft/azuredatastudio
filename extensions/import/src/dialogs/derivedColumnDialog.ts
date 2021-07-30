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
	private _view!: azdata.ModelView;
	private _specifyTransformations: azdata.InputBoxComponent[] = [];

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
			this._view = view;
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
					transformationTable.columns.splice(transformationTable.columns.length - 1, 0,
						{
							displayName: this._model.proseColumns[e.row].columnName,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: '100px'
						}
					);
					for (let index = 0; index < this._model.proseDataPreview.length; index++) {
						transformationTable.dataValues[index].splice(transformationTable.dataValues[index].length - 1, 0, { value: this._model.proseDataPreview[index][e.row] });
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
				transformationContainer.addItem(applyButton);
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
			for (let index = 0; index < this._model.proseDataPreview.length; index++) {
				const tableRow: azdata.DeclarativeTableCellValue[] = [];
				this._specifyTransformations.push(this._view.modelBuilder.inputBox().withProps({
					value: '',
					placeHolder: 'Specify Transformation'
				}).component());
				tableRow.push({
					value: this._specifyTransformations[index]
				});
				transformationTableData.push(tableRow);
			}

			const transformationTable = view.modelBuilder.declarativeTable().withProps({
				columns: [
					{
						displayName: 'Specify Transformation',
						valueType: azdata.DeclarativeDataType.component,
						isReadOnly: false,
						width: '200px'
					}
				],
				dataValues: transformationTableData
			}).component();

			// const delay = (function(){
			// 	let timer:NodeJS.Timeout;
			// 	return function(callback: any, ms: number){
			// 	clearTimeout (timer);
			// 	timer = setTimeout(callback, ms);
			//    };
			//   })();

			// this._specifyTransformations.forEach(i => {
			// 	i.onTextChanged(async e => {
			// 		delay(async ()=>{
			// 			const requiredColNames = [];
			// 			const numCols = transformationTable.columns.length - 1;
			// 			for (let index = 0; index < numCols; index++) {
			// 				requiredColNames[index] = transformationTable.columns[index].displayName;
			// 			}
			// 			const transExamples = [];
			// 			const transExampleIndices = [];

			// 			for (let index = 0; index < transformationTable.dataValues.length; index++) {
			// 				const example =(<azdata.InputBoxComponent>transformationTable.dataValues[index][numCols].value).value as string;
			// 				if (example === '') {
			// 					continue;
			// 				}
			// 				transExamples.push(example);
			// 				transExampleIndices.push(index);
			// 			}

			// 			const response = await this._provider.sendLearnTransformationRequest({
			// 				columnNames: requiredColNames,
			// 				transformationExamples: transExamples,
			// 				transformationExampleRowIndices: transExampleIndices
			// 			});
			// 			this.currentTransformation = response.transformationPreview;
			// 			for (let index = 0; index < this.currentTransformation.length; index++) {
			// 				(<azdata.InputBoxComponent>transformationTable.dataValues[index][transformationTable.columns.length - 1].value).placeHolder = this.currentTransformation[index];

			// 			}
			// 			transformationContainer.clearItems();
			// 			transformationContainer.addItem(transformationTable);
			// 			transformationContainer.addItem(applyButton);
			// 		}, 1000);
			// 	});
			// })

			const applyButton = view.modelBuilder.button().withProps({
				label: 'Apply',
				// width: '200px'
			}).component();

			applyButton.onDidClick(async e => {
				const requiredColNames = [];
				const numCols = transformationTable.columns.length - 1;
				for (let index = 0; index < numCols; index++) {
					requiredColNames[index] = transformationTable.columns[index].displayName;
				}
				const transExamples = [];
				const transExampleIndices = [];

				for (let index = 0; index < transformationTable.dataValues.length; index++) {
					const example = (<azdata.InputBoxComponent>transformationTable.dataValues[index][numCols].value).value as string;
					if (example === '') {
						continue;
					}
					transExamples.push(example);
					transExampleIndices.push(index);
				}

				const response = await this._provider.sendLearnTransformationRequest({
					columnNames: requiredColNames,
					transformationExamples: transExamples,
					transformationExampleRowIndices: transExampleIndices
				});
				this.currentTransformation = response.transformationPreview;
				for (let index = 0; index < this.currentTransformation.length; index++) {
					(<azdata.InputBoxComponent>transformationTable.dataValues[index][transformationTable.columns.length - 1].value).placeHolder = this.currentTransformation[index];

				}
				transformationContainer.clearItems();
				transformationContainer.addItem(transformationTable);
				transformationContainer.addItem(applyButton);
			});

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
				width: '700px'
			}).withProps({
				CSSStyles: {
					'overflow-x': 'scroll'
				}
			}).component();
			transformationContainer.addItem(transformationTable);
			transformationContainer.addItem(applyButton);

			const specifyDerivedColNameContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '150px'
			}).withProps({
				CSSStyles: {
					'overflow-x': 'scroll'
				}
			}).component();
			specifyDerivedColNameContainer.addItem(specifyDerivedColNameTable);

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
					width: '700px'
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
					await this._provider.sendSaveTransformationRequest({
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
