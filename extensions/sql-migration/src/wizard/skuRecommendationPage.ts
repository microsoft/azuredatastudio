/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as path from 'path';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import { Product, ProductLookupTable } from '../models/product';
import { SKU_RECOMMENDATION_PAGE_TITLE, SKU_RECOMMENDATION_CHOOSE_A_TARGET } from '../models/strings';
import { Disposable } from 'vscode';

export class SKURecommendationPage extends MigrationWizardPage {
	// For future reference: DO NOT EXPOSE WIZARD DIRECTLY THROUGH HERE.
	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(SKU_RECOMMENDATION_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView) {
		await this.initialState(view);
	}

	private igComponent: azdata.FormComponent<azdata.TextComponent> | undefined;
	private detailsComponent: azdata.FormComponent<azdata.TextComponent> | undefined;
	private chooseTargetComponent: azdata.FormComponent<azdata.DivContainer> | undefined;
	private view: azdata.ModelView | undefined;

	private async initialState(view: azdata.ModelView) {
		this.igComponent = this.createStatusComponent(view); // The first component giving basic information
		this.detailsComponent = this.createDetailsComponent(view); // The details of what can be moved
		this.chooseTargetComponent = this.createChooseTargetComponent(view);
		this.view = view;


		const form = view.modelBuilder.formContainer().withFormItems(
			[
				this.igComponent,
				this.detailsComponent,
				this.chooseTargetComponent
			]
		);

		await view.initializeModel(form.component());
	}

	private createStatusComponent(view: azdata.ModelView): azdata.FormComponent<azdata.TextComponent> {
		const component = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: '',
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
			title: SKU_RECOMMENDATION_CHOOSE_A_TARGET,
			component: component.component()
		};
	}

	private constructDetails(): void {
		this.chooseTargetComponent?.component.clearItems();

		this.igComponent!.component.value = 'Test';
		this.detailsComponent!.component.value = 'Test';
		this.constructTargets();
	}

	private constructTargets(): void {
		const products: Product[] = Object.values(ProductLookupTable);

		const rbg = this.view!.modelBuilder.radioCardGroup();
		rbg.component().cards = [];

		products.forEach((product) => {
			const imagePath = path.resolve(this.migrationStateModel.getExtensionPath(), 'media', product.icon ?? 'ads.svg');

			rbg.component().cards.push({
				id: product.name,
				icon: imagePath,
				label: 'Some Label'
			});
		});

		this.chooseTargetComponent?.component.addItem(rbg.component());
	}

	private eventListener: Disposable | undefined;
	public async onPageEnter(): Promise<void> {
		this.eventListener = this.migrationStateModel.stateChangeEvent(async (e) => this.onStateChangeEvent(e));
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
