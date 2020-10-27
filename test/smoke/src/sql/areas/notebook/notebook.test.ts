/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../../../../automation';

export function setup() {
	describe('Notebook', () => {

		it('can open new notebook, configure Python, and execute one cell', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.newUntitledNotebook();
			await app.workbench.sqlNotebook.addCell('code');
			await app.workbench.sqlNotebook.waitForTypeInEditor('print("Hello world!")');

			await app.workbench.sqlNotebook.changeKernel('Python 3');
			await app.workbench.configurePythonDialog.waitForConfigurePythonDialog();
			await app.workbench.configurePythonDialog.installPython();
			await app.workbench.sqlNotebook.waitForKernel('Python 3');

			await app.workbench.sqlNotebook.runActiveCell();
			await app.workbench.sqlNotebook.waitForResults();
		});

		it('can open ipynb file, run all, and save notebook with outputs', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.openFile('hello.ipynb');
			await app.workbench.sqlNotebook.waitForKernel('Python 3');

			await app.workbench.sqlNotebook.clearResults();
			await app.workbench.sqlNotebook.waitForAllResultsGone([1, 2, 3]);
			await app.workbench.sqlNotebook.runAllCells();
			await app.workbench.sqlNotebook.waitForAllResults([1, 2, 3]);

			await app.workbench.quickaccess.runCommand('workbench.action.files.save');
			await app.workbench.quickaccess.runCommand('workbench.action.closeActiveEditor');

			await app.workbench.sqlNotebook.openFile('hello.ipynb');
			await app.workbench.sqlNotebook.waitForKernel('Python 3');
			// The cell ids increase by one after closing and reopening notebook
			await app.workbench.sqlNotebook.waitForAllResults([4, 5, 6]);
		});
	});
}
