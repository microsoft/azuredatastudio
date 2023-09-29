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

		this._skuDataCollectionToolbar = new SkuDataCollectionToolbar(this, this.migrationStateModel);
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
			// await this.startCardLoading();
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

		this._dbAssessmentCard = new AssessmentSummaryCard(MigrationTargetType.SQLDB);
		this._miAssessmentCard = new AssessmentSummaryCard(MigrationTargetType.SQLMI);
		this._vmAssessmentCard = new AssessmentSummaryCard(MigrationTargetType.SQLVM);

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

				// TODO - Will be done once import performance dialog is implemented.
				// case PerformanceDataSourceOptions.OpenExisting: {
				// 	shouldGetSkuRecommendations = true;
				// 	break;
				// }
			}
		}

		if (shouldGetSkuRecommendations) {
			await this.migrationStateModel.getSkuRecommendations();
		}

		await this.refreshSkuRecommendationComponents();
		await this._setAssessmentState(false, this.migrationStateModel._runAssessments);
	}

	// creating the assessmentInProgress. Shown when the assessment is being calculate.
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
	// public async startCardLoading(): Promise<void> {
	// }
	// private createPerformanceCollectionStatusContainer(_view: azdata.ModelView): azdata.FlexContainer {
	// }
	// public async refreshSkuParameters(): Promise<void> {
	// }
	// public async refreshAzureRecommendation(): Promise<void> {
	// }
	// private createSkuEditParameters(_view: azdata.ModelView): azdata.FlexContainer {
	// }
	// private createAzureRecommendationContainer(_view: azdata.ModelView): azdata.FlexContainer {
	// }

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
			// case PerformanceDataSourceOptions.OpenExisting: {
			// }

			// initial state before "Get Azure recommendation" dialog
			default: {
				// TODO - update the visibility of different button and status message.
				break;
			}
		}

		await this.refreshCardText(false);
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
