/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as path from 'path';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import { Product, ProductLookupTable } from '../models/product';
import { AssessmentResultsDialog } from '../dialog/assessmentResults/assessmentResultsDialog';
import * as constants from '../constants/strings';
import * as vscode from 'vscode';
import { EOL } from 'os';

// import { SqlMigrationService } from '../../../../extensions/mssql/src/sqlMigration/sqlMigrationService';

export class SKURecommendationPage extends MigrationWizardPage {
	// For future reference: DO NOT EXPOSE WIZARD DIRECTLY THROUGH HERE.
	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.SKU_RECOMMENDATION_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView) {
		await this.initialState(view);
	}

	private _igComponent: azdata.FormComponent<azdata.TextComponent> | undefined;
	private _detailsComponent: azdata.FormComponent<azdata.TextComponent> | undefined;
	private _chooseTargetComponent: azdata.FormComponent<azdata.DivContainer> | undefined;
	private _azureSubscriptionText: azdata.FormComponent<azdata.TextComponent> | undefined;
	private _managedInstanceSubscriptionDropdown!: azdata.DropDownComponent;
	private _resourceDropdownLabel!: azdata.TextComponent;
	private _resourceDropdown!: azdata.DropDownComponent;
	private _view: azdata.ModelView | undefined;
	private _rbg!: azdata.RadioCardGroupComponent;

	private async initialState(view: azdata.ModelView) {
		this._view = view;
		this._igComponent = this.createStatusComponent(view); // The first component giving basic information
		this._detailsComponent = this.createDetailsComponent(view); // The details of what can be moved
		this._chooseTargetComponent = this.createChooseTargetComponent(view);
		this._azureSubscriptionText = this.createAzureSubscriptionText(view);

		const managedInstanceSubscriptionDropdownLabel = view.modelBuilder.text().withProps({
			value: constants.SUBSCRIPTION
		}).component();
		this._managedInstanceSubscriptionDropdown = view.modelBuilder.dropDown().component();
		this._managedInstanceSubscriptionDropdown.onValueChanged((e) => {
			if (e.selected) {
				this.migrationStateModel._targetSubscription = this.migrationStateModel.getSubscription(e.index);
				this.migrationStateModel._targetServerInstance = undefined!;
				this.migrationStateModel._migrationController = undefined!;
				this.populateResourceInstanceDropdown();
			}
		});
		this._resourceDropdownLabel = view.modelBuilder.text().withProps({
			value: constants.MANAGED_INSTANCE
		}).component();

		this._resourceDropdown = view.modelBuilder.dropDown().component();
		this._resourceDropdown.onValueChanged((e) => {
			if (e.selected &&
				e.selected !== constants.NO_MANAGED_INSTANCE_FOUND &&
				e.selected !== constants.NO_VIRTUAL_MACHINE_FOUND) {
				this.migrationStateModel._migrationControllers = undefined!;
				if (this._rbg.selectedCardId === 'AzureSQLVM') {
					this.migrationStateModel._targetServerInstance = this.migrationStateModel.getVirtualMachine(e.index);
				} else {
					this.migrationStateModel._targetServerInstance = this.migrationStateModel.getManagedInstance(e.index);
				}

			}
		});

		const targetContainer = view.modelBuilder.flexContainer().withItems(
			[
				managedInstanceSubscriptionDropdownLabel,
				this._managedInstanceSubscriptionDropdown,
				this._resourceDropdownLabel,
				this._resourceDropdown
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		let connectionUri: string = await azdata.connection.getUriForConnection(this.migrationStateModel.sourceConnectionId);
		this.migrationStateModel.migrationService.getAssessments(connectionUri).then(results => {
			if (results) {
				this.migrationStateModel.assessmentResults = results.items;
			}
		});

		this._view = view;
		const formContainer = view.modelBuilder.formContainer().withFormItems(
			[
				this._igComponent,
				this._detailsComponent,
				this._chooseTargetComponent,
				this._azureSubscriptionText,
				{
					component: targetContainer
				},
			]
		);

		await view.initializeModel(formContainer.component());
	}

	private createStatusComponent(view: azdata.ModelView): azdata.FormComponent<azdata.TextComponent> {
		const component = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: '',
			CSSStyles: {
				'font-size': '18px'
			}
		});

		return {
			title: '',
			component: component.component(),
		};
	}

	private createDetailsComponent(view: azdata.ModelView): azdata.FormComponent<azdata.TextComponent> {
		const component = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: '',
		});

		return {
			title: '',
			component: component.component(),
		};
	}

	private createChooseTargetComponent(view: azdata.ModelView) {
		const component = view.modelBuilder.divContainer();

		return {
			title: constants.SKU_RECOMMENDATION_CHOOSE_A_TARGET,
			component: component.component()
		};
	}

	private constructDetails(): void {
		this._chooseTargetComponent?.component.clearItems();

		if (this.migrationStateModel.assessmentResults) {

		}
		this._igComponent!.component.value = constants.CONGRATULATIONS;
		// either: SKU_RECOMMENDATION_ALL_SUCCESSFUL or SKU_RECOMMENDATION_SOME_SUCCESSFUL or SKU_RECOMMENDATION_NONE_SUCCESSFUL
		this._detailsComponent!.component.value = constants.SKU_RECOMMENDATION_SOME_SUCCESSFUL(1, 1);
		this.constructTargets();
	}

	private constructTargets(): void {
		const products: Product[] = Object.values(ProductLookupTable);

		this._rbg = this._view!.modelBuilder.radioCardGroup().withProperties<azdata.RadioCardGroupComponentProperties>({
			cards: [],
			cardWidth: '600px',
			cardHeight: '40px',
			orientation: azdata.Orientation.Vertical,
			iconHeight: '30px',
			iconWidth: '30px'
		}).component();

		products.forEach((product) => {
			const imagePath = path.resolve(this.migrationStateModel.getExtensionPath(), 'images', product.icon ?? 'ads.svg');
			const dbCount = this.migrationStateModel._migrationDbs.length;
			const descriptions: azdata.RadioCardDescription[] = [
				{
					textValue: product.name,
					textStyles: {
						'font-size': '14px',
						'font-weight': 'bold',
						'line-height': '20px'
					},
					linkDisplayValue: 'Learn more',
					linkStyles: {
						'font-size': '14px',
						'line-height': '20px'
					},
					displayLinkCodicon: true,
					linkCodiconStyles: {
						'font-size': '14px',
						'line-height': '20px'
					},
				},
				{
					textValue: `${dbCount} databases will be migrated`,
					textStyles: {
						'font-size': '13px',
						'line-height': '18px'
					},
					linkStyles: {
						'font-size': '14px',
						'line-height': '20px'
					},
					linkDisplayValue: 'View/Change',
					displayLinkCodicon: true,
					linkCodiconStyles: {
						'font-size': '13px',
						'line-height': '18px'
					}
				}
			];

			this._rbg.cards.push({
				id: product.type,
				icon: imagePath,
				descriptions
			});
		});

		this._rbg.onLinkClick(async (value) => {

			//check which card is being selected, and open correct dialog based on link
			console.log(value);
			let dialog = new AssessmentResultsDialog('ownerUri', this.migrationStateModel, 'Assessment Dialog', this);
			await dialog.openDialog();
		});

		this._rbg.onSelectionChanged((value) => {
			this.populateResourceInstanceDropdown();
		});

		this._rbg.selectedCardId = 'AzureSQLMI';

		this._chooseTargetComponent?.component.addItem(this._rbg);
	}

	private createAzureSubscriptionText(view: azdata.ModelView): azdata.FormComponent<azdata.TextComponent> {
		const component = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Select an Azure subscription and an Azure SQL Managed Instance for your target.', //TODO: Localize
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px'
			}
		});

		return {
			title: '',
			component: component.component(),
		};
	}

	private async populateSubscriptionDropdown(): Promise<void> {
		if (!this.migrationStateModel._targetSubscription) {
			this._managedInstanceSubscriptionDropdown.loading = true;
			this._resourceDropdown.loading = true;
			try {
				this._managedInstanceSubscriptionDropdown.values = await this.migrationStateModel.getSubscriptionsDropdownValues();
			} catch (e) {
				console.log(e);
			} finally {
				this._managedInstanceSubscriptionDropdown.loading = false;
			}
		}
	}

	private async populateResourceInstanceDropdown(): Promise<void> {
		this._resourceDropdown.loading = true;
		try {
			if (this._rbg.selectedCardId === 'AzureSQLVM') {
				this._resourceDropdownLabel.value = constants.AZURE_SQL_DATABASE_VIRTUAL_MACHINE;
				this._resourceDropdown.values = await this.migrationStateModel.getSqlVirtualMachineValues(this.migrationStateModel._targetSubscription);

			} else {
				this._resourceDropdownLabel.value = constants.AZURE_SQL_DATABASE_MANAGED_INSTANCE;
				this._resourceDropdown.values = await this.migrationStateModel.getManagedInstanceValues(this.migrationStateModel._targetSubscription);
			}
		} catch (e) {
			console.log(e);
		} finally {
			this._resourceDropdown.loading = false;
		}
	}

	private eventListener: vscode.Disposable | undefined;
	public async onPageEnter(): Promise<void> {
		this.eventListener = this.migrationStateModel.stateChangeEvent(async (e) => this.onStateChangeEvent(e));
		this.populateSubscriptionDropdown();
		this.constructDetails();

		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			const errors: string[] = [];
			this.wizard.message = {
				text: '',
				level: azdata.window.MessageLevel.Error
			};
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}
			if (this.migrationStateModel._migrationDbs.length === 0) {
				errors.push('Please select databases to migrate');

			}
			if ((<azdata.CategoryValue>this._managedInstanceSubscriptionDropdown.value).displayName === constants.NO_SUBSCRIPTIONS_FOUND) {
				errors.push(constants.INVALID_SUBSCRIPTION_ERROR);
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
	}

	public async onPageLeave(): Promise<void> {
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
		switch (e.newState) {

		}
	}

	public refreshDatabaseCount(count: number): void {
		this.wizard.message = {
			text: '',
			level: azdata.window.MessageLevel.Error
		};
		const textValue: string = `${count} databases will be migrated`;
		this._rbg.cards[0].descriptions[1].textValue = textValue;
		this._rbg.cards[1].descriptions[1].textValue = textValue;

		this._rbg.updateProperties({
			cards: this._rbg.cards
		});
	}

}
