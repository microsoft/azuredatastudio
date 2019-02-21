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
import { ExtensionContext } from 'vscode';
import { WizardBase } from '../wizardBase';
import * as nls from 'vscode-nls';
import { Kubectl } from '../../kubectl/kubectl';

const localize = nls.loadMessageBundle();

export class CreateClusterWizard extends WizardBase<CreateClusterModel> {
	constructor(context: ExtensionContext, kubectl: Kubectl) {
		let model = new CreateClusterModel(kubectl);
		super(model, context, localize('bdc-create.wizardTitle', 'Create a big data cluster'));
	}

	protected initialize(): void {
		let settingsPage = new SettingsPage(this.model, this);
		let clusterProfilePage = new ClusterProfilePage(this.model, this);
		let selectTargetClusterPage = new SelectTargetClusterPage(this.model, this);
		let summaryPage = new SummaryPage(this.model, this);

		this.wizard.pages = [
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
