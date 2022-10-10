/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as utils from '../api/utils';
import * as mssql from 'mssql';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, MigrationTargetType, PerformanceDataSourceOptions, StateChangeEvent } from '../models/stateMachine';
import { AssessmentResultsDialog } from '../dialog/assessmentResults/assessmentResultsDialog';
import { SkuRecommendationResultsDialog } from '../dialog/skuRecommendationResults/skuRecommendationResultsDialog';
import { GetAzureRecommendationDialog } from '../dialog/skuRecommendationResults/getAzureRecommendationDialog';
import * as constants from '../constants/strings';
import { EOL } from 'os';
import { IconPath, IconPathHelper } from '../constants/iconPathHelper';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import * as styles from '../constants/styles';
import { SkuEditParametersDialog } from '../dialog/skuRecommendationResults/skuEditParametersDialog';
import { logError, TelemetryViews } from '../telemtery';

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

	private _azureRecommendationSectionText!: azdata.TextComponent;

	private _skuGetRecommendationContainer!: azdata.FlexContainer;
	private _azureRecommendationInfoText!: azdata.TextComponent;
	private _getAzureRecommendationButton!: azdata.ButtonComponent;

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
	private _disposables: vscode.Disposable[] = [];

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

	protected async registerContent(view: azdata.ModelView) {
		this._view = view;
		this._igComponent = this.createStatusComponent(view); // The first component giving basic information
		this._assessmentStatusIcon = this._view.modelBuilder.image()
			.withProps({
				iconPath: IconPathHelper.completedMigration,
				iconHeight: 17,
				iconWidth: 17,
				width: 20,
				height: 20
			}).component();
		const igContainer = this._view.modelBuilder.flexContainer()
			.withProps({ CSSStyles: { 'align-items': 'center' } })
			.component();
		igContainer.addItem(this._assessmentStatusIcon, { flex: '0 0 auto' });
		igContainer.addItem(this._igComponent, { flex: '0 0 auto' });

		this._detailsComponent = this.createDetailsComponent(view); // The details of what can be moved
		this._skipAssessmentCheckbox = view.modelBuilder.checkBox()
			.withProps({
				label: constants.SKU_RECOMMENDATION_ASSESSMENT_ERROR_BYPASS,
				checked: false,
				CSSStyles: {
					...styles.SECTION_HEADER_CSS,
					'margin': '10px 0 0 0',
					'display': 'none'
				},
			}).component();
		this._skipAssessmentSubText = view.modelBuilder.text()
			.withProps({
				value: constants.SKU_RECOMMENDATION_ASSESSMENT_ERROR_DETAIL,
				CSSStyles: {
					'margin': '0 0 0 15px',
					'font-size': '13px',
					'color': 'red',
					'width': '590px',
					'display': 'none'
				},
			}).component();

		this._disposables.push(
			this._skipAssessmentCheckbox.onChanged(
				async (value) => await this._setAssessmentState(false, true)));

		const refreshAssessmentButton = this._view.modelBuilder.button()
			.withProps({
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
			await this.startCardLoading();
			this.migrationStateModel._runAssessments = true;
			await this.constructDetails();
		}));

		const statusContainer = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([
				igContainer,
				this._detailsComponent,
				refreshAssessmentButton,
				this._skipAssessmentCheckbox,
				this._skipAssessmentSubText])
			.withProps({ CSSStyles: { 'margin': '0' } })
			.component();
		this._chooseTargetComponent = await this.createChooseTargetComponent(view);
		const _azureRecommendationsContainer = this.createAzureRecommendationContainer(view);
		this.assessmentGroupContainer = await this.createViewAssessmentsContainer();
		this._formContainer = view.modelBuilder.formContainer()
			.withFormItems([
				{ component: statusContainer, title: '' },
				{ component: this._chooseTargetComponent },
				{ component: _azureRecommendationsContainer },
				{ component: this.assessmentGroupContainer }])
			.withProps({
				CSSStyles: {
					'display': 'none',
					'padding-top': '0',
				}
			});

		this._assessmentComponent = this._view.modelBuilder.flexContainer()
			.withLayout({ height: '100%', flexFlow: 'column' })
			.withProps({ CSSStyles: { 'margin-left': '30px' } })
			.component();

		this._assessmentComponent.addItem(this.createAssessmentProgress(), { flex: '0 0 auto' });
		this._assessmentComponent.addItem(await this.createAssessmentInfo(), { flex: '0 0 auto' });

		this._rootContainer = this._view.modelBuilder.flexContainer()
			.withLayout({ height: '100%', flexFlow: 'column' })
			.withProps({ ariaLive: 'polite' })
			.component();
		this._rootContainer.addItem(this._assessmentComponent, { flex: '0 0 auto' });
		this._rootContainer.addItem(this._formContainer.component(), { flex: '0 0 auto' });

		this._disposables.push(this._view.onClosed(
			e => this._disposables.forEach(
				d => { try { d.dispose(); } catch { } })));

		await this._view.initializeModel(this._rootContainer);
	}

	private createStatusComponent(view: azdata.ModelView): azdata.TextComponent {
		const component = view.modelBuilder.text()
			.withProps({
				CSSStyles: {
					...styles.SECTION_HEADER_CSS,
					'margin-left': '8px'
				}
			}).component();
		return component;
	}

	private createDetailsComponent(view: azdata.ModelView): azdata.TextComponent {
		const component = view.modelBuilder.text()
			.withProps({ CSSStyles: { ...styles.BODY_CSS } })
			.component();
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
			cardHeight: '340px',
			iconPosition: 'left',
			ariaLabel: constants.SKU_RECOMMENDATION_CHOOSE_A_TARGET,
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
			}
		}));

		this._rbgLoader = this._view.modelBuilder.loadingComponent()
			.withItem(this._rbg)
			.component();

		const component = this._view.modelBuilder.divContainer()
			.withItems([chooseYourTargetText, this._rbgLoader])
			.component();
		return component;
	}

	private async createViewAssessmentsContainer(): Promise<azdata.FlexContainer> {
		this._viewAssessmentsHelperText = this._view.modelBuilder.text().withProps({
			value: constants.SKU_RECOMMENDATION_VIEW_ASSESSMENT_MI,
			CSSStyles: { ...styles.SECTION_HEADER_CSS },
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();

		const button = this._view.modelBuilder.button().withProps({
			label: constants.VIEW_SELECT_BUTTON_LABEL,
			width: 100,
			CSSStyles: { 'margin': '12px 0' }
		}).component();

		this._serverName = this.migrationStateModel.serverName || (await this.migrationStateModel.getSourceConnectionProfile()).serverName;

		const miDialog = new AssessmentResultsDialog('ownerUri', this.migrationStateModel, constants.ASSESSMENT_TILE(this._serverName), this, MigrationTargetType.SQLMI);
		const vmDialog = new AssessmentResultsDialog('ownerUri', this.migrationStateModel, constants.ASSESSMENT_TILE(this._serverName), this, MigrationTargetType.SQLVM);
		const dbDialog = new AssessmentResultsDialog('ownerUri', this.migrationStateModel, constants.ASSESSMENT_TILE(this._serverName), this, MigrationTargetType.SQLDB);

		this._disposables.push(button.onDidClick(async (e) => {
			switch (this._rbg.selectedCardId) {
				case MigrationTargetType.SQLVM:
					this._rbg.selectedCardId = MigrationTargetType.SQLVM;
					return await vmDialog.openDialog();
				case MigrationTargetType.SQLMI:
					this._rbg.selectedCardId = MigrationTargetType.SQLMI;
					return await miDialog.openDialog();
				case MigrationTargetType.SQLDB:
					this._rbg.selectedCardId = MigrationTargetType.SQLDB;
					return await dbDialog.openDialog();
			}
		}));

		this._databaseSelectedHelperText = this._view.modelBuilder.text()
			.withProps({
				CSSStyles: { ...styles.BODY_CSS },
				ariaLive: 'polite',
			}).component();

		const container = this._view.modelBuilder.flexContainer()
			.withItems([
				this._viewAssessmentsHelperText,
				button,
				this._databaseSelectedHelperText
			]).withProps({
				'display': 'none'
			}).component();
		return container;
	}

	private changeTargetType(newTargetType: string): void {
		switch (newTargetType) {
			case MigrationTargetType.SQLMI:
				const miDbs = this.migrationStateModel._miDbs.filter(
					db => this.migrationStateModel._databasesForAssessment.findIndex(
						dba => dba === db) >= 0);

				this._viewAssessmentsHelperText.value = constants.SKU_RECOMMENDATION_VIEW_ASSESSMENT_MI;
				this.migrationStateModel._targetType = MigrationTargetType.SQLMI;
				this.migrationStateModel._databasesForMigration = miDbs;
				break;
			case MigrationTargetType.SQLVM:
				const vmDbs = this.migrationStateModel._vmDbs.filter(
					db => this.migrationStateModel._databasesForAssessment.findIndex(
						dba => dba === db) >= 0);

				this._viewAssessmentsHelperText.value = constants.SKU_RECOMMENDATION_VIEW_ASSESSMENT_VM;
				this.migrationStateModel._targetType = MigrationTargetType.SQLVM;
				this.migrationStateModel._databasesForMigration = vmDbs;
				break;
			case MigrationTargetType.SQLDB:
				const dbDbs = this.migrationStateModel._sqldbDbs.filter(
					db => this.migrationStateModel._databasesForAssessment.findIndex(
						dba => dba === db) >= 0);

				this._viewAssessmentsHelperText.value = constants.SKU_RECOMMENDATION_VIEW_ASSESSMENT_SQLDB;
				this.migrationStateModel._targetType = MigrationTargetType.SQLDB;
				this.migrationStateModel._databasesForMigration = dbDbs;
				break;
		}

		this._databaseSelectedHelperText.value = constants.TOTAL_DATABASES_SELECTED(
			this.migrationStateModel._databasesForMigration.length,
			this.migrationStateModel._databasesForAssessment.length);
		this.migrationStateModel.refreshDatabaseBackupPage = true;
	}

	private async constructDetails(): Promise<void> {
		this.wizard.message = {
			text: '',
			level: azdata.window.MessageLevel.Error
		};

		if (this.migrationStateModel._runAssessments) {
			const errors: string[] = [];
			await this._setAssessmentState(true, false);
			try {
				await this.migrationStateModel.getDatabaseAssessments([MigrationTargetType.SQLMI, MigrationTargetType.SQLDB]);
				const assessmentError = this.migrationStateModel._assessmentResults?.assessmentError;
				if (assessmentError) {
					errors.push(`message: ${assessmentError.message}${EOL}stack: ${assessmentError.stack}`);
				}
				if (this.migrationStateModel?._assessmentResults?.errors?.length! > 0) {
					errors.push(...this.migrationStateModel._assessmentResults?.errors?.map(
						e => `message: ${e.message}${EOL}errorSummary: ${e.errorSummary}${EOL}possibleCauses: ${e.possibleCauses}${EOL}guidance: ${e.guidance}${EOL}errorId: ${e.errorId}`)!);
				}
			} catch (e) {
				errors.push(constants.SKU_RECOMMENDATION_ASSESSMENT_UNEXPECTED_ERROR(this._serverName, e));
				logError(TelemetryViews.MigrationWizardSkuRecommendationPage, 'SkuRecommendationUnexpectedError', e);
			} finally {
				this.migrationStateModel._runAssessments = errors.length > 0;
				if (errors.length > 0) {
					this.wizard.message = {
						text: constants.SKU_RECOMMENDATION_ASSESSMENT_ERROR(this._serverName),
						description: errors.join(EOL),
						level: azdata.window.MessageLevel.Error
					};
					this._assessmentStatusIcon.iconPath = IconPathHelper.error;
					this._igComponent.value = constants.ASSESSMENT_FAILED(this._serverName);
					this._detailsComponent.value = constants.SKU_RECOMMENDATION_ASSESSMENT_ERROR(this._serverName);
				} else {
					this._assessmentStatusIcon.iconPath = IconPathHelper.completedMigration;
					this._igComponent.value = constants.ASSESSMENT_COMPLETED(this._serverName);
					this._detailsComponent.value = constants.SKU_RECOMMENDATION_ALL_SUCCESSFUL(
						this.migrationStateModel._assessmentResults?.databaseAssessments?.length);
				}
			}
		} else {
			// use prior assessment results
			this._assessmentStatusIcon.iconPath = IconPathHelper.completedMigration;
			this._igComponent.value = constants.ASSESSMENT_COMPLETED(this._serverName);
			this._detailsComponent.value = constants.SKU_RECOMMENDATION_ALL_SUCCESSFUL(
				this.migrationStateModel._assessmentResults?.databaseAssessments?.length);
		}

		if (this.migrationStateModel.savedInfo?.migrationTargetType) {
			this._rbg.selectedCardId = this.migrationStateModel._targetType;
		}

		let shouldGetSkuRecommendations = false;
		if (this.hasRecommendations() && this.migrationStateModel.hasRecommendedDatabaseListChanged()) {
			shouldGetSkuRecommendations = true;
		}

		if (this.migrationStateModel.savedInfo?.skuRecommendation) {
			await this.refreshSkuParameters();

			switch (this.migrationStateModel._skuRecommendationPerformanceDataSource) {
				case PerformanceDataSourceOptions.CollectData: {
					// check if collector is still running
					await this.migrationStateModel.refreshPerfDataCollection();
					if (this.migrationStateModel._perfDataCollectionIsCollecting) {
						// user started collecting data, and the collector is still running
						const collectionStartTime = new Date(this.migrationStateModel._perfDataCollectionStartDate!);
						const expectedRefreshTime = new Date(collectionStartTime.getTime() + this.migrationStateModel.refreshGetSkuRecommendationFrequency);
						const timeLeft = Math.abs(new Date().getTime() - expectedRefreshTime.getTime());
						await this.migrationStateModel.startSkuTimers(this, timeLeft);

					} else {
						// user started collecting data, but collector is stopped
						// set stop date to some date value
						this.migrationStateModel._perfDataCollectionStopDate = this.migrationStateModel._perfDataCollectionStopDate || new Date();
						shouldGetSkuRecommendations = true;
					}
					break;
				}

				case PerformanceDataSourceOptions.OpenExisting: {
					shouldGetSkuRecommendations = true;
					break;
				}
			}
		}

		if (shouldGetSkuRecommendations) {
			await this.migrationStateModel.getSkuRecommendations();
		}

		await this.refreshSkuRecommendationComponents();
		await this._setAssessmentState(false, this.migrationStateModel._runAssessments);
	}

	private async _setAssessmentState(assessing: boolean, failedAssessment: boolean): Promise<void> {
		await utils.updateControlDisplay(
			this._assessmentComponent,
			assessing,
			'block');
		await utils.updateControlDisplay(
			this._skipAssessmentCheckbox,
			!assessing && failedAssessment,
			'block');
		await utils.updateControlDisplay(
			this._skipAssessmentSubText,
			!assessing && failedAssessment,
			'block');
		await utils.updateControlDisplay(
			this._formContainer.component(),
			!assessing,
			'block');
		await utils.updateControlDisplay(
			this._chooseTargetComponent,
			!failedAssessment || this._skipAssessmentCheckbox.checked === true,
			'block');
		await utils.updateControlDisplay(
			this.assessmentGroupContainer,
			this._rbg.selectedCardId !== undefined && (!failedAssessment || this._skipAssessmentCheckbox.checked === true),
			'inline');

		this._assessmentLoader.loading = assessing;
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
			return;
		}

		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			this.wizard.message = { text: '' };
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}

			const errors: string[] = [];
			if (this._rbg.selectedCardId === undefined || this._rbg.selectedCardId === '') {
				errors.push(constants.SELECT_TARGET_TO_CONTINUE);
			}
			if (this.migrationStateModel._databasesForMigration.length === 0) {
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

	public async refreshCardText(showLoadingIcon: boolean = true): Promise<void> {
		this._rbgLoader.loading = showLoadingIcon && true;
		switch (this._rbg.selectedCardId) {
			case MigrationTargetType.SQLMI:
				this.migrationStateModel._databasesForMigration = this.migrationStateModel._miDbs;
			case MigrationTargetType.SQLDB:
				this.migrationStateModel._databasesForMigration = this.migrationStateModel._sqldbDbs;
			case MigrationTargetType.SQLVM:
				this.migrationStateModel._databasesForMigration = this.migrationStateModel._vmDbs;
		}

		const dbCount = this.migrationStateModel._assessmentResults?.databaseAssessments?.length;
		const dbWithoutIssuesForMiCount = this.migrationStateModel._assessmentResults?.databaseAssessments?.filter(db =>
			!db.issues?.some(issue => issue.appliesToMigrationTargetPlatform === MigrationTargetType.SQLMI)
		).length;
		const dbWithoutIssuesForVmCount = dbCount;
		const dbWithoutIssuesForDbCount = this.migrationStateModel._assessmentResults?.databaseAssessments?.filter(db =>
			!db.issues?.some(issue => issue.appliesToMigrationTargetPlatform === MigrationTargetType.SQLDB)
		).length;

		this._supportedProducts.forEach((product, index) => {
			if (!this.migrationStateModel._assessmentResults) {
				this._rbg.cards[index].descriptions[CardDescriptionIndex.ASSESSMENT_STATUS].textValue = '';
			} else {
				if (this.hasRecommendations()) {
					this._rbg.cards[index].descriptions[CardDescriptionIndex.VIEW_SKU_DETAILS].linkDisplayValue = constants.VIEW_DETAILS;
					this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textStyles = {
						...styles.BODY_CSS,
						'font-weight': '500',
					};
				} else {
					this._rbg.cards[index].descriptions[CardDescriptionIndex.VIEW_SKU_DETAILS].linkDisplayValue = '';
					this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textStyles = {
						...styles.BODY_CSS,
					};

					if (this.migrationStateModel._perfDataCollectionStartDate) {
						this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue =
							constants.AZURE_RECOMMENDATION_CARD_IN_PROGRESS;
					} else {
						this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue =
							constants.AZURE_RECOMMENDATION_CARD_NOT_ENABLED;
					}
				}

				let recommendation;
				switch (product.type) {
					case MigrationTargetType.SQLMI:
						this._rbg.cards[index].descriptions[CardDescriptionIndex.ASSESSMENT_STATUS].textValue =
							constants.CAN_BE_MIGRATED(dbWithoutIssuesForMiCount, dbCount);

						if (this.hasRecommendations()) {
							if (this.migrationStateModel._skuEnableElastic) {
								recommendation = this.migrationStateModel._skuRecommendationResults.recommendations?.elasticSqlMiRecommendationResults[0];
							} else {
								recommendation = this.migrationStateModel._skuRecommendationResults.recommendations?.sqlMiRecommendationResults[0];
							}

							// result returned but no SKU recommended
							if (!recommendation?.targetSku) {
								this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue =
									constants.SKU_RECOMMENDATION_NO_RECOMMENDATION;
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
								this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue =
									constants.MI_CONFIGURATION_PREVIEW(
										hardwareType,
										serviceTier,
										recommendation.targetSku.computeSize!,
										recommendation.targetSku.storageMaxSizeInMb! / 1024);
							}
						}
						break;

					case MigrationTargetType.SQLVM:
						this._rbg.cards[index].descriptions[CardDescriptionIndex.ASSESSMENT_STATUS].textValue =
							constants.CAN_BE_MIGRATED(dbWithoutIssuesForVmCount, dbCount);

						if (this.hasRecommendations()) {
							// elastic model currently doesn't support SQL VM, so show the baseline model results regardless of user preference
							recommendation = this.migrationStateModel._skuRecommendationResults.recommendations?.sqlVmRecommendationResults[0];

							// result returned but no SKU recommended
							if (!recommendation?.targetSku) {
								this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue =
									constants.SKU_RECOMMENDATION_NO_RECOMMENDATION;
								this._rbg.cards[index].descriptions[CardDescriptionIndex.VM_CONFIGURATIONS].textValue = '';
							}
							else {
								this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue =
									constants.VM_CONFIGURATION(
										recommendation.targetSku.virtualMachineSize!.sizeName,
										recommendation.targetSku.virtualMachineSize!.vCPUsAvailable);

								const dataDisk = constants.STORAGE_CONFIGURATION(
									recommendation.targetSku.dataDiskSizes![0].size,
									recommendation.targetSku.dataDiskSizes!.length);
								const storageDisk = constants.STORAGE_CONFIGURATION(
									recommendation.targetSku.logDiskSizes![0].size,
									recommendation.targetSku.logDiskSizes!.length);
								const tempDb = recommendation.targetSku.tempDbDiskSizes!.length > 0
									? constants.STORAGE_CONFIGURATION(
										recommendation.targetSku.logDiskSizes![0].size,
										recommendation.targetSku.logDiskSizes!.length)
									: constants.LOCAL_SSD;
								this._rbg.cards[index].descriptions[CardDescriptionIndex.VM_CONFIGURATIONS].textValue =
									constants.VM_CONFIGURATION_PREVIEW(dataDisk, storageDisk, tempDb);
							}
						}
						break;

					case MigrationTargetType.SQLDB:
						this._rbg.cards[index].descriptions[CardDescriptionIndex.ASSESSMENT_STATUS].textValue =
							constants.CAN_BE_MIGRATED(dbWithoutIssuesForDbCount, dbCount);

						if (this.hasRecommendations()) {
							const recommendations = this.migrationStateModel._skuEnableElastic
								? this.migrationStateModel._skuRecommendationResults.recommendations!.elasticSqlDbRecommendationResults
								: this.migrationStateModel._skuRecommendationResults.recommendations!.sqlDbRecommendationResults;
							const successfulRecommendationsCount = recommendations.filter(r => r.targetSku !== null).length;
							this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue =
								constants.RECOMMENDATIONS_AVAILABLE(successfulRecommendationsCount);
						}
						break;
				}
			}
		});

		await this._rbg.updateProperties({ cards: this._rbg.cards });

		if (this._rbg.selectedCardId) {
			this.changeTargetType(this._rbg.selectedCardId);
		}

		this._rbgLoader.loading = false;
	}

	public async startCardLoading(): Promise<void> {
		// TO-DO: ideally the short SKU recommendation loading time should have a spinning indicator,
		// but updating the card text will do for now
		this._supportedProducts.forEach((product, index) => {
			this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textValue = constants.LOADING_RECOMMENDATIONS;
			this._rbg.cards[index].descriptions[CardDescriptionIndex.SKU_RECOMMENDATION].textStyles = { ...styles.BODY_CSS };
			this._rbg.cards[index].descriptions[CardDescriptionIndex.VM_CONFIGURATIONS].textValue = '';
		});

		await this._rbg.updateProperties({ cards: this._rbg.cards });
	}

	private createAssessmentProgress(): azdata.FlexContainer {
		this._assessmentLoader = this._view.modelBuilder.loadingComponent()
			.component();

		this._assessmentProgress = this._view.modelBuilder.text()
			.withProps({
				value: constants.ASSESSMENT_IN_PROGRESS,
				CSSStyles: {
					...styles.PAGE_TITLE_CSS,
					'margin-right': '20px'
				}
			}).component();

		this._progressContainer = this._view.modelBuilder.flexContainer()
			.withLayout({
				height: '100%',
				flexFlow: 'row',
				alignItems: 'center'
			}).component();

		this._progressContainer.addItem(this._assessmentProgress, { flex: '0 0 auto' });
		this._progressContainer.addItem(this._assessmentLoader, { flex: '0 0 auto' });
		return this._progressContainer;
	}

	private async createAssessmentInfo(): Promise<azdata.TextComponent> {
		this._assessmentInfo = this._view.modelBuilder.text()
			.withProps({
				value: constants.ASSESSMENT_IN_PROGRESS_CONTENT(this._serverName),
				CSSStyles: {
					...styles.BODY_CSS,
					'width': '660px'
				}
			}).component();
		return this._assessmentInfo;
	}

	private createAzureRecommendationContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: {
					'flex-direction': 'column',
					'max-width': '700px',
					'margin-bottom': '1em',
				}
			}).component();
		this._azureRecommendationSectionText = _view.modelBuilder.text()
			.withProps({
				value: constants.AZURE_RECOMMENDATION,
				description: '',
				CSSStyles: {
					...styles.SECTION_HEADER_CSS,
					'margin': '12px 0 8px',
				}
			}).component();
		this._azureRecommendationInfoText = _view.modelBuilder.text()
			.withProps({
				value: constants.AZURE_RECOMMENDATION_STATUS_NOT_ENABLED,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '0',
				}
			}).component();
		const learnMoreLink = _view.modelBuilder.hyperlink()
			.withProps({
				label: constants.LEARN_MORE,
				ariaLabel: constants.LEARN_MORE,
				url: 'https://aka.ms/ads-sql-sku-recommend',
				showLinkIcon: true,
			}).component();
		const azureRecommendationsInfoContainer = _view.modelBuilder.flexContainer()
			.withItems([
				this._azureRecommendationInfoText,
				learnMoreLink,
			]).withProps({
				CSSStyles: {
					'flex-direction': 'column',
					'margin-top': '-0.5em',
					'margin-bottom': '12px',
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
		this._disposables.push(this._getAzureRecommendationButton.onDidClick(
			async (e) => await getAzureRecommendationDialog.openDialog()));

		this._skuGetRecommendationContainer = _view.modelBuilder.flexContainer()
			.withProps({ CSSStyles: { 'flex-direction': 'column', } })
			.component();

		this._skuGetRecommendationContainer.addItems([
			azureRecommendationsInfoContainer,
			this._getAzureRecommendationButton]);

		this._skuDataCollectionStatusContainer = this.createPerformanceCollectionStatusContainer(_view);
		this._skuEditParametersContainer = this.createSkuEditParameters(_view);
		container.addItems([
			this._azureRecommendationSectionText,
			this._skuDataCollectionStatusContainer,
			this._skuGetRecommendationContainer,
			this._skuEditParametersContainer,
		]);
		return container;
	}

	private createPerformanceCollectionStatusContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: {
					'flex-direction': 'column',
					'display': this.migrationStateModel.performanceCollectionNotStarted() ? 'none' : 'block',
				}
			}).component();

		this._skuDataCollectionStatusIcon = _view.modelBuilder.image()
			.withProps({
				iconPath: IconPathHelper.inProgressMigration,
				iconHeight: 16,
				iconWidth: 16,
				width: 16,
				height: 16,
				CSSStyles: { 'margin-right': '4px' }
			}).component();
		this._skuDataCollectionStatusText = _view.modelBuilder.text()
			.withProps({
				value: '',
				CSSStyles: { ...styles.BODY_CSS, 'margin': '0' }
			}).component();

		const statusIconTextContainer = _view.modelBuilder.flexContainer()
			.withItems([
				this._skuDataCollectionStatusIcon,
				this._skuDataCollectionStatusText,
			])
			.withProps({
				CSSStyles: {
					'flex-direction': 'row',
					'width': 'fit-content',
					'align-items': 'center',
					'margin': '0',
				}
			}).component();

		this._skuDataCollectionTimerText = _view.modelBuilder.text()
			.withProps({
				value: '',
				CSSStyles: {
					...styles.LIGHT_LABEL_CSS,
					'margin': '0 0 8px 20px',
				}
			}).component();

		this._skuStopDataCollectionButton = this._view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.cancel,
				label: constants.STOP_PERFORMANCE_COLLECTION,
				width: 150,
				height: 24,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '0',
					'display': this.migrationStateModel.performanceCollectionInProgress() ? 'block' : 'none',
				}
			}).component();
		this._disposables.push(this._skuStopDataCollectionButton.onDidClick(async (e) => {
			await this.migrationStateModel.stopPerfDataCollection();
			await this.refreshAzureRecommendation();
		}));

		this._skuRestartDataCollectionButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.restartDataCollection,
			label: constants.RESTART_PERFORMANCE_COLLECTION,
			width: 160,
			height: 24,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '0',
				'display': this.migrationStateModel.performanceCollectionStopped() ? 'block' : 'none',
			}
		}).component();
		this._disposables.push(
			this._skuRestartDataCollectionButton.onDidClick(async (e) => {
				await this.migrationStateModel.startPerfDataCollection(
					this.migrationStateModel._skuRecommendationPerformanceLocation,
					this.migrationStateModel._performanceDataQueryIntervalInSeconds,
					this.migrationStateModel._staticDataQueryIntervalInSeconds,
					this.migrationStateModel._numberOfPerformanceDataQueryIterations,
					this);
				await this.refreshSkuRecommendationComponents();
			}));

		this._refreshAzureRecommendationButton = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
			label: constants.REFRESH_AZURE_RECOMMENDATION,
			width: 180,
			height: 24,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '0 0 0 12px',
			}
		}).component();
		this._disposables.push(
			this._refreshAzureRecommendationButton.onDidClick(
				async (e) => await this.refreshAzureRecommendation()));

		this._skuLastRefreshTimeText = this._view.modelBuilder.text()
			.withProps({
				value: constants.LAST_REFRESHED_TIME(),
				CSSStyles: {
					...styles.SMALL_NOTE_CSS,
					'margin': '0 0 4px 4px',
				},
			}).component();
		this._skuControlButtonsContainer = _view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: {
					'flex-direction': 'row',
					'width': 'fit-content',
					'align-items': 'flex-end',
					'margin-bottom': '12px',
				}
			}).component();
		this._skuControlButtonsContainer.addItems([
			this._skuStopDataCollectionButton,
			this._skuRestartDataCollectionButton,
			this._refreshAzureRecommendationButton,
			this._skuLastRefreshTimeText]);

		container.addItems([
			this._skuControlButtonsContainer,
			statusIconTextContainer,
			this._skuDataCollectionTimerText]);

		return container;
	}

	private createSkuEditParameters(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'column',
				'display': this.migrationStateModel.performanceCollectionNotStarted() ? 'none' : 'block',
			}
		}).component();
		const recommendationParametersSection = _view.modelBuilder.text()
			.withProps({
				value: constants.RECOMMENDATION_PARAMETERS,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '16px 0 8px'
				}
			}).component();

		const editParametersButton = this._view.modelBuilder.button()
			.withProps({
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
		this._disposables.push(
			editParametersButton.onDidClick(
				async () => await skuEditParametersDialog.openDialog()));

		const createParameterGroup = (label: string, value: string): {
			flexContainer: azdata.FlexContainer,
			text: azdata.TextComponent,
		} => {
			const parameterGroup = this._view.modelBuilder.flexContainer()
				.withProps({
					CSSStyles: {
						'flex-direction': 'row',
						'align-content': 'left',
						'width': 'fit-content',
						'margin-right': '24px',
					}
				}).component();
			const labelText = this._view.modelBuilder.text()
				.withProps({
					value: label + ':',
					CSSStyles: {
						...styles.LIGHT_LABEL_CSS,
						'width': 'fit-content',
						'margin-right': '4px',
					}
				}).component();
			const valueText = this._view.modelBuilder.text()
				.withProps({
					value: value,
					CSSStyles: {
						...styles.BODY_CSS,
						'width': 'fit-content,',
					}
				}).component();
			parameterGroup.addItems([
				labelText,
				valueText]);
			return {
				flexContainer: parameterGroup,
				text: valueText,
			};
		};

		const scaleFactorParameterGroup = createParameterGroup(
			constants.SCALE_FACTOR,
			this.migrationStateModel._skuScalingFactor.toString());
		this._skuScaleFactorText = scaleFactorParameterGroup.text;

		const skuTargetPercentileParameterGroup = createParameterGroup(
			constants.PERCENTAGE_UTILIZATION,
			constants.PERCENTAGE(this.migrationStateModel._skuTargetPercentile));
		this._skuTargetPercentileText = skuTargetPercentileParameterGroup.text;

		const skuEnablePreviewParameterGroup = createParameterGroup(
			constants.ENABLE_PREVIEW_SKU,
			this.migrationStateModel._skuEnablePreview ? constants.YES : constants.NO);
		this._skuEnablePreviewSkuText = skuEnablePreviewParameterGroup.text;

		const skuEnableElasticRecommendationsParameterGroup = createParameterGroup(constants.ELASTIC_RECOMMENDATION_LABEL, this.migrationStateModel._skuEnableElastic ? constants.YES : constants.NO);
		this._skuEnableElasticRecommendationsText = skuEnableElasticRecommendationsParameterGroup.text;

		const parametersContainer = _view.modelBuilder.flexContainer()
			.withProps({
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
			skuEnableElasticRecommendationsParameterGroup.flexContainer
		]);

		container.addItems([
			recommendationParametersSection,
			editParametersButton,
			parametersContainer,
		]);
		return container;
	}

	public async refreshSkuParameters(): Promise<void> {
		this._skuScaleFactorText.value = this.migrationStateModel._skuScalingFactor.toString();
		this._skuTargetPercentileText.value = constants.PERCENTAGE(this.migrationStateModel._skuTargetPercentile);
		this._skuEnablePreviewSkuText.value = this.migrationStateModel._skuEnablePreview ? constants.YES : constants.NO;
		this._skuEnableElasticRecommendationsText.value = this.migrationStateModel._skuEnableElastic ? constants.YES : constants.NO;
		await this.refreshAzureRecommendation();
	}

	public async refreshAzureRecommendation(): Promise<void> {
		await this.startCardLoading();
		this._skuLastRefreshTimeText.value = constants.LAST_REFRESHED_TIME();
		await this.migrationStateModel.getSkuRecommendations();

		const skuRecommendationError = this.migrationStateModel._skuRecommendationResults?.recommendationError;
		if (skuRecommendationError) {
			this.wizard.message = {
				text: constants.SKU_RECOMMENDATION_ERROR(this._serverName),
				description: skuRecommendationError.message,
				level: azdata.window.MessageLevel.Error
			};
		}

		await this.refreshSkuRecommendationComponents();
		this._skuLastRefreshTimeText.value = constants.LAST_REFRESHED_TIME(new Date().toLocaleString());
	}

	public async refreshSkuRecommendationComponents(): Promise<void> {
		switch (this.migrationStateModel._skuRecommendationPerformanceDataSource) {
			case PerformanceDataSourceOptions.CollectData: {
				await this._azureRecommendationSectionText.updateProperties({
					description: constants.AZURE_RECOMMENDATION_TOOLTIP_IN_PROGRESS
				});

				if (this.migrationStateModel.performanceCollectionInProgress()) {
					await this._skuDataCollectionStatusIcon.updateProperties({
						iconPath: IconPathHelper.inProgressMigration
					});
					this._skuDataCollectionStatusText.value = this.hasRecommendations()
						? constants.AZURE_RECOMMENDATION_STATUS_REFINING
						: constants.AZURE_RECOMMENDATION_STATUS_IN_PROGRESS;

					if (await this.migrationStateModel.isWaitingForFirstTimeRefresh()) {
						const elapsedTimeInMins = Math.abs(new Date().getTime() - new Date(this.migrationStateModel._perfDataCollectionStartDate!).getTime()) / 60000;
						const skuRecAutoRefreshTimeInMins = this.migrationStateModel.refreshGetSkuRecommendationFrequency / 60000;

						this._skuDataCollectionTimerText.value = constants.AZURE_RECOMMENDATION_STATUS_AUTO_REFRESH_TIMER(Math.ceil(skuRecAutoRefreshTimeInMins - elapsedTimeInMins));
					} else {
						this._skuDataCollectionTimerText.value = constants.AZURE_RECOMMENDATION_STATUS_MANUAL_REFRESH_TIMER;
					}

					await this._skuGetRecommendationContainer.updateCssStyles({ 'display': 'none' });
					await this._skuDataCollectionStatusContainer.updateCssStyles({ 'display': 'block' });
					await this._skuStopDataCollectionButton.updateCssStyles({ 'display': 'block' });
					await this._skuRestartDataCollectionButton.updateCssStyles({ 'display': 'none' });
					await this._refreshAzureRecommendationButton.updateCssStyles({ 'display': 'block' });
					await this._skuEditParametersContainer.updateCssStyles({ 'display': 'block' });
				}

				else if (this.migrationStateModel.performanceCollectionStopped()) {
					await this._skuDataCollectionStatusIcon.updateProperties({
						iconPath: IconPathHelper.stop
					});
					this._skuDataCollectionStatusText.value = constants.AZURE_RECOMMENDATION_STATUS_STOPPED;
					this._skuDataCollectionTimerText.value = '';

					await this._skuGetRecommendationContainer.updateCssStyles({ 'display': 'none' });
					await this._skuDataCollectionStatusContainer.updateCssStyles({ 'display': 'block' });
					await this._skuStopDataCollectionButton.updateCssStyles({ 'display': 'none' });
					await this._skuRestartDataCollectionButton.updateCssStyles({ 'display': 'block' });
					await this._refreshAzureRecommendationButton.updateCssStyles({ 'display': 'none' });
					await this._skuEditParametersContainer.updateCssStyles({ 'display': 'block' });
				}
				break;
			}

			case PerformanceDataSourceOptions.OpenExisting: {
				await this._azureRecommendationSectionText.updateProperties({
					description: constants.AZURE_RECOMMENDATION_TOOLTIP_NOT_STARTED
				});

				if (this.hasRecommendations()) {
					this._azureRecommendationInfoText.value = constants.AZURE_RECOMMENDATION_STATUS_DATA_IMPORTED;
					this._getAzureRecommendationButton.label = constants.REFINE_AZURE_RECOMMENDATION;
					this._getAzureRecommendationButton.width = 200;

					await this._skuGetRecommendationContainer.updateCssStyles({ 'display': 'block' });
					await this._skuDataCollectionStatusContainer.updateCssStyles({ 'display': 'none' });
					await this._skuEditParametersContainer.updateCssStyles({ 'display': 'block' });
				}
				break;
			}

			// initial state before "Get Azure recommendation" dialog
			default: {
				await this._skuGetRecommendationContainer.updateCssStyles({ 'display': 'block' });
				await this._skuDataCollectionStatusContainer.updateCssStyles({ 'display': 'none' });
				await this._skuEditParametersContainer.updateCssStyles({ 'display': 'none' });
				await this._azureRecommendationSectionText.updateProperties({
					description: constants.AZURE_RECOMMENDATION_TOOLTIP_NOT_STARTED
				});
				break;
			}
		}

		await this.refreshCardText(false);
	}

	private hasRecommendations(): boolean {
		return this.migrationStateModel._skuRecommendationResults?.recommendations
			&& !this.migrationStateModel._skuRecommendationResults?.recommendationError
			? true
			: false;
	}
}

export enum CardDescriptionIndex {
	TARGET_TYPE = 0,
	ASSESSMENT_RESULTS_SECTION = 1,
	ASSESSMENT_STATUS = 2,
	ASSESSED_DBS = 3,
	RECOMMENDATION_RESULTS_SECTION = 4,
	SKU_RECOMMENDATION = 5,
	VM_CONFIGURATIONS = 6,
	VIEW_SKU_DETAILS = 7,
}
