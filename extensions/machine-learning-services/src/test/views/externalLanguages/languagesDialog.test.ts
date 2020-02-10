/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import { createContext } from './utils';
import { LanguagesDialog } from '../../../views/externalLanguages/languagesDialog';

describe('External Languages Dialog', () => {
	it('Should open dialog successfully ', async function (): Promise<void> {
		let testContext = createContext();
		let dialog = new LanguagesDialog(testContext.apiWrapper.object, '');
		dialog.showDialog();
		should.notEqual(dialog.addNewLanguageTab, undefined);
		should.notEqual(dialog.currentLanguagesTab, undefined);
	});
});
