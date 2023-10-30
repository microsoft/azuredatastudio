/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { QuickAccess, QuickAccessKind } from '../quickaccess';
import { QuickInput } from '../quickinput';
import { Editors } from '../editors';
import { IElement } from '../driver';
import * as constants from '../sql/constants';

const activeCellSelector = '.notebook-cell.active';

export class Notebook {

	public readonly notebookToolbar: NotebookToolbar;
	public readonly textCellToolbar: TextCellToolbar;
	public readonly notebookFind: NotebookFind;
	public readonly view: NotebookTreeView;

	constructor(private code: Code, private quickAccess: QuickAccess, private quickInput: QuickInput, private editors: Editors) {
		this.notebookToolbar = new NotebookToolbar(code);
		this.textCellToolbar = new TextCellToolbar(code);
		this.view = new NotebookTreeView(code, quickAccess);
		this.notebookFind = new NotebookFind(code);
	}

	async openFile(fileName: string): Promise<void> {
		await this.quickAccess.openQuickAccessWithRetry(QuickAccessKind.Files, fileName);
		await this.quickInput.waitForQuickInputElements(names => names[0] === fileName);
		await this.code.waitAndClick('.quick-input-widget .quick-input-list .monaco-list-row');
		await this.editors.waitForActiveTab(fileName);
		await this.code.waitForElement('.notebookEditor');
	}

	async newUntitledNotebook(): Promise<void> {
		await this.code.dispatchKeybinding(`${constants.winOrCtrl}+Alt+n`);
		await this.editors.waitForActiveTab(`Notebook-0`);
		await this.code.waitForElement('.notebookEditor');
	}

	// Notebook Toolbar Actions (keyboard shortcuts)

	async addCell(cellType: 'markdown' | 'code'): Promise<void> {
		if (cellType === 'markdown') {
			await this.code.dispatchKeybinding('ctrl+shift+t');
		} else {
			await this.code.dispatchKeybinding('ctrl+shift+c');
		}

		await this.code.waitForElement(activeCellSelector);
	}

	async waitForActiveCellGone(): Promise<void> {
		await this.code.waitForElementGone(activeCellSelector);
	}

	async runActiveCell(): Promise<void> {
		await this.code.dispatchKeybinding('F5');
	}

	async exitActiveCell(): Promise<void> {
		await this.code.dispatchKeybinding('escape'); // first escape to exit edit mode
		await this.code.dispatchKeybinding('escape'); // second escape to deselect cell
	}

	async runAllCells(): Promise<void> {
		await this.code.dispatchKeybinding('ctrl+shift+F5');
	}

	// Cell Actions

	async getActiveCell(id?: string): Promise<IElement> {
		const activeCell = id ? `${activeCellSelector}[id="${id}"]` : activeCellSelector;
		return this.code.waitForElement(activeCell);
	}

	async waitForTypeInEditor(text: string, cellId?: string) {
		const editor = cellId ? `${activeCellSelector}[id="${cellId}"] .monaco-editor` : `${activeCellSelector} .monaco-editor`;
		await this.code.waitAndClick(editor);

		const textarea = `${editor} textarea`;
		await this.code.waitForActiveElement(textarea);

		await this.code.waitForTypeInEditor(textarea, text);
		await this.waitForActiveCellEditorContents(c => c.indexOf(text) > -1);
	}

	async waitForActiveCellEditorContents(accept: (contents: string) => boolean): Promise<any> {
		const selector = `${activeCellSelector} .monaco-editor .view-lines`;
		return this.code.waitForTextContent(selector, undefined, c => accept(c.replace(/\u00a0/g, ' ')));
	}

	async waitForColorization(spanNumber: string, color: string): Promise<void> {
		const span = `span:nth-child(${spanNumber})[class="${color}"]`;
		await this.code.waitForElement(span);
	}

	public async selectAllTextInRichTextEditor(): Promise<void> {
		const editor = `${activeCellSelector} .notebook-preview[contenteditable="true"]`;
		await this.selectAllText(editor);
	}

	public async selectAllTextInEditor(): Promise<void> {
		const editor = `${activeCellSelector} .monaco-editor`;
		await this.selectAllText(editor);
	}

	private async selectAllText(selector: string): Promise<void> {
		await this.code.waitAndClick(selector);
		await this.code.dispatchKeybinding(`${constants.ctrlOrCmd}+a`);
	}

	private static readonly placeholderSelector = 'div.placeholder-cell-component';
	async addCellFromPlaceholder(cellType: 'Markdown' | 'Code'): Promise<void> {
		await this.code.waitAndClick(`${Notebook.placeholderSelector} p a[id="add${cellType}"]`);
		await this.code.waitForElement(activeCellSelector);
	}

	async waitForPlaceholderGone(): Promise<void> {
		await this.code.waitForElementGone(Notebook.placeholderSelector);
	}

	async waitForCollapseIconInCells(): Promise<void> {
		let cellIds = await this.getCellIds();
		for (let i of cellIds) {
			const editor = `.notebook-cell[id="${i}"] code-cell-component code-component collapse-component`;
			await this.code.waitForElement(`${editor} [title="Collapse code cell contents"]`);
		}
	}

	async waitForExpandIconInCells(): Promise<void> {
		let cellIds = await this.getCellIds();
		for (let i of cellIds) {
			const editor = `.notebook-cell[id="${i}"] code-cell-component code-component collapse-component`;
			await this.code.waitForElement(`${editor} [title="Expand code cell contents"]`);
		}
	}

	/**
	 * Helper function
	 * @returns cell ids for the notebook
	 */
	async getCellIds(): Promise<string[]> {
		return (await this.code.waitForElements('div.notebook-cell', false)).map(cell => cell.attributes['id']);
	}

	// Code Cell Actions

	async waitForSuggestionWidget(): Promise<void> {
		const suggestionWidgetSelector = 'div.editor-widget.suggest-widget';
		await this.code.waitForElement(suggestionWidgetSelector);
	}

	async waitForSuggestionResult(expectedResult: string): Promise<void> {
		const expectedResultSelector = `div.editor-widget.suggest-widget div.monaco-list-row.focused[aria-label="${expectedResult}"]`;
		await this.code.waitForElement(expectedResultSelector);
	}

	// Text Cell Actions

	private static readonly textCellPreviewSelector = 'div.notebook-preview';
	private static readonly doubleClickToEditSelector = `${Notebook.textCellPreviewSelector} p i`;
	async waitForDoubleClickToEdit(): Promise<void> {
		await this.code.waitForElement(Notebook.doubleClickToEditSelector);
	}

	async doubleClickTextCell(): Promise<void> {
		await this.code.waitAndClick(Notebook.textCellPreviewSelector);
		await this.code.waitAndDoubleClick(`${Notebook.textCellPreviewSelector}.actionselect`);
	}

	async waitForDoubleClickToEditGone(): Promise<void> {
		await this.code.waitForElementGone(Notebook.doubleClickToEditSelector);
	}

	async waitForTextCellPreviewContent(text: string, selector: string): Promise<void> {
		let textSelector = `${Notebook.textCellPreviewSelector} ${selector}`;
		await this.code.waitForElement(textSelector, result => !!result?.textContent?.includes(text)); // Use includes to handle whitespace/quote edge cases
	}

	async waitForTextCellPreviewContentGone(selector: string): Promise<void> {
		let textSelector = `${Notebook.textCellPreviewSelector} ${selector}`;
		await this.code.waitForElementGone(textSelector);
	}

	// Cell Output Actions

	async waitForJupyterErrorOutput(): Promise<void> {
		const jupyterErrorOutput = `${activeCellSelector} .notebook-output mime-output[data-mime-type="application/vnd.jupyter.stderr"]`;
		await this.code.waitForElement(jupyterErrorOutput);
	}

	async waitForActiveCellResults(): Promise<void> {
		const outputComponent = `${activeCellSelector} .notebook-output`;
		await this.code.waitForElement(outputComponent);
	}

	async waitForResults(cellIds: string[]): Promise<void> {
		for (let i of cellIds) {
			await this.code.waitForElement(`div.notebook-cell[id="${i}"] .notebook-output`);
		}
	}

	async waitForAllResults(): Promise<void> {
		await this.waitForResults(await this.getCellIds());
	}

	async waitForActiveCellResultsGone(): Promise<void> {
		const outputComponent = `${activeCellSelector} .notebook-output`;
		await this.code.waitForElementGone(outputComponent);
	}

	async waitForResultsGone(cellIds: string[]): Promise<void> {
		for (let i of cellIds) {
			await this.code.waitForElementGone(`div.notebook-cell[id="${i}"] .notebook-output`);
		}
	}

	async waitForAllResultsGone(): Promise<void> {
		await this.waitForResultsGone(await this.getCellIds());
	}

	async waitForTrustedElements(): Promise<void> {
		const cellSelector = '.notebookEditor .notebook-cell';
		await this.code.waitForElement(`${cellSelector} iframe`);
		await this.code.waitForElement(`${cellSelector} dialog`);
		await this.code.waitForElement(`${cellSelector} embed`);
		await this.code.waitForElement(`${cellSelector} svg`);
	}

	async waitForTrustedElementsGone(): Promise<void> {
		const cellSelector = '.notebookEditor .notebook-cell';
		await this.code.waitForElementGone(`${cellSelector} iframe`);
		await this.code.waitForElementGone(`${cellSelector} dialog`);
		await this.code.waitForElementGone(`${cellSelector} embed`);
		await this.code.waitForElementGone(`${cellSelector} svg`);
	}
}

export class TextCellToolbar {
	private static readonly textCellToolbar = 'text-cell-component markdown-toolbar-component ul.actions-container li.action-item';

	constructor(private code: Code) { }

	public async changeTextCellView(view: 'Rich Text View' | 'Split View' | 'Markdown View'): Promise<void> {
		await this.clickToolbarButton(view);
	}

	public async boldSelectedText(): Promise<void> {
		await this.clickToolbarButton('Bold');
	}

	public async italicizeSelectedText(): Promise<void> {
		await this.clickToolbarButton('Italic');
	}

	public async underlineSelectedText(): Promise<void> {
		await this.clickToolbarButton('Underline');
	}

	public async highlightSelectedText(): Promise<void> {
		await this.clickToolbarButton('Highlight');
	}

	public async codifySelectedText(): Promise<void> {
		await this.clickToolbarButton('Insert code');
	}

	public async insertLink(linkLabel: string, linkAddress: string): Promise<void> {
		await this.clickToolbarButton('Insert link');
		const linkDialogSelector = 'div.modal.callout-dialog[aria-label="Insert link"]';
		const displayTextSelector = `${linkDialogSelector} input[aria-label="Text to display"]`;
		await this.code.waitForSetValue(displayTextSelector, linkLabel);

		const addressTextSelector = `${linkDialogSelector} input[aria-label="Address"]`;
		await this.code.waitForSetValue(addressTextSelector, linkAddress);

		await this.code.dispatchKeybinding('enter');
	}

	public async insertList(): Promise<void> {
		await this.clickToolbarButton('Insert list');
	}

	public async insertOrderedList(): Promise<void> {
		await this.clickToolbarButton('Insert ordered list');
	}

	// Disabled since the text size dropdown is not clickable on Unix from smoke tests
	// public async changeSelectedTextSize(textSize: 'Heading 1' | 'Heading 2' | 'Heading 3' | 'Paragraph'): Promise<void> {
	// 	const actionSelector = `${TextCellToolbar.textCellToolbar} .monaco-dropdown a.heading-dropdown`;
	// 	await this.code.waitAndClick(actionSelector);
	// 	const menuItemSelector = `.context-view.monaco-menu-container .monaco-menu .action-menu-item[title="${textSize}"]`;
	// 	await this.code.waitAndClick(menuItemSelector);
	// }

	private async clickToolbarButton(buttonTitle: string) {
		const actionSelector = `${TextCellToolbar.textCellToolbar} a[title="${buttonTitle}"]`;
		await this.code.waitAndClick(actionSelector);
	}
}

export class NotebookToolbar {

	private static readonly toolbarSelector = '.notebookEditor .editor-toolbar .actions-container';
	private static readonly toolbarButtonSelector = `${NotebookToolbar.toolbarSelector} a.action-label.codicon.masked-icon`;
	private static readonly trustedButtonSelector = `${NotebookToolbar.toolbarButtonSelector}.icon-shield`;
	private static readonly notTrustedButtonSelector = `${NotebookToolbar.toolbarButtonSelector}.icon-shield-x`;
	private static readonly collapseCellsButtonSelector = `${NotebookToolbar.toolbarButtonSelector}.icon-collapse-cells`;
	private static readonly expandCellsButtonSelector = `${NotebookToolbar.toolbarButtonSelector}.icon-expand-cells`;
	private static readonly clearResultsButtonSelector = `${NotebookToolbar.toolbarButtonSelector}.icon-clear-results`;
	private static readonly managePackagesButtonSelector = `${NotebookToolbar.toolbarButtonSelector}[title="Manage Packages"]`;

	constructor(private code: Code) { }

	async changeKernel(kernel: string): Promise<void> {
		const kernelDropdown = `${NotebookToolbar.toolbarSelector} select[id="kernel-dropdown"]`;
		await this.code.waitForSetValue(kernelDropdown, kernel);
		await this.code.dispatchKeybinding('enter');
	}

	async waitForKernel(kernel: string): Promise<void> {
		const kernelDropdownValue = `${NotebookToolbar.toolbarSelector} select[id="kernel-dropdown"][title="${kernel}"]`;
		await this.code.waitForElement(kernelDropdownValue, undefined, 3000); // wait up to 5 minutes for kernel change
	}

	async trustNotebook(): Promise<void> {
		await this.code.waitAndClick(NotebookToolbar.toolbarSelector);

		let buttons: IElement[] = await this.code.waitForElements(NotebookToolbar.toolbarButtonSelector, false);
		buttons.forEach(async button => {
			if (button.className.includes('icon-shield-x')) {
				await this.code.waitAndClick(NotebookToolbar.notTrustedButtonSelector);
				return;
			} else if (button.className.includes('icon-shield')) { // notebook is already trusted
				return;
			}
		});
	}

	async waitForTrustedIcon(): Promise<void> {
		await this.code.waitForElement(NotebookToolbar.trustedButtonSelector);
	}

	async waitForNotTrustedIcon(): Promise<void> {
		await this.code.waitForElement(NotebookToolbar.notTrustedButtonSelector);
	}

	async collapseCells(): Promise<void> {
		let buttons: IElement[] = await this.code.waitForElements(NotebookToolbar.toolbarButtonSelector, false);
		let collapseButton = buttons.find(button => button.className.includes('icon-collapse-cells'));
		if (collapseButton) {
			await this.code.waitAndClick(NotebookToolbar.collapseCellsButtonSelector);
		}
	}

	async expandCells(): Promise<void> {
		let buttons: IElement[] = await this.code.waitForElements(NotebookToolbar.toolbarButtonSelector, false);
		let expandButton = buttons.find(button => button.className.includes('icon-expand-cells'));
		if (expandButton) {
			await this.code.waitAndClick(NotebookToolbar.expandCellsButtonSelector);
		}
	}

	async waitForCollapseCellsNotebookIcon(): Promise<void> {
		await this.code.waitForElement(NotebookToolbar.collapseCellsButtonSelector);
	}

	async waitForExpandCellsNotebookIcon(): Promise<void> {
		await this.code.waitForElement(NotebookToolbar.expandCellsButtonSelector);
	}

	async clearResults(): Promise<void> {
		await this.code.waitAndClick(NotebookToolbar.clearResultsButtonSelector);
	}

	async managePackages(): Promise<void> {
		await this.code.waitAndClick(NotebookToolbar.managePackagesButtonSelector);
	}
}

export class NotebookTreeView {
	private static readonly inputBox = '.notebookExplorer-viewlet .search-widget .input-box';
	private static searchResult = '.search-view .result-messages';
	private static notebookTreeItem = '.split-view-view .tree-explorer-viewlet-tree-view .monaco-list-row';
	private static selectedItem = '.focused.selected';
	private static pinnedNotebooksSelector = '.split-view-view .tree-explorer-viewlet-tree-view .monaco-list[aria-label="Pinned notebooks"] .monaco-list-row';

	constructor(private code: Code, private quickAccess: QuickAccess) { }

	async focusSearchResultsView(): Promise<void> {
		return this.quickAccess.runCommand('Notebooks: Focus on Search Results View');
	}

	async focusNotebooksView(): Promise<void> {
		return this.quickAccess.runCommand('Notebooks: Focus on Notebooks View');
	}

	async focusPinnedNotebooksView(): Promise<void> {
		return this.quickAccess.runCommand('Notebooks: Focus on Pinned notebooks View');
	}

	async searchInNotebook(expr: string): Promise<IElement> {
		await this.waitForSetSearchValue(expr);
		await this.code.dispatchKeybinding('enter');
		let selector = NotebookTreeView.searchResult;
		if (expr) {
			selector += ' .message';
		}
		return this.code.waitForElement(selector, undefined);
	}

	async waitForSetSearchValue(text: string): Promise<void> {
		const textArea = `${NotebookTreeView.inputBox} textarea`;
		await this.code.waitForTypeInEditor(textArea, text);
	}

	/**
	 * Gets tree items from Notebooks Tree View
	 * @returns tree item from Notebooks View
	 */
	async getNotebookTreeItems(): Promise<IElement[]> {
		return this.code.waitForElements(NotebookTreeView.notebookTreeItem, false);
	}

	/**
	 * Gets tree items from Pinned Notebooks View
	 * @returns tree item from Pinned Notebooks View
	 */
	async getPinnedNotebookTreeItems(): Promise<IElement[]> {
		return this.code.waitForElements(NotebookTreeView.pinnedNotebooksSelector, false);
	}

	async pinNotebook(notebookId: string): Promise<void> {
		await this.code.waitAndDoubleClick(`${NotebookTreeView.notebookTreeItem}[id="${notebookId}"]`);
		await this.code.waitAndClick(`${NotebookTreeView.notebookTreeItem}${NotebookTreeView.selectedItem} .codicon-pinned`);
	}

	async unpinNotebook(notebookId: string): Promise<void> {
		await this.code.waitAndClick(NotebookTreeView.pinnedNotebooksSelector);
		await this.code.waitAndClick(`${NotebookTreeView.pinnedNotebooksSelector}[id="${notebookId}"] .actions a[title="Unpin Notebook"]`);
	}

	/**
	 * When pinning a notebook, the pinned notebook view will show.
	 */
	async waitForPinnedNotebookTreeView(): Promise<void> {
		await this.code.waitForElement(NotebookTreeView.pinnedNotebooksSelector);
	}

	async waitForPinnedNotebookTreeViewGone(): Promise<void> {
		await this.code.waitForElementGone(NotebookTreeView.pinnedNotebooksSelector);
	}
}

export class NotebookFind {

	constructor(private code: Code) { }

	async openFindWidget(): Promise<void> {
		const findWidgetCmd = `${constants.ctrlOrCmd}+f`;
		await this.code.dispatchKeybinding(findWidgetCmd);
		await this.code.waitForElement('.editor-widget.find-widget.visible');
	}
}
