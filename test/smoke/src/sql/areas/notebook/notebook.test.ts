/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../../../../automation';

export function setup() {
	describe('Notebook', () => {
		it('open ', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebbok.openFile('hello.ipynb');
		});
	});
}
