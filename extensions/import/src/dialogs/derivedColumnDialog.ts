/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ImportDataModel } from '../wizard/api/models';
import * as EventEmitter from 'events';
import { FlatFileProvider } from '../services/contracts';
import * as constants from '../common/constants';

const headerLeft: azdata.CssStyles = {
	'border': 'none',
	'text-align': 'left',
	'white-space': 'nowrap',
	'text-overflow': 'ellipsis',
	'overflow': 'hidden',
	'border-bottom': '2px solid'
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
	private _specifyDerivedColumnNameContainer!: azdata.FlexContainer;

	constructor(private _model: ImportDataModel, private _provider: FlatFileProvider) {
	}

	public createDerivedColumn(): Promise<DerivedColumnDialogResult | undefined> {
		this._applyButton = azdata.window.createButton(constants.previewTransformation);
		this._applyButton.enabled = false;
		this._dialogObject = azdata.window.createModelViewDialog(
			constants.createDerivedColumn,
			'DerivedColumnDialog',
			'wide'
		);
		this._dialogObject.customButtons = [this._applyButton];
		this._applyButton.hidden = false;

		let tab = azdata.window.createTab('');
		tab.registerContent(async (view: azdata.ModelView) => {
			const columnTableData: azdata.DeclarativeTableCellValue[][] = [];
			this._model.originalProseColumns.forEach(c => {
				const tableRow: azdata.DeclarativeTableCellValue[] = [];
				tableRow.push(
					{ value: false, ariaLabel: constants.selectColumn(c.columnName) },
					{ value: c.columnName }
				);
				columnTableData.push(tableRow);
			});
			this._view = view;
			const columnTable = view.modelBuilder.declarativeTable().withProps({
				columns: [
					{
						displayName: '',
						ariaLabel: constants.selectAllColumns,
						valueType: azdata.DeclarativeDataType.boolean,
						isReadOnly: false,
						showCheckAll: true,
						width: '20px',
						headerCssStyles: headerLeft,
						rowCssStyles: styleLeft,
					},
					{
						displayName: constants.columnTableTitle,
						valueType: azdata.DeclarativeDataType.string,
						isReadOnly: true,
						width: '140px',
						headerCssStyles: headerLeft,
						rowCssStyles: styleLeft,
						ariaLabel: constants.columnTableTitle
					}
				],
				dataValues: columnTableData,
				CSSStyles: {
					'table-layout': 'fixed'
				}
			}).component();


			columnTable.onDataChanged(e => {
				if (e.value) {
					// Adding newly selected column to transformation table
					this._transformationTable.columns.push({
						displayName: this._model.proseColumns[e.row].columnName,
						valueType: azdata.DeclarativeDataType.string,
						isReadOnly: true,
						width: '100px',
						headerCssStyles: headerLeft,
						rowCssStyles: styleLeft
					});

					this._model.proseDataPreview.forEach((v, i) => {
						this._transformationTable.dataValues[i].push({ value: v[e.row] });
					});
				}
				else {
					// Removing unselected column from transformation table
					let removeIndex = this._transformationTable.columns.findIndex(v => this._model.proseColumns[e.row].columnName === v.displayName);
					this._transformationTable.columns.splice(removeIndex, 1);
					for (let index = 0; index < this._model.proseDataPreview.length; index++) {
						this._transformationTable.dataValues[index].splice(removeIndex, 1);
					}
				}
				const isColumnAdded = this._transformationTable.columns.length > 1;
				this.clearAndAddTransformationContainerComponents(isColumnAdded);
				this._applyButton.enabled = isColumnAdded;
			});


			const columnContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				height: '100%'
			}).withProps({
				CSSStyles: {
					'border-right': 'solid 1px'
				}
			}).component();
			columnContainer.addItem(columnTable, { flex: '1 1 auto', CSSStyles: { 'overflow-y': 'hidden' } });

			const transformationTableData: azdata.DeclarativeTableCellValue[][] = [];
			for (let index = 0; index < this._model.proseDataPreview.length; index++) {
				this._specifyTransformations.push(this._view.modelBuilder.inputBox().withProps({
					value: '',
					placeHolder: constants.specifyTransformation,
					ariaLabel: constants.specifyTransformationForRow(index)
				}).component());
				transformationTableData.push([{
					value: this._specifyTransformations[index]
				}]);
			}

			this._transformationTable = view.modelBuilder.declarativeTable().withProps({
				columns: [
					{
						displayName: constants.specifyTransformation,
						ariaLabel: constants.specifyTransformation,
						valueType: azdata.DeclarativeDataType.component,
						isReadOnly: false,
						width: '200px',
						headerCssStyles: headerLeft,
						rowCssStyles: styleLeft
					}
				],
				CSSStyles: {
					'table-layout': 'fixed',
					'overflow': 'scroll',
				},
				width: '800px',
				dataValues: transformationTableData
			}).component();




			this._applyButton.onClick(async e => {
				const requiredColNames = this._transformationTable.columns.map(v => v.displayName);
				requiredColNames.splice(0, 1); // Removing specify transformation column
				const transExamples: string[] = [];
				const transExampleIndices: number[] = [];

				// Getting all the example transformations specified by the user
				this._transformationTable.dataValues.forEach((v, index) => {
					const example = (<azdata.InputBoxComponent>v[0].value).value as string;
					if (example !== '') {
						transExamples.push(example);
						transExampleIndices.push(index);
					}
				});

				if (transExamples.length > 0) {
					try {
						const response = await this._provider.sendLearnTransformationRequest({
							columnNames: requiredColNames,
							transformationExamples: transExamples,
							transformationExampleRowIndices: transExampleIndices
						});
						this.currentTransformation = response.transformationPreview;
						this.currentTransformation.forEach((v, i) => {
							(<azdata.InputBoxComponent>this._transformationTable.dataValues[i][0].value).placeHolder = v;
						});
						this.clearAndAddTransformationContainerComponents(true);
					} catch (e) {
						this._dialogObject.message = {
							text: e.toString(),
							level: azdata.window.MessageLevel.Error
						};
					}
				}
				this.validatePage();
			});

			const columnNameText = view.modelBuilder.text().withProps({
				value: constants.specifyDerivedColNameTitle,
				requiredIndicator: true,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold'
				}
			}).component();

			const columnNameInput = view.modelBuilder.inputBox().withProps({
				ariaLabel: constants.specifyDerivedColNameTitle,
				required: true
			}).component();

			columnNameInput.onTextChanged(e => {
				if (e) {
					this.currentDerivedColumnName = e;
					this.validatePage();
				}
			});

			this._specifyDerivedColumnNameContainer = view.modelBuilder.flexContainer().withItems([
				columnNameText,
				columnNameInput
			]).withLayout({
				width: '500px'
			}).component();

			this._transformationContainer = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column',
				height: '100%',
			}).withProps({
				CSSStyles: {
					'overflow-y': 'auto',
					'margin-left': '10px',
				}
			}).component();

			this._headerInstructionText = this._view.modelBuilder.text()
				.withProps({
					value: constants.headerIntructionText,
					CSSStyles: {
						'font-size': 'x-large',
						'line-height': '22pt',
						'margin-bottom': '0.7em'
					}
				}).component();

			this._bodyInstructionText = this._view.modelBuilder.text()
				.withProps({
					value: [
						constants.deriverColumnInstruction1,
						constants.deriverColumnInstruction2,
						constants.deriverColumnInstruction3,
						constants.deriverColumnInstruction4,
						constants.deriverColumnInstruction5,
					],
					textType: azdata.TextType.OrderedList,
					CSSStyles: {
						'font-size': 'large',
						'line-height': '22pt',
						'margin-left': '1em',
						'margin-top': '0em'
					}
				}).component();

			this.clearAndAddTransformationContainerComponents(false);

			const flexGrid = view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'row',
				height: '100%',
				width: '100%'
			}).component();

			/**
			 * Setting height of the div based on the total viewport height after removing dialog
			 * header and footer heights. With this the div will occupy the entire page space of the dialog.
			 */
			flexGrid.addItem(columnContainer, {
				flex: '0 0 auto',
				CSSStyles: {
					'min-height': 'calc(100vh - 160px)'
				}
			});
			flexGrid.addItem(this._transformationContainer, {
				flex: '0 0 auto',
				CSSStyles: {
					'overflow': 'scroll',
					'padding-right': '10px',
					'width': '900px',
					'max-height': 'calc(100vh - 160px)'
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
		azdata.window.openDialog(this._dialogObject);
		return new Promise((resolve) => {
			this._doneEmitter.once('done', async () => {
				try {
					await this._provider.sendSaveTransformationRequest({
						derivedColumnName: this.currentDerivedColumnName
					});
					resolve({
						derivedColumnName: this.currentDerivedColumnName,
						derivedColumnDataPreview: this.currentTransformation
					});
				} catch (e) {
					console.log(e); // Need to have better error handling for saved transformation. However this seems to be mostly a non-issue.
				}
			});

			this._doneEmitter.once('close', async () => {
				resolve(undefined);
				azdata.window.closeDialog(this._dialogObject);
			});
		});
	}

	private clearAndAddTransformationContainerComponents(addTable: boolean): void {
		this._transformationContainer.clearItems();
		if (addTable) {
			this._transformationContainer.addItem(this._specifyDerivedColumnNameContainer, { flex: '0 0 auto' });
			this._transformationContainer.addItem(this._transformationTable, { flex: '1 1 auto', CSSStyles: { 'overflow': 'scroll' } });
		}
		else {
			this._transformationContainer.addItem(this._headerInstructionText, { flex: '0 0 auto' });
			this._transformationContainer.addItem(this._bodyInstructionText, { flex: '0 0 auto' });
		}
	}

	private validatePage(): void {
		this._dialogObject.okButton.enabled = this.currentDerivedColumnName !== undefined && this.currentTransformation.length !== 0;
	}
}

export interface DerivedColumnDialogResult {
	derivedColumnName?: string;
	derivedColumnDataPreview?: string[];
}
