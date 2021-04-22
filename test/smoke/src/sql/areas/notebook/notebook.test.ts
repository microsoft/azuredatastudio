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
			await app.workbench.sqlNotebook.waitForKernel('SQL');

			await app.workbench.sqlNotebook.changeKernel('Python 3');
			await app.workbench.configurePythonDialog.waitForConfigurePythonDialog();
			await app.workbench.configurePythonDialog.installPython();
			await app.workbench.sqlNotebook.waitForKernel('Python 3');

			await app.workbench.sqlNotebook.runActiveCell();
			await app.workbench.sqlNotebook.waitForActiveCellResults();
		});

		it('can open ipynb file, run all, and save notebook with outputs', async function () {
			const app = this.app as Application;
			await openAndRunNotebook(app, 'hello.ipynb');
		});

		it('can open ipynb file from path with spaces, run all, and save notebook with outputs', async function () {
			const app = this.app as Application;
			await openAndRunNotebook(app, 'helloWithSpaces.ipynb');
		});

		it('can open ipynb file from path with escaped spaces, run all, and save notebook with outputs', async function () {
			const app = this.app as Application;
			await openAndRunNotebook(app, 'helloWithEscapedSpaces.ipynb');
		});

		it('can open untrusted notebook, trust, save, and reopen trusted notebook', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.openFile('untrusted.ipynb');
			await app.workbench.sqlNotebook.waitForKernel('SQL');
			await app.workbench.sqlNotebook.waitForNotTrustedIcon();
			await app.workbench.sqlNotebook.waitForTrustedElementsGone();

			await app.workbench.sqlNotebook.trustNotebook();
			await app.workbench.sqlNotebook.waitForTrustedIcon();
			await app.workbench.sqlNotebook.waitForTrustedElements();

			await app.workbench.quickaccess.runCommand('workbench.action.files.save');
			await app.workbench.quickaccess.runCommand('workbench.action.closeActiveEditor');

			await app.workbench.sqlNotebook.openFile('untrusted.ipynb');
			await app.workbench.sqlNotebook.waitForTrustedIcon();
			await app.workbench.sqlNotebook.waitForTrustedElements();

			await app.workbench.quickaccess.runCommand('workbench.action.closeActiveEditor');
		});
	});
}

async function openAndRunNotebook(app: Application, filename: string): Promise<void> {
	await app.workbench.sqlNotebook.openFile(filename);
	await app.workbench.sqlNotebook.waitForKernel('Python 3');

	await app.workbench.sqlNotebook.clearResults();
	await app.workbench.sqlNotebook.waitForAllResultsGone();
	await app.workbench.sqlNotebook.runAllCells();
	await app.workbench.sqlNotebook.waitForAllResults();

	await app.workbench.quickaccess.runCommand('workbench.action.files.save');
	await app.workbench.quickaccess.runCommand('workbench.action.closeActiveEditor');

	await app.workbench.sqlNotebook.openFile(filename);
	await app.workbench.sqlNotebook.waitForKernel('Python 3');
	await app.workbench.sqlNotebook.waitForAllResults();
}
