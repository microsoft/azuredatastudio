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

/**
 * View to pick model source
 */
export class ModelImportLocationPage extends ModelViewBase implements IPageView, IDataComponent<DatabaseTable> {

	private _form: azdata.FormContainer | undefined;
	private _formBuilder: azdata.FormBuilder | undefined;
	public tableSelectionComponent: TableSelectionComponent | undefined;

	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder Register components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {

		this._formBuilder = modelBuilder.formContainer();
		this.tableSelectionComponent = new TableSelectionComponent(this._apiWrapper, this, true);
		this.tableSelectionComponent.onSelectedChanged(async () => {
			await this.onTableSelected();
		});
		this.tableSelectionComponent.registerComponent(modelBuilder);
		this.tableSelectionComponent.addComponents(this._formBuilder);
		this._form = this._formBuilder.component();
		return this._form;
	}

	private async onTableSelected(): Promise<void> {
		if (this.tableSelectionComponent?.data) {
			this.importTable = this.tableSelectionComponent?.data;
		}
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

		if (this.data?.databaseName && this.data?.tableName) {
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
