/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import * as constants from '../../../common/constants';
import { FlatFileWizard } from '../../../wizard/flatFileWizard';
import * as should from 'should';
import { ImportDataModel } from '../../../wizard/api/models';
import { TestImportDataModel } from '../../utils.test';
import { ImportPage } from '../../../wizard/api/importPage';
import { ProsePreviewPage } from '../../../wizard/pages/prosePreviewPage';

describe('import extension prose preview tests', function () {

	// declaring mock variables
	let mockFlatFileWizard: TypeMoq.IMock<FlatFileWizard>;
	let mockImportModel: TypeMoq.IMock<ImportDataModel>;

	// declaring instance variables
	let wizard: azdata.window.Wizard;
	let page: azdata.window.WizardPage;
	let pages: Map<number, ImportPage> = new Map<number, ImportPage>();
	let prosePreviewPage: ProsePreviewPage;


	beforeEach(async function () {

		// initializing mock variables
		mockFlatFileWizard = TypeMoq.Mock.ofType(FlatFileWizard, TypeMoq.MockBehavior.Loose, undefined, TypeMoq.It.isAny());
		mockImportModel = TypeMoq.Mock.ofType(TestImportDataModel, TypeMoq.MockBehavior.Loose);

		// creating a wizard and adding page that will contain the fileConfigPage
		wizard = azdata.window.createWizard(constants.wizardNameText);
		page = azdata.window.createWizardPage(constants.page2NameText);

	});

	it('checking if all components are initialized properly', async function () {

		// Opening the wizard and initializing the page as ProsePreviewPage
		await new Promise(function (resolve) {
			page.registerContent(async (view) => {
				prosePreviewPage = new ProsePreviewPage(mockFlatFileWizard.object, page, mockImportModel.object, view, TypeMoq.It.isAny());
				pages.set(1, prosePreviewPage);
				await prosePreviewPage.start();
				await prosePreviewPage.setupNavigationValidator();
				await prosePreviewPage.onPageEnter();
				resolve();
			});
			wizard.generateScriptButton.hidden = true;
			wizard.pages = [page];
			wizard.open();
		});

		// checking if all the required components are correctly initialized
		should.notEqual(prosePreviewPage.table, undefined, 'table should not be undefined');
		should.notEqual(prosePreviewPage.refresh, undefined, 'refresh should not be undefined');
		should.notEqual(prosePreviewPage.loading, undefined, 'loading should not be undefined');
		should.notEqual(prosePreviewPage.form, undefined, 'form should not be undefined');
		should.notEqual(prosePreviewPage.resultTextComponent, undefined, 'resultTextComponent should not be undefined');

		// calling the clean up code
		await prosePreviewPage.onPageLeave();
		await prosePreviewPage.cleanup();
	});
});
