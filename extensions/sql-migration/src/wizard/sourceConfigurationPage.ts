/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { SOURCE_CONFIGURATION_PAGE_TITLE, COLLECTING_SOURCE_CONFIGURATIONS, COLLECTING_SOURCE_CONFIGURATIONS_INFO, COLLECTING_SOURCE_CONFIGURATIONS_ERROR } from '../models/strings';
import { MigrationStateModel } from '../models/stateMachine';

export class SourceConfigurationPage extends MigrationWizardPage {
	constructor(migrationStateModel: MigrationStateModel) {
		super(azdata.window.createWizardPage(SOURCE_CONFIGURATION_PAGE_TITLE), migrationStateModel);
	}

	public async registerWizardContent(): Promise<void> {
		return new Promise<void>(async (resolve, reject) => {
			this.wizardPage.registerContent(async (view) => {
				try {
					await this.registerContent(view);
					resolve();
				} catch (ex) {
					reject(ex);
				} finally {
					reject(new Error());
				}
			});
		});
	}

	private async registerContent(view: azdata.ModelView) {
		await this.createGatheringInformationPage(view);
		setTimeout(async () => {
			console.log('doing it');
			try {
				await this.createErrorInInformationGatheringPage(view);
			} catch (ex) {
				console.log(ex);
			}
		}, 5000);
	}

	private gatheringInfoComponent!: azdata.FormComponent;
	private async createGatheringInformationPage(view: azdata.ModelView) {
		this.gatheringInfoComponent = this.createGatheringInfoComponent(view);
		const form = view.modelBuilder.formContainer().withFormItems(
			[
				this.gatheringInfoComponent
			],
			{
				titleFontSize: '20px'
			}
		).component();

		await view.initializeModel(form);
	}

	// private async createInformationGatheredPage(view: azdata.ModelView){

	// }

	private async createErrorInInformationGatheringPage(view: azdata.ModelView) {
		const component = this.gatheringInfoComponent.component as azdata.TextComponent;
		component.value = COLLECTING_SOURCE_CONFIGURATIONS_ERROR('Some error');
	}

	//#region component builders
	private createGatheringInfoComponent(view: azdata.ModelView): azdata.FormComponent {
		let explaination = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: COLLECTING_SOURCE_CONFIGURATIONS_INFO,
			CSSStyles: {
				'font-size': '14px'
			}
		});

		return {
			component: explaination.component(),
			title: COLLECTING_SOURCE_CONFIGURATIONS
		};
	}
	//#endregion
	public async onPageEnter(): Promise<void> {

	}

	public async onPageLeave(): Promise<void> {

	}
}
