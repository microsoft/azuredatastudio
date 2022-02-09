/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, MigrationTargetType, Page, ServerAssessment, StateChangeEvent } from '../models/stateMachine';
import { AssessmentResultsDialog } from '../dialog/assessmentResults/assessmentResultsDialog';
import { SkuRecommendationResultsDialog } from '../dialog/skuRecommendationResults/skuRecommendationResultsDialog';
import { GetAzureRecommendationDialog } from '../dialog/skuRecommendationResults/getAzureRecommendationDialog';
import * as constants from '../constants/strings';
import { EOL } from 'os';
import { IconPath, IconPathHelper } from '../constants/iconPathHelper';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import * as styles from '../constants/styles';
import { SkuEditParametersDialog } from '../dialog/skuRecommendationResults/skuEditParametersDialog';

export interface Product {
	type: MigrationTargetType;
	name: string,
	icon: IconPath;
}

export class SKURecommendationPage extends MigrationWizardPage {
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

	private _getAzureRecommendationButton!: azdata.ButtonComponent;
	private _stopPerformanceCollectionButton!: azdata.ButtonComponent;
	private _skuDataCollectionStatusText!: azdata.TextComponent;
	private _skuDataCollectionTimerText!: azdata.TextComponent;

	private _skuEditParametersContainer!: azdata.FlexContainer;
	private _skuScaleFactorText!: azdata.TextComponent;
	private _skuTargetPercentileText!: azdata.TextComponent;
	private _skuEnablePreviewSkuText!: azdata.TextComponent;

	private assessmentGroupContainer!: azdata.FlexContainer;
	private _disposables: vscode.Disposable[] = [];

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
		// TO-DO: remove SQL DB
		{
			type: MigrationTargetType.SQLDB,
			name: constants.SKU_RECOMMENDATION_DB_CARD_TEXT,
			icon: IconPathHelper.sqlDatabaseLogo
		}
	];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.ASSESSMENT_RESULTS_AND_RECOMMENDATIONS_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView) {
		this._view = view;
		this._igComponent = this.createStatusComponent(view); // The first component giving basic information
		this._assessmentStatusIcon = this._view.modelBuilder.image().withProps({
			iconPath: IconPathHelper.completedMigration,
			iconHeight: 17,
			iconWidth: 17,
			width: 20,
			height: 20
		}).component();
		const igContainer = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'align-items': 'center'
			}
		}).component();
		igContainer.addItem(this._assessmentStatusIcon, {
			flex: '0 0 auto'
		});
		igContainer.addItem(this._igComponent, {
			flex: '0 0 auto'
		});

		this._detailsComponent = this.createDetailsComponent(view); // The details of what can be moved
		this._skipAssessmentCheckbox = view.modelBuilder.checkBox().withProps({
			label: constants.SKU_RECOMMENDATION_ASSESSMENT_ERROR_BYPASS,
			checked: false,
			CSSStyles: {
				...styles.SECTION_HEADER_CSS,
				'margin': '10px 0 0 0',
				'display': 'none'
			},
		}).component();
		this._skipAssessmentSubText = view.modelBuilder.text().withProps({
			value: constants.SKU_RECOMMENDATION_ASSESSMENT_ERROR_DETAIL,
			CSSStyles: {
				'margin': '0 0 0 15px',
				'font-size': '13px',
				'color': 'red',
				'width': '590px',
				'display': 'none'
			},
		}).component();

		this._disposables.push(this._skipAssessmentCheckbox.onChanged(async (value) => {
			await this._setAssessmentState(false, true);
		}));

		const refreshAssessmentButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			label: constants.REFRESH_ASSESSMENT_BUTTON_LABEL,
			width: 160,
			height: 24,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '12px 0 4px 0'
			}
		}).component();

		this._disposables.push(refreshAssessmentButton.onDidClick(async () => {
			// placeholder stop perf data collection entry point
			await this.getSkuRecommendations();
			await this.constructDetails();
		}));

		const statusContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
		}).withItems(
			[
				igContainer,
				this._detailsComponent,
				refreshAssessmentButton,
				this._skipAssessmentCheckbox,
				this._skipAssessmentSubText,
			]
		).withProps({
			CSSStyles: {
				'margin': '0'
			}
		}).component();
		this._chooseTargetComponent = await this.createChooseTargetComponent(view);
		const _azureRecommendationsContainer = await this.createAzureRecommendationContainer(view);
		this.assessmentGroupContainer = await this.createViewAssessmentsContainer();
		this._formContainer = view.modelBuilder.formContainer().withFormItems(
			[
				{
					title: '',
					component: statusContainer
				},
				{
					component: this._chooseTargetComponent
				},
				{
					component: _azureRecommendationsContainer
				},
				{
					component: this.assessmentGroupContainer
				},
			]
		).withProps({
			CSSStyles: {
				'display': 'none',
				'padding-top': '0',
			}
		});

		this._assessmentComponent = this._view.modelBuilder.flexContainer().withLayout({
			height: '100%',
			flexFlow: 'column'
		}).withProps({
			CSSStyles: {
				'margin-left': '30px'
			}
		}).component();

		this._assessmentComponent.addItem(this.createAssessmentProgress(), { flex: '0 0 auto' });
		this._assessmentComponent.addItem(await this.createAssessmentInfo(), { flex: '0 0 auto' });

		this._rootContainer = this._view.modelBuilder.flexContainer().withLayout({
			height: '100%',
			flexFlow: 'column'
		}).component();
		this._rootContainer.addItem(this._assessmentComponent, { flex: '0 0 auto' });
		this._rootContainer.addItem(this._formContainer.component(), { flex: '0 0 auto' });

		this._disposables.push(this._view.onClosed(e => {
			this._disposables.forEach(
				d => { try { d.dispose(); } catch { } });
		}));

		await this._view.initializeModel(this._rootContainer);

		if (this.hasSavedInfo()) {
			if (this.migrationStateModel.savedInfo.migrationTargetType === MigrationTargetType.SQLMI) {
				this.migrationStateModel._miDbs = this.migrationStateModel.savedInfo.databaseList;
			} else {
				this.migrationStateModel._vmDbs = this.migrationStateModel.savedInfo.databaseList;
			}
		}
	}

	private createStatusComponent(view: azdata.ModelView): azdata.TextComponent {
		const component = view.modelBuilder.text().withProps({
			CSSStyles: {
				...styles.SECTION_HEADER_CSS,
				'margin-left': '8px'
			}
		}).component();
		return component;
	}

	private createDetailsComponent(view: azdata.ModelView): azdata.TextComponent {
		const component = view.modelBuilder.text().withProps({
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();
		return component;
	}

	private async createChooseTargetComponent(view: azdata.ModelView): Promise<azdata.DivContainer> {

		const chooseYourTargetText = this._view.modelBuilder.text().withProps({
			value: constants.SKU_RECOMMENDATION_CHOOSE_A_TARGET,
			CSSStyles: {
				...styles.SECTION_HEADER_CSS,
				'margin': '0'
			}
		}).component();

		this._rbg = this._view!.modelBuilder.radioCardGroup().withProps({
			cards: [],
			iconHeight: '35px',
			iconWidth: '35px',
			cardWidth: '250px',
			cardHeight: '300px',
			iconPosition: 'left',
			CSSStyles: {
				'margin-top': '0px',
				'margin-left': '-15px',
			}
		}).component();

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
							...styles.BODY_CSS
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
							'font-weight': '600px'
						}
					},
					{
						// 6 - CardDescriptionIndex.VIEW_SKU_DETAILS
						textValue: '',
						linkDisplayValue: '',
						linkStyles: {
							...styles.BODY_CSS,
							'text-decoration': 'none',
						}
					},
				]
			});

			let skuRecommendationResultsDialog = new SkuRecommendationResultsDialog(this.migrationStateModel, product.type);
			this._disposables.push(this._rbg.onLinkClick(async (e: azdata.RadioCardLinkClickEvent) => {
				if (this.hasRecommendations()) {
					if (e.cardId === skuRecommendationResultsDialog._targetType) {
						await skuRecommendationResultsDialog.openDialog(e.cardId, this.migrationStateModel._skuRecommendationResults.recommendations);
					}
				}
			}));
		});

		this._disposables.push(this._rbg.onSelectionChanged(async (value) => {
			if (value) {
				this.assessmentGroupContainer.display = 'inline';
				await this.changeTargetType(value.cardId);
			}
		}));

		this._rbgLoader = this._view.modelBuilder.loadingComponent().withItem(
			this._rbg
		).component();

		const component = this._view.modelBuilder.divContainer().withItems(
			[
				chooseYourTargetText,
				this._rbgLoader
			]
		).component();
		return component;
	}

	private async createViewAssessmentsContainer(): Promise<azdata.FlexContainer> {
		this._viewAssessmentsHelperText = this._view.modelBuilder.text().withProps({
			value: constants.SKU_RECOMMENDATION_VIEW_ASSESSMENT_MI,
			CSSStyles: {
				...styles.SECTION_HEADER_CSS
			},
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();

		const button = this._view.modelBuilder.button().withProps({
			label: constants.VIEW_SELECT_BUTTON_LABEL,
			width: 100,
			CSSStyles: {
				'margin': '12px 0'
			}
		}).component();

		let serverName = '';
		if (this.migrationStateModel.retryMigration || (this.migrationStateModel.resumeAssessment && this.migrationStateModel.serverName)) {
			serverName = this.migrationStateModel.serverName;
		} else {
			serverName = (await this.migrationStateModel.getSourceConnectionProfile()).serverName;
		}

		let miDialog = new AssessmentResultsDialog('ownerUri', this.migrationStateModel, constants.ASSESSMENT_TILE(serverName), this, MigrationTargetType.SQLMI);
		let vmDialog = new AssessmentResultsDialog('ownerUri', this.migrationStateModel, constants.ASSESSMENT_TILE(serverName), this, MigrationTargetType.SQLVM);

		this._disposables.push(button.onDidClick(async (e) => {
			if (this._rbg.selectedCardId === MigrationTargetType.SQLVM) {
				this._rbg.selectedCardId = MigrationTargetType.SQLVM;
				await vmDialog.openDialog();
			} else if (this._rbg.selectedCardId === MigrationTargetType.SQLMI) {
				this._rbg.selectedCardId = MigrationTargetType.SQLMI;
				await miDialog.openDialog();
			}
		}));

		this._databaseSelectedHelperText = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();

		const container = this._view.modelBuilder.flexContainer().withItems([
			this._viewAssessmentsHelperText,
			button,
			this._databaseSelectedHelperText
		]).withProps({
			'display': 'none'
		}).component();
		return container;
	}

	private async changeTargetType(newTargetType: string) {
		if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.SKURecommendation) {
			this.migrationStateModel._databaseAssessment = <string[]>this.migrationStateModel.savedInfo.databaseAssessment;
		}
		// remove assessed databases that have been removed from the source selection list
		const miDbs = this.migrationStateModel._miDbs.filter(
			db => this.migrationStateModel._databaseAssessment.findIndex(
				dba => dba === db) >= 0);

		const vmDbs = this.migrationStateModel._vmDbs.filter(
			db => this.migrationStateModel._databaseAssessment.findIndex(
				dba => dba === db) >= 0);

		if (newTargetType === MigrationTargetType.SQLMI) {
			this._viewAssessmentsHelperText.value = constants.SKU_RECOMMENDATION_VIEW_ASSESSMENT_MI;
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.SKURecommendation) {
				this._databaseSelectedHelperText.value = constants.TOTAL_DATABASES_SELECTED(this.migrationStateModel.savedInfo.databaseList.length, this.migrationStateModel._databaseAssessment.length);
			} else {
				this._databaseSelectedHelperText.value = constants.TOTAL_DATABASES_SELECTED(miDbs.length, this.migrationStateModel._databaseAssessment.length);
			}
			this.migrationStateModel._targetType = MigrationTargetType.SQLMI;
			this.migrationStateModel._migrationDbs = miDbs;
		} else {
			this._viewAssessmentsHelperText.value = constants.SKU_RECOMMENDATION_VIEW_ASSESSMENT_VM;
			if ((this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.SKURecommendation)) {
				this._databaseSelectedHelperText.value = constants.TOTAL_DATABASES_SELECTED(this.migrationStateModel.savedInfo.databaseList.length, this.migrationStateModel._databaseAssessment.length);
			} else {
				this._databaseSelectedHelperText.value = constants.TOTAL_DATABASES_SELECTED(vmDbs.length, this.migrationStateModel._databaseAssessment.length);
			}
			this.migrationStateModel._targetType = MigrationTargetType.SQLVM;
			this.migrationStateModel._migrationDbs = vmDbs;
		}
		this.migrationStateModel.refreshDatabaseBackupPage = true;
	}

	private async constructDetails(): Promise<void> {
		this.wizard.message = {
			text: '',
			level: azdata.window.MessageLevel.Error
		};

		await this._setAssessmentState(true, false);

		const serverName = (await this.migrationStateModel.getSourceConnectionProfile()).serverName;
		const errors: string[] = [];
		try {
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage) {
				this.migrationStateModel._assessmentResults = <ServerAssessment>this.migrationStateModel.savedInfo.serverAssessment;
			} else {
				await this.migrationStateModel.getDatabaseAssessments(MigrationTargetType.SQLMI);
			}

			const assessmentError = this.migrationStateModel._assessmentResults?.assessmentError;
			if (assessmentError) {
				errors.push(`message: ${assessmentError.message}${EOL}stack: ${assessmentError.stack}`);
			}
			if (this.migrationStateModel?._assessmentResults?.errors?.length! > 0) {
				errors.push(...this.migrationStateModel._assessmentResults?.errors?.map(
					e => `message: ${e.message}${EOL}errorSummary: ${e.errorSummary}${EOL}possibleCauses: ${e.possibleCauses}${EOL}guidance: ${e.guidance}${EOL}errorId: ${e.errorId}`)!);
			}
		} catch (e) {
			console.log(e);
			errors.push(constants.SKU_RECOMMENDATION_ASSESSMENT_UNEXPECTED_ERROR(serverName, e));
		} finally {
			this.migrationStateModel._runAssessments = errors.length > 0;
			if (errors.length > 0) {
				this.wizard.message = {
					text: constants.SKU_RECOMMENDATION_ASSESSMENT_ERROR(serverName),
					description: errors.join(EOL),
					level: azdata.window.MessageLevel.Error
				};
				this._assessmentStatusIcon.iconPath = IconPathHelper.error;
				this._igComponent.value = constants.ASSESSMENT_FAILED(serverName);
				this._detailsComponent.value = constants.SKU_RECOMMENDATION_ASSESSMENT_ERROR(serverName);
			} else {
				this._assessmentStatusIcon.iconPath = IconPathHelper.completedMigration;
				this._igComponent.value = constants.ASSESSMENT_COMPLETED(serverName);
				this._detailsComponent.value = constants.SKU_RECOMMENDATION_ALL_SUCCESSFUL(this.migrationStateModel._assessmentResults?.databaseAssessments?.length);
			}
		}

		if (this.hasSavedInfo()) {
			if (this.migrationStateModel.savedInfo.migrationTargetType) {
				this._rbg.selectedCardId = this.migrationStateModel.savedInfo.migrationTargetType;
				await this.refreshCardText();
			}
		}

		await this.refreshCardText();
		await this._setAssessmentState(false, this.migrationStateModel._runAssessments);
	}

	private async _setAssessmentState(assessing: boolean, failedAssessment: boolean): Promise<void> {
		let display: azdata.DisplayType = assessing ? 'block' : 'none';
		await this._assessmentComponent.updateCssStyles({ 'display': display });
		this._assessmentComponent.display = display;

		display = !assessing && failedAssessment ? 'block' : 'none';
		await this._skipAssessmentCheckbox.updateCssStyles({ 'display': display });
		this._skipAssessmentCheckbox.display = display;
		await this._skipAssessmentSubText.updateCssStyles({ 'display': display });
		this._skipAssessmentSubText.display = display;

		await this._formContainer.component().updateCssStyles({ 'display': !assessing ? 'block' : 'none' });

		display = failedAssessment && !this._skipAssessmentCheckbox.checked ? 'none' : 'block';
		await this._chooseTargetComponent.updateCssStyles({ 'display': display });
		this._chooseTargetComponent.display = display;

		display = !this._rbg.selectedCardId || failedAssessment && !this._skipAssessmentCheckbox.checked ? 'none' : 'inline';
		await this.assessmentGroupContainer.updateCssStyles({ 'display': display });
		this.assessmentGroupContainer.display = display;

		display = (this._rbg.selectedCardId
			&& (!failedAssessment || this._skipAssessmentCheckbox.checked)
			&& this.migrationStateModel._migrationDbs.length > 0)
			? 'inline'
			: 'none';

		this._assessmentLoader.loading = assessing;
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			const errors: string[] = [];
			this.wizard.message = {
				text: '',
				level: azdata.window.MessageLevel.Error
			};
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}

			if (this._rbg.selectedCardId === undefined || this._rbg.selectedCardId === '') {
				errors.push(constants.SELECT_TARGET_TO_CONTINUE);
			}
			if (this.migrationStateModel._migrationDbs.length === 0) {
				errors.push(constants.SELECT_DATABASE_TO_MIGRATE);
			}

			if (errors.length > 0) {
				this.wizard.message = {
					text: errors.join(EOL),
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
			return true;
		});
		this.wizard.nextButton.enabled = false;
		await this.constructDetails();
		this.wizard.nextButton.enabled = this.migrationStateModel._assessmentResults !== undefined;
	}

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.eventListener?.dispose();
		this.wizard.message = {
			text: '',
			level: azdata.window.MessageLevel.Error
		};
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			return true;
		});
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	public async refreshCardText(): Promise<void> {
		this._rbgLoader.loading = true;
		if (this._rbg.selectedCardId === MigrationTargetType.SQLMI) {
			this.migrationStateModel._migrationDbs = this.migrationStateModel._miDbs;
		} else {
			this.migrationStateModel._migrationDbs = this.migrationStateModel._vmDbs;
		}

		const dbCount = this.migrationStateModel._assessmentResults?.databaseAssessments?.length;
		const dbWithoutIssuesCount = this.migrationStateModel._assessmentResults?.databaseAssessments?.filter(db => db.issues?.length === 0).length;
		this._supportedProducts.forEach((product, index) => {
			if (!this.migrationStateModel._assessmentResults) {
				this._rbg.cards[index].descriptions[CardDescriptionIndex.ASSESSMENT_STATUS].textValue = '';
			} else {
				// this._rbg.cards[index].descriptions[5].textValue = constants.ASSESSED_DBS(dbCount);
				if (this.hasRecommendations()) {
					this._rbg.cards[index].descriptions[CardDescriptionIndex.VIEW_SKU_DETAILS].linkDisplayValue = constants.VIEW_DETAILS;
				} else {
					this._rbg.cards[index].descriptions[CardDescriptionIndex.VIEW_SKU_DETAILS].linkDisplayValue = '';

					if (this.migrationStateModel._perfDataCollectionStartDate) {
						this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue =
							constants.AZURE_RECOMMENDATION_CARD_IN_PROGRESS;
						// 'Data collection in progress, started at ' + new Date(this.migrationStateModel._perfDataCollectionStartDate).toLocaleString();
					} else {
						this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue = constants.AZURE_RECOMMENDATION_CARD_NOT_ENABLED;
					}
				}

				let recommendation;
				switch (product.type) {
					case MigrationTargetType.SQLMI:
						this._rbg.cards[index].descriptions[CardDescriptionIndex.ASSESSMENT_STATUS].textValue = constants.CAN_BE_MIGRATED(dbWithoutIssuesCount, dbCount);

						if (this.hasRecommendations()) {
							recommendation = this.migrationStateModel._skuRecommendationResults.recommendations.sqlMiRecommendationResults[0];

							if (!recommendation.targetSku) {	// result returned but no SKU recommended
								this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue = constants.SKU_RECOMMENDATION_NO_RECOMMENDATION;
							}
							else {
								const serviceTier = recommendation.targetSku.category?.sqlServiceTier === mssql.AzureSqlPaaSServiceTier.GeneralPurpose
									? constants.GENERAL_PURPOSE
									: constants.BUSINESS_CRITICAL;
								const hardwareType = recommendation.targetSku.category?.hardwareType === mssql.AzureSqlPaaSHardwareType.Gen5
									? constants.GEN5
									: recommendation.targetSku.category?.hardwareType === mssql.AzureSqlPaaSHardwareType.PremiumSeries
										? constants.PREMIUM_SERIES
										: constants.PREMIUM_SERIES_MEMORY_OPTIMIZED;
								this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue = constants.MI_CONFIGURATION_PREVIEW(hardwareType, serviceTier, recommendation.targetSku.computeSize!, recommendation.targetSku.storageMaxSizeInMb! / 1024);
							}

						}
						break;

					case MigrationTargetType.SQLVM:
						this._rbg.cards[index].descriptions[CardDescriptionIndex.ASSESSMENT_STATUS].textValue = constants.CAN_BE_MIGRATED(dbCount, dbCount);

						if (this.hasRecommendations()) {
							recommendation = this.migrationStateModel._skuRecommendationResults.recommendations.sqlVmRecommendationResults[0];
							if (!recommendation.targetSku) {	// result returned but no SKU recommended
								this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue = constants.SKU_RECOMMENDATION_NO_RECOMMENDATION;
							}
							else {
								this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue = constants.VM_CONFIGURATION_PREVIEW(recommendation.targetSku.virtualMachineSize!.sizeName, recommendation.targetSku.virtualMachineSize!.vCPUsAvailable, recommendation.targetSku.dataDiskSizes!.length, recommendation.targetSku.dataDiskSizes![0].size);
							}
						}
						break;

					case MigrationTargetType.SQLDB:
						this._rbg.cards[index].descriptions[CardDescriptionIndex.ASSESSMENT_STATUS].textValue = constants.CAN_BE_MIGRATED(dbWithoutIssuesCount, dbCount);

						if (this.hasRecommendations()) {
							const successfulRecommendationsCount = this.migrationStateModel._skuRecommendationResults.recommendations.sqlDbRecommendationResults.filter(r => r.targetSku !== null).length;
							this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue = constants.RECOMMENDATIONS_AVAILABLE(successfulRecommendationsCount);
						}
						break;
				}
			}
		});

		await this._rbg.updateProperties({ cards: this._rbg.cards });

		if (this._rbg.selectedCardId) {
			await this.changeTargetType(this._rbg.selectedCardId);
		}

		this._rbgLoader.loading = false;
	}

	private createAssessmentProgress(): azdata.FlexContainer {

		this._assessmentLoader = this._view.modelBuilder.loadingComponent().component();

		this._assessmentProgress = this._view.modelBuilder.text().withProps({
			value: constants.ASSESSMENT_IN_PROGRESS,
			CSSStyles: {
				...styles.PAGE_TITLE_CSS,
				'margin-right': '20px'
			}
		}).component();

		this._progressContainer = this._view.modelBuilder.flexContainer().withLayout({
			height: '100%',
			flexFlow: 'row',
			alignItems: 'center'
		}).component();

		this._progressContainer.addItem(this._assessmentProgress, { flex: '0 0 auto' });
		this._progressContainer.addItem(this._assessmentLoader, { flex: '0 0 auto' });
		return this._progressContainer;
	}

	private async createAssessmentInfo(): Promise<azdata.TextComponent> {
		this._assessmentInfo = this._view.modelBuilder.text().withProps({
			value: constants.ASSESSMENT_IN_PROGRESS_CONTENT((await this.migrationStateModel.getSourceConnectionProfile()).serverName),
			CSSStyles: {
				...styles.BODY_CSS,
				'width': '660px'
			}
		}).component();
		return this._assessmentInfo;
	}

	private createAzureRecommendationContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'column',
			}
		}).component();
		const recommendationSection = _view.modelBuilder.text().withProps({
			value: constants.AZURE_RECOMMENDATION,
			CSSStyles: {
				...styles.SECTION_HEADER_CSS,
				'margin': '12px 0 8px'
			}
		}).component();

		this._skuDataCollectionStatusText = _view.modelBuilder.text().withProps({
			value: constants.AZURE_RECOMMENDATION_STATUS_NOT_ENABLED,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '0 0 8px'
			}
		}).component();

		this._skuDataCollectionTimerText = _view.modelBuilder.text().withProps({
			value: '',
			CSSStyles: {
				...styles.LIGHT_LABEL_CSS,
				'margin': '0 0 8px',
				'display': 'none'
			}
		}).component();

		this._getAzureRecommendationButton = this._view.modelBuilder.button().withProps({
			label: constants.GET_AZURE_RECOMMENDATION,
			width: 180,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '0',
			}
		}).component();
		const getAzureRecommendationDialog = new GetAzureRecommendationDialog(this, this.wizard, this.migrationStateModel);
		this._disposables.push(this._getAzureRecommendationButton.onDidClick(async (e) => {
			await getAzureRecommendationDialog.openDialog();
		}));

		this._stopPerformanceCollectionButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.cancel,
			label: constants.STOP_PERFORMANCE_COLLECTION,
			width: 120,
			height: 24,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '0 0 8px 0',
				'width': 'fit-content',
				'display': 'none',
			}
		}).component();
		this._disposables.push(this._stopPerformanceCollectionButton.onDidClick(async (e) => {
			await this.migrationStateModel.stopPerfDataCollection();
		}));

		this._skuEditParametersContainer = this.createSkuEditParameters(_view);
		container.addItems([
			recommendationSection,
			this._stopPerformanceCollectionButton,
			this._skuDataCollectionStatusText,
			this._skuDataCollectionTimerText,
			this._getAzureRecommendationButton,
			this._skuEditParametersContainer,
		]);
		return container;
	}

	private createSkuEditParameters(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'column',
			}
		}).component();
		const recommendationParametersSection = _view.modelBuilder.text().withProps({
			value: constants.RECOMMENDATION_PARAMETERS,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '16px 0 8px'
			}
		}).component();

		const editParametersButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.edit,
			label: constants.EDIT_PARAMETERS,
			width: 130,
			height: 24,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '0',
				'width': 'fit-content',
			}
		}).component();
		let skuEditParametersDialog = new SkuEditParametersDialog(this, this.migrationStateModel);
		this._disposables.push(editParametersButton.onDidClick(async () => {
			await skuEditParametersDialog.openDialog();
		}));

		const createParameterGroup = (label: string, value: string): {
			flexContainer: azdata.FlexContainer,
			text: azdata.TextComponent,
		} => {
			const parameterGroup = this._view.modelBuilder.flexContainer().withProps({
				CSSStyles: {
					'flex-direction': 'row',
					'align-content': 'left',
					'width': 'fit-content',
					'margin-right': '24px',
				}
			}).component();
			const labelText = this._view.modelBuilder.text().withProps({
				value: label + ':',
				CSSStyles: {
					...styles.LIGHT_LABEL_CSS,
					'width': 'fit-content',
					'margin-right': '4px',
				}
			}).component();
			const valueText = this._view.modelBuilder.text().withProps({
				value: value,
				CSSStyles: {
					...styles.BODY_CSS,
					'width': 'fit-content,',
				}
			}).component();
			parameterGroup.addItems([
				labelText,
				valueText,
			]);
			return {
				flexContainer: parameterGroup,
				text: valueText,
			};
		};

		const scaleFactorParameterGroup = createParameterGroup(constants.SCALE_FACTOR, this.migrationStateModel._skuScalingFactor.toString());
		this._skuScaleFactorText = scaleFactorParameterGroup.text;

		const skuTargetPercentileParameterGroup = createParameterGroup(constants.PERCENTAGE_UTILIZATION, constants.PERCENTAGE(this.migrationStateModel._skuTargetPercentile));
		this._skuTargetPercentileText = skuTargetPercentileParameterGroup.text;

		const skuEnablePreviewParameterGroup = createParameterGroup(constants.ENABLE_PREVIEW_SKU, this.migrationStateModel._skuEnablePreview ? constants.YES : constants.NO);
		this._skuEnablePreviewSkuText = skuEnablePreviewParameterGroup.text;

		const parametersContainer = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'margin': '8px 0',
				'flex-direction': 'row',
				'width': 'fit-content',
			}
		}).component();
		parametersContainer.addItems([
			scaleFactorParameterGroup.flexContainer,
			skuTargetPercentileParameterGroup.flexContainer,
			skuEnablePreviewParameterGroup.flexContainer,
		]);

		container.addItems([
			recommendationParametersSection,
			editParametersButton,
			parametersContainer,
		]);
		return container;
	}

	private async getSkuRecommendations() {
		const perfQueryIntervalInSec = 30;
		const targetPlatforms = [MigrationTargetType.SQLDB, MigrationTargetType.SQLMI, MigrationTargetType.SQLVM];
		const startTime = '1900-01-01 00:00:00';
		const endTime = '2200-01-01 00:00:00';

		await this.migrationStateModel.getSkuRecommendations(
			this.migrationStateModel._skuRecommendationPerformanceLocation,
			perfQueryIntervalInSec,
			targetPlatforms,
			this.migrationStateModel._skuTargetPercentile,
			this.migrationStateModel._skuScalingFactor,
			startTime,
			endTime,
			this.migrationStateModel._skuEnablePreview,
			this.migrationStateModel._databaseAssessment);
	}

	public async refreshSkuParameters(): Promise<void> {
		this._skuScaleFactorText.value = this.migrationStateModel._skuScalingFactor.toString();
		this._skuTargetPercentileText.value = constants.PERCENTAGE(this.migrationStateModel._skuTargetPercentile);
		this._skuEnablePreviewSkuText.value = this.migrationStateModel._skuEnablePreview.toString();

		await this.getSkuRecommendations();
		await this.refreshCardText();
	}

	public async refreshDataCollectionTimerStatus(): Promise<void> {
		console.log('refreshDataCollectionTimerStatus');

		// TO-DO: update text when initial timer starts
		this._skuDataCollectionStatusText.value = constants.AZURE_RECOMMENDATION_STATUS_IN_PROGRESS;

		if (this.hasRecommendations()) {
			this._skuDataCollectionStatusText.value = constants.AZURE_RECOMMENDATION_STATUS_REFINING;
		}

		if (!this.migrationStateModel._perfDataCollectionStartDate) {
			await this._getAzureRecommendationButton.updateCssStyles({ 'display': 'block' });
			await this._stopPerformanceCollectionButton.updateCssStyles({ 'display': 'none' });
			await this._skuDataCollectionTimerText.updateCssStyles({ 'display': 'none' });
		} else {
			await this._getAzureRecommendationButton.updateCssStyles({ 'display': 'none' });

			if (!this.migrationStateModel._perfDataCollectionStopDate) {
				await this._stopPerformanceCollectionButton.updateCssStyles({ 'display': 'block' });

				await this._skuDataCollectionTimerText.updateCssStyles({ 'display': 'block' });
				// TO-DO: update timer text here
				const durationMins = Math.abs(new Date().getTime() - new Date(this.migrationStateModel._perfDataCollectionStartDate).getTime()) / 60000;
				this._skuDataCollectionTimerText.value = 'Data collected for ' + durationMins.toFixed(2) + ' minutes';
			}
		}

		await this.refreshCardText();
	}

	private hasSavedInfo(): boolean {
		return this.migrationStateModel.retryMigration || (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.SKURecommendation);
	}

	private hasRecommendations(): boolean {
		return this.migrationStateModel._skuRecommendationResults?.recommendations && !this.migrationStateModel._skuRecommendationResults?.recommendationError ? true : false;
	}
}

export enum CardDescriptionIndex {
	TARGET_TYPE = 0,
	ASSESSMENT_RESULTS_SECTION = 1,
	ASSESSMENT_STATUS = 2,
	ASSESSED_DBS = 3,
	RECOMMENDATION_RESULTS_SECTION = 4,
	SKU_RECOMMENDATION = 5,
	VIEW_SKU_DETAILS = 6,
}
