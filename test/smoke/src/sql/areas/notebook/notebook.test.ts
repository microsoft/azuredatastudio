/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../../../../automation';

export function setup() {
	describe('Notebook', () => {

		it('can perform basic text cell functionality', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.newUntitledNotebook();
			await app.workbench.sqlNotebook.addCellFromPlaceholder('Markdown');
			await app.workbench.sqlNotebook.waitForPlaceholderGone();

			await app.code.dispatchKeybinding('escape');
			await app.workbench.sqlNotebook.waitForDoubleClickToEdit();
			await app.workbench.sqlNotebook.doubleClickTextCell();
			await app.workbench.sqlNotebook.waitForDoubleClickToEditGone();

			await app.workbench.sqlNotebook.textCellToolbar.changeTextCellView('Split View');
			const sampleText: string = 'Test text cells';
			await app.workbench.sqlNotebook.waitForTypeInEditor(sampleText);
			await app.workbench.sqlNotebook.selectAllTextInEditor();
			await app.workbench.sqlNotebook.textCellToolbar.boldSelectedText();
			await app.code.dispatchKeybinding('escape');
			await app.workbench.sqlNotebook.waitForTextCellPreviewContent(sampleText, 'p', 'strong');
		});

		it('can perform basic code cell functionality', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.newUntitledNotebook();
			await app.workbench.sqlNotebook.notebookToolbar.waitForKernel('SQL');
			await app.workbench.sqlNotebook.addCellFromPlaceholder('Code');
			await app.workbench.sqlNotebook.waitForPlaceholderGone();

			const text1: string = 'SEL';
			await app.workbench.sqlNotebook.waitForTypeInEditor(text1);
			await app.code.dispatchKeybinding('ctrl+space bar');

			// check for completion suggestions
			await app.workbench.sqlNotebook.waitForSuggestionWidget();
			await app.workbench.sqlNotebook.waitForSuggestionResult('SELECT');
			await app.code.dispatchKeybinding('tab');

			const text2: string = ' * FROM employees';
			await app.workbench.sqlNotebook.waitForTypeInEditor(text2);

			await app.workbench.sqlNotebook.waitForColorization('1', 'mtk5'); // SELECT
			await app.workbench.sqlNotebook.waitForColorization('3', 'mtk13'); // *
			await app.workbench.sqlNotebook.waitForColorization('5', 'mtk5'); // FROM
			await app.workbench.sqlNotebook.waitForColorization('6', 'mtk1'); // employees
		});

		// Python Notebooks

		it('can open new notebook, configure Python, and execute one cell', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.newUntitledNotebook();
			await app.workbench.sqlNotebook.addCell('code');
			await app.workbench.sqlNotebook.waitForTypeInEditor('print("Hello world!")');
			await app.workbench.sqlNotebook.notebookToolbar.waitForKernel('SQL');

			await app.workbench.sqlNotebook.notebookToolbar.changeKernel('Python 3');
			await app.workbench.configurePythonDialog.waitForConfigurePythonDialog();
			await app.workbench.configurePythonDialog.installPython();
			await app.workbench.sqlNotebook.notebookToolbar.waitForKernel('Python 3');

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

		afterEach(async function () {
			const app = this.app as Application;
			await app.workbench.quickaccess.runCommand('workbench.action.revertAndCloseActiveEditor');
		});

		describe('Notebook Toolbar Actions', async () => {

			it('Collapse and Expand Cell', async function () {
				const app = this.app as Application;
				await app.workbench.sqlNotebook.openFile('collapsed.ipynb');
				await app.workbench.sqlNotebook.waitForCollapseIconInCells();
				await app.workbench.sqlNotebook.notebookToolbar.waitForCollapseCellsNotebookIcon();
				await app.workbench.sqlNotebook.notebookToolbar.collapseCells();
				await app.workbench.sqlNotebook.waitForExpandIconInCells();
				await app.workbench.sqlNotebook.notebookToolbar.waitForExpandCellsNotebookIcon();
				await app.workbench.sqlNotebook.notebookToolbar.expandCells();
				await app.workbench.sqlNotebook.waitForCollapseIconInCells();
				await app.workbench.sqlNotebook.notebookToolbar.waitForCollapseCellsNotebookIcon();
			});

			it('can open untrusted notebook, trust, save, and reopen trusted notebook', async function () {
				const app = this.app as Application;
				await app.workbench.sqlNotebook.openFile('untrusted.ipynb');
				await app.workbench.sqlNotebook.notebookToolbar.waitForKernel('SQL');
				await app.workbench.sqlNotebook.notebookToolbar.waitForNotTrustedIcon();
				await app.workbench.sqlNotebook.waitForTrustedElementsGone();

				await app.workbench.sqlNotebook.notebookToolbar.trustNotebook();
				await app.workbench.sqlNotebook.notebookToolbar.waitForTrustedIcon();
				await app.workbench.sqlNotebook.waitForTrustedElements();

				await app.workbench.quickaccess.runCommand('workbench.action.files.save');
				await app.workbench.quickaccess.runCommand('workbench.action.closeActiveEditor');

				await app.workbench.sqlNotebook.openFile('untrusted.ipynb');
				await app.workbench.sqlNotebook.notebookToolbar.waitForTrustedIcon();
				await app.workbench.sqlNotebook.waitForTrustedElements();
			});
		});
	});
}

async function openAndRunNotebook(app: Application, filename: string): Promise<void> {
	await app.workbench.sqlNotebook.openFile(filename);
	await app.workbench.sqlNotebook.notebookToolbar.waitForKernel('Python 3');

	await app.workbench.sqlNotebook.notebookToolbar.clearResults();
	await app.workbench.sqlNotebook.waitForAllResultsGone();
	await app.workbench.sqlNotebook.runAllCells();
	await app.workbench.sqlNotebook.waitForAllResults();

	await app.workbench.quickaccess.runCommand('workbench.action.files.save');
	await app.workbench.quickaccess.runCommand('workbench.action.closeActiveEditor');

	await app.workbench.sqlNotebook.openFile(filename);
	await app.workbench.sqlNotebook.notebookToolbar.waitForKernel('Python 3');
	await app.workbench.sqlNotebook.waitForAllResults();
}
