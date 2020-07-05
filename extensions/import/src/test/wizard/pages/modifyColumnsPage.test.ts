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
import { ImportPage } from '../../../wizard/api/importPage';
// import { FlatFileProvider, PROSEDiscoveryParams, InsertDataParams, GetColumnInfoParams, ChangeColumnSettingsParams } from '../../../services/contracts';

describe('import extension modify Column Page', function () {
	let wizard: azdata.window.Wizard;
	let page: azdata.window.WizardPage;
	let modifyColumnsPage: ModifyColumnsPage;
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
				modifyColumnsPage = new ModifyColumnsPage(mockFlatFileWizard.object, page, mockImportModel.object, view, TypeMoq.It.isAny(), apiWrapper);
				pages.set(1, modifyColumnsPage);
				await modifyColumnsPage.start().then(() => {
					modifyColumnsPage.setupNavigationValidator();
					modifyColumnsPage.onPageEnter();
					resolve();
				});
			});
			wizard.generateScriptButton.hidden = true;

			wizard.pages = [page];
			wizard.open();
		});
		should.notEqual(modifyColumnsPage.table, undefined);
		should.notEqual(modifyColumnsPage.text, undefined);
		should.notEqual(modifyColumnsPage.loading, undefined);
		should.notEqual(modifyColumnsPage.form, undefined);
	});

	it('handleImport updates table value correctly when import is successful', async function() {

	});

});

// class TestFlatFileProvider implements FlatFileProvider{
// 	providerId?: string;
// 	sendPROSEDiscoveryRequest(params: PROSEDiscoveryParams): Thenable<import("../../../services/contracts").PROSEDiscoveryResponse> {
// 		throw new Error('Method not implemented.');
// 	}
// 	sendInsertDataRequest(params: InsertDataParams): Thenable<import("../../../services/contracts").InsertDataResponse> {
// 		throw new Error('Method not implemented.');
// 	}
// 	sendGetColumnInfoRequest(params: GetColumnInfoParams): Thenable<import("../../../services/contracts").GetColumnInfoResponse> {
// 		throw new Error('Method not implemented.');
// 	}
// 	sendChangeColumnSettingsRequest(params: ChangeColumnSettingsParams): Thenable<import("../../../services/contracts").ChangeColumnSettingsResponse> {
// 		throw new Error('Method not implemented.');
// 	}

// }
