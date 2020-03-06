/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import * as constants from '../../common/constants';
import { ModelViewBase, RegisterModelEventName } from './modelViewBase';
import { CurrentModelsTable } from './currentModelsTable';
import { ApiWrapper } from '../../common/apiWrapper';
import { IPageView } from '../interfaces';

/**
 * View to render current registered models
 */
export class CurrentModelsPage extends ModelViewBase implements IPageView {
	private _tableComponent: azdata.DeclarativeTableComponent | undefined;
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
		this._dataTable = new CurrentModelsTable(this._apiWrapper, modelBuilder, this);
		this._tableComponent = this._dataTable.component;

		let registerButton = modelBuilder.button().withProperties({
			label: constants.registerModelTitle,
			width: this.buttonMaxLength
		}).component();
		registerButton.onDidClick(async () => {
			await this.sendDataRequest(RegisterModelEventName);
		});

		let formModel = modelBuilder.formContainer()
			.withFormItems([{
				title: '',
				component: registerButton
			}, {
				component: this._tableComponent,
				title: ''
			}]).component();

		this._loader = modelBuilder.loadingComponent()
			.withItem(formModel)
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
