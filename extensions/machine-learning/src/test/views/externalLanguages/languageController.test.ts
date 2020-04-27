/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import * as TypeMoq from 'typemoq';
import { createContext } from './utils';
import { LanguageController } from '../../../views/externalLanguages/languageController';
import * as mssql from '../../../../../mssql';

describe('External Languages Controller', () => {
	it('Should open dialog for manage languages successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let controller = new LanguageController(testContext.apiWrapper.object, '', testContext.dialogModel.object);
		let dialog = await controller.manageLanguages();
		testContext.apiWrapper.verify(x => x.openDialog(TypeMoq.It.isAny()), TypeMoq.Times.once());
		should.notEqual(dialog, undefined);
	});

	it('Should list languages successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let languages: mssql.ExternalLanguage[]  = [{
			name: '',
			contents: [{
				extensionFileName: '',
				isLocalFile: true,
				pathToExtension: '',
			}]
		}];

		testContext.dialogModel.setup( x=> x.getLanguageList()).returns(() => Promise.resolve(languages));
		let controller = new LanguageController(testContext.apiWrapper.object, '', testContext.dialogModel.object);
		let dialog = await controller.manageLanguages();
		let actual = await dialog.listLanguages();
		should.deepEqual(actual, languages);
	});

	it('Should update languages successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let language: mssql.ExternalLanguage = {
			name: '',
			contents: [{
				extensionFileName: '',
				isLocalFile: true,
				pathToExtension: '',
			}]
		};

		testContext.dialogModel.setup( x=> x.updateLanguage(language)).returns(() => Promise.resolve());
		let controller = new LanguageController(testContext.apiWrapper.object, '', testContext.dialogModel.object);
		let dialog = await controller.manageLanguages();
		await dialog.updateLanguage({
			language: language,
			content: language.contents[0],
			newLang: false
		});
		testContext.dialogModel.verify(x => x.updateLanguage(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	it('Should delete language successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let language: mssql.ExternalLanguage = {
			name: '',
			contents: [{
				extensionFileName: '',
				isLocalFile: true,
				pathToExtension: '',
			}]
		};

		testContext.dialogModel.setup( x=> x.deleteLanguage(language.name)).returns(() => Promise.resolve());
		let controller = new LanguageController(testContext.apiWrapper.object, '', testContext.dialogModel.object);
		let dialog = await controller.manageLanguages();
		await dialog.deleteLanguage({
			language: language,
			content: language.contents[0],
			newLang: false
		});
		testContext.dialogModel.verify(x => x.deleteLanguage(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	it('Should open edit dialog for edit language', async function (): Promise<void> {
		let testContext = createContext();
		let language: mssql.ExternalLanguage = {
			name: '',
			contents: [{
				extensionFileName: '',
				isLocalFile: true,
				pathToExtension: '',
			}]
		};
		let controller = new LanguageController(testContext.apiWrapper.object, '', testContext.dialogModel.object);
		let dialog = await controller.manageLanguages();
		dialog.onEditLanguage({
			language: language,
			content: language.contents[0],
			newLang: false
		});
		testContext.apiWrapper.verify(x => x.openDialog(TypeMoq.It.isAny()), TypeMoq.Times.exactly(2));
		should.notEqual(dialog, undefined);
	});
});
