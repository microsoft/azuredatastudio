/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { assert } from 'console';
import { Application } from '../../../../../automation';
import * as minimist from 'minimist';
import { afterSuite, beforeSuite } from '../../../utils';

export function setup(opts: minimist.ParsedArgs) {
	describe('NotebookTreeView', () => {
		beforeSuite(opts);
		afterSuite(opts);

		it('Pin a notebook', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.view.focusNotebooksView();
			const notebookIds = await app.workbench.sqlNotebook.view.getNotebookTreeItemIds();
			// Pinning SQL notebook to prevent the Configure Python Wizard from showing, since Python is no longer set up when the NotebookTreeView test suite starts
			await app.workbench.sqlNotebook.view.pinNotebook(notebookIds[1]);
			await app.workbench.sqlNotebook.view.waitForPinnedNotebookTreeView();
		});

		it('Unpin Notebook', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.view.focusPinnedNotebooksView();
			const notebookIds = await app.workbench.sqlNotebook.view.getNotebookTreeItemIds();
			await app.workbench.sqlNotebook.view.unpinNotebook(notebookIds[0]);
		});

		it('No search results if search query is empty', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.view.focusSearchResultsView();
			const results = await app.workbench.sqlNotebook.view.searchInNotebook('');
			assert(results.children !== undefined && results.children.length === 0);
		});

		it('Simple query search works correctly', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.view.focusSearchResultsView();
			// Adding a regex expression to not depend on specific results of files
			const regexExpr = /[0-9]+( results? in )[0-9]+( files?)/;
			const results = await app.workbench.sqlNotebook.view.searchInNotebook('hello');
			assert(results.textContent !== '' && results.textContent.match(regexExpr));
		});
	});
}
