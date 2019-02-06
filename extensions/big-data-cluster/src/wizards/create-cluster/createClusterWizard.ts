/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { CreateClusterModel } from './createClusterModel';
import { SelectTargetClusterPage } from './pages/targetClusterPage';
import { SummaryPage } from './pages/summaryPage';
import { SettingsPage } from './pages/settingsPage';
import { ClusterProfilePage } from './pages/clusterProfilePage';

const localize = nls.loadMessageBundle();
const WizardTitle = localize('bdc.createClusterTitle','Create a 2019 Big Data cluster');

export class CreateClusterWizard {
	private wizard: sqlops.window.modelviewdialog.Wizard;
	private model: CreateClusterModel;

	constructor() {
	}

	public open() {
		this.model = new CreateClusterModel();
		this.wizard =sqlops.window.modelviewdialog.createWizard(WizardTitle);

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

		this.wizard.generateScriptButton.label = localize('bdc.createClusterGenerateScriptButtonLabel', 'Generate Scripts');
		this.wizard.doneButton.label = localize('bdc.createClusterDeployButtonLabel', 'Create');

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
