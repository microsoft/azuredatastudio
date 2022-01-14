/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, MigrationTargetType, Page, ServerAssessment, StateChangeEvent } from '../models/stateMachine';
import { AssessmentResultsDialog } from '../dialog/assessmentResults/assessmentResultsDialog';
import * as constants from '../constants/strings';
import { EOL } from 'os';
import { IconPath, IconPathHelper } from '../constants/iconPathHelper';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import * as styles from '../constants/styles';

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
			cardHeight: '130px',
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
						textValue: product.name,
						textStyles: {
							...styles.SECTION_HEADER_CSS
						}
					},
					{
						textValue: '',
						textStyles: {
							...styles.BODY_CSS
						}
					}
				]
			});
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

		const component = view.modelBuilder.divContainer().withItems(
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
				this._detailsComponent.value = constants.SKU_RECOMMENDATION_ERROR;
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

		if (this.migrationStateModel._assessmentResults) {
			const dbCount = this.migrationStateModel._assessmentResults?.databaseAssessments?.length;
			const dbWithoutIssuesCount = this.migrationStateModel._assessmentResults?.databaseAssessments?.filter(db => db.issues?.length === 0).length;
			this._rbg.cards[0].descriptions[1].textValue = constants.CAN_BE_MIGRATED(dbWithoutIssuesCount, dbCount);
			this._rbg.cards[1].descriptions[1].textValue = constants.CAN_BE_MIGRATED(dbCount, dbCount);

			await this._rbg.updateProperties({ cards: this._rbg.cards });
		} else {
			this._rbg.cards[0].descriptions[1].textValue = '';
			this._rbg.cards[1].descriptions[1].textValue = '';
			await this._rbg.updateProperties({ cards: this._rbg.cards });
		}

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

	private hasSavedInfo(): boolean {
		return this.migrationStateModel.retryMigration || (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.SKURecommendation);
	}
}


