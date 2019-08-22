/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo } from '../../../interfaces';
import { initializeWizardPage, Validator } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
const localize = nls.loadMessageBundle();

export class TargetClusterContextPage extends WizardPageBase<DeployClusterWizard> {
	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.TargetClusterContextPageTitle', "Target cluster context"), '', wizard);
	}

	protected initialize(): void {
		const validators: Validator[] = [];
		const sectionInfoArray: SectionInfo[] = [];
		initializeWizardPage(this.pageObject, this.wizard.wizardObject, sectionInfoArray, validators, this.wizard.InputComponents, this.wizard.toDispose);
	}
}
