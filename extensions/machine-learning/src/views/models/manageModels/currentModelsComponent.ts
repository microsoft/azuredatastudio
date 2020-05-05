/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import * as constants from '../../../common/constants';
import { ModelViewBase } from '../modelViewBase';
import { CurrentModelsTable } from './currentModelsTable';
import { ApiWrapper } from '../../../common/apiWrapper';
import { IPageView, IComponentSettings } from '../../interfaces';
import { TableSelectionComponent } from '../tableSelectionComponent';
import { ImportedModel } from '../../../modelManagement/interfaces';

/**
 * View to render current registered models
 */
export class CurrentModelsComponent extends ModelViewBase implements IPageView {
	private _tableComponent: azdata.Component | undefined;
	private _dataTable: CurrentModelsTable | undefined;
	private _loader: azdata.LoadingComponent | undefined;
	private _tableSelectionComponent: TableSelectionComponent | undefined;

	/**
	 *
	 * @param apiWrapper Creates new view
	 * @param parent page parent
	 */
	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase, private _settings: IComponentSettings) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder register the components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._tableSelectionComponent = new TableSelectionComponent(this._apiWrapper, this, false);
		this._tableSelectionComponent.registerComponent(modelBuilder);
		this._tableSelectionComponent.onSelectedChanged(async () => {
			await this.onTableSelected();
		});
		this._dataTable = new CurrentModelsTable(this._apiWrapper, this, this._settings);
		this._dataTable.registerComponent(modelBuilder);
		this._tableComponent = this._dataTable.component;

		let formModelBuilder = modelBuilder.formContainer();
		this._tableSelectionComponent.addComponents(formModelBuilder);

		if (this._tableComponent) {
			formModelBuilder.addFormItem({
				component: this._tableComponent,
				title: ''
			});
		}

		this._loader = modelBuilder.loadingComponent()
			.withItem(formModelBuilder.component())
			.withProperties({
				loading: true
			}).component();
		return this._loader;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._tableSelectionComponent && this._dataTable) {
			this._tableSelectionComponent.addComponents(formBuilder);
			this._dataTable.addComponents(formBuilder);
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._tableSelectionComponent && this._dataTable) {
			this._tableSelectionComponent.removeComponents(formBuilder);
			this._dataTable.removeComponents(formBuilder);
		}
	}

	/**
	 * Returns the component
	 */
	public get component(): azdata.Component | undefined {
		return this._loader;
	}

	/**
	 * Refreshes the view
	 */
	public async refresh(): Promise<void> {
		await this.onLoading();

		try {
			if (this._tableSelectionComponent) {
				this._tableSelectionComponent.refresh();
			}
			await this._dataTable?.refresh();
		} catch (err) {
			this.showErrorMessage(constants.getErrorMessage(err));
		} finally {
			await this.onLoaded();
		}
	}

	public get data(): ImportedModel[] | undefined {
		return this._dataTable?.data;
	}

	private async onTableSelected(): Promise<void> {
		if (this._tableSelectionComponent?.data) {
			this.importTable = this._tableSelectionComponent?.data;
			await this.storeImportConfigTable();
			await this._dataTable?.refresh();
		}
	}

	public get modelTable(): CurrentModelsTable | undefined {
		return this._dataTable;
	}

	/**
	 * disposes the view
	 */
	public async disposeComponent(): Promise<void> {
		if (this._dataTable) {
			await this._dataTable.disposeComponent();
		}
	}

	/**
	 * returns the title of the page
	 */
	public get title(): string {
		return constants.currentModelsTitle;
	}

	private async onLoading(): Promise<void> {
		if (this._loader) {
			await this._loader.updateProperties({ loading: true });
		}
	}

	private async onLoaded(): Promise<void> {
		if (this._loader) {
			await this._loader.updateProperties({ loading: false });
		}
	}
}
