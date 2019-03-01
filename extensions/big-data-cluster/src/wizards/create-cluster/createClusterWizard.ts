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
import { ScriptGenerator } from '../../scripting/scripting';
const localize = nls.loadMessageBundle();

export class CreateClusterWizard extends WizardBase<CreateClusterModel, CreateClusterWizard> {
	private scripter : ScriptGenerator;
	constructor(context: ExtensionContext, kubectl: Kubectl) {
		let model = new CreateClusterModel(kubectl);
		super(model, context, localize('bdc-create.wizardTitle', 'Create a big data cluster'));
		this.scripter = new ScriptGenerator(kubectl);
	}

	protected initialize(): void {
		let settingsPage = new SettingsPage(this);
		let clusterProfilePage = new ClusterProfilePage(this);
		let selectTargetClusterPage = new SelectExistingClusterPage(this);
		let summaryPage = new SummaryPage(this);
		let targetClusterTypePage = new SelectTargetClusterTypePage(this);
		this.setPages([targetClusterTypePage, selectTargetClusterPage, clusterProfilePage, settingsPage, summaryPage]);

		this.wizardObject.generateScriptButton.label = localize('bdc-create.generateScriptsButtonText', 'Generate Scripts');
		this.wizardObject.generateScriptButton.hidden = false;
		this.wizardObject.doneButton.label = localize('bdc-create.createClusterButtonText', 'Create');

		this.wizardObject.generateScriptButton.onClick(async () => {
															this.wizardObject.generateScriptButton.enabled = false;
															this.scripter.generateDeploymentScript(this.model).then( () => {
																this.wizardObject.generateScriptButton.enabled = true;
																//TODO: Add error handling.
															});
														});
		this.wizardObject.doneButton.onClick(() => { });
	}
}
