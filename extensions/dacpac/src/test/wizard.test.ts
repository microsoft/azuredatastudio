/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as should from 'should';
import * as loc from '../localizedConstants';
import { DataTierApplicationWizard, Operation } from '../wizard/dataTierApplicationWizard';
import { DacFxDataModel } from '../wizard/api/models';

let wizard: DataTierApplicationWizard;
describe('Dacfx wizard', function (): void {
	beforeEach(async function (): Promise<void> {
		wizard = new DataTierApplicationWizard();
		wizard.model = <DacFxDataModel>{};
	});

	it('Should initialize wizard correctly', async () => {
		should.notEqual(wizard.wizard, undefined);
		should.equal(wizard.wizard.title, loc.wizardTitle);

		wizard.setPages();
		should.notEqual(wizard.pages, undefined);
		should.equal(wizard.pages.size, 7);
		should.equal(wizard.wizard.pages.length, 4);
	});

	it('Should determine summary page correctly', async () => {
		// summary page should be 2 for deploy
		wizard.selectedOperation = Operation.deploy;
		wizard.model.upgradeExisting = false;
		should.equal(wizard.isSummaryPage(2), true);

		// summary page should be 3 for deploy - upgrade existing db
		wizard.selectedOperation = Operation.deploy;
		wizard.model.upgradeExisting = true;
		should.equal(wizard.isSummaryPage(3), true);

		// summary page should be 3 for generate deploy script
		wizard.selectedOperation = Operation.generateDeployScript;
		should.equal(wizard.isSummaryPage(3), true);

		// summary page should be 2 for import
		wizard.selectedOperation = Operation.import;
		should.equal(wizard.isSummaryPage(2), true);

		// summary page should be 2 for export
		wizard.selectedOperation = Operation.export;
		should.equal(wizard.isSummaryPage(2), true);

		// summary page should be 2 for extract
		wizard.selectedOperation = Operation.extract;
		should.equal(wizard.isSummaryPage(2), true);
	});

	it('Should set Done button and operation correctly', async () => {
		wizard.setDoneButton(Operation.deploy);
		should.equal(wizard.selectedOperation, Operation.deploy);

		wizard.setDoneButton(Operation.generateDeployScript);
		should.equal(wizard.selectedOperation, Operation.generateDeployScript);

		wizard.setDoneButton(Operation.extract);
		should.equal(wizard.selectedOperation, Operation.extract);

		wizard.setDoneButton(Operation.import);
		should.equal(wizard.selectedOperation, Operation.import);

		wizard.setDoneButton(Operation.export);
		should.equal(wizard.selectedOperation, Operation.export);
	});
});
