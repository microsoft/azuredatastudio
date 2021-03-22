/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { assert } from 'console';
import { Application } from '../../../../../automation';

export function setup() {
	describe('NotebookView', () => {

		it('No search results if search query is empty', async function () {
			const app = this.app as Application;
			await app.workbench.quickaccess.runCommand('Notebooks: Focus on Search Results View');
			const results = await app.workbench.sqlNotebook.view.searchInNotebook('');
			assert(results.children !== undefined && results.children.length === 0);
		});

		it('Simple query search works correctly', async function () {
			const app = this.app as Application;
			// Adding a regex expression to not depend on specific results of files
			const regexExpr = /[0-9]+( results in )[0-9]+( files)/;
			await app.workbench.quickaccess.runCommand('Notebooks: Focus on Search Results View');
			const results = await app.workbench.sqlNotebook.view.searchInNotebook('hello');
			assert(results.textContent !== '' && results.textContent.match(regexExpr));
		});
	});
}
