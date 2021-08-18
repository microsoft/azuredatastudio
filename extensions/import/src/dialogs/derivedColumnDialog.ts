/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ImportDataModel } from '../wizard/api/models';
import * as EventEmitter from 'events';
import { FlatFileProvider } from '../services/contracts';

const headerLeft: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'left',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
	'border-bottom': '1px solid'
};

const styleLeft: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'left',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
};

export class DerivedColumnDialog {
	private _dialogObject: azdata.window.Dialog;
	private _doneEmitter: EventEmitter = new EventEmitter();
	private currentTransformation: string[] = [];
	private currentDerivedColumnName: string = '';
	private _view!: azdata.ModelView;
	private _specifyTransformations: azdata.InputBoxComponent[] = [];
	private _headerInstructionText: azdata.TextComponent;
	private _bodyInstructionText: azdata.TextComponent;


	private _applyButton!: azdata.window.Button;
	private _transformationTable!: azdata.DeclarativeTableComponent;
	private _transformationContainer!: azdata.FlexContainer;

	constructor(private _model: ImportDataModel, private _provider: FlatFileProvider) {
	}

	public openDialog(): Promise<boolean> {
		this._applyButton = azdata.window.createButton('Preview Transformation');
		this._dialogObject = azdata.window.createModelViewDialog(
			'Derived column',
			'DerivedColumnDialog',
			'wide'
		);
		this._dialogObject.customButtons = [this._applyButton];
		this._applyButton.hidden = false;
		this._dialogObject.okButton.enabled = false;

		let tab = azdata.window.createTab('');
		tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;
			const columnTable = view.modelBuilder.declarativeTable().withProps({
				columns: [
					{
						displayName: '',
						valueType: azdata.DeclarativeDataType.boolean,
						isReadOnly: false,
						showCheckAll: true,
						width: '20px',
						headerCssStyles: headerLeft,
						rowCssStyles: styleLeft
					},
					{
						displayName: 'Column',
						valueType: azdata.DeclarativeDataType.string,
						isReadOnly: true,
						width: '140px',
						headerCssStyles: headerLeft,
						rowCssStyles: styleLeft
					}
				],
				CSSStyles: {
					'table-layout': 'fixed'
				}
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
				if (e.value) {
					this._transformationTable.columns.splice(this._transformationTable.columns.length - 1, 0,
						{
							displayName: this._model.proseColumns[e.row].columnName,
							valueType: azdata.DeclarativeDataType.string,
							isReadOnly: true,
							width: '100px',
							headerCssStyles: headerLeft,
							rowCssStyles: styleLeft
						}
					);
					for (let index = 0; index < this._model.proseDataPreview.length; index++) {
						this._transformationTable.dataValues[index].splice(this._transformationTable.dataValues[index].length - 1, 0, { value: this._model.proseDataPreview[index][e.row] });
					}

				}
				else {
					let removeIndex = 0;
					for (let index = 0; index < this._transformationTable.columns.length; index++) {
						if (this._model.proseColumns[e.row].columnName === this._transformationTable.columns[index].displayName) {
							removeIndex = index;
							break;
						}
					}
					this._transformationTable.columns.splice(removeIndex, 1);
					for (let index = 0; index < this._model.proseDataPreview.length; index++) {
						this._transformationTable.dataValues[index].splice(removeIndex, 1);
					}
				}
				this.clearAndAddTransformationContainerComponents(this._transformationTable.columns.length > 1);
			});


			const columnContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '180px',
				height: '100%'
			}).withProps({
				CSSStyles: {
					'border-right': 'solid 1px'
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

			this._transformationTable = view.modelBuilder.declarativeTable().withProps({
				height: '100%',
				columns: [
					{
						displayName: 'Specify Transformation',
						valueType: azdata.DeclarativeDataType.component,
						isReadOnly: false,
						width: '200px',
						headerCssStyles: headerLeft,
						rowCssStyles: styleLeft
					}
				],
				CSSStyles: {
					'table-layout': 'fixed'
				},
				dataValues: transformationTableData
			}).component();




			this._applyButton.onClick(async e => {

				const numCols = this._transformationTable.columns.length - 1;
				const requiredColNames = this._transformationTable.columns.map(v => v.displayName);
				const transExamples: string[] = [];
				const transExampleIndices: number[] = [];

				this._transformationTable.dataValues.forEach((v, index) => {
					const example = (<azdata.InputBoxComponent>v[numCols].value).value as string;
					if (example === '') {
						transExamples.push(example);
						transExampleIndices.push(index);
					}
				});
				if (transExamples.length > 0) {
					const response = await this._provider.sendLearnTransformationRequest({
						columnNames: requiredColNames,
						transformationExamples: transExamples,
						transformationExampleRowIndices: transExampleIndices
					});
					this.currentTransformation = response.transformationPreview;
					for (let index = 0; index < this.currentTransformation.length; index++) {
						(<azdata.InputBoxComponent>this._transformationTable.dataValues[index][this._transformationTable.columns.length - 1].value).placeHolder = this.currentTransformation[index];
					}
					this.clearAndAddTransformationContainerComponents(true);
				}
				this.validatePage();
			});

			const specifyDerivedColNameTable = view.modelBuilder.declarativeTable().withProps({
				columns: [
					{
						displayName: 'Column Name',
						valueType: azdata.DeclarativeDataType.string,
						isReadOnly: false,
						width: '150px',
						headerCssStyles: headerLeft,
						rowCssStyles: styleLeft,
					}
				],
				height: '100vh',
			}).component();

			specifyDerivedColNameTable.onDataChanged(e => {
				console.log(columnContainer);
				this.currentDerivedColumnName = specifyDerivedColNameTable.dataValues[0][0].value as string;
				this.validatePage();
			});

			const specifyDerivedColNameTableData: azdata.DeclarativeTableCellValue[][] = [];
			const colNameTableRow: azdata.DeclarativeTableCellValue[] = [];
			colNameTableRow.push({
				value: ''
			});
			specifyDerivedColNameTableData.push(colNameTableRow);
			specifyDerivedColNameTable.dataValues = specifyDerivedColNameTableData;

			this._transformationContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '700px',
				height: '100vh'
			}).withProps({
				CSSStyles: {
					'overflow-y': 'auto',
					'margin-left': '10px',
				}
			}).component();

			this._headerInstructionText = this._view.modelBuilder.text()
				.withProps({
					value: 'Welcome to the Derived Column Tool! To get started, please follow the steps below:',
					CSSStyles: {
						'font-size': 'x-large',
						'line-height': '22pt',
						'margin-bottom': '0.7em'
					}
				}).component();

			this._bodyInstructionText = this._view.modelBuilder.text()
				.withProps({
					value: '1. Select the columns of data on the left required to derive your new column\n\t\
				2. Select a row and specify an example transformation that you would like applied to the rest of the column\n\t\
				3. Click \"Preview Transformation\" to preview the transformation\n\t\
				4. Refine your transformation until you have the desired column\n\t\
				5. Specify the new derived column\'s name and click \"Done\"',
					CSSStyles: {
						'font-size': 'large',
						'line-height': '22pt',
						'margin-left': '1em',
						'margin-top': '0em'
					}
				}).component();

			this._transformationContainer.addItem(this._headerInstructionText);
			this._transformationContainer.addItem(this._bodyInstructionText);


			const specifyDerivedColNameContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				width: '150px'
			}).component();
			specifyDerivedColNameContainer.addItem(specifyDerivedColNameTable);

			const flexGrid = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'row',
				height: '800px',
			}).component();
			flexGrid.addItem(columnContainer, {
				flex: '0 0 auto',
				CSSStyles: {
					'overflow-y': 'auto',
					'padding-right': '10px',
					'height': '100vh'
				}
			});
			flexGrid.addItem(this._transformationContainer, {
				flex: '0 0 auto',
				CSSStyles: {
					'overflow-y': 'auto',
					'padding-right': '10px',
					'height': '100vh'
				}
			});
			flexGrid.addItem(specifyDerivedColNameContainer, {
				flex: '0 0 auto',
				CSSStyles: {
					'margin-left': '10px',
					'height': '100vh'
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
				azdata.window.closeDialog(this._dialogObject);
			});

			this._doneEmitter.once('close', async () => {
				resolve(false);
				azdata.window.closeDialog(this._dialogObject);
			});
		});
	}

	private clearAndAddTransformationContainerComponents(addTable: boolean): void {
		this._transformationContainer.updateCssStyles({
			'width': '700px'
		});
		this._transformationContainer.clearItems();
		if (addTable) {
			this._transformationContainer.addItem(this._transformationTable);
		}
		else {
			this._transformationContainer.addItem(this._headerInstructionText);
			this._transformationContainer.addItem(this._bodyInstructionText);
		}
	}

	private validatePage(): void {
		if (this.currentTransformation.length > 0 && this.currentDerivedColumnName.length > 0) {
			this._dialogObject.okButton.enabled = true;
		}
	}
}
