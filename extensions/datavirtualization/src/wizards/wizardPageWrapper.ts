/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { VirtualizeDataInput } from '../services/contracts';

export interface IWizardPageWrapper {
	// Returns underlying wizard page object.
	getPage(): azdata.window.WizardPage;

	// Called for the current page after clicking the Wizard's Next button.
	// Returns boolean indicating whether validation was successful and thus
	// if page can be changed.
	validate(): Promise<boolean>;

	// Updates the wizard page by retrieving current info from the backing data model.
	updatePage(): Promise<void>;

	// Adds this page's input contributions to the provided data input object
	getInputValues(existingInput: VirtualizeDataInput): void;
}
