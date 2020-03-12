/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import * as constants from '../../../common/constants';
import { ModelViewBase } from '../modelViewBase';
import { CurrentModelsTable } from './currentModelsTable';
import { ApiWrapper } from '../../../common/apiWrapper';
import { IPageView } from '../../interfaces';

/**
 * View to render current registered models
 */
export class CurrentModelsPage extends ModelViewBase implements IPageView {
	private _tableComponent: azdata.Component | undefined;
	private _dataTable: CurrentModelsTable | undefined;
	private _loader: azdata.LoadingComponent | undefined;

	/**
	 *
	 * @param apiWrapper Creates new view
	 * @param parent page parent
	 */
	constructor(apiWrapper: ApiWrapper, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
	}

	/**
	 *
	 * @param modelBuilder register the components
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.Component {
		this._dataTable = new CurrentModelsTable(this._apiWrapper, this);
		this._dataTable.registerComponent(modelBuilder);
		this._tableComponent = this._dataTable.component;

		let formModelBuilder = modelBuilder.formContainer();

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
			await this._dataTable?.refresh();
		} catch (err) {
			this.showErrorMessage(constants.getErrorMessage(err));
		} finally {
			await this.onLoaded();
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
