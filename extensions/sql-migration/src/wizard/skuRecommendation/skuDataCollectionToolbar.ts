/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
* For Assessement Summary and SKU Recommendation Page.
* This file contains the code for toolbar at the top of page with buttons for different data
* collection functionalities.
-----------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../../constants/iconPathHelper';
import * as styles from '../../constants/styles';
import * as constants from '../../constants/strings';
import { MigrationStateModel, PerformanceDataSourceOptions } from '../../models/stateMachine';
import { SKURecommendationPage } from './skuRecommendationPage';
import { ImportPerformanceDataDialog } from '../../dialog/skuRecommendationResults/importPerformanceDataDialog';
import { SkuEditParametersDialog } from '../../dialog/skuRecommendationResults/skuEditParametersDialog';

// TODO - "Change this to actual default path once it is available"
const DEFAULT_PATH_FOR_START_DATA_COLLECTION = "C:\DataPointsCollectionFolder";

export class SkuDataCollectionToolbar implements vscode.Disposable {
	private _refreshButtonSelectionDropdown!: azdata.DropDownComponent;
	private _startPerformanceCollectionButton!: azdata.ButtonComponent;
	private _restartPerformanceCollectionButton!: azdata.ButtonComponent;
	private _stopPerformanceCollectionButton!: azdata.ButtonComponent;
	private _importPerformanceDataButton!: azdata.ButtonComponent;
	private _recommendationParametersButton!: azdata.ButtonComponent;

	private _performanceDataSource!: PerformanceDataSourceOptions;

	private _disposables: vscode.Disposable[] = [];

	constructor(private skuRecommendationPage: SKURecommendationPage, public wizard: azdata.window.Wizard, private migrationStateModel: MigrationStateModel) {
	}

	public get refreshButtonSelectionDropdown() {
		return this._refreshButtonSelectionDropdown;
	}

	public createToolbar(view: azdata.ModelView): azdata.ToolbarContainer {
		const toolbar = view.modelBuilder.toolbarContainer();

		this._refreshButtonSelectionDropdown = this.createRefreshButtonSelectionDropDown(view);
		this._startPerformanceCollectionButton = this.createStartPerformanceCollectionButton(view);
		this._restartPerformanceCollectionButton = this.createRestartPerformanceCollectionButton(view);
		this._stopPerformanceCollectionButton = this.createStopPerformanceCollectionButton(view);
		this._importPerformanceDataButton = this.createImportPerformanceDataButton(view);
		this._recommendationParametersButton = this.createRecommendationParametersButton(view);

		toolbar.addToolbarItems([
			<azdata.ToolbarComponent>{ component: this._refreshButtonSelectionDropdown, toolbarSeparatorAfter: true },
			<azdata.ToolbarComponent>{ component: this._startPerformanceCollectionButton, toolbarSeparatorAfter: false },
			<azdata.ToolbarComponent>{ component: this._restartPerformanceCollectionButton, toolbarSeparatorAfter: false },
			<azdata.ToolbarComponent>{ component: this._stopPerformanceCollectionButton, toolbarSeparatorAfter: false },
			<azdata.ToolbarComponent>{ component: this._importPerformanceDataButton, toolbarSeparatorAfter: true },
			<azdata.ToolbarComponent>{ component: this._recommendationParametersButton, toolbarSeparatorAfter: false },
		]);

		return toolbar.component();
	}

	private createRefreshButtonSelectionDropDown(view: azdata.ModelView): azdata.DropDownComponent {
		const refreshAssessmentOption = constants.REFRESH_ASSESSMENT_LABEL;
		const refreshSKUOption = constants.REFRESH_SKU_LABEL;

		const refreshButtonSelectionDropdown = view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.AZURE_SQL_TARGET,
			placeholder: constants.REFRESH,
			values: [refreshAssessmentOption],
			editable: true,
			fireOnTextChange: true,
			CSSStyles: {
				'margin': '0',
				'padding-top': '5px'
			},
		}).component();

		this._disposables.push(refreshButtonSelectionDropdown.onValueChanged(async (value) => {
			if (value === refreshAssessmentOption) {
				refreshButtonSelectionDropdown.value = constants.REFRESH;
				await this.skuRecommendationPage.refreshAssessment();
			}
			else if (value === refreshSKUOption) {
				refreshButtonSelectionDropdown.value = constants.REFRESH;
				await this.skuRecommendationPage.refreshAzureRecommendation();
			}
		}));

		return refreshButtonSelectionDropdown;
	}

	private createStartPerformanceCollectionButton(view: azdata.ModelView): azdata.ButtonComponent {
		const startPerformanceCollectionButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.START_PERFORMANCE_COLLECTION,
				width: 146,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.startDataCollection,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();

		const defaultPathOption = constants.AZURE_RECOMMENDATION_DATA_COLLECTION_DEFAULT_PATH;
		const choosePathOption = constants.AZURE_RECOMMENDATION_DATA_COLLECTION_CHOOSE_PATH;

		this._disposables.push(startPerformanceCollectionButton.onDidClick(async () => {
			const selectedOption = await vscode.window.showInformationMessage(
				constants.AZURE_RECOMMENDATION_DATA_COLLECTION_POPUP_MESSAGE_LABEL,
				defaultPathOption,
				choosePathOption
			);

			// Default path is selected or no option is selected.
			if (!selectedOption || selectedOption === defaultPathOption) {
				this._performanceDataSource = PerformanceDataSourceOptions.CollectData;
				this.migrationStateModel._skuRecommendationPerformanceLocation = DEFAULT_PATH_FOR_START_DATA_COLLECTION;

				// Start data collection at default path.
				await this.executeStartDataCollection();
			}
			// 'Choose a path' option is selected.
			else if (selectedOption === choosePathOption) {
				const options: vscode.OpenDialogOptions = {
					openLabel: 'Select',
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
				};

				// Handle the folder selection here
				const chosenFolder = await vscode.window.showOpenDialog(options);

				// if a folder path is selected.
				if (chosenFolder && chosenFolder.length > 0 && chosenFolder[0]) {
					this._performanceDataSource = PerformanceDataSourceOptions.CollectData;
					this.migrationStateModel._skuRecommendationPerformanceLocation = chosenFolder[0].fsPath;

					// Start data collection at folder path selected.
					await this.executeStartDataCollection();
				} else {
					// TODO - What to do if user clicks on "choose a path" and do not selecta folder.
					// Either 1) start data collection at Default path.
					// or 2) Do not start data collection and give user a warning that "no path selected".
				}
			}
		}));

		return startPerformanceCollectionButton;
	}

	private createRestartPerformanceCollectionButton(view: azdata.ModelView): azdata.ButtonComponent {
		const restartPerformanceCollectionButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.RESTART_PERFORMANCE_COLLECTION,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.startDataCollection,
				CSSStyles: {
					...styles.TOOLBAR_CSS,
					display: 'none',
				}
			}).component();
		restartPerformanceCollectionButton.enabled = false;
		this._disposables.push(restartPerformanceCollectionButton.onDidClick(async () => {
			this._stopPerformanceCollectionButton.enabled = true;
			this._restartPerformanceCollectionButton.enabled = false;

			await this.migrationStateModel.startPerfDataCollection(
				this.migrationStateModel._skuRecommendationPerformanceLocation,
				this.migrationStateModel._performanceDataQueryIntervalInSeconds,
				this.migrationStateModel._staticDataQueryIntervalInSeconds,
				this.migrationStateModel._numberOfPerformanceDataQueryIterations,
				this.skuRecommendationPage);
			await this.skuRecommendationPage.refreshSkuRecommendationComponents();
		}));

		return restartPerformanceCollectionButton;
	}

	private createStopPerformanceCollectionButton(view: azdata.ModelView): azdata.ButtonComponent {
		const stopPerformanceCollectionButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.STOP_PERFORMANCE_COLLECTION,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.stopDataCollection,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();
		stopPerformanceCollectionButton.enabled = false;
		this._disposables.push(stopPerformanceCollectionButton.onDidClick(async () => {
			this._stopPerformanceCollectionButton.enabled = false;

			await this._startPerformanceCollectionButton.updateCssStyles({ 'display': 'none' });
			await this._restartPerformanceCollectionButton.updateCssStyles({ 'display': 'inline' });

			this._restartPerformanceCollectionButton.enabled = true;

			await this.migrationStateModel.stopPerfDataCollection();
			await this.skuRecommendationPage.refreshAzureRecommendation();
		}));
		return stopPerformanceCollectionButton;
	}

	private createImportPerformanceDataButton(view: azdata.ModelView): azdata.ButtonComponent {
		const importPerformanceDataButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.IMPORT_PERFORMANCE_DATA,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.import,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();

		this._disposables.push(
			importPerformanceDataButton.onDidClick(async (e) => {
				this._stopPerformanceCollectionButton.enabled = false;
				this._startPerformanceCollectionButton.enabled = false;

				const importPerformanceDataDialog = new ImportPerformanceDataDialog(this.skuRecommendationPage, this.wizard, this.migrationStateModel);
				await importPerformanceDataDialog.openDialog();
			})
		);
		return importPerformanceDataButton;
	}

	private createRecommendationParametersButton(view: azdata.ModelView): azdata.ButtonComponent {
		const recommendationParametersButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.RECOMMENDATION_PARAMETERS,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.settings,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();

		let skuEditParametersDialog = new SkuEditParametersDialog(this.skuRecommendationPage, this.migrationStateModel);
		this._disposables.push(
			recommendationParametersButton.onDidClick(
				async () => await skuEditParametersDialog.openDialog()));
		return recommendationParametersButton;
	}

	private async executeStartDataCollection() {
		this._stopPerformanceCollectionButton.enabled = true;
		this._startPerformanceCollectionButton.enabled = false;
		this._importPerformanceDataButton.enabled = false;

		this.migrationStateModel._skuRecommendationPerformanceDataSource = this._performanceDataSource;

		await this.migrationStateModel.startPerfDataCollection(
			this.migrationStateModel._skuRecommendationPerformanceLocation,
			this.migrationStateModel._performanceDataQueryIntervalInSeconds,
			this.migrationStateModel._staticDataQueryIntervalInSeconds,
			this.migrationStateModel._numberOfPerformanceDataQueryIterations,
			this.skuRecommendationPage);

		await this.skuRecommendationPage.refreshSkuRecommendationComponents();
	}

	public dispose(): void {
		// TODO - need to call this at the place where toolbar is initialized
		this._disposables.forEach(
			d => { try { d.dispose(); } catch { } });
	}
}
