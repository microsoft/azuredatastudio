/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo } from '../../../interfaces';
import { initializeWizardPage, Validator, InputComponents } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
const localize = nls.loadMessageBundle();

export class SummaryPage extends WizardPageBase<DeployClusterWizard> {
	private inputComponents: InputComponents = {};

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.summaryPageTitle', "Summary"), '', wizard);
	}

	protected initialize(): void {
		const validators: Validator[] = [];
		const sectionInfoArray: SectionInfo[] = [];
		initializeWizardPage(this.pageObject, this.wizard.wizardObject, sectionInfoArray, validators, this.inputComponents, this.wizard.toDispose);
	}
}
