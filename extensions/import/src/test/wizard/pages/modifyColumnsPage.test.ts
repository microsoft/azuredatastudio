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
import { ModifyColumnsPage } from '../../../wizard/pages/modifyColumnsPage';
import { ImportDataModel } from '../../../wizard/api/models';
import { TestImportDataModel } from '../../utils.test';

describe('import extension modify Column Page', function () {
	let _apiWrapper: ApiWrapper;
	let page1: azdata.window.WizardPage;
	let modifyColumnPage: ModifyColumnsPage;
	let mockFlatFileWizard: TypeMoq.IMock<FlatFileWizard>;
	let mockImportModel: TypeMoq.IMock<ImportDataModel>;

	beforeEach(function () {
		// Creating the page Wizard
		_apiWrapper = new ApiWrapper();
		page1 = this._apiWrapper.createWizardPage(constants.page1NameText);
		mockFlatFileWizard = TypeMoq.Mock.ofType(FlatFileWizard, TypeMoq.MockBehavior.Loose, undefined, TypeMoq.It.isAny(), _apiWrapper);
		mockImportModel = TypeMoq.Mock.ofType(TestImportDataModel, TypeMoq.MockBehavior.Loose);
		page1.registerContent(async (view: any) => {
			modifyColumnPage = new ModifyColumnsPage(mockFlatFileWizard.object, this.page1, mockImportModel.object, view, this.provider, _apiWrapper);
		});


	});

	describe('checking if all components are initialized properly', async function () {
		await modifyColumnPage.start().then(() => {
			modifyColumnPage.setupNavigationValidator();
			modifyColumnPage.onPageEnter();
		});
		should.notEqual(modifyColumnPage.table, undefined);
		should.notEqual(modifyColumnPage.text, undefined);
		should.notEqual(modifyColumnPage.loading, undefined);
		should.notEqual(modifyColumnPage.form, undefined);
	});
});
