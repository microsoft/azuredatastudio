/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { QuickAccess } from '../quickaccess';
import { QuickInput } from '../quickinput';
import { Editors } from '../editors';
import { IElement } from '..';

const winOrCtrl = process.platform === 'win32' ? 'win' : 'ctrl';

export class Notebook {

	public readonly notebookToolbar: NotebookToolbar;
	public readonly textCellToolbar: TextCellToolbar;
	public readonly view: NotebookView;

	constructor(private code: Code, private quickAccess: QuickAccess, private quickInput: QuickInput, private editors: Editors) {
		this.notebookToolbar = new NotebookToolbar(code);
		this.textCellToolbar = new TextCellToolbar(code);
		this.view = new NotebookView(code, quickAccess);
	}

	async openFile(fileName: string): Promise<void> {
		await this.quickAccess.openQuickAccess(fileName);
		await this.quickInput.waitForQuickInputElements(names => names[0] === fileName);
		await this.code.waitAndClick('.quick-input-widget .quick-input-list .monaco-list-row');
		await this.editors.waitForActiveTab(fileName);
		await this.code.waitForElement('.notebookEditor');
	}

	async newUntitledNotebook(): Promise<void> {
		await this.code.dispatchKeybinding(winOrCtrl + '+Alt+n');
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

		await this.code.waitForElement('.notebook-cell.active');
	}

	async runActiveCell(): Promise<void> {
		await this.code.dispatchKeybinding('F5');
	}

	async runAllCells(): Promise<void> {
		await this.code.dispatchKeybinding('ctrl+shift+F5');
	}

	// Cell Actions

	async waitForTypeInEditor(text: string) {
		const editor = '.notebook-cell.active .monaco-editor';
		await this.code.waitAndClick(editor);

		const textarea = `${editor} textarea`;
		await this.code.waitForActiveElement(textarea);

		await this.code.waitForTypeInEditor(textarea, text);
		await this._waitForActiveCellEditorContents(c => c.indexOf(text) > -1);
	}

	private async _waitForActiveCellEditorContents(accept: (contents: string) => boolean): Promise<any> {
		const selector = '.notebook-cell.active .monaco-editor .view-lines';
		return this.code.waitForTextContent(selector, undefined, c => accept(c.replace(/\u00a0/g, ' ')));
	}

	async waitForColorization(spanNumber: string, color: string): Promise<void> {
		const span = `span:nth-child(${spanNumber})[class="${color}"]`;
		await this.code.waitForElement(span);
	}

	public async selectAllTextInEditor(): Promise<void> {
		const editor = '.notebook-cell.active .monaco-editor';
		await this.code.waitAndClick(editor);
		await this.code.dispatchKeybinding('cmd+a');
	}

	private static readonly placeholderSelector = 'div.placeholder-cell-component';
	async addCellFromPlaceholder(cellType: 'Markdown' | 'Code'): Promise<void> {
		await this.code.waitAndClick(`${Notebook.placeholderSelector} p a[id="add${cellType}"]`);
		await this.code.waitForElement('.notebook-cell.active');
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

	async waitForTextCellPreviewContent(text: string, fontType: 'p' | 'h1' | 'h2' | 'h3', textStyle?: 'strong' | 'i' | 'u' | 'mark'): Promise<void> {
		let textSelector = `${Notebook.textCellPreviewSelector} ${fontType}`;
		if (textStyle) {
			textSelector = `${textSelector} ${textStyle}`;
		}
		await this.code.waitForElement(textSelector, result => result?.textContent === text);
	}

	// Cell Output Actions

	async waitForActiveCellResults(): Promise<void> {
		const outputComponent = '.notebook-cell.active .notebook-output';
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
		const outputComponent = '.notebook-cell.active .notebook-output';
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
	private static readonly textCellToolbar = 'text-cell-component markdown-toolbar-component ul.actions-container';

	constructor(private code: Code) { }

	public async changeTextCellView(view: 'Rich Text View' | 'Split View' | 'Markdown View'): Promise<void> {
		await this.clickToolbarButton(view);
	}

	public async boldSelectedText(): Promise<void> {
		await this.clickToolbarButton('Bold');
	}

	public async italicizeSelectedText(): Promise<void> {
		await this.clickToolbarButton('Italics');
	}

	public async underlineSelectedText(): Promise<void> {
		await this.clickToolbarButton('Underline');
	}

	public async highlightSelectedText(): Promise<void> {
		await this.clickToolbarButton('Highlight');
	}

	public async codifySelectedText(): Promise<void> {
		await this.clickToolbarButton('Code');
	}

	public async insertLink(): Promise<void> {
		throw new Error('Method not implemented.');
	}

	public async insertList(): Promise<void> {
		await this.clickToolbarButton('List');
	}

	public async insertOrderedList(): Promise<void> {
		await this.clickToolbarButton('Ordered list');
	}

	public async changeSelectedTextSize(): Promise<void> {
		throw new Error('Method not implemented.');
	}

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
}

export class NotebookView {
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
		let selector = NotebookView.searchResult;
		if (expr) {
			selector += ' .message';
		}
		return this.code.waitForElement(selector, undefined);
	}

	async waitForSetSearchValue(text: string): Promise<void> {
		const textArea = `${NotebookView.inputBox} textarea`;
		await this.code.waitForTypeInEditor(textArea, text);
	}

	/**
	 * Helper function
	 * @returns tree item ids from Notebooks View
	 */
	async getNotebookTreeItemIds(): Promise<string[]> {
		return (await this.code.waitForElements(NotebookView.notebookTreeItem, false)).map(item => item.attributes['id']);
	}

	/**
	 * Pin the first notebook in the Notebooks View
	 */
	async pinNotebook(): Promise<void> {
		const notebookIds = await this.getNotebookTreeItemIds();
		await this.code.waitAndDoubleClick(`${NotebookView.notebookTreeItem}[id="${notebookIds[0]}"]`);
		await this.code.waitAndClick(`${NotebookView.notebookTreeItem}${NotebookView.selectedItem} .codicon-pinned`);
	}

	/**
	 * Unpin the only pinned notebook.
	 * Previously pinned by the pinNotebook method.
	 */
	async unpinNotebook(): Promise<void> {
		await this.code.waitAndClick(NotebookView.pinnedNotebooksSelector);
		await this.code.waitAndClick(`${NotebookView.pinnedNotebooksSelector} .actions a[title="Unpin Notebook"]`);
	}

	/**
	 * When pinning a notebook, the pinned notebook view will show.
	 */
	async waitForPinnedNotebookView(): Promise<void> {
		await this.code.waitForElement(NotebookView.pinnedNotebooksSelector);
	}
}
