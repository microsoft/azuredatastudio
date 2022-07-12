/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMouseWheelEvent } from 'vs/base/browser/mouseEvent';
import { IListContextMenuEvent, IListEvent, IListMouseEvent } from 'vs/base/browser/ui/list/list';
import { IListOptions, IListStyles } from 'vs/base/browser/ui/list/listWidget';
import { ProgressBar } from 'vs/base/browser/ui/progressbar/progressbar';
import { ToolBar } from 'vs/base/browser/ui/toolbar/toolbar';
import { Event } from 'vs/base/common/event';
import { FastDomNode } from 'vs/base/browser/fastDomNode';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { ScrollEvent } from 'vs/base/common/scrollable';
import { URI } from 'vs/base/common/uri';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { Range } from 'vs/editor/common/core/range';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { CellViewModel, NotebookViewModel } from 'vs/workbench/contrib/notebook/browser/viewModel/notebookViewModel';
import { IOutputItemDto } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { ICellRange } from 'vs/workbench/contrib/notebook/common/notebookRange';
import { IMenu } from 'vs/platform/actions/common/actions';
import { CellEditorStatusBar } from 'vs/workbench/contrib/notebook/browser/view/renderers/cellWidgets';
import { ICellOutputViewModel, ICellViewModel, IGenericCellViewModel, INotebookCellOutputLayoutInfo, INotebookEditorCreationOptions, IRenderOutput, RenderOutputType } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';

export interface INotebookCellList {
	isDisposed: boolean;
	viewModel: NotebookViewModel | null;
	readonly contextKeyService: IContextKeyService;
	element(index: number): ICellViewModel | undefined;
	elementAt(position: number): ICellViewModel | undefined;
	elementHeight(element: ICellViewModel): number;
	onWillScroll: Event<ScrollEvent>;
	onDidScroll: Event<ScrollEvent>;
	onDidChangeFocus: Event<IListEvent<ICellViewModel>>;
	onDidChangeContentHeight: Event<number>;
	onDidChangeVisibleRanges: Event<void>;
	visibleRanges: ICellRange[];
	scrollTop: number;
	scrollHeight: number;
	scrollLeft: number;
	length: number;
	rowsContainer: HTMLElement;
	readonly onDidRemoveOutputs: Event<readonly ICellOutputViewModel[]>;
	readonly onDidHideOutputs: Event<readonly ICellOutputViewModel[]>;
	readonly onDidRemoveCellsFromView: Event<readonly ICellViewModel[]>;
	readonly onMouseUp: Event<IListMouseEvent<CellViewModel>>;
	readonly onMouseDown: Event<IListMouseEvent<CellViewModel>>;
	readonly onContextMenu: Event<IListContextMenuEvent<CellViewModel>>;
	detachViewModel(): void;
	attachViewModel(viewModel: NotebookViewModel): void;
	clear(): void;
	getViewIndex(cell: ICellViewModel): number | undefined;
	getViewIndex2(modelIndex: number): number | undefined;
	getModelIndex(cell: CellViewModel): number | undefined;
	getModelIndex2(viewIndex: number): number | undefined;
	getVisibleRangesPlusViewportBelow(): ICellRange[];
	focusElement(element: ICellViewModel): void;
	selectElements(elements: ICellViewModel[]): void;
	getFocusedElements(): ICellViewModel[];
	getSelectedElements(): ICellViewModel[];
	revealElementsInView(range: ICellRange): void;
	isScrolledToBottom(): boolean;
	scrollToBottom(): void;
	revealElementInView(element: ICellViewModel): void;
	revealElementInViewAtTop(element: ICellViewModel): void;
	revealElementInCenterIfOutsideViewport(element: ICellViewModel): void;
	revealElementInCenter(element: ICellViewModel): void;
	revealElementInCenterIfOutsideViewportAsync(element: ICellViewModel): Promise<void>;
	revealElementLineInViewAsync(element: ICellViewModel, line: number): Promise<void>;
	revealElementLineInCenterAsync(element: ICellViewModel, line: number): Promise<void>;
	revealElementLineInCenterIfOutsideViewportAsync(element: ICellViewModel, line: number): Promise<void>;
	revealElementRangeInViewAsync(element: ICellViewModel, range: Range): Promise<void>;
	revealElementRangeInCenterAsync(element: ICellViewModel, range: Range): Promise<void>;
	revealElementRangeInCenterIfOutsideViewportAsync(element: ICellViewModel, range: Range): Promise<void>;
	setHiddenAreas(_ranges: ICellRange[], triggerViewUpdate: boolean): boolean;
	domElementOfElement(element: ICellViewModel): HTMLElement | null;
	focusView(): void;
	getAbsoluteTopOfElement(element: ICellViewModel): number;
	triggerScrollFromMouseWheelEvent(browserEvent: IMouseWheelEvent): void;
	updateElementHeight2(element: ICellViewModel, size: number): void;
	domFocus(): void;
	setCellSelection(element: ICellViewModel, range: Range): void;
	style(styles: IListStyles): void;
	getRenderHeight(): number;
	updateOptions(options: IListOptions<ICellViewModel>): void;
	layout(height?: number, width?: number): void;
	dispose(): void;
}

export interface BaseCellRenderTemplate {
	rootContainer: HTMLElement;
	editorPart: HTMLElement;
	cellInputCollapsedContainer: HTMLElement;
	contextKeyService: IContextKeyService;
	container: HTMLElement;
	cellContainer: HTMLElement;
	decorationContainer: HTMLElement;
	toolbar: ToolBar;
	deleteToolbar: ToolBar;
	betweenCellToolbar: ToolBar;
	focusIndicatorLeft: FastDomNode<HTMLElement>;
	focusIndicatorRight: FastDomNode<HTMLElement>;
	readonly disposables: DisposableStore;
	readonly elementDisposables: DisposableStore;
	bottomCellContainer: HTMLElement;
	currentRenderedCell?: ICellViewModel;
	statusBar: CellEditorStatusBar;
	titleMenu: IMenu;
	toJSON: () => object;
}

export interface MarkdownCellRenderTemplate extends BaseCellRenderTemplate {
	editorContainer: HTMLElement;
	foldingIndicator: HTMLElement;
	focusIndicatorBottom: HTMLElement;
	currentEditor?: ICodeEditor;
}

export interface CodeCellRenderTemplate extends BaseCellRenderTemplate {
	runToolbar: ToolBar;
	runButtonContainer: HTMLElement;
	executionOrderLabel: HTMLElement;
	outputContainer: FastDomNode<HTMLElement>;
	cellOutputCollapsedContainer: HTMLElement;
	outputShowMoreContainer: FastDomNode<HTMLElement>;
	focusSinkElement: HTMLElement;
	editor: ICodeEditor;
	progressBar: ProgressBar;
	collapsedProgressBar: ProgressBar;
	focusIndicatorRight: FastDomNode<HTMLElement>;
	focusIndicatorBottom: FastDomNode<HTMLElement>;
	dragHandle: FastDomNode<HTMLElement>;
}

export function isCodeCellRenderTemplate(templateData: BaseCellRenderTemplate): templateData is CodeCellRenderTemplate {
	return !!(templateData as CodeCellRenderTemplate).runToolbar;
}

export interface IOutputTransformContribution {
	getType(): RenderOutputType;
	getMimetypes(): string[];
	/**
	 * Dispose this contribution.
	 */
	dispose(): void;

	/**
	 * Returns contents to place in the webview inset, or the {@link IRenderNoOutput}.
	 * This call is allowed to have side effects, such as placing output
	 * directly into the container element.
	 */
	render(output: ICellOutputViewModel, item: IOutputItemDto, container: HTMLElement, notebookUri: URI): IRenderOutput;
}

/**
 * Notebook Editor Delegate for output rendering
 */
export interface INotebookDelegateForOutput {
	readonly creationOptions: INotebookEditorCreationOptions;
	getCellOutputLayoutInfo(cell: IGenericCellViewModel): INotebookCellOutputLayoutInfo;
}
