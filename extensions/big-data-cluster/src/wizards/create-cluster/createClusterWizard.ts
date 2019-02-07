/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { CreateClusterModel } from './createClusterModel';
import { SelectTargetClusterPage } from './pages/targetClusterPage';
import { SummaryPage } from './pages/summaryPage';
import { SettingsPage } from './pages/settingsPage';
import { ClusterProfilePage } from './pages/clusterProfilePage';
import * as ResourceStrings from './resourceStrings';

export class CreateClusterWizard {
	private wizard: sqlops.window.modelviewdialog.Wizard;
	private model: CreateClusterModel;

	constructor() { }

	public open() {
		this.model = new CreateClusterModel();
		this.wizard = sqlops.window.modelviewdialog.createWizard(ResourceStrings.WizardTitle);

		let settingsPage = new SettingsPage(this.model);
		let clusterProfilePage = new ClusterProfilePage(this.model);
		let selectTargetClusterPage = new SelectTargetClusterPage(this.model);
		let summaryPage = new SummaryPage(this.model);

		this.wizard.pages = [
			settingsPage.Page,
			clusterProfilePage.Page,
			selectTargetClusterPage.Page,
			summaryPage.Page
		];

		this.wizard.generateScriptButton.label = ResourceStrings.GenerateScriptsButtonText;
		this.wizard.doneButton.label = ResourceStrings.CreateClusterButtonText;

		this.wizard.generateScriptButton.onClick(async () => {
			await new Promise(resolve => {
				setTimeout(() => {
					resolve();
				}, 3000);
			});
		});
		this.wizard.doneButton.onClick(async () => {
			await new Promise(resolve => {
				setTimeout(() => {
					resolve();
				}, 3000);
			});
		});

		this.wizard.open();
	}
}
