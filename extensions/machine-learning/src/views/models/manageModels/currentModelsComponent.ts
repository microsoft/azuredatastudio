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
	private _dataTable: CurrentModelsTable | undefined;
	private _loader: azdata.LoadingComponent | undefined;
	private _tableSelectionComponent: TableSelectionComponent | undefined;
	private _labelComponent: azdata.TextComponent | undefined;
	private _descriptionComponent: azdata.TextComponent | undefined;
	private _labelContainer: azdata.FlexContainer | undefined;
	private _formBuilder: azdata.FormBuilder | undefined;

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
		this._tableSelectionComponent = new TableSelectionComponent(this._apiWrapper, this, {
			editable: false,
			preSelected: true,
			databaseTitle: constants.databaseName,
			tableTitle: constants.tableName,
			databaseInfo: constants.modelDatabaseInfo,
			tableInfo: constants.modelTableInfo
		});
		this._tableSelectionComponent.registerComponent(modelBuilder);
		this._tableSelectionComponent.onSelectedChanged(async () => {
			await this.onTableSelected();
		});
		this._dataTable = new CurrentModelsTable(this._apiWrapper, this, this._settings);
		this._dataTable.registerComponent(modelBuilder);

		let formModelBuilder = modelBuilder.formContainer();
		this._loader = modelBuilder.loadingComponent()
			.withItem(formModelBuilder.component())
			.withProperties({
				loading: true
			}).component();
		this._labelComponent = modelBuilder.text().withProperties({
			width: 200,
			value: constants.modelsListEmptyMessage
		}).component();
		this._descriptionComponent = modelBuilder.text().withProperties({
			width: 200,
			value: constants.modelsListEmptyDescription
		}).component();
		this._labelContainer = modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: 800,
			height: '400px',
			justifyContent: 'center'
		}).component();

		this._labelContainer.addItem(
			this._labelComponent
			, {
				CSSStyles: {
					'align-items': 'center',
					'padding-top': '30px',
					'padding-left': `${this.componentMaxLength}px`,
					'font-size': '16px'
				}
			});
		this._labelContainer.addItem(
			this._descriptionComponent
			, {
				CSSStyles: {
					'align-items': 'center',
					'padding-top': '10px',
					'padding-left': `${this.componentMaxLength - 50}px`,
					'font-size': '13px'
				}
			});

		this.addComponents(formModelBuilder);
		return this._loader;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		this._formBuilder = formBuilder;
		if (this._tableSelectionComponent && this._dataTable && this._labelContainer) {
			this._tableSelectionComponent.addComponents(formBuilder);
			this._dataTable.addComponents(formBuilder);
			if (this._dataTable.isEmpty) {
				formBuilder.addFormItem({ title: '', component: this._labelContainer });
			}
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._tableSelectionComponent && this._dataTable && this._labelContainer) {
			this._tableSelectionComponent.removeComponents(formBuilder);
			this._dataTable.removeComponents(formBuilder);
			formBuilder.removeFormItem({ title: '', component: this._labelContainer });
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
			if (this._tableSelectionComponent && this._dataTable) {
				await this._tableSelectionComponent.refresh();
				await this._dataTable.refresh();
				this.refreshComponents();
			}
		} catch (err) {
			this.showErrorMessage(constants.getErrorMessage(err));
		} finally {
			await this.onLoaded();
		}
	}

	public get data(): ImportedModel[] | undefined {
		return this._dataTable?.data;
	}

	private refreshComponents(): void {
		if (this._formBuilder) {
			this.removeComponents(this._formBuilder);
			this.addComponents(this._formBuilder);
		}
	}

	private async onTableSelected(): Promise<void> {
		if (this._tableSelectionComponent?.data) {
			this.importTable = this._tableSelectionComponent?.data;
			await this.storeImportConfigTable();
			if (this._dataTable) {
				await this._dataTable.refresh();
			}
			this.refreshComponents();
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
