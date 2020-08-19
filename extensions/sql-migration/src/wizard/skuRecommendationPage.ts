/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import { Product } from '../models/product';
import { CONGRATULATIONS, SKU_RECOMMENDATION_PAGE_TITLE, SKU_RECOMMENDATION_ALL_SUCCESSFUL } from '../models/strings';

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
	private async initialState(view: azdata.ModelView) {
		this.igComponent = this.createIGComponent(view);
		this.detailsComponent = this.createDetailsComponent(view);
	}

	private createIGComponent(view: azdata.ModelView): azdata.FormComponent<azdata.TextComponent> {
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

	private constructDetails(): void {
		const recommendations = this.migrationStateModel.skuRecommendations?.recommendations;

		if (!recommendations) {
			return;
		}

		const products = recommendations.map(recommendation => {
			return {
				checks: recommendation.checks,
				product: Product.FromMigrationProduct(recommendation.product)
			};
		});

		const migratableDatabases: number = products?.length ?? 10; // force it to be used

		const allDatabases = 10;

		if (allDatabases === migratableDatabases) {
			this.allMigratable(migratableDatabases);
		}

		// TODO handle other situations

	}

	private allMigratable(databaseCount: number): void {
		this.igComponent!.title = CONGRATULATIONS;
		this.igComponent!.component.value = SKU_RECOMMENDATION_ALL_SUCCESSFUL(databaseCount);
		this.detailsComponent!.component.value = ''; // force it to be used
		// fill in some of that information
	}

	public async onPageEnter(): Promise<void> {
		this.constructDetails();
	}

	public async onPageLeave(): Promise<void> {

	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
		switch (e.newState) {

		}
	}

}
