/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLDBWizard } from '../deployAzureSQLDBWizard';
import { DeployAzureSQLDBWizardModel } from '../deployAzureSQLDBWizardModel';

export abstract class BasePage extends WizardPageBase<DeployAzureSQLDBWizard, DeployAzureSQLDBWizardModel> {
	public abstract initialize(): void;
}
