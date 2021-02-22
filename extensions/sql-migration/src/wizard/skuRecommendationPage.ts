/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as path from 'path';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import { Product, ProductLookupTable } from '../models/product';
import { Disposable } from 'vscode';
import { AssessmentResultsDialog } from '../dialog/assessmentResults/assessmentResultsDialog';
import { getAvailableManagedInstanceProducts, getSubscriptions, SqlManagedInstance, Subscription } from '../api/azure';
import * as constants from '../models/strings';
import { azureResource } from 'azureResource';

// import { SqlMigrationService } from '../../../../extensions/mssql/src/sqlMigration/sqlMigrationService';

export class SKURecommendationPage extends MigrationWizardPage {
	// For future reference: DO NOT EXPOSE WIZARD DIRECTLY THROUGH HERE.
	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.SKU_RECOMMENDATION_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView) {
		await this.initialState(view);
	}

	private igComponent: azdata.FormComponent<azdata.TextComponent> | undefined;
	private detailsComponent: azdata.FormComponent<azdata.TextComponent> | undefined;
	private chooseTargetComponent: azdata.FormComponent<azdata.DivContainer> | undefined;
	private azureSubscriptionText: azdata.FormComponent<azdata.TextComponent> | undefined;
	private _managedInstanceSubscriptionDropdown!: azdata.DropDownComponent;
	private _managedInstanceDropdown!: azdata.DropDownComponent;
	private _subscriptionDropdownValues: azdata.CategoryValue[] = [];
	private _subscriptionMap: Map<string, Subscription> = new Map();
	private view: azdata.ModelView | undefined;

	private async initialState(view: azdata.ModelView) {
		this.igComponent = this.createStatusComponent(view); // The first component giving basic information
		this.detailsComponent = this.createDetailsComponent(view); // The details of what can be moved
		this.chooseTargetComponent = this.createChooseTargetComponent(view);
		this.azureSubscriptionText = this.createAzureSubscriptionText(view);

		const managedInstanceSubscriptionDropdownLabel = view.modelBuilder.text().withProps({
			value: constants.SUBSCRIPTION
		}).component();
		this._managedInstanceSubscriptionDropdown = view.modelBuilder.dropDown().component();
		this._managedInstanceSubscriptionDropdown.onValueChanged((e) => {
			this.populateManagedInstanceDropdown();
		});
		const managedInstanceDropdownLabel = view.modelBuilder.text().withProps({
			value: constants.MANAGED_INSTANCE
		}).component();
		this._managedInstanceDropdown = view.modelBuilder.dropDown().component();

		const targetContainer = view.modelBuilder.flexContainer().withItems(
			[
				managedInstanceSubscriptionDropdownLabel,
				this._managedInstanceSubscriptionDropdown,
				managedInstanceDropdownLabel,
				this._managedInstanceDropdown
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		// this.assessmentLink = view.modelBuilder.hyperlink()
		// 	.withProperties<azdata.HyperlinkComponentProperties>({
		// 		label: 'View Assessment Results',
		// 		url: ''
		// 	}).component();
		// this.assessmentLink.onDidClick(async () => {
		// 	let dialog = new AssessmentResultsDialog('ownerUri', this.migrationStateModel, 'Assessment Dialog');
		// 	await dialog.openDialog();
		// });

		// const assessmentFormLink = {
		// 	title: '',
		// 	component: assessmentLink,
		// };

		this.view = view;
		const formContainer = view.modelBuilder.formContainer().withFormItems(
			[
				this.igComponent,
				this.detailsComponent,
				this.chooseTargetComponent,
				this.azureSubscriptionText,
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
		this.chooseTargetComponent?.component.clearItems();

		//TODO: Need to take assessment result and insert here
		//*** What service do I need to call to get the assessment results?
		if (this.migrationStateModel.assessmentResults) {

		}
		this.igComponent!.component.value = constants.CONGRATULATIONS;
		// either: SKU_RECOMMENDATION_ALL_SUCCESSFUL or SKU_RECOMMENDATION_SOME_SUCCESSFUL or SKU_RECOMMENDATION_NONE_SUCCESSFUL
		this.detailsComponent!.component.value = constants.SKU_RECOMMENDATION_SOME_SUCCESSFUL(1, 1);
		this.constructTargets();
	}

	private constructTargets(): void {
		const products: Product[] = Object.values(ProductLookupTable);

		const rbg = this.view!.modelBuilder.radioCardGroup().withProperties<azdata.RadioCardGroupComponentProperties>({
			cards: [],
			cardWidth: '600px',
			cardHeight: '60px',
			orientation: azdata.Orientation.Vertical,
			iconHeight: '30px',
			iconWidth: '30px'
		});
		// rbg.component().cards = [];
		// rbg.component().orientation = azdata.Orientation.Vertical;
		// rbg.component().iconHeight = '30px';
		// rbg.component().iconWidth = '30px';

		products.forEach((product) => {
			const imagePath = path.resolve(this.migrationStateModel.getExtensionPath(), 'media', product.icon ?? 'ads.svg');

			const descriptions: azdata.RadioCardDescription[] = [
				{
					textValue: product.name,
					linkDisplayValue: 'Learn more',
					displayLinkCodicon: true,
					textStyles: {
						'font-size': '1rem',
						'font-weight': 550,
					},
					linkCodiconStyles: {
						'font-size': '1em',
						'color': 'royalblue'
					}
				},
				{
					textValue: '9 databases will be migrated',
					linkDisplayValue: 'View/Change',
					displayLinkCodicon: true,
					linkCodiconStyles: {
						'font-size': '1em',
						'color': 'royalblue'
					}
				}
			];

			rbg.component().cards.push({
				id: product.name,
				icon: imagePath,
				descriptions
			});
			rbg.component().onLinkClick(async () => {
				let dialog = new AssessmentResultsDialog('ownerUri', this.migrationStateModel, 'Assessment Dialog');
				await dialog.openDialog();
			});
		});

		this.chooseTargetComponent?.component.addItem(rbg.component());
	}

	private createAzureSubscriptionText(view: azdata.ModelView): azdata.FormComponent<azdata.TextComponent> {
		const component = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: 'Select an Azure subscription and an Azure SQL Managed Instance for your target.', //TODO: Localize

		});

		return {
			title: '',
			component: component.component(),
		};
	}

	private async populateSubscriptionDropdown(): Promise<void> {
		this._managedInstanceSubscriptionDropdown.loading = true;
		this._managedInstanceDropdown.loading = true;
		let subscriptions: azureResource.AzureResourceSubscription[] = [];
		try {
			subscriptions = await getSubscriptions(this.migrationStateModel.azureAccount);
			subscriptions.forEach((subscription) => {
				this._subscriptionMap.set(subscription.id, subscription);
				this._subscriptionDropdownValues.push({
					name: subscription.id,
					displayName: subscription.name + ' - ' + subscription.id,
				});
			});

			if (!this._subscriptionDropdownValues || this._subscriptionDropdownValues.length === 0) {
				this._subscriptionDropdownValues = [
					{
						displayName: constants.NO_SUBSCRIPTIONS_FOUND,
						name: ''
					}
				];
			}

			this._managedInstanceSubscriptionDropdown.values = this._subscriptionDropdownValues;
		} catch (error) {
			this.setEmptyDropdownPlaceHolder(this._managedInstanceSubscriptionDropdown, constants.NO_SUBSCRIPTIONS_FOUND);
			this._managedInstanceDropdown.loading = false;
		}
		this.populateManagedInstanceDropdown();
		this._managedInstanceSubscriptionDropdown.loading = false;
	}

	private async populateManagedInstanceDropdown(): Promise<void> {
		this._managedInstanceDropdown.loading = true;
		let mis: SqlManagedInstance[] = [];
		let miValues: azdata.CategoryValue[] = [];
		try {
			const subscriptionId = (<azdata.CategoryValue>this._managedInstanceSubscriptionDropdown.value).name;

			mis = await getAvailableManagedInstanceProducts(this.migrationStateModel.azureAccount, this._subscriptionMap.get(subscriptionId)!);
			mis.forEach((mi) => {
				miValues.push({
					name: mi.name,
					displayName: mi.name
				});
			});

			if (!miValues || miValues.length === 0) {
				miValues = [
					{
						displayName: constants.NO_MANAGED_INSTANCE_FOUND,
						name: ''
					}
				];
			}

			this._managedInstanceDropdown.values = miValues;
		} catch (error) {
			this.setEmptyDropdownPlaceHolder(this._managedInstanceDropdown, constants.NO_MANAGED_INSTANCE_FOUND);
		}

		this._managedInstanceDropdown.loading = false;
	}

	private setEmptyDropdownPlaceHolder(dropDown: azdata.DropDownComponent, placeholder: string): void {
		dropDown.values = [{
			displayName: placeholder,
			name: ''
		}];
	}

	private eventListener: Disposable | undefined;
	public async onPageEnter(): Promise<void> {
		this.eventListener = this.migrationStateModel.stateChangeEvent(async (e) => this.onStateChangeEvent(e));
		this.populateSubscriptionDropdown();
		this.constructDetails();
	}

	public async onPageLeave(): Promise<void> {
		this.eventListener?.dispose();
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
		switch (e.newState) {

		}
	}

}
