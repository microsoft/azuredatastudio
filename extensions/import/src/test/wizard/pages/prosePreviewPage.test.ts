/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import { ApiWrapper } from '../../../common/apiWrapper';
import * as constants from '../../../common/constants';
import { FlatFileWizard } from '../../../wizard/flatFileWizard';
import * as should from 'should';
import { ImportDataModel } from '../../../wizard/api/models';
import { TestImportDataModel } from '../../utils.test';
import { ImportPage } from '../../../wizard/api/importPage';
import { ProsePreviewPage } from '../../../wizard/pages/prosePreviewPage';

describe('import extension prose preview tests', function () {
	let wizard: azdata.window.Wizard;
	let page: azdata.window.WizardPage;
	let prosePreviewPage: ProsePreviewPage;
	let mockFlatFileWizard: TypeMoq.IMock<FlatFileWizard>;
	let mockImportModel: TypeMoq.IMock<ImportDataModel>;
	let apiWrapper: ApiWrapper;
	let pages: Map<number, ImportPage> = new Map<number, ImportPage>();

	beforeEach(async function () {
		apiWrapper = new ApiWrapper();
		mockFlatFileWizard = TypeMoq.Mock.ofType(FlatFileWizard, TypeMoq.MockBehavior.Loose, undefined, TypeMoq.It.isAny(), apiWrapper);
		mockImportModel = TypeMoq.Mock.ofType(TestImportDataModel, TypeMoq.MockBehavior.Loose);
		wizard = apiWrapper.createWizard(constants.wizardNameText);
		page = apiWrapper.createWizardPage(constants.page3NameText);

	});

	it('checking if all components are initialized properly', async function () {
		await new Promise(function (resolve) {
			page.registerContent(async (view) => {
				prosePreviewPage = new ProsePreviewPage(mockFlatFileWizard.object, page, mockImportModel.object, view, TypeMoq.It.isAny(), apiWrapper);
				pages.set(1, prosePreviewPage);
				await prosePreviewPage.start().then(async() => {
					await prosePreviewPage.setupNavigationValidator();
					await prosePreviewPage.onPageEnter();
					resolve();
				});
			});
			wizard.generateScriptButton.hidden = true;

			wizard.pages = [page];
			wizard.open();
		});
		should.notEqual(prosePreviewPage.table, undefined);
		should.notEqual(prosePreviewPage.refresh, undefined);
		should.notEqual(prosePreviewPage.loading, undefined);
		should.notEqual(prosePreviewPage.form, undefined);
		should.notEqual(prosePreviewPage.resultTextComponent, undefined);

		await prosePreviewPage.onPageLeave();
		await prosePreviewPage.cleanup();
	});
});
