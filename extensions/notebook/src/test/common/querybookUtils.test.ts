/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import 'mocha';

import * as notebookUtils from '../../common/notebookUtils';

describe('Random Token', () => {
	it('Should have default length and be hex only', async function (): Promise<void> {

		let token = await notebookUtils.getRandomToken();
		should(token).have.length(48);
		let validChars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
		for (let i = 0; i < token.length; i++) {
			let char = token.charAt(i);
			should(validChars.indexOf(char)).be.greaterThan(-1);
		}
	});
});
