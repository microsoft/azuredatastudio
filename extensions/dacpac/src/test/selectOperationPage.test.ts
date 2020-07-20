/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as should from 'should';
import * as loc from '../localizedConstants';
import { DataTierApplicationWizard, PageName } from '../wizard/dataTierApplicationWizard';
import { DacFxDataModel } from '../wizard/api/models';
import { TestContext, createContext } from './testContext';
import { TestSelectOperationPage } from './testDacFxConfigPages';

let wizard: DataTierApplicationWizard;
let testContext: TestContext;

describe('Dacpac Select OperationPage Tests', function (): void {
	beforeEach(async function (): Promise<void> {
		wizard = new DataTierApplicationWizard();
		wizard.model = <DacFxDataModel>{};
		wizard.model.server = undefined;
	});

	it('Select Operations Page should start correctly', async () => {
		testContext = createContext();
		wizard.setPages();

		const opPage: TestSelectOperationPage = new TestSelectOperationPage(wizard, wizard.pages.get(PageName.selectOperation).wizardPage, wizard.model, testContext.viewContext.view);
		const onPageStart = await opPage.start();
		const onPageEnter = await opPage.onPageEnter();
		should(onPageStart).equal(true);
		should(onPageEnter).equal(true);
		should(opPage.WizardState.wizard.pages.length).equal(4);

		should(opPage.WizardState.wizard.pages[1].title).equal(loc.deployConfigPageName);
		should(opPage.WizardState.wizard.pages[2].title).equal(loc.deployPlanPageName);
		should(opPage.WizardState.wizard.pages[3].title).equal(loc.summaryPageName);
	});

	it('Select Operations Page clicks should work correctly', async () => {
		testContext = createContext();
		wizard.setPages();

		const opPage: TestSelectOperationPage = new TestSelectOperationPage(wizard, wizard.pages.get(PageName.selectOperation).wizardPage, wizard.model, testContext.viewContext.view);
		await opPage.start();

		testContext.viewContext.extractOnClick.fire(undefined);
		should(opPage.WizardState.wizard.doneButton.label).equal(loc.extract);

		testContext.viewContext.exportOnClick.fire(undefined);
		should(opPage.WizardState.wizard.doneButton.label).equal(loc.exportText);

		testContext.viewContext.importOnClick.fire(undefined);
		should(opPage.WizardState.wizard.doneButton.label).equal(loc.importText);

		testContext.viewContext.deployOnClick.fire(undefined);
		should(opPage.WizardState.wizard.doneButton.label).equal(loc.deploy);
	});
});
