/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as should from 'should';
import * as loc from '../localizedConstants';
import { DataTierApplicationWizard, Operation } from '../wizard/dataTierApplicationWizard';

describe('Dacfx wizard', function (): void {
	it('Should initialize wizard correctly', async () => {
		let wizard = new DataTierApplicationWizard();
		should.notEqual(wizard.wizard, undefined);
		should.equal(wizard.wizard.title, loc.wizardTitle);

		wizard.setPages();
		should.notEqual(wizard.pages, undefined);
		should.equal(wizard.pages.size, 7);
		should.equal(wizard.wizard.pages.length, 4);

		wizard.setDoneButton(Operation.deploy);
		should.equal(wizard.selectedOperation, Operation.deploy);
	});
});
