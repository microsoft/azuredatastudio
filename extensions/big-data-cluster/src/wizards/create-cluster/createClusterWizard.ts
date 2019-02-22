/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { CreateClusterModel } from './createClusterModel';
import { SelectExistingClusterPage } from './pages/selectExistingClusterPage';
import { SummaryPage } from './pages/summaryPage';
import { SettingsPage } from './pages/settingsPage';
import { ClusterProfilePage } from './pages/clusterProfilePage';
import { TestKubeConfigParser } from '../../data/kubeConfigParser';
import { ExtensionContext } from 'vscode';
import { WizardBase } from '../wizardBase';
import * as nls from 'vscode-nls';
import { SelectTargetClusterTypePage } from './pages/selectTargetClusterTypePage';

const localize = nls.loadMessageBundle();

export class CreateClusterWizard extends WizardBase<CreateClusterModel> {
	constructor(context: ExtensionContext) {
		let configParser = new TestKubeConfigParser();
		let model = new CreateClusterModel(configParser);
		super(model, context, localize('bdc-create.wizardTitle', 'Create a big data cluster'));
	}

	protected initialize(): void {
		let settingsPage = new SettingsPage(this.model, this);
		let clusterProfilePage = new ClusterProfilePage(this.model, this);
		let selectTargetClusterPage = new SelectExistingClusterPage(this.model, this);
		let summaryPage = new SummaryPage(this.model, this);
		let targetClusterTypePage = new SelectTargetClusterTypePage(this.model, this);

		this.wizard.pages = [
			targetClusterTypePage.page,
			settingsPage.page,
			clusterProfilePage.page,
			selectTargetClusterPage.page,
			summaryPage.page
		];

		this.wizard.generateScriptButton.label = localize('bdc-create.generateScriptsButtonText', 'Generate Scripts');
		this.wizard.doneButton.label = localize('bdc-create.createClusterButtonText', 'Create');

		this.wizard.generateScriptButton.onClick(() => { });
		this.wizard.doneButton.onClick(() => { });
	}
}
