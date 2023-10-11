/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import * as constants from '../../../common/constants';
import { DataInfoComponent } from '../../dataInfoComponent';
import { ModelActionType, ModelViewBase, ModelSourceType } from '../modelViewBase';
import { CurrentModelsTable } from './currentModelsTable';
import { ApiWrapper } from '../../../common/apiWrapper';
import { IPageView, IComponentSettings } from '../../interfaces';
import { TableSelectionComponent } from '../tableSelectionComponent';
import { ImportedModel } from '../../../modelManagement/interfaces';

/**
 * View to render current registered models
 */
export class CurrentModelsComponent extends ModelViewBase implements IPageView {
	private _emptyModelsComponent: DataInfoComponent | undefined;
	private _dataTable: CurrentModelsTable | undefined;
	private _loader: azdata.LoadingComponent | undefined;
	private _tableSelectionComponent: TableSelectionComponent | undefined;
	private _tableDataCountContainer: azdata.FlexContainer | undefined;
	private _tableDataCountComponent: azdata.TextComponent | undefined;
	private _subheadingContainer: azdata.FlexContainer | undefined;
	private _subheadingTextComponent: azdata.TextComponent | undefined;
	private _subheadingLinkComponent: azdata.HyperlinkComponent | undefined;
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
			tableInfo: constants.modelTableInfo,
			layout: 'vertical',
			defaultDbName: constants.selectModelDatabaseTitle,
			defaultTableName: constants.selectModelTableTitle,
			useImportModelCache: true
		});
		this._tableSelectionComponent.registerComponent(modelBuilder);
		this._tableSelectionComponent.onSelectedChanged(async () => {
			await this.onTableSelected();
		});
		this._dataTable = new CurrentModelsTable(this._apiWrapper, this, this._settings);
		this._dataTable.registerComponent(modelBuilder);

		let dataCountString: string = constants.getDataCount(0);

		this._tableDataCountContainer = modelBuilder.flexContainer().component();
		this._tableDataCountComponent = modelBuilder.text().withProps({
			value: dataCountString
		}).component();
		this._tableDataCountContainer.addItem(this._tableDataCountComponent,
			{
				CSSStyles: {
					'font-size': '13px',
					'margin': '0'
				}
			});


		let formModelBuilder = modelBuilder.formContainer();
		this._loader = modelBuilder.loadingComponent()
			.withItem(formModelBuilder.component())
			.withProps({
				loading: true
			}).component();
		this._emptyModelsComponent = new DataInfoComponent(this._apiWrapper, this);
		this._emptyModelsComponent.width = 200;
		this._emptyModelsComponent.height = 250;
		this._emptyModelsComponent.title = constants.modelsListEmptyMessage;
		this._emptyModelsComponent.description = constants.modelsListEmptyDescription;
		this._emptyModelsComponent.iconSettings = {
			css: { 'padding-top': '30px' },
			path: this.asAbsolutePath('images/emptyTable.svg'),
			width: 128,
			height: 128
		};
		this._emptyModelsComponent.registerComponent(modelBuilder);
		this._labelContainer = modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '750px',
			height: '400px',
			justifyContent: 'flex-start',
			textAlign: 'center'
		}).component();
		this._subheadingContainer = modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '452px'
		}).component();
		this._subheadingTextComponent = modelBuilder.text().withProps(<azdata.CheckBoxProperties>{
			value: this.modelActionType === ModelActionType.Import ? constants.viewImportModelsDesc : constants.viewImportModeledForPredictDesc,
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();
		this._subheadingLinkComponent = modelBuilder.hyperlink().withProps({
			label: constants.learnMoreLink,
			url: constants.importModelsDoc,
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();
		if (this._emptyModelsComponent.component) {
			this._labelContainer.addItem(this._emptyModelsComponent.component
				, {
					CSSStyles: {
						'margin': '0 auto'
					}
				});

		}
		this._subheadingContainer.addItems(
			[this._subheadingTextComponent, this._subheadingLinkComponent]
		);

		this.addComponents(formModelBuilder);
		return this._loader;
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this.modelSourceType === ModelSourceType.RegisteredModels) {
			this._formBuilder = formBuilder;
			if (this._tableSelectionComponent && this._dataTable && this._tableDataCountContainer && this._labelContainer && this._subheadingContainer) {
				formBuilder.addFormItem({ title: '', component: this._subheadingContainer });
				this._tableSelectionComponent.addComponents(formBuilder);
				formBuilder.addFormItem({ title: '', component: this._tableDataCountContainer });
				this._dataTable.addComponents(formBuilder);

				if (this._dataTable.isEmpty) {
					formBuilder.addFormItem({ title: '', component: this._labelContainer });
				} else {
					formBuilder.removeFormItem({ title: '', component: this._labelContainer });
				}
				if (this._tableDataCountComponent) {
					this._tableDataCountComponent.value = constants.getDataCount(this._dataTable.modelCounts);
				}
			}
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._tableSelectionComponent && this._dataTable && this._labelContainer && this._tableDataCountContainer && this._subheadingContainer) {
			this._tableSelectionComponent.removeComponents(formBuilder);
			this._dataTable.removeComponents(formBuilder);
			formBuilder.removeFormItem({ title: '', component: this._labelContainer });
			formBuilder.removeFormItem({ title: '', component: this._tableDataCountContainer });
			formBuilder.removeFormItem({ title: '', component: this._subheadingContainer });
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
		if (this._emptyModelsComponent) {
			await this._emptyModelsComponent.refresh();
		}
		await this.onLoading();

		try {
			if (this._tableSelectionComponent && this._dataTable) {
				await this._tableSelectionComponent.refresh();
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
			this.addComponents(this._formBuilder);
		}
	}

	private async onTableSelected(): Promise<void> {
		if (this._tableSelectionComponent?.data) {
			if (this._tableSelectionComponent?.isDataValid) {
				this.importTable = this._tableSelectionComponent?.data;
				await this.storeImportConfigTable();
			}
			if (this._dataTable) {
				await this._dataTable.refresh();
				if (this._emptyModelsComponent) {
					if (this._tableSelectionComponent?.defaultDbNameIsSelected) {
						this._emptyModelsComponent.title = constants.selectModelDatabaseMessage;
						this._emptyModelsComponent.description = '';
					} else if (this._tableSelectionComponent?.defaultTableNameIsSelected) {
						this._emptyModelsComponent.title = constants.selectModelTableMessage;
						this._emptyModelsComponent.description = '';

					} else {
						this._emptyModelsComponent.title = constants.modelsListEmptyMessage;
						this._emptyModelsComponent.description = constants.modelsListEmptyDescription;
					}
					await this._emptyModelsComponent.refresh();
				}

				if (this._tableDataCountComponent) {
					this._tableDataCountComponent.value = constants.getDataCount(this._dataTable.modelCounts);
				}
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
