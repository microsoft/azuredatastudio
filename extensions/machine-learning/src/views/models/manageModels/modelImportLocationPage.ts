/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import * as constants from '../../../common/constants';
import { IPageView, IDataComponent } from '../../interfaces';
import { TableSelectionComponent } from '../tableSelectionComponent';
import { DatabaseTable } from '../../../prediction/interfaces';
import { DataInfoComponent } from '../../dataInfoComponent';

/**
 * View to pick model source
 */
export class ModelImportLocationPage extends ModelViewBase implements IPageView, IDataComponent<DatabaseTable> {

	private _form: azdata.FormContainer | undefined;
	private _formBuilder: azdata.FormBuilder | undefined;
	public tableSelectionComponent: TableSelectionComponent | undefined;
	private _dataInfoComponent: DataInfoComponent | undefined;

	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._formBuilder = modelBuilder.formContainer();
		this.tableSelectionComponent = new TableSelectionComponent(this._apiWrapper, this,
			{
				editable: true,
				preSelected: true,
				databaseTitle: constants.databaseName,
				tableTitle: constants.tableName,
				databaseInfo: constants.databaseToStoreInfo,
				tableInfo: constants.tableToStoreInfo
			});
		this._dataInfoComponent = new DataInfoComponent(this._apiWrapper, this);

		this._dataInfoComponent.width = 300;
		this._dataInfoComponent.height = 300;
		this._dataInfoComponent.iconSettings = {
			css: {
				'border': 'solid',
				'margin': '5px'
			}
		};
		this._dataInfoComponent.registerComponent(modelBuilder);

		this.tableSelectionComponent.onSelectedChanged(async () => {
			await this.onTableSelected();
		});
		this.tableSelectionComponent.registerComponent(modelBuilder);
		this.tableSelectionComponent.addComponents(this._formBuilder);

		if (this._dataInfoComponent.component) {
			this._formBuilder.addFormItem({
				title: '',
				component: this._dataInfoComponent.component
			});
		}
		this._form = this._formBuilder.component();
		return this._form;
	}

	private async onTableSelected(): Promise<void> {
		if (this.tableSelectionComponent?.data) {
			this.importTable = this.tableSelectionComponent?.data;
		}

		if (this.importTable && this._dataInfoComponent) {
			this._dataInfoComponent.loading();

			// Add table name to the models imported.
			// Since Table name is picked last as per new flow this hasn't been set yet.
			this.modelsViewData?.forEach(x => x.targetImportTable = this.importTable);

			if (!this.validateImportTableName()) {
				this._dataInfoComponent.title = constants.selectModelsTableMessage;
				this._dataInfoComponent.iconSettings.path = 'noicon';
			} else {
				const validated = await this.verifyImportConfigTable(this.importTable);
				if (validated) {
					this._dataInfoComponent.title = constants.modelSchemaIsAcceptedMessage;
					this._dataInfoComponent.iconSettings.path = this.asAbsolutePath('images/validItem.svg');
				} else {
					this._dataInfoComponent.title = constants.modelSchemaIsNotAcceptedMessage;
					this._dataInfoComponent.iconSettings.path = this.asAbsolutePath('images/invalidItem.svg');
				}
			}

			await this._dataInfoComponent.refresh();
		}
	}

	private validateImportTableName(): boolean {
		return this.importTable?.databaseName !== undefined && this.importTable?.databaseName !== constants.selectDatabaseTitle
			&& this.importTable?.tableName !== undefined && this.importTable?.tableName !== constants.selectTableTitle;
	}

	/**
	 * Returns selected data
	 */
	public get data(): DatabaseTable | undefined {
		return this.tableSelectionComponent?.data;
	}

	/**
	 * Returns the component
	 */
	public get component(): azdata.Component | undefined {
		return this._form;
	}

	/**
	 * Refreshes the view
	 */
	public async refresh(): Promise<void> {
		if (this.tableSelectionComponent) {
			await this.tableSelectionComponent.refresh();
		}

		if (this._dataInfoComponent) {
			await this._dataInfoComponent.refresh();
		}
	}

	/**
	 * Returns page title
	 */
	public get title(): string {
		return constants.modelImportTargetPageTitle;
	}

	public async disposePage(): Promise<void> {
	}

	public async validate(): Promise<boolean> {
		let validated = false;

		if (this.data && this.validateImportTableName()) {
			validated = true;
			validated = await this.verifyImportConfigTable(this.data);
			if (!validated) {
				this.showErrorMessage(constants.invalidImportTableSchemaError(this.data?.databaseName, this.data?.tableName));
			}
		} else {
			this.showErrorMessage(constants.invalidImportTableError(this.data?.databaseName, this.data?.tableName));
		}
		return validated;
	}
}
