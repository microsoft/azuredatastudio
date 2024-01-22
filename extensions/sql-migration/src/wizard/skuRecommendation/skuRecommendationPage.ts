/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as styles from '../../constants/styles';
import * as constants from '../../constants/strings';
import * as utils from '../../api/utils';

import { EOL } from 'os';
import { MigrationWizardPage } from '../../models/migrationWizardPage';
import { MigrationStateModel, PerformanceDataSourceOptions, StateChangeEvent } from '../../models/stateMachine';
import { SkuDataCollectionToolbar } from './skuDataCollectionToolbar';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { FlexContainer } from 'azdata';
import { AssessmentSummaryCard } from './assessmentSummaryCard';
import { MigrationTargetType } from '../../api/utils';
import { logError, TelemetryViews } from '../../telemetry';
import { getSourceConnectionProfile } from '../../api/sqlUtils';
import { IssueCategory } from '../../constants/helper';
import { WizardController } from '../wizardController';

export class SKURecommendationPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _rootContainer!: azdata.FlexContainer;
	private _assessmentComponent!: azdata.FlexContainer;

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

	private _skuDataCollectionStatusContainer!: azdata.FlexContainer;
	private _skuDataCollectionStatusIcon!: azdata.ImageComponent;
	private _skuDataCollectionStatusText!: azdata.TextComponent;
	private _skuDataCollectionTimerText!: azdata.TextComponent;

	private _assessmentLoader!: azdata.LoadingComponent;
	private _assessmentProgress!: azdata.TextComponent;
	private _progressContainer!: azdata.FlexContainer;
	private _assessmentInfo!: azdata.TextComponent;
	private _disposables: vscode.Disposable[] = [];

	private _serverName: string = '';
	private _skipAssessmentValid: boolean = false;


	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel, private wizardController: WizardController) {
		super(wizard, azdata.window.createWizardPage(constants.ASSESSMENT_SUMMARY_AND_RECOMMENDATIONS_PAGE_TITLE), migrationStateModel);
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

		this._skuDataCollectionStatusContainer = this.createPerformanceCollectionStatusContainer(view);

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

		const statusContainer = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([
				igContainer,
				this._skuDataCollectionStatusContainer,
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

	// Creates the Assessment summary container.
	private createTargetSummaryComponent(view: azdata.ModelView): FlexContainer {
		const chooseYourTargetText = this._view.modelBuilder.text().withProps({
			value: constants.ASSESSMENT_SUMMARY_AND_SKU_RECOMMENDATION_FOR_TARGETS_LABEL,
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
					errors.push(constants.SKU_RECOMMENDATION_ASSESSMENT_ERROR_WITH_STACK(assessmentError));
				}
				if (this.migrationStateModel?._assessmentResults?.errors?.length! > 0) {
					errors.push(...this.migrationStateModel._assessmentResults?.errors?.map(
						e => constants.SKU_RECOMMENDATION_ASSESSMENT_ERROR_WITH_INFO(e))!);
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
				} else {
					this._assessmentStatusIcon.iconPath = IconPathHelper.completedMigration;
					this._igComponent.value = constants.ASSESSMENT_COMPLETED(this._serverName);
				}
			}
		} else {
			// use prior assessment results
			this._assessmentStatusIcon.iconPath = IconPathHelper.completedMigration;
			this._igComponent.value = constants.ASSESSMENT_COMPLETED(this._serverName);
		}

		let shouldGetSkuRecommendations = false;

		// // recommendations were already generated, then the user went back and changed the list of databases
		// // so recommendations should be re-generated
		if (utils.hasRecommendations(this.migrationStateModel) && this.migrationStateModel.hasRecommendedDatabaseListChanged()) {
			shouldGetSkuRecommendations = true;
		}

		if (this.migrationStateModel.savedInfo?.skuRecommendation) {

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
		this._skipAssessmentValid = (!assessing && failedAssessment);
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
			if (!utils.hasRecommendations(this.migrationStateModel)) {
				if (this.migrationStateModel._perfDataCollectionStartDate) {
					await this._dbAssessmentCard.updateSKURecommendationStatus(constants.AZURE_RECOMMENDATION_CARD_IN_PROGRESS);
					await this._miAssessmentCard.updateSKURecommendationStatus(constants.AZURE_RECOMMENDATION_CARD_IN_PROGRESS);
					await this._vmAssessmentCard.updateSKURecommendationStatus(constants.AZURE_RECOMMENDATION_CARD_IN_PROGRESS);
				} else {
					await this._dbAssessmentCard.updateSKURecommendationStatus(constants.AZURE_RECOMMENDATION_CARD_NOT_ENABLED);
					await this._miAssessmentCard.updateSKURecommendationStatus(constants.AZURE_RECOMMENDATION_CARD_NOT_ENABLED);
					await this._vmAssessmentCard.updateSKURecommendationStatus(constants.AZURE_RECOMMENDATION_CARD_NOT_ENABLED);
				}
			}

			await this.updateDetailsForEachTarget(MigrationTargetType.SQLDB, dbCount);
			await this.updateDetailsForEachTarget(MigrationTargetType.SQLMI, dbCount);
			await this.updateDetailsForEachTarget(MigrationTargetType.SQLVM, dbCount);
		}

		this._assessmentSummaryCardLoader.loading = false;
	}

	// Update the assessment details for each of the target type.
	private async updateDetailsForEachTarget(targetType: MigrationTargetType, dbCount: number): Promise<void> {

		const targetConfigurations = await utils.getRecommendedConfiguration(targetType, this.migrationStateModel);

		// For Target - SQLVM, all databases can be migrated with issues. So dbReady = dbCount;
		if (targetType === MigrationTargetType.SQLVM) {
			this._vmAssessmentCard.updateAssessmentResult(dbCount, dbCount, 0, 0, 0, 0);
			if (targetConfigurations?.length > 0) {
				await this._vmAssessmentCard.updateSkuRecommendationDetails(targetConfigurations[0], targetConfigurations[1] ?? "");
			}
			return;
		}

		// dbReady are those databases without issues. dbNotReady are those databases with at least one issue with issueCategory = "Issue".
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
		// also blockers includes sum of all the database level issues with issueCategory = "Issue" for each database.
		blockers += this.migrationStateModel._assessmentResults?.databaseAssessments?.reduce((count, database) =>
			count + database.issues.filter(issue => (issue.appliesToMigrationTargetPlatform === targetType) && (issue.issueCategory === IssueCategory.Issue)).length, 0);

		// warnings contain count all the instance level issues with issueCategory = "Warning".
		var warnings = this.migrationStateModel._assessmentResults?.issues.filter(issue =>
			(issue.appliesToMigrationTargetPlatform === targetType) && (issue.issueCategory === IssueCategory.Warning)).length;
		// also warnings includes sum of all the database level issues with issueCategory = "Warning" for each database.
		warnings += this.migrationStateModel._assessmentResults?.databaseAssessments?.reduce((count, database) =>
			count + database.issues.filter(issue => (issue.appliesToMigrationTargetPlatform === targetType) && (issue.issueCategory === IssueCategory.Warning)).length, 0);

		switch (targetType) {
			case MigrationTargetType.SQLDB:
				this._dbAssessmentCard.updateAssessmentResult(dbCount, dbReady, dbReadyWithWarnings, dbNotReady, blockers, warnings);
				if (targetConfigurations.length > 0)
					await this._dbAssessmentCard.updateSkuRecommendationDetails(targetConfigurations[0]);
				break;
			case MigrationTargetType.SQLMI:
				this._miAssessmentCard.updateAssessmentResult(dbCount, dbReady, dbReadyWithWarnings, dbNotReady, blockers, warnings);
				if (targetConfigurations.length > 0)
					await this._miAssessmentCard.updateSkuRecommendationDetails(targetConfigurations[0]);
				break;
		}
	}

	private createPerformanceCollectionStatusContainer(_view: azdata.ModelView): azdata.FlexContainer {
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


		this._skuDataCollectionTimerText = _view.modelBuilder.text()
			.withProps({
				value: '',
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': 0,
				}
			}).component();

		const container = _view.modelBuilder.flexContainer()
			.withItems([
				this._skuDataCollectionStatusIcon,
				this._skuDataCollectionStatusText,
				this._skuDataCollectionTimerText
			])
			.withProps({
				CSSStyles: {
					'flex-direction': 'row',
					'width': 'fit-content',
					'align-items': 'center',
					'display': this.migrationStateModel.performanceCollectionNotStarted() ? 'none' : 'flex',
				}
			}).component();

		return container;
	}

	public async startCardLoading(): Promise<void> {
		// TO-DO: ideally the short SKU recommendation loading time should have a spinning indicator,
		// but updating the card text will do for now
		await this._dbAssessmentCard.updateSKURecommendationStatus(constants.LOADING_RECOMMENDATIONS);
		await this._miAssessmentCard.updateSKURecommendationStatus(constants.LOADING_RECOMMENDATIONS);
		await this._vmAssessmentCard.updateSKURecommendationStatus(constants.LOADING_RECOMMENDATIONS);
	}

	public async refreshSkuRecommendationComponents(): Promise<void> {
		switch (this.migrationStateModel._skuRecommendationPerformanceDataSource) {
			case PerformanceDataSourceOptions.CollectData: {
				if (this.migrationStateModel.performanceCollectionInProgress()) {
					await this._skuDataCollectionStatusIcon.updateProperties({
						iconPath: IconPathHelper.inProgressMigration
					});
					this._skuDataCollectionStatusText.value = utils.hasRecommendations(this.migrationStateModel)
						? constants.AZURE_RECOMMENDATION_STATUS_REFINING
						: constants.AZURE_RECOMMENDATION_STATUS_IN_PROGRESS;

					if (await this.migrationStateModel.isWaitingForFirstTimeRefresh()) {
						const elapsedTimeInMins = Math.abs(new Date().getTime() - new Date(this.migrationStateModel._perfDataCollectionStartDate!).getTime()) / 60000;
						const skuRecAutoRefreshTimeInMins = this.migrationStateModel.refreshGetSkuRecommendationFrequency / 60000;

						this._skuDataCollectionTimerText.value = constants.AZURE_RECOMMENDATION_STATUS_AUTO_REFRESH_TIMER(Math.ceil(skuRecAutoRefreshTimeInMins - elapsedTimeInMins));
					} else {
						// Timer is only for first refresh.
						this._skuDataCollectionTimerText.value = constants.AZURE_RECOMMENDATION_STATUS_MANUAL_REFRESH_TIMER;
					}

					await this._skuDataCollectionStatusContainer.updateCssStyles({ 'display': 'flex' });
				}

				else if (this.migrationStateModel.performanceCollectionStopped()) {
					await this._skuDataCollectionStatusIcon.updateProperties({
						iconPath: IconPathHelper.stop
					});
					this._skuDataCollectionStatusText.value = constants.AZURE_RECOMMENDATION_STATUS_STOPPED;
					this._skuDataCollectionTimerText.value = '';
				}
				break;
			}
			case PerformanceDataSourceOptions.OpenExisting: {
				if (utils.hasRecommendations(this.migrationStateModel)) {
					await this._skuDataCollectionStatusContainer.updateCssStyles({ 'display': 'flex' });

					await this._skuDataCollectionStatusIcon.updateProperties({
						iconPath: IconPathHelper.completedMigration
					});

					this._skuDataCollectionStatusText.value = constants.AZURE_RECOMMENDATION_STATUS_DATA_IMPORTED;
					this._skuDataCollectionTimerText.value = '';
				}
				break;
			}

			// initial state before "Get Azure recommendation" dialog
			default: {
				await this._skuDataCollectionStatusContainer.updateCssStyles({ 'display': 'none' });
				break;
			}
		}

		await this.refreshCardText(false);
	}

	public async refreshAssessment(): Promise<void> {
		await this.startCardLoading();
		this.migrationStateModel._runAssessments = true;
		await this.constructDetails();
	}

	public async refreshAzureRecommendation(): Promise<void> {
		await this.startCardLoading();
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
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizardController.cancelReasonsList([
			constants.WIZARD_CANCEL_REASON_CONTINUE_WITH_MIGRATION_LATER,
			constants.WIZARD_CANCEL_REASON_NEED_TO_EVALUATE_RCOMMENDED_SKU
		]);

		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			this.wizard.message = { text: '' };
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}

			const errors: string[] = [];
			if (this._skipAssessmentValid && !this._skipAssessmentCheckbox.checked) {
				errors.push(constants.SELECT_SKIP_ASSESSMENT_CHECK_TO_CONTINUE);
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
		await this.constructDetails();
		await this._skuDataCollectionToolbar._setToolbarState();
		this.wizard.nextButton.enabled = this.migrationStateModel._assessmentResults !== undefined;
	}

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator(pageChangeInfo => true);
		this.wizard.message = { text: '' };
	}
}
