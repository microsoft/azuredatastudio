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
import { findDropDownItemIndex, selectDropDownIndex } from '../api/utils';
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
	private _chooseTargetComponent!: azdata.DivContainer;
	private _azureSubscriptionText!: azdata.TextComponent;
	private _managedInstanceSubscriptionDropdown!: azdata.DropDownComponent;
	private _azureLocationDropdown!: azdata.DropDownComponent;
	private _azureResourceGroupDropdown!: azdata.DropDownComponent;
	private _resourceDropdownLabel!: azdata.TextComponent;
	private _resourceDropdown!: azdata.DropDownComponent;
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
	private _targetContainer!: azdata.FlexContainer;
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
		super(wizard, azdata.window.createWizardPage(constants.SKU_RECOMMENDATION_PAGE_TITLE), migrationStateModel);
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
			]
		).withProps({
			CSSStyles: {
				'margin': '0'
			}
		}).component();
		this._chooseTargetComponent = await this.createChooseTargetComponent(view);
		this.assessmentGroupContainer = await this.createViewAssessmentsContainer();
		this._targetContainer = this.createTargetDropdownContainer();
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
				{
					component: this._targetContainer
				}
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
		if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.serverName) {
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

	private createTargetDropdownContainer(): azdata.FlexContainer {
		this._azureSubscriptionText = this._view.modelBuilder.text().withProps({
			CSSStyles: {
				...styles.SECTION_HEADER_CSS
			}
		}).component();

		const managedInstanceSubscriptionDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.SUBSCRIPTION,
			description: constants.SKU_RECOMMENDATION_SUBSCRIPTION_INFO,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS,
			}
		}).component();
		this._managedInstanceSubscriptionDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.SUBSCRIPTION,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			required: true,
			fireOnTextChange: true,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._managedInstanceSubscriptionDropdown.onValueChanged(async (value) => {
			const selectedIndex = findDropDownItemIndex(this._managedInstanceSubscriptionDropdown, value);
			if (selectedIndex > -1) {
				this.migrationStateModel._targetSubscription = this.migrationStateModel.getSubscription(selectedIndex);
				this.migrationStateModel._targetServerInstance = undefined!;
				this.migrationStateModel._sqlMigrationService = undefined!;
				await this.populateLocationAndResourceGroupDropdown();
			}
		}));

		const azureLocationLabel = this._view.modelBuilder.text().withProps({
			value: constants.LOCATION,
			description: constants.SKU_RECOMMENDATION_LOCATION_INFO,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();
		this._azureLocationDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.LOCATION,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			required: true,
			fireOnTextChange: true,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._azureLocationDropdown.onValueChanged(async (value) => {
			const selectedIndex = findDropDownItemIndex(this._azureLocationDropdown, value);
			if (selectedIndex > -1) {
				this.migrationStateModel._location = this.migrationStateModel.getLocation(selectedIndex);
				await this.populateResourceInstanceDropdown();
			}
		}));

		const azureResourceGroupLabel = this._view.modelBuilder.text().withProps({
			value: constants.RESOURCE_GROUP,
			description: constants.SKU_RECOMMENDATION_RESOURCE_GROUP_INFO,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();
		this._azureResourceGroupDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.RESOURCE_GROUP,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			required: true,
			fireOnTextChange: true,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._azureResourceGroupDropdown.onValueChanged(async (value) => {
			const selectedIndex = findDropDownItemIndex(this._azureResourceGroupDropdown, value);
			if (selectedIndex > -1) {
				this.migrationStateModel._resourceGroup = this.migrationStateModel.getAzureResourceGroup(selectedIndex);
				await this.populateResourceInstanceDropdown();
			}
		}));

		this._resourceDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.MANAGED_INSTANCE,
			description: constants.SKU_RECOMMENDATION_RESOURCE_INFO,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();
		this._resourceDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.MANAGED_INSTANCE,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			required: true,
			fireOnTextChange: true,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._resourceDropdown.onValueChanged(value => {
			const selectedIndex = findDropDownItemIndex(this._resourceDropdown, value);
			if (selectedIndex > -1 &&
				value !== constants.NO_MANAGED_INSTANCE_FOUND &&
				value !== constants.NO_VIRTUAL_MACHINE_FOUND) {
				this.migrationStateModel._sqlMigrationServices = undefined!;
				if (this._rbg.selectedCardId === MigrationTargetType.SQLVM) {
					this.migrationStateModel._targetServerInstance = this.migrationStateModel.getVirtualMachine(selectedIndex);
				} else {
					this.migrationStateModel._targetServerInstance = this.migrationStateModel.getManagedInstance(selectedIndex);
				}
			}
		}));

		return this._view.modelBuilder.flexContainer().withItems(
			[
				this._azureSubscriptionText,
				managedInstanceSubscriptionDropdownLabel,
				this._managedInstanceSubscriptionDropdown,
				azureLocationLabel,
				this._azureLocationDropdown,
				azureResourceGroupLabel,
				this._azureResourceGroupDropdown,
				this._resourceDropdownLabel,
				this._resourceDropdown
			]
		).withLayout({
			flexFlow: 'column',
		}).withProps({
			CSSStyles: {
				'display': 'none'
			}
		}).component();

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
			this._azureSubscriptionText.value = constants.SELECT_AZURE_MI;
			this.migrationStateModel._migrationDbs = miDbs;
		} else {
			this._viewAssessmentsHelperText.value = constants.SKU_RECOMMENDATION_VIEW_ASSESSMENT_VM;
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.SKURecommendation) {
				this._databaseSelectedHelperText.value = constants.TOTAL_DATABASES_SELECTED(this.migrationStateModel.savedInfo.databaseList.length, this.migrationStateModel._databaseAssessment.length);
			} else {
				this._databaseSelectedHelperText.value = constants.TOTAL_DATABASES_SELECTED(vmDbs.length, this.migrationStateModel._databaseAssessment.length);
			}
			this.migrationStateModel._targetType = MigrationTargetType.SQLVM;
			this._azureSubscriptionText.value = constants.SELECT_AZURE_VM;
			this.migrationStateModel._migrationDbs = vmDbs;
		}
		this.migrationStateModel.refreshDatabaseBackupPage = true;
		if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.SKURecommendation) {
			this._targetContainer.display = 'inline';
		} else {
			this._targetContainer.display = (this.migrationStateModel._migrationDbs.length === 0) ? 'none' : 'inline';
		}
		await this.populateResourceInstanceDropdown();
	}

	private async constructDetails(): Promise<void> {
		this.wizard.message = {
			text: '',
			level: azdata.window.MessageLevel.Error
		};
		await this._assessmentComponent.updateCssStyles({ display: 'block' });
		await this._formContainer.component().updateCssStyles({ display: 'none' });

		this._assessmentLoader.loading = true;
		const serverName = (await this.migrationStateModel.getSourceConnectionProfile()).serverName;
		this._igComponent.value = constants.ASSESSMENT_COMPLETED(serverName);
		try {
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage) {
				this.migrationStateModel._assessmentResults = <ServerAssessment>this.migrationStateModel.savedInfo.serverAssessment;
			} else {
				await this.migrationStateModel.getDatabaseAssessments(MigrationTargetType.SQLMI);
			}
			this._detailsComponent.value = constants.SKU_RECOMMENDATION_ALL_SUCCESSFUL(this.migrationStateModel._assessmentResults.databaseAssessments.length);

			const errors: string[] = [];
			const assessmentError = this.migrationStateModel._assessmentResults.assessmentError;
			if (assessmentError) {
				errors.push(`message: ${assessmentError.message}
stack: ${assessmentError.stack}
`);
			}
			if (this.migrationStateModel?._assessmentResults?.errors?.length! > 0) {
				errors.push(...this.migrationStateModel._assessmentResults.errors?.map(e => `message: ${e.message}
errorSummary: ${e.errorSummary}
possibleCauses: ${e.possibleCauses}
guidance: ${e.guidance}
errorId: ${e.errorId}
`)!);
			}

			if (errors.length > 0) {
				this.wizard.message = {
					text: constants.SKU_RECOMMENDATION_ASSESSMENT_ERROR(serverName),
					description: errors.join(EOL),
					level: azdata.window.MessageLevel.Error
				};
			}

			this.migrationStateModel._runAssessments = errors.length > 0;
		} catch (e) {
			console.log(e);
		}

		if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.SKURecommendation) {
			if (this.migrationStateModel.savedInfo.migrationTargetType) {
				this._rbg.selectedCardId = this.migrationStateModel.savedInfo.migrationTargetType;
				await this.refreshCardText();
			}
		}

		await this.refreshCardText();
		this._assessmentLoader.loading = false;
		await this._assessmentComponent.updateCssStyles({ display: 'none' });
		await this._formContainer.component().updateCssStyles({ display: 'block' });
	}

	private async populateSubscriptionDropdown(): Promise<void> {
		if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.SKURecommendation) {
			this.migrationStateModel._azureAccount = <azdata.Account>this.migrationStateModel.savedInfo.azureAccount;
		}
		if (!this.migrationStateModel._targetSubscription) {
			this._managedInstanceSubscriptionDropdown.loading = true;
			this._resourceDropdown.loading = true;
			try {
				this._managedInstanceSubscriptionDropdown.values = await this.migrationStateModel.getSubscriptionsDropdownValues();
			} catch (e) {
				console.log(e);
			} finally {
				this._managedInstanceSubscriptionDropdown.loading = false;
				this._resourceDropdown.loading = false;
			}
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= 2 && this._managedInstanceSubscriptionDropdown.values) {
				this._managedInstanceSubscriptionDropdown.values.forEach((subscription, index) => {
					if ((<azdata.CategoryValue>subscription).name === this.migrationStateModel.savedInfo?.subscription?.id) {
						selectDropDownIndex(this._managedInstanceSubscriptionDropdown, index);
					}
				});
			} else {
				selectDropDownIndex(this._managedInstanceSubscriptionDropdown, 0);
			}
		}
	}

	public async populateLocationAndResourceGroupDropdown(): Promise<void> {
		this._azureResourceGroupDropdown.loading = true;
		this._azureLocationDropdown.loading = true;
		try {
			this._azureResourceGroupDropdown.values = await this.migrationStateModel.getAzureResourceGroupDropdownValues(this.migrationStateModel._targetSubscription);
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= 2 && this._azureResourceGroupDropdown.values) {
				this._azureResourceGroupDropdown.values.forEach((resourceGroup, index) => {
					if (resourceGroup.name === this.migrationStateModel.savedInfo?.resourceGroup?.id) {
						selectDropDownIndex(this._azureResourceGroupDropdown, index);
					}
				});
			} else {
				selectDropDownIndex(this._azureResourceGroupDropdown, 0);
			}
			this._azureLocationDropdown.values = await this.migrationStateModel.getAzureLocationDropdownValues(this.migrationStateModel._targetSubscription);
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= 2 && this._azureLocationDropdown.values) {
				this._azureLocationDropdown.values.forEach((location, index) => {
					if (location.displayName === this.migrationStateModel.savedInfo?.location?.displayName) {
						selectDropDownIndex(this._azureLocationDropdown, index);
					}
				});
			} else {
				selectDropDownIndex(this._azureLocationDropdown, 0);
			}
		} catch (e) {
			console.log(e);
		} finally {
			this._azureResourceGroupDropdown.loading = false;
			this._azureLocationDropdown.loading = false;
		}
	}

	private async populateResourceInstanceDropdown(): Promise<void> {
		try {
			this._resourceDropdown.loading = true;

			if (this._rbg.selectedCardId === MigrationTargetType.SQLVM) {
				this._resourceDropdownLabel.value = constants.AZURE_SQL_DATABASE_VIRTUAL_MACHINE;
				this._resourceDropdown.values = await this.migrationStateModel.getSqlVirtualMachineValues(
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._location,
					this.migrationStateModel._resourceGroup);

			} else {
				this._resourceDropdownLabel.value = constants.AZURE_SQL_DATABASE_MANAGED_INSTANCE;
				this._resourceDropdown.values = await this.migrationStateModel.getManagedInstanceValues(
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._location,
					this.migrationStateModel._resourceGroup);
			}
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= 2 && this._resourceDropdown.values) {
				this._resourceDropdown.values.forEach((resource, index) => {
					if (resource.displayName === this.migrationStateModel.savedInfo?.targetServerInstance?.name) {
						selectDropDownIndex(this._resourceDropdown, index);
					}
				});
			} else {
				selectDropDownIndex(this._resourceDropdown, 0);
			}
		} catch (e) {
			console.log(e);
		} finally {
			this._resourceDropdown.loading = false;
		}
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.SKURecommendation) {
				this.migrationStateModel._migrationDbs = this.migrationStateModel.savedInfo.databaseList;
			}
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
			if ((<azdata.CategoryValue>this._managedInstanceSubscriptionDropdown.value)?.displayName === constants.NO_SUBSCRIPTIONS_FOUND) {
				errors.push(constants.INVALID_SUBSCRIPTION_ERROR);
			}
			if ((<azdata.CategoryValue>this._azureLocationDropdown.value)?.displayName === constants.NO_LOCATION_FOUND) {
				errors.push(constants.INVALID_LOCATION_ERROR);
			}

			if ((<azdata.CategoryValue>this._managedInstanceSubscriptionDropdown.value)?.displayName === constants.RESOURCE_GROUP_NOT_FOUND) {
				errors.push(constants.INVALID_RESOURCE_GROUP_ERROR);
			}
			const resourceDropdownValue = (<azdata.CategoryValue>this._resourceDropdown.value).displayName;
			if (resourceDropdownValue === constants.NO_MANAGED_INSTANCE_FOUND) {
				errors.push(constants.NO_MANAGED_INSTANCE_FOUND);
			}
			else if (resourceDropdownValue === constants.NO_VIRTUAL_MACHINE_FOUND) {
				errors.push(constants.NO_VIRTUAL_MACHINE_FOUND);
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
		if (this.migrationStateModel._runAssessments) {
			await this.constructDetails();
		}
		await this._assessmentComponent.updateCssStyles({
			display: 'none'
		});
		await this._formContainer.component().updateCssStyles({
			display: 'block'
		});

		await this.populateSubscriptionDropdown();
		this.wizard.nextButton.enabled = true;
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

	public async refreshDatabaseCount(selectedDbs: string[]): Promise<void> {
		this.wizard.message = {
			text: '',
			level: azdata.window.MessageLevel.Error
		};
		this.migrationStateModel._migrationDbs = selectedDbs;
		await this.refreshCardText();
	}

	public async refreshCardText(): Promise<void> {
		this._rbgLoader.loading = true;
		if (this._rbg.selectedCardId === MigrationTargetType.SQLMI) {
			this.migrationStateModel._migrationDbs = this.migrationStateModel._miDbs;
		} else {
			this.migrationStateModel._migrationDbs = this.migrationStateModel._vmDbs;
		}

		this._azureResourceGroupDropdown.display = (!this._rbg.selectedCardId) ? 'none' : 'inline';
		this._targetContainer.display = (this.migrationStateModel._migrationDbs.length === 0) ? 'none' : 'inline';

		if (this.migrationStateModel._assessmentResults) {
			const dbCount = this.migrationStateModel._assessmentResults.databaseAssessments.length;

			const dbWithoutIssuesCount = this.migrationStateModel._assessmentResults.databaseAssessments.filter(db => db.issues.length === 0).length;
			const miCardText = constants.CAN_BE_MIGRATED(dbWithoutIssuesCount, dbCount);
			this._rbg.cards[0].descriptions[1].textValue = miCardText;

			const vmCardText = constants.CAN_BE_MIGRATED(dbCount, dbCount);
			this._rbg.cards[1].descriptions[1].textValue = vmCardText;

			await this._rbg.updateProperties({
				cards: this._rbg.cards
			});
		} else {
			this._rbg.cards[0].descriptions[1].textValue = '';
			this._rbg.cards[1].descriptions[1].textValue = '';

			await this._rbg.updateProperties({
				cards: this._rbg.cards
			});
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
}


