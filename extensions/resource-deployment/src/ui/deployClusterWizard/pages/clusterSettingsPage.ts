/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployClusterWizard } from '../deployClusterWizard';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class ClusterSettingsPage extends WizardPageBase<DeployClusterWizard> {
	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.ClusterSettingsPageTitle', "Cluster settings"), '', wizard);
	}

	protected initialize(view: azdata.ModelView): Thenable<void> {
		const form = view.modelBuilder.formContainer().withFormItems([]).component();
		return view.initializeModel(form);
	}
}
