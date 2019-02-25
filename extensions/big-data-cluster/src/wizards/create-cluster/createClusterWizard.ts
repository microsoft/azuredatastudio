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
import { ExtensionContext } from 'vscode';
import { WizardBase } from '../wizardBase';
import * as nls from 'vscode-nls';
import { Kubectl } from '../../kubectl/kubectl';
import { SelectTargetClusterTypePage } from './pages/selectTargetClusterTypePage';

const localize = nls.loadMessageBundle();

export class CreateClusterWizard extends WizardBase<CreateClusterModel, CreateClusterWizard> {
	constructor(context: ExtensionContext, kubectl: Kubectl) {
		let model = new CreateClusterModel(kubectl);
		super(model, context, localize('bdc-create.wizardTitle', 'Create a big data cluster'));
	}

	protected initialize(): void {
		let settingsPage = new SettingsPage(this);
		let clusterProfilePage = new ClusterProfilePage(this);
		let selectTargetClusterPage = new SelectExistingClusterPage(this);
		let summaryPage = new SummaryPage(this);
		let targetClusterTypePage = new SelectTargetClusterTypePage(this);
		this.setPages([targetClusterTypePage, settingsPage, clusterProfilePage, selectTargetClusterPage, summaryPage]);

		this.wizardObject.generateScriptButton.label = localize('bdc-create.generateScriptsButtonText', 'Generate Scripts');
		this.wizardObject.generateScriptButton.hidden = true;
		this.wizardObject.doneButton.label = localize('bdc-create.createClusterButtonText', 'Create');

		this.wizardObject.generateScriptButton.onClick(() => { });
		this.wizardObject.doneButton.onClick(() => { });
	}
}
