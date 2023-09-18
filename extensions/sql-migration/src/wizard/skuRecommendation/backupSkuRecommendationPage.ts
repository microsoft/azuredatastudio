/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as utils from '../../api/utils';
import { MigrationTargetType } from '../../api/utils';
import * as contracts from '../../service/contracts';
import { MigrationWizardPage } from '../../models/migrationWizardPage';
import { MigrationStateModel, PerformanceDataSourceOptions, StateChangeEvent, AssessmentRuleId } from '../../models/stateMachine';
import { AssessmentResultsDialog } from '../../dialog/assessment/assessmentResultsDialog';
import { SkuRecommendationResultsDialog } from '../../dialog/skuRecommendationResults/skuRecommendationResultsDialog';
import { GetAzureRecommendationDialog } from '../../dialog/skuRecommendationResults/getAzureRecommendationDialog';
import * as constants from '../../constants/strings';
import { EOL } from 'os';
import { IconPath, IconPathHelper } from '../../constants/iconPathHelper';
import { WIZARD_INPUT_COMPONENT_WIDTH } from '../wizardController';
import * as styles from '../../constants/styles';
import { SkuEditParametersDialog } from '../../dialog/skuRecommendationResults/skuEditParametersDialog';
import { logError, TelemetryViews, TelemetryAction, sendSqlMigrationActionEvent, getTelemetryProps } from '../../telemetry';
import { TdeConfigurationDialog } from '../../dialog/tdeConfiguration/tdeConfigurationDialog';
import { TdeMigrationModel } from '../../models/tdeModels';
import { getSourceConnectionProfile } from '../../api/sqlUtils';
import { ConfigDialogSetting } from '../../models/tdeModels';
import { SkuDataCollectionToolbar } from './skuDataCollectionToolbar';

export interface Product {
	type: MigrationTargetType;
	name: string,
	icon: IconPath;
}

export class BackupSKURecommendationPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _igComponent!: azdata.TextComponent;
	private _assessmentStatusIcon!: azdata.ImageComponent;
	private _detailsComponent!: azdata.TextComponent;
	private _skipAssessmentCheckbox!: azdata.CheckBoxComponent;
	private _skipAssessmentSubText!: azdata.TextComponent;
	private _chooseTargetComponent!: azdata.DivContainer;
	private _rbg!: azdata.RadioCardGroupComponent;
	private eventListener!: vscode.Disposable;
	private _rbgLoader!: azdata.LoadingComponent;
	private _progressContainer!: azdata.FlexContainer;
	private _assessmentComponent!: azdata.FlexContainer;
	private _assessmentProgress!: azdata.TextComponent;
	private _assessmentInfo!: azdata.TextComponent;
	private _formContainer!: azdata.ComponentBuilder<azdata.FormContainer, azdata.ComponentProperties>;
	private _assessmentLoader!: azdata.LoadingComponent;
	private _rootContainer!: azdata.FlexContainer;
	private _viewAssessmentsHelperText!: azdata.TextComponent;
	private _databaseSelectedHelperText!: azdata.TextComponent;
	private _tdedatabaseSelectedHelperText!: azdata.TextComponent;

	private _azureRecommendationSectionText!: azdata.TextComponent;

	private _skuGetRecommendationContainer!: azdata.FlexContainer;
	private _azureRecommendationInfoText!: azdata.TextComponent;
	private _getAzureRecommendationButton!: azdata.ButtonComponent;

	private _skuDataCollectionToolbar!: SkuDataCollectionToolbar;
	private _skuDataCollectionStatusContainer!: azdata.FlexContainer;
	private _skuDataCollectionStatusIcon!: azdata.ImageComponent;
	private _skuDataCollectionStatusText!: azdata.TextComponent;
	private _skuDataCollectionTimerText!: azdata.TextComponent;

	private _skuControlButtonsContainer!: azdata.FlexContainer;
	private _skuStopDataCollectionButton!: azdata.ButtonComponent;
	private _skuRestartDataCollectionButton!: azdata.ButtonComponent;
	private _refreshAzureRecommendationButton!: azdata.ButtonComponent;
	private _skuLastRefreshTimeText!: azdata.TextComponent;

	private _skuEditParametersContainer!: azdata.FlexContainer;
	private _skuScaleFactorText!: azdata.TextComponent;
	private _skuTargetPercentileText!: azdata.TextComponent;
	private _skuEnablePreviewSkuText!: azdata.TextComponent;
	private _skuEnableElasticRecommendationsText!: azdata.TextComponent;

	private assessmentGroupContainer!: azdata.FlexContainer;
	private _tdeInfoContainer!: azdata.FlexContainer;
	private _disposables: vscode.Disposable[] = [];
	private _tdeConfigurationDialog!: TdeConfigurationDialog;
	private _previousMiTdeMigrationConfig: TdeMigrationModel = new TdeMigrationModel(); // avoid null checks
	private _tdeEditButton!: azdata.ButtonComponent;

	private _serverName: string = '';
	private _supportedProducts: Product[] = [
		{
			type: MigrationTargetType.SQLMI,
			name: constants.SKU_RECOMMENDATION_MI_CARD_TEXT,
			icon: IconPathHelper.sqlMiLogo,

		},
		{
			type: MigrationTargetType.SQLVM,
			name: constants.SKU_RECOMMENDATION_VM_CARD_TEXT,
			icon: IconPathHelper.sqlVmLogo
		},
		{
			type: MigrationTargetType.SQLDB,
			name: constants.SKU_RECOMMENDATION_SQLDB_CARD_TEXT,
			icon: IconPathHelper.sqlDatabaseLogo
		}
	];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.ASSESSMENT_RESULTS_AND_RECOMMENDATIONS_PAGE_TITLE), migrationStateModel);
	}

	private async createChooseTargetComponent(view: azdata.ModelView): Promise<azdata.DivContainer> {

		this._supportedProducts.forEach((product) => {
			this._rbg.cards.push({
				id: product.type,
				icon: product.icon,
				descriptions: [
					{
						// 0 - CardDescriptionIndex.TARGET_TYPE
						textValue: product.name,
						textStyles: {
							...styles.SECTION_HEADER_CSS
						}
					},
					{
						// 1 - CardDescriptionIndex.ASSESSMENT_RESULTS_SECTION
						textValue: constants.ASSESSMENT_RESULTS.toLocaleUpperCase(),
						textStyles: {
							...styles.LIGHT_LABEL_CSS,
						}
					},
					{
						// 2 - CardDescriptionIndex.ASSESSMENT_STATUS
						textValue: '',
						textStyles: {
							...styles.BODY_CSS,
							'font-weight': '500'
						}
					},
					{
						// 3 - CardDescriptionIndex.ASSESSED_DBS
						textValue: '',
						textStyles: {
							...styles.BODY_CSS,
						}
					},
					{
						// 4 - CardDescriptionIndex.RECOMMENDATION_RESULTS_SECTION
						textValue: constants.RECOMMENDED_CONFIGURATION.toLocaleUpperCase(),
						textStyles: {
							...styles.LIGHT_LABEL_CSS,
							marginBottom: '0',
						}
					},
					{
						// 5 - CardDescriptionIndex.SKU_RECOMMENDATION
						textValue: constants.AZURE_RECOMMENDATION_CARD_NOT_ENABLED,
						textStyles: {
							...styles.BODY_CSS,
						}
					},
					{
						// 6 - CardDescriptionIndex.VM_CONFIGURATIONS
						textValue: '',
						textStyles: {
							...styles.SMALL_NOTE_CSS,
						}
					},
					{
						// 7 - CardDescriptionIndex.VIEW_SKU_DETAILS
						textValue: '',
						linkDisplayValue: '',
						linkStyles: {
							...styles.BODY_CSS,
							'text-decoration': 'none',
						}
					},
				]
			});

			this._disposables.push(
				this._rbg.onLinkClick(async (e: azdata.RadioCardLinkClickEvent) => {
					if (this.hasRecommendations()) {
						if (e.cardId === product.type) {
							const skuRecommendationResultsDialog = new SkuRecommendationResultsDialog(this.migrationStateModel, product.type);
							await skuRecommendationResultsDialog.openDialog(
								e.cardId,
								this.migrationStateModel._skuRecommendationResults.recommendations);
						}
					}
				}));
		});

		this._disposables.push(this._rbg.onSelectionChanged(async (value) => {
			if (value) {
				this.assessmentGroupContainer.display = 'inline';
				this.changeTargetType(value.cardId);
				await this.refreshTdeView();
			}
		}));

		this._rbgLoader = this._view.modelBuilder.loadingComponent()
			.withItem(this._rbg)
			.component();

		const component = this._view.modelBuilder.divContainer()
			.withItems([chooseYourTargetText, learnMoreLink, this._rbgLoader])
			.component();
		return component;
	}
}
