/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import { createContext, ParentDialog } from './utils';
import { LanguageEditDialog } from '../../../views/externalLanguages/languageEditDialog';
import { LanguageUpdateModel } from '../../../views/externalLanguages/languageViewBase';

describe('Edit External Languages Dialog', () => {
	it('Should open dialog successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);
		let languageUpdateModel: LanguageUpdateModel = {
			content: parent.createNewContent(),
			language: parent.createNewLanguage(),
			newLang: true
		};
		let dialog = new LanguageEditDialog(testContext.apiWrapper.object, parent, languageUpdateModel);
		dialog.showDialog();
		should.notEqual(dialog.addNewLanguageTab, undefined);
	});

	it('Should raise save event if save button clicked ', async function (): Promise<void> {
		let testContext = createContext();
		let parent = new ParentDialog(testContext.apiWrapper.object);
		let languageUpdateModel: LanguageUpdateModel = {
			content: parent.createNewContent(),
			language: parent.createNewLanguage(),
			newLang: true
		};
		let dialog = new LanguageEditDialog(testContext.apiWrapper.object, parent, languageUpdateModel);
		dialog.showDialog();

		let updateCalled = false;
		let promise = new Promise(resolve => {
			parent.onUpdate(() => {
				updateCalled = true;
				parent.onUpdatedLanguage(languageUpdateModel);
				resolve();
			});
		});

		dialog.onSave();
		await promise;
		should.equal(updateCalled, true);
	});
});
