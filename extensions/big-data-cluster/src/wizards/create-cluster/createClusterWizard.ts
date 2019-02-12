/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { CreateClusterModel } from './createClusterModel';
import { SelectTargetClusterPage } from './pages/targetClusterPage';
import { SummaryPage } from './pages/summaryPage';
import { SettingsPage } from './pages/settingsPage';
import { ClusterProfilePage } from './pages/clusterProfilePage';
import * as ResourceStrings from './resourceStrings';
import { TestKubeConfigParser } from '../../data/kubeConfigParser';
import { ExtensionContext } from 'vscode';
import { WizardBase } from '../wizardBase';

export class CreateClusterWizard extends WizardBase<CreateClusterModel> {
	constructor(context: ExtensionContext) {
		let configParser = new TestKubeConfigParser();
		let model = new CreateClusterModel(configParser);
		super(model, context, ResourceStrings.WizardTitle);
	}

	protected initialize(): void {
		let settingsPage = new SettingsPage(this.model, this);
		let clusterProfilePage = new ClusterProfilePage(this.model, this);
		let selectTargetClusterPage = new SelectTargetClusterPage(this.model, this);
		let summaryPage = new SummaryPage(this.model, this);

		this.wizard.pages = [
			settingsPage.Page,
			clusterProfilePage.Page,
			selectTargetClusterPage.Page,
			summaryPage.Page
		];

		this.wizard.generateScriptButton.label = ResourceStrings.GenerateScriptsButtonText;
		this.wizard.doneButton.label = ResourceStrings.CreateClusterButtonText;

		this.wizard.generateScriptButton.onClick(() => { });
		this.wizard.doneButton.onClick(() => { });
	}
}
