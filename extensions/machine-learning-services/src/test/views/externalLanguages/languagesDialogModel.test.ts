/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import { createContext } from './utils';
import * as mssql from '../../../../../mssql';
import { LanguageService } from '../../../externalLanguage/languageService';

describe('External Languages Dialog Model', () => {
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
		testContext.languageExtensionService.listLanguages = () => {return Promise.resolve(languages);};
		let model = new LanguageService(testContext.apiWrapper.object, testContext.languageExtensionService);
		await model.load();
		let actual = await model.getLanguageList();
		should.deepEqual(actual, languages);
	});

	it('Should update language successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let language: mssql.ExternalLanguage  = {
			name: '',
			contents: [{
				extensionFileName: '',
				isLocalFile: true,
				pathToExtension: '',
			}]
		};

		let model = new LanguageService(testContext.apiWrapper.object, testContext.languageExtensionService);
		await model.load();
		await should(model.updateLanguage(language)).resolved();
	});

	it('Should delete language successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let language: mssql.ExternalLanguage  = {
			name: '',
			contents: [{
				extensionFileName: '',
				isLocalFile: true,
				pathToExtension: '',
			}]
		};

		let model = new LanguageService(testContext.apiWrapper.object, testContext.languageExtensionService);
		await model.load();
		await should(model.deleteLanguage(language.name)).resolved();
	});
});
