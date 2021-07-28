/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../../common/constants';
import { ModelViewBase, DeleteModelEventName, EditModelEventName, PredictWizardEventName } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import { ImportedModel } from '../../../modelManagement/interfaces';
import { IDataComponent, IComponentSettings } from '../../interfaces';
import { ModelArtifact } from '../prediction/modelArtifact';
import * as utils from '../../../common/utils';

/**
 * View to render registered models table
 */
export class CurrentModelsTable extends ModelViewBase implements IDataComponent<ImportedModel[]> {

	private _table: azdata.DeclarativeTableComponent | undefined;
	private _modelBuilder: azdata.ModelBuilder | undefined;
	private _selectedModels: ImportedModel[] = [];
	private _loader: azdata.LoadingComponent | undefined;
	private _downloadedFile: ModelArtifact | undefined;
	private _onModelSelectionChanged: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onModelSelectionChanged: vscode.Event<void> = this._onModelSelectionChanged.event;
	public modelCounts: number = 0;

	/**
	 * Creates new view
	 */
	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase, private _settings: IComponentSettings) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder register the components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._modelBuilder = modelBuilder;
		let columns: azdata.DeclarativeTableColumn[] = [];
		if (this._settings.selectable) {
			columns.push(
				{ // Action
					displayName: '',
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: 50,
					headerCssStyles: {
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						...constants.cssStyles.tableRow
					},
				});
		}
		columns.push(...[
			{ // Name
				displayName: constants.modelName,
				ariaLabel: constants.modelName,
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: 150,
				headerCssStyles: {
					...constants.cssStyles.tableHeader
				},
				rowCssStyles: {
					...constants.cssStyles.tableRow
				},
			},
			{ // Created
				displayName: constants.modelCreated,
				ariaLabel: constants.modelCreated,
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: 150,
				headerCssStyles: {
					...constants.cssStyles.tableHeader
				},
				rowCssStyles: {
					...constants.cssStyles.tableRow
				},
			},
			{ // Version
				displayName: constants.modelVersion,
				ariaLabel: constants.modelVersion,
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: 150,
				headerCssStyles: {
					...constants.cssStyles.tableHeader
				},
				rowCssStyles: {
					...constants.cssStyles.tableRow
				},
			},
			{ // Format
				displayName: constants.modelFramework,
				ariaLabel: constants.modelFramework,
				valueType: azdata.DeclarativeDataType.string,
				isReadOnly: true,
				width: 150,
				headerCssStyles: {
					...constants.cssStyles.tableHeader
				},
				rowCssStyles: {
					...constants.cssStyles.tableRow
				},
			}
		]);
		if (this._settings.editable) {
			columns.push(...[{ // Action
				displayName: '',
				valueType: azdata.DeclarativeDataType.component,
				isReadOnly: true,
				width: 50,
				headerCssStyles: {
					...constants.cssStyles.tableHeader
				},
				rowCssStyles: {
					...constants.cssStyles.tableRow
				},
			},
			{ // Action
				displayName: '',
				valueType: azdata.DeclarativeDataType.component,
				isReadOnly: true,
				width: 50,
				headerCssStyles: {
					...constants.cssStyles.tableHeader
				},
				rowCssStyles: {
					...constants.cssStyles.tableRow
				},
			}
			]);
			columns.push(
				{ // Action
					displayName: '',
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: 50,
					headerCssStyles: {
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						...constants.cssStyles.tableRow
					},
				}
			);
		}
		this._table = modelBuilder.declarativeTable()
			.withProps(
				{
					columns: columns,
					data: [],
					ariaLabel: constants.mlsConfigTitle
				})
			.component();
		this._loader = modelBuilder.loadingComponent()
			.withItem(this._table)
			.withProps({
				loading: true
			}).component();
		return this._loader;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this.component) {
			formBuilder.addFormItem({ title: '', component: this.component });
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this.component) {
			formBuilder.removeFormItem({ title: '', component: this.component });
		}
	}

	/**
	 * Returns the component
	 */
	public get component(): azdata.Component | undefined {
		return this._loader;
	}

	public set selectedModels(value: ImportedModel[]) {
		this._selectedModels = value;
	}

	/**
	 * Loads the data in the component
	 */
	public async loadData(): Promise<void> {
		await this.onLoading();
		if (this._table) {
			let models: ImportedModel[] | undefined;

			if (this.importTable) {
				models = await this.listModels(this.importTable);
			}
			let tableData: any[][] = [];

			if (models) {
				tableData = tableData.concat(models.map(model => this.createTableRow(model)));
			}

			this.modelCounts = models === undefined || models.length === 0 ? 0 : models.length;
			this._table.data = tableData;
		} else {
			this.modelCounts = 0;
		}
		this.onModelSelected();
		await this.onLoaded();
	}

	public async onLoading(): Promise<void> {
		if (this._loader) {
			this._loader.loading = true;
		}
	}

	public async onLoaded(): Promise<void> {
		if (this._loader) {
			this._loader.loading = false;
		}
	}

	public get isEmpty(): boolean {
		return this.modelCounts === 0;
	}

	private createTableRow(model: ImportedModel): any[] {
		let row: any[] = [model.modelName, model.created, model.version, model.framework];
		if (this._modelBuilder) {
			const selectButton = this.createSelectButton(model);
			if (selectButton) {
				row = [selectButton, model.modelName, model.created, model.version, model.framework];
			}
			const editButtons = this.createEditButtons(model);
			if (editButtons && editButtons.length > 0) {
				row = row.concat(editButtons);
			}
		}

		return row;
	}

	private createSelectButton(model: ImportedModel): azdata.Component | undefined {
		let selectModelButton: azdata.Component | undefined = undefined;
		if (this._modelBuilder && this._settings.selectable) {

			let onSelectItem = (checked: boolean) => {
				if (!this._settings.multiSelect) {
					this._selectedModels = [];
				}
				const foundItem = this._selectedModels.find(x => x === model);
				if (checked && !foundItem) {
					this._selectedModels.push(model);
				} else if (foundItem) {
					this._selectedModels = this._selectedModels.filter(x => x !== model);
				}
				this.onModelSelected();
			};
			if (this._settings.multiSelect) {
				const checkbox = this._modelBuilder.checkBox().withProps({
					width: 15,
					height: 15,
					checked: !!this._selectedModels.find(x => x.id === model.id)
				}).component();
				checkbox.onChanged(() => {
					onSelectItem(checkbox.checked || false);
				});
				selectModelButton = checkbox;
			} else {
				const radioButton = this._modelBuilder.radioButton().withProps({
					name: 'amlModel',
					value: String(model.id),
					width: 15,
					height: 15,
					checked: !!this._selectedModels.find(x => x.id === model.id)
				}).component();
				radioButton.onDidClick(() => {
					onSelectItem(radioButton.checked || false);
				});
				selectModelButton = radioButton;
			}
		}
		return selectModelButton;
	}

	private createEditButtons(model: ImportedModel): azdata.Component[] | undefined {
		let dropButton: azdata.ButtonComponent | undefined = undefined;
		let predictButton: azdata.ButtonComponent | undefined = undefined;
		let editButton: azdata.ButtonComponent | undefined = undefined;
		if (this._modelBuilder && this._settings.editable) {
			dropButton = this._modelBuilder.button().withProps({
				label: '',
				title: constants.deleteTitle,
				iconPath: {
					dark: this.asAbsolutePath('images/dark/delete_inverse.svg'),
					light: this.asAbsolutePath('images/light/delete.svg')
				},
				width: 16,
				height: 16
			}).component();
			dropButton.onDidClick(async () => {
				try {
					const confirm = await utils.promptConfirm(constants.confirmDeleteModel(model.modelName), this._apiWrapper);
					if (confirm) {
						await this.sendDataRequest(DeleteModelEventName, model);
						if (this.parent) {
							await this.parent.refresh();
						}
					}
				} catch (error) {
					this.showErrorMessage(`${constants.updateModelFailedError} ${constants.getErrorMessage(error)}`);
				}
			});
			predictButton = this._modelBuilder.button().withProps({
				label: '',
				title: constants.predictModel,
				iconPath: {
					dark: this.asAbsolutePath('images/dark/predict_inverse.svg'),
					light: this.asAbsolutePath('images/light/predict.svg')
				},
				width: 16,
				height: 16
			}).component();
			predictButton.onDidClick(async () => {
				await this.sendDataRequest(PredictWizardEventName, [model]);
			});

			editButton = this._modelBuilder.button().withProps({
				label: '',
				title: constants.editTitle,
				iconPath: {
					dark: this.asAbsolutePath('images/dark/edit_inverse.svg'),
					light: this.asAbsolutePath('images/light/edit.svg')
				},
				width: 16,
				height: 16
			}).component();
			editButton.onDidClick(async () => {
				await this.sendDataRequest(EditModelEventName, model);
			});
		}
		return editButton && dropButton && predictButton ? [editButton, dropButton, predictButton] : undefined;
	}

	private async onModelSelected(): Promise<void> {
		this._onModelSelectionChanged.fire();
		if (this._downloadedFile) {
			await this._downloadedFile.close();
		}
		this._downloadedFile = undefined;
	}

	/**
	 * Returns selected data
	 */
	public get data(): ImportedModel[] | undefined {
		return this._selectedModels;
	}

	public async getDownloadedModel(): Promise<ModelArtifact | undefined> {
		if (!this._downloadedFile && this.data && this.data.length > 0) {
			this._downloadedFile = new ModelArtifact(await this.downloadRegisteredModel(this.data[0]));
		}
		return this._downloadedFile;
	}

	/**
	 * disposes the view
	 */
	public async disposeComponent(): Promise<void> {
		if (this._downloadedFile) {
			await this._downloadedFile.close();
		}
	}

	/**
	 * Refreshes the view
	 */
	public async refresh(): Promise<void> {
		await this.loadData();
	}
}
