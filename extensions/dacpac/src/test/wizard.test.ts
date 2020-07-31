/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as should from 'should';
import * as loc from '../localizedConstants';
import { DataTierApplicationWizard, Operation, PageName } from '../wizard/dataTierApplicationWizard';
import { DacFxDataModel } from '../wizard/api/models';
import { TestContext, createContext } from './testContext';
import { DeployConfigPage } from '../wizard/pages/deployConfigPage';
import { ExportConfigPage } from '../wizard/pages/exportConfigPage';
import { ExtractConfigPage } from '../wizard/pages/extractConfigPage';
import { ImportConfigPage } from '../wizard/pages/importConfigPage';
import { DacFxSummaryPage } from '../wizard/pages/dacFxSummaryPage';
import { SelectOperationPage } from '../wizard/pages/selectOperationpage';
import { DeployPlanPage } from '../wizard/pages/deployPlanPage';
import { BasePage } from '../wizard/api/basePage';

let wizard: DataTierApplicationWizard;
let testContext: TestContext;

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

		should.equal(wizard.pages.get(PageName.selectOperation).wizardPage.title, loc.selectOperationPageName);
	});

	it('Should initialize wizard with correct page order', async () => {
		wizard.setPages();

		wizard.selectedOperation = Operation.deploy;
		should.equal(wizard.getPage(1), wizard.pages.get(PageName.deployConfig));
		wizard.model.upgradeExisting = false;
		should.equal(wizard.getPage(2), wizard.pages.get(PageName.summary));
		wizard.model.upgradeExisting = true;
		should.equal(wizard.getPage(2), wizard.pages.get(PageName.deployPlan));
		should.equal(wizard.getPage(3), wizard.pages.get(PageName.summary));

		wizard.selectedOperation = Operation.export;
		should.equal(wizard.getPage(1), wizard.pages.get(PageName.exportConfig));
		should.equal(wizard.getPage(2), wizard.pages.get(PageName.summary));

		wizard.selectedOperation = Operation.extract;
		should.equal(wizard.getPage(1), wizard.pages.get(PageName.extractConfig));
		should.equal(wizard.getPage(2), wizard.pages.get(PageName.summary));

		wizard.selectedOperation = Operation.import;
		should.equal(wizard.getPage(1), wizard.pages.get(PageName.importConfig));
		should.equal(wizard.getPage(2), wizard.pages.get(PageName.summary));
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

		wizard.setDoneButton(Operation.extract);
		should.equal(wizard.selectedOperation, Operation.extract);

		wizard.setDoneButton(Operation.import);
		should.equal(wizard.selectedOperation, Operation.import);

		wizard.setDoneButton(Operation.export);
		should.equal(wizard.selectedOperation, Operation.export);
	});

	it('Should start all pages - Set 1', async () => {
		testContext = createContext();
		wizard.setPages();

		let selectOperationPage = new SelectOperationPage(wizard, wizard.pages.get(PageName.selectOperation).wizardPage, wizard.model, testContext.viewContext.view);
		await validateStartPage(selectOperationPage);

		let deployConfigPage = new DeployConfigPage(wizard, wizard.pages.get(PageName.deployConfig).wizardPage, wizard.model, testContext.viewContext.view);
		await validateStartPage(deployConfigPage);

		let deployPlanPage = new DeployPlanPage(wizard, wizard.pages.get(PageName.deployPlan).wizardPage, wizard.model, testContext.viewContext.view);
		await validateStartPage(deployPlanPage);

		let dacFxSummaryPage = new DacFxSummaryPage(wizard, wizard.pages.get(PageName.summary).wizardPage, wizard.model, testContext.viewContext.view);
		await validateStartPage(dacFxSummaryPage);

	});

	it('Should start all pages - Set 2', async () => {
		testContext = createContext();
		wizard.setPages();

		let exportConfigPage = new ExportConfigPage(wizard, wizard.pages.get(PageName.exportConfig).wizardPage, wizard.model, testContext.viewContext.view);
		await validateStartPage(exportConfigPage);

		let extractConfigPage = new ExtractConfigPage(wizard, wizard.pages.get(PageName.exportConfig).wizardPage, wizard.model, testContext.viewContext.view);
		await validateStartPage(extractConfigPage);

		let importConfigPage = new ImportConfigPage(wizard, wizard.pages.get(PageName.importConfig).wizardPage, wizard.model, testContext.viewContext.view);
		await validateStartPage(importConfigPage);
	});

	async function validateStartPage(page: BasePage) : Promise<void> {
		let result = false;
		result = await page.start();
		should.equal(result, true);
	}
});
