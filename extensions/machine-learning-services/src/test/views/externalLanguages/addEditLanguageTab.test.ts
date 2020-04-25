/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import { createContext, ParentDialog } from './utils';
import { AddEditLanguageTab } from '../../../views/externalLanguages/addEditLanguageTab';
import { LanguageUpdateModel } from '../../../views/externalLanguages/languageViewBase';

describe('Add Edit External Languages Tab', () => {
	it('Should create AddEditLanguageTab for new language successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);
		let languageUpdateModel: LanguageUpdateModel = {
			content: parent.createNewContent(),
			language: parent.createNewLanguage(),
			newLang: true
		};
		let tab = new AddEditLanguageTab(testContext.apiWrapper.object, parent, languageUpdateModel);
		should.notEqual(tab.languageView, undefined, 'Failed to create language view for add');
	});

	it('Should create AddEditLanguageTab for edit successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);
		let languageUpdateModel: LanguageUpdateModel = {
			content: {
				extensionFileName: 'filename',
				isLocalFile: true,
				pathToExtension: 'path',
			},
			language: {
				name: 'name',
				contents: []
			},
			newLang: false
		};
		let tab = new AddEditLanguageTab(testContext.apiWrapper.object, parent, languageUpdateModel);
		should.notEqual(tab.languageView, undefined, 'Failed to create language view for edit');
		should.equal(tab.saveButton, undefined);
	});

	it('Should reset AddEditLanguageTab successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);
		let languageUpdateModel: LanguageUpdateModel = {
			content: {
				extensionFileName: 'filename',
				isLocalFile: true,
				pathToExtension: 'path',
			},
			language: {
				name: 'name',
				contents: []
			},
			newLang: false
		};
		let tab = new AddEditLanguageTab(testContext.apiWrapper.object, parent, languageUpdateModel);
		if (tab.languageName) {
			tab.languageName.value = 'some value';
		}
		await tab.reset();
		should.equal(tab.languageName?.value, 'name');
	});

	it('Should load content successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);
		let languageUpdateModel: LanguageUpdateModel = {
			content: {
				extensionFileName: 'filename',
				isLocalFile: true,
				pathToExtension: 'path',
				environmentVariables: 'env vars',
				parameters: 'params'
			},
			language: {
				name: 'name',
				contents: []
			},
			newLang: false
		};
		let tab = new AddEditLanguageTab(testContext.apiWrapper.object, parent, languageUpdateModel);
		let content = tab.languageView?.updatedContent;
		should.notEqual(content, undefined);
		if (content) {
			should.equal(content.extensionFileName, languageUpdateModel.content.extensionFileName);
			should.equal(content.pathToExtension, languageUpdateModel.content.pathToExtension);
			should.equal(content.environmentVariables, languageUpdateModel.content.environmentVariables);
			should.equal(content.parameters, languageUpdateModel.content.parameters);
		}
	});

	it('Should raise save event if save button clicked ', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);
		let languageUpdateModel: LanguageUpdateModel = {
			content: parent.createNewContent(),
			language: parent.createNewLanguage(),
			newLang: true
		};
		let tab = new AddEditLanguageTab(testContext.apiWrapper.object, parent, languageUpdateModel);
		should.notEqual(tab.saveButton, undefined);
		let updateCalled = false;
		let promise = new Promise(resolve => {
			parent.onUpdate(() => {
				updateCalled = true;
				resolve();
			});
		});

		testContext.onClick.fire(undefined);
		parent.onUpdatedLanguage(languageUpdateModel);
		await promise;
		should.equal(updateCalled, true);
		should.notEqual(tab.updatedData, undefined);
	});
});
