/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application, ctrlOrCmd } from '../../../../../automation';
import * as minimist from 'minimist';
import { afterSuite, beforeSuite } from '../../../utils';
import * as assert from 'assert';
export function setup(opts: minimist.ParsedArgs) {
	describe('Notebook', () => {
		beforeSuite(opts);
		afterSuite(opts);

		it('can perform basic text cell functionality', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.newUntitledNotebook();
			await app.workbench.sqlNotebook.addCellFromPlaceholder('Markdown');
			await app.workbench.sqlNotebook.waitForPlaceholderGone();

			await app.code.dispatchKeybinding('escape'); // first escape sets the cell in edit mode
			await app.code.dispatchKeybinding('escape'); // second escape unselects cell completely
			await app.workbench.sqlNotebook.waitForDoubleClickToEdit();
			await app.workbench.sqlNotebook.doubleClickTextCell();
			await app.workbench.sqlNotebook.waitForDoubleClickToEditGone();

			await app.workbench.sqlNotebook.textCellToolbar.changeTextCellView('Split View');
			const sampleText: string = 'Test text cells';
			await app.workbench.sqlNotebook.waitForTypeInEditor(sampleText);
			await app.workbench.sqlNotebook.selectAllTextInEditor();
			await app.workbench.sqlNotebook.textCellToolbar.boldSelectedText();
			await app.code.dispatchKeybinding('escape');
			await app.workbench.sqlNotebook.waitForTextCellPreviewContent(sampleText, 'p strong');
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
			this.timeout(600000); // set timeout to 10 minutes to ensure test does not timeout during python installation
			const app = this.app as Application;
			await app.workbench.sqlNotebook.newUntitledNotebook();
			await app.workbench.sqlNotebook.addCell('code');
			await app.workbench.sqlNotebook.waitForTypeInEditor('print("Hello world!")');
			await app.workbench.sqlNotebook.notebookToolbar.waitForKernel('SQL');

			await app.workbench.sqlNotebook.notebookToolbar.changeKernel('Python 3');
			await app.workbench.configurePythonDialog.waitForConfigurePythonDialog();
			await app.workbench.configurePythonDialog.waitForPageOneLoaded();
			await app.workbench.configurePythonDialog.next();
			await app.workbench.configurePythonDialog.waitForPageTwoLoaded();
			await app.workbench.configurePythonDialog.install();
			await app.workbench.sqlNotebook.notebookToolbar.waitForKernel('Python 3');

			await app.workbench.sqlNotebook.runActiveCell();
			await app.workbench.sqlNotebook.waitForActiveCellResults();
		});

		// Temporarily skipping this test while investigating failure in builds
		it.skip('can add a new package from the Manage Packages wizard', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.newUntitledNotebook();
			await app.workbench.sqlNotebook.notebookToolbar.waitForKernel('SQL');
			await app.workbench.sqlNotebook.notebookToolbar.changeKernel('Python 3');
			await app.workbench.sqlNotebook.notebookToolbar.waitForKernel('Python 3');

			await app.workbench.sqlNotebook.addCell('code');
			await app.workbench.sqlNotebook.waitForTypeInEditor('import pyarrow');
			await app.workbench.sqlNotebook.runActiveCell();
			await app.workbench.sqlNotebook.waitForJupyterErrorOutput();

			await app.workbench.sqlNotebook.notebookToolbar.managePackages();
			await app.workbench.managePackagesDialog.waitForManagePackagesDialog();
			await app.workbench.managePackagesDialog.addNewPackage('pyarrow');

			// There should be no error output when running the cell after pyarrow has been installed
			await app.workbench.sqlNotebook.runActiveCell();
			await app.workbench.sqlNotebook.waitForActiveCellResultsGone();
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
			// If the test failed, take a screenshot before closing the active editor.
			if (this.currentTest!.state === 'failed') {
				const name = this.currentTest!.fullTitle().replace(/[^a-z0-9\-]/ig, '_');
				await app.captureScreenshot(`${name} (screenshot before revertAndCloseActiveEditor action)`);
			}

			await app.workbench.quickaccess.runCommand('workbench.action.revertAndCloseActiveEditor');

			// Close any open wizards
			await app.code.dispatchKeybinding('escape');
		});

		describe('Notebook keyboard navigation', async () => {
			it('can enter and exit edit mode and navigate using keyboard nav', async function () {
				const app = this.app as Application;
				await app.workbench.sqlNotebook.newUntitledNotebook();
				await app.workbench.sqlNotebook.addCellFromPlaceholder('Code'); // add new code cell
				await app.workbench.sqlNotebook.waitForPlaceholderGone();
				const activeCodeCellId = (await app.workbench.sqlNotebook.getActiveCell()).attributes['id'];
				await app.workbench.sqlNotebook.waitForTypeInEditor('code cell', activeCodeCellId); // the new cell should be in edit mode
				await app.workbench.sqlNotebook.exitActiveCell();
				await app.workbench.sqlNotebook.waitForActiveCellGone();

				await app.workbench.sqlNotebook.addCell('markdown'); // add markdown cell
				await app.workbench.sqlNotebook.textCellToolbar.changeTextCellView('Split View');
				const activeTextCellId = (await app.workbench.sqlNotebook.getActiveCell()).attributes['id'];
				await app.workbench.sqlNotebook.waitForTypeInEditor('text cell', activeTextCellId); // Text cell should be in edit mode

				await app.code.dispatchKeybinding('escape'); // exit edit mode and stay in browse mode
				await app.code.dispatchKeybinding('up'); // select code cell
				await app.workbench.sqlNotebook.getActiveCell(activeCodeCellId); // check that the code cell is now active
				await app.code.dispatchKeybinding('enter');
				await app.workbench.sqlNotebook.waitForTypeInEditor('test', activeCodeCellId); // code cell should be in edit mode after hitting enter
				await app.code.dispatchKeybinding('escape'); // exit edit mode and stay in browse mode
				await app.code.dispatchKeybinding('down'); // select text cell
				await app.code.dispatchKeybinding('enter');
				await app.workbench.sqlNotebook.textCellToolbar.changeTextCellView('Split View');
				await app.workbench.sqlNotebook.waitForTypeInEditor('test', activeTextCellId); // text cell should be in edit mode after hitting enter
			});

			it('cannot move through cells when find widget is invoked', async function () {
				const app = this.app as Application;
				await app.workbench.sqlNotebook.newUntitledNotebook();
				await app.workbench.sqlNotebook.addCell('markdown');
				await app.workbench.sqlNotebook.exitActiveCell();
				await app.workbench.sqlNotebook.addCell('markdown');
				await app.workbench.sqlNotebook.exitActiveCell();
				await app.workbench.sqlNotebook.addCell('markdown');
				await app.code.dispatchKeybinding('escape');
				const activeCellId = (await app.workbench.sqlNotebook.getActiveCell()).attributes['id'];
				await app.workbench.sqlNotebook.notebookFind.openFindWidget();
				await app.code.dispatchKeybinding('down');
				await app.workbench.sqlNotebook.getActiveCell(activeCellId); // verify that the active cell is the same
			});
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

		describe('Cell Toolbar Actions', function () {
			async function verifyCellToolbarBehavior(app: Application, toolbarAction: () => Promise<void>, selector: string, checkIfGone: boolean = false): Promise<void> {
				const sampleText: string = 'Test Text';

				await app.workbench.sqlNotebook.newUntitledNotebook();
				await app.workbench.sqlNotebook.addCellFromPlaceholder('Markdown');
				await app.workbench.sqlNotebook.waitForPlaceholderGone();
				await app.workbench.sqlNotebook.textCellToolbar.changeTextCellView('Split View');
				await app.workbench.sqlNotebook.waitForTypeInEditor(sampleText);
				await app.workbench.sqlNotebook.selectAllTextInEditor();

				await toolbarAction();
				await app.code.dispatchKeybinding('escape');
				if (checkIfGone) {
					await app.workbench.sqlNotebook.waitForTextCellPreviewContentGone(selector);
				} else {
					await app.workbench.sqlNotebook.waitForTextCellPreviewContent(sampleText, selector);
				}
			}

			async function verifyToolbarKeyboardShortcut(app: Application, keyboardShortcut: string, selector: string) {
				await app.workbench.sqlNotebook.newUntitledNotebook();
				await app.workbench.sqlNotebook.addCellFromPlaceholder('Markdown');
				await app.workbench.sqlNotebook.waitForPlaceholderGone();
				await app.workbench.sqlNotebook.textCellToolbar.changeTextCellView('Markdown View');
				let testText = 'Markdown Keyboard Shortcut Test';
				await app.workbench.sqlNotebook.waitForTypeInEditor(testText);
				await app.workbench.sqlNotebook.selectAllTextInEditor();
				await app.code.dispatchKeybinding(keyboardShortcut);
				await app.code.dispatchKeybinding('escape');
				await app.workbench.sqlNotebook.waitForTextCellPreviewContent(testText, selector);
			}

			it('can bold selected text', async function () {
				const app = this.app as Application;
				await verifyCellToolbarBehavior(app, () => app.workbench.sqlNotebook.textCellToolbar.boldSelectedText(), 'p strong');
			});

			it('can undo bold text', async function () {
				const app = this.app as Application;
				await verifyCellToolbarBehavior(app, async () => {
					await app.workbench.sqlNotebook.textCellToolbar.boldSelectedText();
					await app.workbench.sqlNotebook.textCellToolbar.boldSelectedText();
				}, 'p strong', true);
			});

			it('can italicize selected text', async function () {
				const app = this.app as Application;
				await verifyCellToolbarBehavior(app, () => app.workbench.sqlNotebook.textCellToolbar.italicizeSelectedText(), 'p em');
			});

			it('can undo italic text', async function () {
				const app = this.app as Application;
				await verifyCellToolbarBehavior(app, async () => {
					await app.workbench.sqlNotebook.textCellToolbar.italicizeSelectedText();
					await app.workbench.sqlNotebook.textCellToolbar.italicizeSelectedText();
				}, 'p em', true);
			});

			it('can underline selected text', async function () {
				const app = this.app as Application;
				await verifyCellToolbarBehavior(app, () => app.workbench.sqlNotebook.textCellToolbar.underlineSelectedText(), 'p u');
			});

			it('can undo underlined text', async function () {
				const app = this.app as Application;
				await verifyCellToolbarBehavior(app, async () => {
					await app.workbench.sqlNotebook.textCellToolbar.underlineSelectedText();
					await app.workbench.sqlNotebook.textCellToolbar.underlineSelectedText();
				}, 'p u', true);
			});

			it('can highlight selected text', async function () {
				const app = this.app as Application;
				await verifyCellToolbarBehavior(app, () => app.workbench.sqlNotebook.textCellToolbar.highlightSelectedText(), 'p mark');
			});

			it('can undo highlighted text', async function () {
				const app = this.app as Application;
				await verifyCellToolbarBehavior(app, async () => {
					await app.workbench.sqlNotebook.textCellToolbar.highlightSelectedText();
					await app.workbench.sqlNotebook.textCellToolbar.highlightSelectedText();
				}, 'p mark', true);
			});

			it('can codify selected text', async function () {
				const app = this.app as Application;
				await verifyCellToolbarBehavior(app, () => app.workbench.sqlNotebook.textCellToolbar.codifySelectedText(), 'pre code');
			});

			it('can bullet selected text', async function () {
				const app = this.app as Application;
				await verifyCellToolbarBehavior(app, () => app.workbench.sqlNotebook.textCellToolbar.insertList(), 'ul li');
			});

			it('can undo bulleted text', async function () {
				const app = this.app as Application;
				await verifyCellToolbarBehavior(app, async () => {
					await app.workbench.sqlNotebook.textCellToolbar.insertList();
					await app.workbench.sqlNotebook.textCellToolbar.insertList();
				}, 'ul li', true);
			});

			it('can number selected text', async function () {
				const app = this.app as Application;
				await verifyCellToolbarBehavior(app, () => app.workbench.sqlNotebook.textCellToolbar.insertOrderedList(), 'ol li');
			});

			it('can undo numbered text', async function () {
				const app = this.app as Application;
				await verifyCellToolbarBehavior(app, async () => {
					await app.workbench.sqlNotebook.textCellToolbar.insertOrderedList();
					await app.workbench.sqlNotebook.textCellToolbar.insertOrderedList();
				}, 'ol li', true);
			});

			// Text size tests are disabled because the text size dropdown
			// is not clickable on Unix from the smoke tests
			// it('can change text size to Heading 1', async function () {
			// 	const app = this.app as Application;
			// 	await createCellAndSelectAllText(app);
			// 	await app.workbench.sqlNotebook.textCellToolbar.changeSelectedTextSize('Heading 1');
			// 	await app.code.dispatchKeybinding('escape');
			// 	await app.workbench.sqlNotebook.waitForTextCellPreviewContent(sampleText, 'h1');
			// });

			// it('can change text size to Heading 2', async function () {
			// 	const app = this.app as Application;
			// 	await createCellAndSelectAllText(app);
			// 	await app.workbench.sqlNotebook.textCellToolbar.changeSelectedTextSize('Heading 2');
			// 	await app.code.dispatchKeybinding('escape');
			// 	await app.workbench.sqlNotebook.waitForTextCellPreviewContent(sampleText, 'h2');
			// });

			// it('can change text size to Heading 3', async function () {
			// 	const app = this.app as Application;
			// 	await createCellAndSelectAllText(app);
			// 	await app.workbench.sqlNotebook.textCellToolbar.changeSelectedTextSize('Heading 3');
			// 	await app.code.dispatchKeybinding('escape');
			// 	await app.workbench.sqlNotebook.waitForTextCellPreviewContent(sampleText, 'h3');
			// });

			// it('can change text size to Paragraph', async function () {
			// 	const app = this.app as Application;
			// 	await createCellAndSelectAllText(app);
			// 	await app.workbench.sqlNotebook.textCellToolbar.changeSelectedTextSize('Paragraph');
			// 	await app.code.dispatchKeybinding('escape');
			// 	await app.workbench.sqlNotebook.waitForTextCellPreviewContent(sampleText, 'p');
			// });

			it('can insert link', async function () {
				const app = this.app as Application;
				await app.workbench.sqlNotebook.newUntitledNotebook();
				await app.workbench.sqlNotebook.addCellFromPlaceholder('Markdown');
				await app.workbench.sqlNotebook.waitForPlaceholderGone();
				await app.workbench.sqlNotebook.textCellToolbar.changeTextCellView('Split View');

				const sampleLabel = 'Microsoft';
				const sampleAddress = 'https://www.microsoft.com';
				await app.workbench.sqlNotebook.textCellToolbar.insertLink(sampleLabel, sampleAddress);
				await app.code.dispatchKeybinding('escape');
				await app.workbench.sqlNotebook.waitForTextCellPreviewContent(sampleLabel, `p a[href="${sampleAddress}"]`);
			});

			it('can bold text with keyboard shortcut', async function () {
				const app = this.app as Application;
				await verifyToolbarKeyboardShortcut(app, `${ctrlOrCmd}+b`, 'p strong');
			});

			it('can italicize text with keyboard shortcut', async function () {
				const app = this.app as Application;
				await verifyToolbarKeyboardShortcut(app, `${ctrlOrCmd}+i`, 'p em');
			});

			it('can underline text with keyboard shortcut', async function () {
				const app = this.app as Application;
				await verifyToolbarKeyboardShortcut(app, `${ctrlOrCmd}+u`, 'p u');
			});

			it('can highlight text with keyboard shortcut', async function () {
				const app = this.app as Application;
				await verifyToolbarKeyboardShortcut(app, `${ctrlOrCmd}+shift+h`, 'p mark');
			});

			it('can codify text with keyboard shortcut', async function () {
				const app = this.app as Application;
				await verifyToolbarKeyboardShortcut(app, `${ctrlOrCmd}+shift+k`, 'pre code');
			});
		});

		describe('markdown', function () {
			it('can create http link from markdown', async function () {
				const app = this.app as Application;
				const markdownString = '[Microsoft homepage](http://www.microsoft.com)';
				const linkSelector = '.notebook-cell.active .notebook-text a[href=\'http://www.microsoft.com\']';
				await verifyElementRendered(app, markdownString, linkSelector);
			});

			it('can create img from markdown', async function () {
				const app = this.app as Application;
				const markdownString = '![Churn-Index](https://www.ngdata.com/wp-content/uploads/2016/05/churn.jpg)';
				// Verify image with the correct src and alt attributes is created
				const imgSelector = '.notebook-cell.active .notebook-text img[src=\'https://www.ngdata.com/wp-content/uploads/2016/05/churn.jpg\'][alt=\'Churn-Index\']';
				await verifyElementRendered(app, markdownString, imgSelector);
			});

			it('can convert WYSIWYG to Markdown', async function () {
				const app = this.app as Application;
				await app.workbench.sqlNotebook.newUntitledNotebook();
				await app.workbench.sqlNotebook.addCellFromPlaceholder('Markdown');
				await app.workbench.sqlNotebook.waitForPlaceholderGone();
				await app.workbench.sqlNotebook.textCellToolbar.changeTextCellView('Markdown View');
				await app.workbench.sqlNotebook.waitForTypeInEditor('Markdown Test');
				await app.workbench.sqlNotebook.textCellToolbar.changeTextCellView('Rich Text View');
				await app.workbench.sqlNotebook.selectAllTextInRichTextEditor();
				await app.workbench.sqlNotebook.textCellToolbar.boldSelectedText();
				await app.workbench.sqlNotebook.textCellToolbar.italicizeSelectedText();
				await app.workbench.sqlNotebook.textCellToolbar.underlineSelectedText();
				await app.workbench.sqlNotebook.textCellToolbar.highlightSelectedText();
				await app.workbench.sqlNotebook.textCellToolbar.insertList();
				await app.workbench.sqlNotebook.textCellToolbar.changeTextCellView('Markdown View');
				await app.workbench.sqlNotebook.waitForActiveCellEditorContents(s => s.includes('- **_<u><mark>Markdown Test</mark></u>_**'));
			});
		});

		describe('Cell Actions', function () {
			it('can change cell language', async function () {
				const app = this.app as Application;
				await app.workbench.sqlNotebook.newUntitledNotebook();
				await app.workbench.sqlNotebook.notebookToolbar.waitForKernel('SQL');
				await app.workbench.sqlNotebook.addCellFromPlaceholder('Code');
				await app.workbench.sqlNotebook.waitForPlaceholderGone();

				const languagePickerButton = '.notebook-cell.active .cellLanguage';
				await app.code.waitAndClick(languagePickerButton);

				await app.workbench.quickinput.waitForQuickInputElements(names => names[0] === 'SQL');
				await app.code.waitAndClick('.quick-input-widget .quick-input-list .monaco-list-row');

				let element = await app.code.waitForElement(languagePickerButton);
				assert.strictEqual(element.textContent?.trim(), 'SQL');
			});
		});
	});
}

/**
 * Verifies that the given markdown string is rendered into the expected HTML element in split view, rich text view
 * and the text cell outside of edit mode.
 * @param app The application
 * @param markdownString The markdown text to enter for the element to render
 * @param element The query selector for the element that is expected to be rendered
 */
async function verifyElementRendered(app: Application, markdownString: string, element: string): Promise<void> {
	await app.workbench.sqlNotebook.newUntitledNotebook();
	await app.workbench.sqlNotebook.addCell('markdown');
	await app.workbench.sqlNotebook.textCellToolbar.changeTextCellView('Split View');
	await app.workbench.sqlNotebook.waitForTypeInEditor(markdownString);
	// Verify link is shown in split view
	await app.code.waitForElement(element);
	await app.workbench.sqlNotebook.textCellToolbar.changeTextCellView('Rich Text View');
	// Verify link is shown in WYSIWYG view
	await app.code.waitForElement(element);
	// Verify link is shown outside of edit mode
	await app.code.dispatchKeybinding('escape');
	await app.code.waitForElement(element);
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
