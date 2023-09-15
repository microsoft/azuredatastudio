/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as styles from '../../constants/styles';
import * as constants from '../../constants/strings';

import { MigrationWizardPage } from '../../models/migrationWizardPage';
import { MigrationStateModel, PerformanceDataSourceOptions, StateChangeEvent, AssessmentRuleId } from '../../models/stateMachine';
import { SkuDataCollectionToolbar } from './skuDataCollectionToolbar';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { FlexContainer } from 'azdata';
import { AssessmentSummaryCard } from './assessmentSummaryCard';
import { MigrationTargetType } from '../../api/utils';

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

	private _dbAssessmentCard!: AssessmentSummaryCard;
	private _miAssessmentCard!: AssessmentSummaryCard;
	private _vmAssessmentCard!: AssessmentSummaryCard;


	private _disposables: vscode.Disposable[] = [];

	private _serverName: string = '';

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.ASSESSMENT_RESULTS_AND_RECOMMENDATIONS_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView) {
		this._view = view;

		this._skuDataCollectionToolbar = new SkuDataCollectionToolbar();
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
				refreshAssessmentButton,
				this._skipAssessmentCheckbox,
				this._skipAssessmentSubText])
			.withProps({ CSSStyles: { 'margin': '0' } })
			.component();

		this._targetSummaryComponent = this.createTargetSummaryComponent(view);
		// this._tdeInfoContainer = await this.createTdeInfoContainer();

		this._formContainer = view.modelBuilder.formContainer()
			.withFormItems([
				{ component: toolbar },
				{ component: this._targetSummaryComponent },
				// { component: this._tdeInfoContainer }
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

	private createTargetSummaryComponent(view: azdata.ModelView): FlexContainer {
		const chooseYourTargetText = this._view.modelBuilder.text().withProps({
			value: constants.SKU_RECOMMENDATION_CHOOSE_A_TARGET,
			CSSStyles: {
				...styles.SECTION_HEADER_CSS,
				'margin': '0'
			}
		}).component();

		const assessmentResultContainer = view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'row',
			}
		}).component();

		this._dbAssessmentCard = new AssessmentSummaryCard(MigrationTargetType.SQLDB);
		this._miAssessmentCard = new AssessmentSummaryCard(MigrationTargetType.SQLMI);
		this._vmAssessmentCard = new AssessmentSummaryCard(MigrationTargetType.SQLVM);

		assessmentResultContainer.addItems([
			this._dbAssessmentCard.createAssessmentSummaryCard(view),
			this._miAssessmentCard.createAssessmentSummaryCard(view),
			this._vmAssessmentCard.createAssessmentSummaryCard(view)]);

		const component = this._view.modelBuilder.flexContainer()
			.withItems([chooseYourTargetText, assessmentResultContainer])
			.component();


		// this._disposables.push(
		// 	this._rbg.onLinkClick(async (e: azdata.RadioCardLinkClickEvent) => {
		// 		if (this.hasRecommendations()) {
		// 			if (e.cardId === product.type) {
		// 				const skuRecommendationResultsDialog = new SkuRecommendationResultsDialog(this.migrationStateModel, product.type);
		// 				await skuRecommendationResultsDialog.openDialog(
		// 					e.cardId,
		// 					this.migrationStateModel._skuRecommendationResults.recommendations);
		// 			}
		// 		}
		// 	}));

		return component;
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

	public hasRecommendations(): boolean {
		return this.migrationStateModel._skuRecommendationResults?.recommendations
			&& !this.migrationStateModel._skuRecommendationResults?.recommendationError
			? true
			: false;
	}
}
