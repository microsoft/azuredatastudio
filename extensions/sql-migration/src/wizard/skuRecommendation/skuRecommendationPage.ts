/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as styles from '../../constants/styles';
import * as constants from '../../constants/strings';
import * as utils from '../../api/utils';
import * as contracts from '../../service/contracts';

import { EOL } from 'os';
import { MigrationWizardPage } from '../../models/migrationWizardPage';
import { MigrationStateModel, PerformanceDataSourceOptions, StateChangeEvent, AssessmentRuleId } from '../../models/stateMachine';
import { SkuDataCollectionToolbar } from './skuDataCollectionToolbar';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { FlexContainer } from 'azdata';
import { AssessmentSummaryCard } from './assessmentSummaryCard';
import { MigrationTargetType } from '../../api/utils';
import { logError, TelemetryViews, TelemetryAction, sendSqlMigrationActionEvent, getTelemetryProps } from '../../telemetry';
import { getSourceConnectionProfile } from '../../api/sqlUtils';
import { IssueCategory } from '../../constants/helper';


export class SKURecommendationPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _rootContainer!: azdata.FlexContainer;
	private _assessmentComponent!: azdata.FlexContainer;
	private _detailsComponent!: azdata.TextComponent;

	private _skuDataCollectionToolbar!: SkuDataCollectionToolbar;
	private _igComponent!: azdata.TextComponent;
	private _assessmentStatusIcon!: azdata.ImageComponent;
	private _skipAssessmentCheckbox!: azdata.CheckBoxComponent;
	private _skipAssessmentSubText!: azdata.TextComponent;
	private _targetSummaryComponent!: azdata.FlexContainer;
	private _formContainer!: azdata.ComponentBuilder<azdata.FormContainer, azdata.ComponentProperties>;

	private _assessmentSummaryCard!: azdata.FlexContainer;
	private _assessmentSummaryCardLoader!: azdata.LoadingComponent;
	private _dbAssessmentCard!: AssessmentSummaryCard;
	private _miAssessmentCard!: AssessmentSummaryCard;
	private _vmAssessmentCard!: AssessmentSummaryCard;

	private _assessmentLoader!: azdata.LoadingComponent;
	private _assessmentProgress!: azdata.TextComponent;
	private _progressContainer!: azdata.FlexContainer;
	private _assessmentInfo!: azdata.TextComponent;
	private _disposables: vscode.Disposable[] = [];

	private _serverName: string = '';


	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.ASSESSMENT_RESULTS_AND_RECOMMENDATIONS_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView) {
		this._view = view;

		this._skuDataCollectionToolbar = new SkuDataCollectionToolbar(this, this.wizard, this.migrationStateModel);
		const toolbar = this._skuDataCollectionToolbar.createToolbar(view);

		this._assessmentStatusIcon = this._view.modelBuilder.image()
			.withProps({
				iconPath: IconPathHelper.completedMigration,
				iconHeight: 16,
				iconWidth: 16,
				width: 16,
				height: 16
			}).component();

		this._igComponent = this.createStatusComponent(view);
		const igContainer = this._view.modelBuilder.flexContainer()
			.withProps({ CSSStyles: { 'align-items': 'center' } })
			.component();
		igContainer.addItem(this._assessmentStatusIcon, { flex: '0 0 auto' });
		igContainer.addItem(this._igComponent, { flex: '0 0 auto' });

		this._detailsComponent = this.createDetailsComponent(view);

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

		this._targetSummaryComponent = this.createTargetSummaryComponent(view);

		this._formContainer = view.modelBuilder.formContainer()
			.withFormItems([
				{ component: toolbar },
				{ component: statusContainer },
				{ component: this._targetSummaryComponent }
			])
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

					'font-size': '13px',
					'font-weight': '400',
					'line-height': '18px',
					'text-decoration': 'none',
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

	// Creates the Assessment summary container.
	private createTargetSummaryComponent(view: azdata.ModelView): FlexContainer {
		const chooseYourTargetText = this._view.modelBuilder.text().withProps({
			value: constants.SKU_RECOMMENDATION_CHOOSE_A_TARGET,
			CSSStyles: {
				...styles.SECTION_HEADER_CSS,
				'margin-bottom': '5px'
			}
		}).component();

		this._assessmentSummaryCard = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'row',
			}
		}).component();

		this._dbAssessmentCard = new AssessmentSummaryCard(this, MigrationTargetType.SQLDB, this.migrationStateModel);
		this._miAssessmentCard = new AssessmentSummaryCard(this, MigrationTargetType.SQLMI, this.migrationStateModel);
		this._vmAssessmentCard = new AssessmentSummaryCard(this, MigrationTargetType.SQLVM, this.migrationStateModel);

		this._assessmentSummaryCard.addItems([
			this._dbAssessmentCard.createAssessmentSummaryCard(view),
			this._miAssessmentCard.createAssessmentSummaryCard(view),
			this._vmAssessmentCard.createAssessmentSummaryCard(view)]);

		this._assessmentSummaryCardLoader = this._view.modelBuilder.loadingComponent()
			.withItem(this._assessmentSummaryCard)
			.component();

		const component = this._view.modelBuilder.flexContainer()
			.withItems([chooseYourTargetText, this._assessmentSummaryCardLoader])
			.component();


		// TODO - OnLinkClick for SKU Recommendations dialog and push it to disposables.

		return component;
	}

	private async constructDetails(): Promise<void> {
		this.wizard.message = {
			text: '',
			level: azdata.window.MessageLevel.Error
		};

		this._serverName = this.migrationStateModel.serverName || (await getSourceConnectionProfile()).serverName;

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

		let shouldGetSkuRecommendations = false;

		// // recommendations were already generated, then the user went back and changed the list of databases
		// // so recommendations should be re-generated
		if (this.hasRecommendations() && this.migrationStateModel.hasRecommendedDatabaseListChanged()) {
			shouldGetSkuRecommendations = true;
		}

		if (this.migrationStateModel.savedInfo?.skuRecommendation) {
			// TODO - Will be needed once the sku parameters dialog is created.
			// await this.refreshSkuParameters();

			switch (this.migrationStateModel._skuRecommendationPerformanceDataSource) {
				case PerformanceDataSourceOptions.CollectData: {
					// check if collector is still running
					await this.migrationStateModel.refreshPerfDataCollection();
					if (this.migrationStateModel._perfDataCollectionIsCollecting) {
						// user started collecting data, ensure the collector is still running
						await this.migrationStateModel.startSkuTimers(this);
						await this.refreshSkuRecommendationComponents();
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

		this._assessmentLoader.loading = assessing;
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			this.wizard.message = { text: '' };
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}

			const errors: string[] = [];

			if (errors.length > 0) {
				this.wizard.message = {
					text: errors.join(EOL),
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
			return true;
		});
		await this.constructDetails();
		this.wizard.nextButton.enabled = this.migrationStateModel._assessmentResults !== undefined;
		this._previousMiTdeMigrationConfig = this.migrationStateModel.tdeMigrationConfig;
	}

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator(pageChangeInfo => true);
		this.wizard.message = { text: '' };
		this.eventListener?.dispose();
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
								const serviceTier = recommendation.targetSku.category?.sqlServiceTier === contracts.AzureSqlPaaSServiceTier.GeneralPurpose
									? constants.GENERAL_PURPOSE
									: constants.BUSINESS_CRITICAL;
								const hardwareType = recommendation.targetSku.category?.hardwareType === contracts.AzureSqlPaaSHardwareType.Gen5
									? constants.GEN5
									: recommendation.targetSku.category?.hardwareType === contracts.AzureSqlPaaSHardwareType.PremiumSeries
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
								// Removed disk details from summary as per experience requirements.
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

		await this.refreshTdeView();

		this._rbgLoader.loading = false;
	}


	private _resetTdeConfiguration() {
		this._previousMiTdeMigrationConfig = this.migrationStateModel.tdeMigrationConfig;
		this.migrationStateModel.tdeMigrationConfig = new TdeMigrationModel();
	}

	private async refreshTdeView() {

		if (this.migrationStateModel._targetType !== MigrationTargetType.SQLMI) {

			//Reset the encrypted databases counter on the model to ensure the certificates migration is ignored.
			this._resetTdeConfiguration();

		} else {

			const encryptedDbFound = this.migrationStateModel._assessmentResults.databaseAssessments
				.filter(
					db => this.migrationStateModel._databasesForMigration.findIndex(dba => dba === db.name) >= 0 &&
						db.issues.findIndex(iss => iss.ruleId === AssessmentRuleId.TdeEnabled && iss.appliesToMigrationTargetPlatform === MigrationTargetType.SQLMI) >= 0
				)
				.map(db => db.name);

			if (this._matchWithEncryptedDatabases(encryptedDbFound)) {
				this.migrationStateModel.tdeMigrationConfig = this._previousMiTdeMigrationConfig;
			} else {
				if (!utils.isWindows()) //Only available for windows for now.
					return;

				//Set encrypted databases
				this.migrationStateModel.tdeMigrationConfig.setTdeEnabledDatabasesCount(encryptedDbFound);

				if (this.migrationStateModel.tdeMigrationConfig.hasTdeEnabledDatabases()) {
					//Set the text when there are encrypted databases.

					if (!this.migrationStateModel.tdeMigrationConfig.shownBefore()) {
						await this._tdeConfigurationDialog.openDialog();
					}
				} else {
					this._tdedatabaseSelectedHelperText.value = constants.TDE_WIZARD_MSG_EMPTY;
				}

			}
		}

		await utils.updateControlDisplay(this._tdeInfoContainer, this.migrationStateModel.tdeMigrationConfig.hasTdeEnabledDatabases());
	}

	private _onTdeConfigClosed(): Thenable<void> {
		const tdeMsg = (this.migrationStateModel.tdeMigrationConfig.getAppliedConfigDialogSetting() === ConfigDialogSetting.ExportCertificates) ? constants.TDE_WIZARD_MSG_TDE : constants.TDE_WIZARD_MSG_MANUAL;
		this._tdedatabaseSelectedHelperText.value = constants.TDE_MSG_DATABASES_SELECTED(this.migrationStateModel.tdeMigrationConfig.getTdeEnabledDatabasesCount(), tdeMsg);

		let tdeTelemetryAction: TelemetryAction;

		switch (this.migrationStateModel.tdeMigrationConfig.getAppliedConfigDialogSetting()) {
			case ConfigDialogSetting.ExportCertificates:
				tdeTelemetryAction = TelemetryAction.TdeConfigurationUseADS;
				break;
			case ConfigDialogSetting.DoNotExport:
				tdeTelemetryAction = TelemetryAction.TdeConfigurationAlreadyMigrated;
				break;
			case ConfigDialogSetting.NoSelection:
				tdeTelemetryAction = TelemetryAction.TdeConfigurationCancelled;
				break;
			default:
				tdeTelemetryAction = TelemetryAction.TdeConfigurationCancelled;
				break;
		}

		sendSqlMigrationActionEvent(
			TelemetryViews.TdeConfigurationDialog,
			tdeTelemetryAction,
			{
				...getTelemetryProps(this.migrationStateModel),
				'numberOfDbsWithTde': this.migrationStateModel.tdeMigrationConfig.getTdeEnabledDatabasesCount().toString()
			},
			{}
		);

		return this._tdeEditButton.focus();
	}

	private _matchWithEncryptedDatabases(encryptedDbList: string[]): boolean {
		var currentTdeDbs = this._previousMiTdeMigrationConfig.getTdeEnabledDatabases();

		if (encryptedDbList.length === 0 || encryptedDbList.length !== currentTdeDbs.length)
			return false;

		if (encryptedDbList.filter(db => currentTdeDbs.findIndex(dba => dba === db) < 0).length > 0)
			return false; //There is at least one element that is not in the other array. There should be no risk of duplicates table names


		return true;
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

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
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
			this._targetSummaryComponent,
			!failedAssessment || this._skipAssessmentCheckbox.checked === true,
			'block');

		this._assessmentSummaryCardLoader.loading = assessing;
	}

	// Refresh the assessment summary details.
	public async refreshCardText(showLoadingIcon: boolean = true): Promise<void> {
		this._assessmentSummaryCardLoader.loading = showLoadingIcon && true;

		const dbCount = this.migrationStateModel._assessmentResults?.databaseAssessments?.length;

		if (!this.migrationStateModel._assessmentResults) {
			// TODO
			// Need to think what to show if assessment result is coming as null.
		}
		else {
			await this.updateDetailsForEachTarget(MigrationTargetType.SQLDB, dbCount);
			await this.updateDetailsForEachTarget(MigrationTargetType.SQLMI, dbCount);
			await this.updateDetailsForEachTarget(MigrationTargetType.SQLVM, dbCount);
		}

		this._assessmentSummaryCardLoader.loading = false;
	}

	// Update the assessment details for each of the target type.
	private async updateDetailsForEachTarget(targetType: MigrationTargetType, dbCount: number): Promise<void> {
		let recommendation;

		// For Target - SQLVM, all databases can be migrated with issues. So dbReady = dbCount;
		if (targetType === MigrationTargetType.SQLVM) {
			this._vmAssessmentCard.updateAssessmentResult(dbCount, dbCount, 0, 0, 0, 0);

			if (this.hasRecommendations()) {
				// elastic model currently doesn't support SQL VM, so show the baseline model results regardless of user preference
				recommendation = this.migrationStateModel._skuRecommendationResults.recommendations?.sqlVmRecommendationResults[0];

				// result returned but no SKU recommended
				if (!recommendation?.targetSku) {
					await this._vmAssessmentCard.updateSkuRecommendation(constants.SKU_RECOMMENDATION_NO_RECOMMENDATION);
				}
				else {
					const vmConfiguration = constants.VM_CONFIGURATION(
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
					const vmConfigurationPreview =
						constants.VM_CONFIGURATION_PREVIEW(dataDisk, storageDisk, tempDb);

					await this._vmAssessmentCard.updateSkuRecommendation(vmConfiguration, vmConfigurationPreview);
				}
			}

			return;
		}

		// dbReady are thos databases without issues. dbNotReady are those databases with atleast one issue with issueCategory = "Issue".
		// dbReadyWithWarnings can be found by subtraction dbReady and dbNotReady with total dbCount.
		const dbReady = this.migrationStateModel._assessmentResults?.databaseAssessments?.filter(db =>
			!db.issues?.some(issue => issue.appliesToMigrationTargetPlatform === targetType)
		).length;
		const dbNotReady = this.migrationStateModel._assessmentResults?.databaseAssessments?.filter(db =>
			db.issues?.some(issue => (issue.appliesToMigrationTargetPlatform === targetType) && (issue.issueCategory === IssueCategory.Issue))
		).length;
		const dbReadyWithWarnings = dbCount - (dbReady + dbNotReady);

		// blockers contain count of all the instance level issues with issueCategory = "Issue".
		var blockers = this.migrationStateModel._assessmentResults?.issues.filter(issue =>
			(issue.appliesToMigrationTargetPlatform === targetType) && (issue.issueCategory === IssueCategory.Issue)).length;
		// also blockers includes sum of all the dabatase level issues with issueCategory = "Issue" for each database.
		blockers += this.migrationStateModel._assessmentResults?.databaseAssessments?.reduce((count, database) =>
			count + database.issues.filter(issue => (issue.appliesToMigrationTargetPlatform === targetType) && (issue.issueCategory === IssueCategory.Issue)).length, 0);

		// warnings contain count all the instance level issues with issueCategory = "Warning".
		var warnings = this.migrationStateModel._assessmentResults?.issues.filter(issue =>
			(issue.appliesToMigrationTargetPlatform === targetType) && (issue.issueCategory === IssueCategory.Warning)).length;
		// also warnings includes sum of all the dabatase level issues with issueCategory = "Warning" for each database.
		warnings += this.migrationStateModel._assessmentResults?.databaseAssessments?.reduce((count, database) =>
			count + database.issues.filter(issue => (issue.appliesToMigrationTargetPlatform === targetType) && (issue.issueCategory === IssueCategory.Warning)).length, 0);

		switch (targetType) {
			case MigrationTargetType.SQLDB:
				this._dbAssessmentCard.updateAssessmentResult(dbCount, dbReady, dbReadyWithWarnings, dbNotReady, blockers, warnings);

				if (this.hasRecommendations()) {
					const recommendations = this.migrationStateModel._skuEnableElastic
						? this.migrationStateModel._skuRecommendationResults.recommendations!.elasticSqlDbRecommendationResults
						: this.migrationStateModel._skuRecommendationResults.recommendations!.sqlDbRecommendationResults;
					const successfulRecommendationsCount = recommendations.filter(r => r.targetSku !== null).length;
					await this._dbAssessmentCard.updateSkuRecommendation(constants.RECOMMENDATIONS_AVAILABLE(successfulRecommendationsCount));
				}
				break;
			case MigrationTargetType.SQLMI:
				this._miAssessmentCard.updateAssessmentResult(dbCount, dbReady, dbReadyWithWarnings, dbNotReady, blockers, warnings);

				if (this.hasRecommendations()) {
					if (this.migrationStateModel._skuEnableElastic) {
						recommendation = this.migrationStateModel._skuRecommendationResults.recommendations?.elasticSqlMiRecommendationResults[0];
					} else {
						recommendation = this.migrationStateModel._skuRecommendationResults.recommendations?.sqlMiRecommendationResults[0];
					}

					// result returned but no SKU recommended
					if (!recommendation?.targetSku) {
						await this._miAssessmentCard.updateSkuRecommendation(constants.SKU_RECOMMENDATION_NO_RECOMMENDATION);
					}
					else {
						const serviceTier = recommendation.targetSku.category?.sqlServiceTier === contracts.AzureSqlPaaSServiceTier.GeneralPurpose
							? constants.GENERAL_PURPOSE
							: constants.BUSINESS_CRITICAL;
						const hardwareType = recommendation.targetSku.category?.hardwareType === contracts.AzureSqlPaaSHardwareType.Gen5
							? constants.GEN5
							: recommendation.targetSku.category?.hardwareType === contracts.AzureSqlPaaSHardwareType.PremiumSeries
								? constants.PREMIUM_SERIES
								: constants.PREMIUM_SERIES_MEMORY_OPTIMIZED;

						await this._miAssessmentCard.updateSkuRecommendation(constants.MI_CONFIGURATION_PREVIEW(
							hardwareType,
							serviceTier,
							recommendation.targetSku.computeSize!,
							recommendation.targetSku.storageMaxSizeInMb! / 1024));
					}
				}
				break;
		}
	}

	// TODO - might be needed when SKU recommendation is done.
	// private createPerformanceCollectionStatusContainer(_view: azdata.ModelView): azdata.FlexContainer {
	// }
	// public async refreshSkuParameters(): Promise<void> {
	// }
	// private createSkuEditParameters(_view: azdata.ModelView): azdata.FlexContainer {
	// }
	// private createAzureRecommendationContainer(_view: azdata.ModelView): azdata.FlexContainer {
	// }

	public async startCardLoading(): Promise<void> {
		// TO-DO: ideally the short SKU recommendation loading time should have a spinning indicator,
		// but updating the card text will do for now
		await this._dbAssessmentCard.loadingSKURecommendation();
		await this._miAssessmentCard.loadingSKURecommendation();
		await this._vmAssessmentCard.loadingSKURecommendation();
	}

	public async refreshSkuRecommendationComponents(): Promise<void> {
		switch (this.migrationStateModel._skuRecommendationPerformanceDataSource) {
			case PerformanceDataSourceOptions.CollectData: {
				if (this.migrationStateModel.performanceCollectionInProgress()) {
					// TODO - update the status container, text and icon.

					if (await this.migrationStateModel.isWaitingForFirstTimeRefresh()) {
						// TODO - update the sku datacollection timer.
					} else {
						// TODO - update the sku datacollection timer.
					}

					// TODO - update the visibility of different button and status message.
				}

				// TODO - implement the functionality of stopp data collection button functionality.
				else if (this.migrationStateModel.performanceCollectionStopped()) {
					// TODO - update the status container, text and icon.
					// TODO - update the visibility of different button and status message.
				}
				break;
			}

			// TODO - implement the import performance data functionality.
			case PerformanceDataSourceOptions.OpenExisting: {
				if (this.hasRecommendations()) {
					// TODO - update the status container, text and icon.
					// TODO - update the visibility of different button and status message.
				}
				break;
			}

			// initial state before "Get Azure recommendation" dialog
			default: {
				// TODO - update the visibility of different button and status message.
				break;
			}
		}

		await this.refreshCardText(false);
	}

	public async refreshAzureRecommendation(): Promise<void> {
		await this.startCardLoading();
		// TODO - update the last refresh time.
		// this._skuLastRefreshTimeText.value = constants.LAST_REFRESHED_TIME();
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
		// TODO - Update the refreshTime for SKU Recommendation.
		// this._skuLastRefreshTimeText.value = constants.LAST_REFRESHED_TIME(new Date().toLocaleString());
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			this.wizard.message = { text: '' };
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}

			const errors: string[] = [];
			if (errors.length > 0) {
				this.wizard.message = {
					text: errors.join(EOL),
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
			return true;
		});
		await this.constructDetails();
		this.wizard.nextButton.enabled = this.migrationStateModel._assessmentResults !== undefined;
	}

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator(pageChangeInfo => true);
		this.wizard.message = { text: '' };
		// this.eventListener?.dispose();
	}

	// Return true if Recommendations are ready and does not  have errors.
	public hasRecommendations(): boolean {
		return this.migrationStateModel._skuRecommendationResults?.recommendations
			&& !this.migrationStateModel._skuRecommendationResults?.recommendationError
			? true
			: false;
	}
}
