/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as should from 'should';
import { DataTierApplicationWizard, PageName, Operation } from '../wizard/dataTierApplicationWizard';
import { DacFxDataModel } from '../wizard/api/models';
import { TestContext, createContext } from './testContext';
import { TestDacFxSummaryPage } from './testDacFxConfigPages';

let wizard: DataTierApplicationWizard;
let testContext: TestContext;

describe('DacFx Summary Page Tests', function (): void {
	beforeEach(async function (): Promise<void> {
		wizard = new DataTierApplicationWizard();
		wizard.model = <DacFxDataModel>{};
		wizard.model.server = undefined;
		wizard.setPages();
		wizard.configureButtons();
		testContext = createContext();
	});

	it('DacFx Summary Page should start correctly for deploying to an existing database', async () => {
		wizard.selectedOperation = Operation.deploy;
		wizard.model.upgradeExisting = true;

		const summaryPage = await validatePageCreation();
		should(summaryPage.WizardState.wizard.generateScriptButton.hidden).equal(false, 'Generate script button should not be hidden when the operation is deploy and upgrade existing is true');
		await validateOnPageLeave(summaryPage);
	});

	it('DacFx Summary Page should start correctly for deploying to a new database', async () => {
		wizard.selectedOperation = Operation.deploy;
		wizard.model.upgradeExisting = false;

		const summaryPage = await validatePageCreation();
		should(summaryPage.WizardState.wizard.generateScriptButton.hidden).equal(true, 'Generate script button should be hidden when deploying to a new database');
		await validateOnPageLeave(summaryPage);
	});

	it('DacFx Summary Page should start correctly for extract', async () => {
		wizard.selectedOperation = Operation.extract;

		const summaryPage = await validatePageCreation();
		should(summaryPage.WizardState.wizard.generateScriptButton.hidden).equal(true, 'Generate script button should be hidden when extracting');
		await validateOnPageLeave(summaryPage);
	});

	it('DacFx Summary Page should start correctly for import', async () => {
		wizard.selectedOperation = Operation.import;

		const summaryPage = await validatePageCreation();
		should(summaryPage.WizardState.wizard.generateScriptButton.hidden).equal(true, 'Generate script button should be hidden when importing');
		await validateOnPageLeave(summaryPage);
	});

	it('DacFx Summary Page should start correctly for exporting', async () => {
		wizard.selectedOperation = Operation.export;

		const summaryPage = await validatePageCreation();
		should(summaryPage.WizardState.wizard.generateScriptButton.hidden).equal(true, 'Generate script button should be hidden when exporting');
		await validateOnPageLeave(summaryPage);
	});

	async function validatePageCreation(): Promise<TestDacFxSummaryPage> {
		const summaryPage: TestDacFxSummaryPage = new TestDacFxSummaryPage(wizard, wizard.pages.get(PageName.selectOperation).wizardPage, wizard.model, testContext.viewContext.view);
		const onPageStart = await summaryPage.start();
		const onPageEnter = await summaryPage.onPageEnter();
		should(onPageStart).equal(true);
		should(onPageEnter).equal(true);
		should(summaryPage.data).not.equal(undefined);
		should(summaryPage.data.length).equal(summaryPage.WizardState.selectedOperation === Operation.extract ? 4 : 3);

		return summaryPage;
	}

	async function validateOnPageLeave(summaryPage: TestDacFxSummaryPage): Promise<void> {
		const onPageLeave = await summaryPage.onPageLeave();
		should(onPageLeave).equal(true);
		should(summaryPage.WizardState.wizard.generateScriptButton.hidden).equal(true, 'Generate Script button should be hidden when leaving the summary page');
	}
});
