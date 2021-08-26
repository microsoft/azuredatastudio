/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { IMouseWheelEvent } from 'vs/base/browser/mouseEvent';
import { IListRenderer, IListVirtualDelegate, ListError } from 'vs/base/browser/ui/list/list';
import { IListStyles, IStyleController } from 'vs/base/browser/ui/list/listWidget';
import { Emitter, Event } from 'vs/base/common/event';
import { DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { isMacintosh } from 'vs/base/common/platform';
import { ScrollEvent } from 'vs/base/common/scrollable';
import { Range } from 'vs/editor/common/core/range';
import { TrackedRangeStickiness } from 'vs/editor/common/model';
import { PrefixSumComputer } from 'vs/editor/common/viewModel/prefixSumComputer';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IListService, IWorkbenchListOptions, WorkbenchList } from 'vs/platform/list/browser/listService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { CellRevealPosition, CellRevealType, CursorAtBoundary, getVisibleCells, ICellViewModel, INotebookCellList, reduceCellRanges, CellEditState, CellFocusMode, BaseCellRenderTemplate, NOTEBOOK_CELL_LIST_FOCUSED, cellRangesEqual, ICellOutputViewModel } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import { CellViewModel, NotebookViewModel } from 'vs/workbench/contrib/notebook/browser/viewModel/notebookViewModel';
import { diff, NOTEBOOK_EDITOR_CURSOR_BOUNDARY, CellKind, SelectionStateType } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { ICellRange, cellRangesToIndexes } from 'vs/workbench/contrib/notebook/common/notebookRange';
import { clamp } from 'vs/base/common/numbers';
import { ISplice } from 'vs/base/common/sequence';
import { ViewContext } from 'vs/workbench/contrib/notebook/browser/viewModel/viewContext';

export interface IFocusNextPreviousDelegate {
	onFocusNext(applyFocusNext: () => void): void;
	onFocusPrevious(applyFocusPrevious: () => void): void;
}

export interface INotebookCellListOptions extends IWorkbenchListOptions<CellViewModel> {
	focusNextPreviousDelegate: IFocusNextPreviousDelegate;
}

export class NotebookCellList extends WorkbenchList<CellViewModel> implements IDisposable, IStyleController, INotebookCellList {
	get onWillScroll(): Event<ScrollEvent> { return this.view.onWillScroll; }

	get rowsContainer(): HTMLElement {
		return this.view.containerDomNode;
	}
	private _previousFocusedElements: CellViewModel[] = [];
	private _localDisposableStore = new DisposableStore();
	private _viewModelStore = new DisposableStore();
	private styleElement?: HTMLStyleElement;

	private readonly _onDidRemoveOutputs = new Emitter<readonly ICellOutputViewModel[]>();
	readonly onDidRemoveOutputs = this._onDidRemoveOutputs.event;

	private readonly _onDidHideOutputs = new Emitter<readonly ICellOutputViewModel[]>();
	readonly onDidHideOutputs = this._onDidHideOutputs.event;

	private readonly _onDidRemoveCellsFromView = new Emitter<readonly ICellViewModel[]>();
	readonly onDidRemoveCellsFromView = this._onDidRemoveCellsFromView.event;

	private _viewModel: NotebookViewModel | null = null;
	get viewModel(): NotebookViewModel | null {
		return this._viewModel;
	}
	private _hiddenRangeIds: string[] = [];
	private hiddenRangesPrefixSum: PrefixSumComputer | null = null;

	private readonly _onDidChangeVisibleRanges = new Emitter<void>();

	onDidChangeVisibleRanges: Event<void> = this._onDidChangeVisibleRanges.event;
	private _visibleRanges: ICellRange[] = [];

	get visibleRanges() {
		return this._visibleRanges;
	}

	set visibleRanges(ranges: ICellRange[]) {
		if (cellRangesEqual(this._visibleRanges, ranges)) {
			return;
		}

		this._visibleRanges = ranges;
		this._onDidChangeVisibleRanges.fire();
	}

	private _isDisposed = false;

	get isDisposed() {
		return this._isDisposed;
	}

	private _isInLayout: boolean = false;

	private readonly _focusNextPreviousDelegate: IFocusNextPreviousDelegate;

	private readonly _viewContext: ViewContext;

	constructor(
		private listUser: string,
		parentContainer: HTMLElement,
		container: HTMLElement,
		viewContext: ViewContext,
		delegate: IListVirtualDelegate<CellViewModel>,
		renderers: IListRenderer<CellViewModel, BaseCellRenderTemplate>[],
		contextKeyService: IContextKeyService,
		options: INotebookCellListOptions,
		@IListService listService: IListService,
		@IThemeService themeService: IThemeService,
		@IConfigurationService configurationService: IConfigurationService,
		@IKeybindingService keybindingService: IKeybindingService
	) {
		super(listUser, container, delegate, renderers, options, contextKeyService, listService, themeService, configurationService, keybindingService);
		NOTEBOOK_CELL_LIST_FOCUSED.bindTo(this.contextKeyService).set(true);
		this._viewContext = viewContext;
		this._focusNextPreviousDelegate = options.focusNextPreviousDelegate;
		this._previousFocusedElements = this.getFocusedElements();
		this._localDisposableStore.add(this.onDidChangeFocus((e) => {
			this._previousFocusedElements.forEach(element => {
				if (e.elements.indexOf(element) < 0) {
					element.onDeselect();
				}
			});
			this._previousFocusedElements = e.elements;

			if (document.activeElement && document.activeElement.classList.contains('webview')) {
				super.domFocus();
			}
		}));

		const notebookEditorCursorAtBoundaryContext = NOTEBOOK_EDITOR_CURSOR_BOUNDARY.bindTo(contextKeyService);
		notebookEditorCursorAtBoundaryContext.set('none');

		let cursorSelectionListener: IDisposable | null = null;
		let textEditorAttachListener: IDisposable | null = null;

		const recomputeContext = (element: CellViewModel) => {
			switch (element.cursorAtBoundary()) {
				case CursorAtBoundary.Both:
					notebookEditorCursorAtBoundaryContext.set('both');
					break;
				case CursorAtBoundary.Top:
					notebookEditorCursorAtBoundaryContext.set('top');
					break;
				case CursorAtBoundary.Bottom:
					notebookEditorCursorAtBoundaryContext.set('bottom');
					break;
				default:
					notebookEditorCursorAtBoundaryContext.set('none');
					break;
			}

			return;
		};

		// Cursor Boundary context
		this._localDisposableStore.add(this.onDidChangeFocus((e) => {
			if (e.elements.length) {
				cursorSelectionListener?.dispose();
				textEditorAttachListener?.dispose();
				// we only validate the first focused element
				const focusedElement = e.elements[0];

				cursorSelectionListener = focusedElement.onDidChangeState((e) => {
					if (e.selectionChanged) {
						recomputeContext(focusedElement);
					}
				});

				textEditorAttachListener = focusedElement.onDidChangeEditorAttachState(() => {
					if (focusedElement.editorAttached) {
						recomputeContext(focusedElement);
					}
				});

				recomputeContext(focusedElement);
				return;
			}

			// reset context
			notebookEditorCursorAtBoundaryContext.set('none');
		}));

		this._localDisposableStore.add(this.view.onMouseDblClick(() => {
			const focus = this.getFocusedElements()[0];

			if (focus && focus.cellKind === CellKind.Markup && !focus.metadata.inputCollapsed) {
				focus.updateEditState(CellEditState.Editing, 'dbclick');
				focus.focusMode = CellFocusMode.Editor;
			}
		}));

		// update visibleRanges
		const updateVisibleRanges = () => {
			if (!this.view.length) {
				return;
			}

			const top = this.getViewScrollTop();
			const bottom = this.getViewScrollBottom();
			if (top >= bottom) {
				return;
			}

			const topViewIndex = clamp(this.view.indexAt(top), 0, this.view.length - 1);
			const topElement = this.view.element(topViewIndex);
			const topModelIndex = this._viewModel!.getCellIndex(topElement);
			const bottomViewIndex = clamp(this.view.indexAt(bottom), 0, this.view.length - 1);
			const bottomElement = this.view.element(bottomViewIndex);
			const bottomModelIndex = this._viewModel!.getCellIndex(bottomElement);

			if (bottomModelIndex - topModelIndex === bottomViewIndex - topViewIndex) {
				this.visibleRanges = [{ start: topModelIndex, end: bottomModelIndex }];
			} else {
				this.visibleRanges = this._getVisibleRangesFromIndex(topViewIndex, topModelIndex, bottomViewIndex, bottomModelIndex);
			}
		};

		this._localDisposableStore.add(this.view.onDidChangeContentHeight(() => {
			if (this._isInLayout) {
				DOM.scheduleAtNextAnimationFrame(() => {
					updateVisibleRanges();
				});
			}
			updateVisibleRanges();
		}));
		this._localDisposableStore.add(this.view.onDidScroll(() => {
			if (this._isInLayout) {
				DOM.scheduleAtNextAnimationFrame(() => {
					updateVisibleRanges();
				});
			}
			updateVisibleRanges();
		}));
	}

	elementAt(position: number): ICellViewModel | undefined {
		if (!this.view.length) {
			return undefined;
		}

		const idx = this.view.indexAt(position);
		const clamped = clamp(idx, 0, this.view.length - 1);
		return this.element(clamped);
	}

	elementHeight(element: ICellViewModel): number {
		const index = this._getViewIndexUpperBound(element);
		if (index === undefined || index < 0 || index >= this.length) {
			this._getViewIndexUpperBound(element);
			throw new ListError(this.listUser, `Invalid index ${index}`);
		}

		return this.view.elementHeight(index);
	}

	detachViewModel() {
		this._viewModelStore.clear();
		this._viewModel = null;
		this.hiddenRangesPrefixSum = null;
	}

	attachViewModel(model: NotebookViewModel) {
		this._viewModel = model;
		this._viewModelStore.add(model.onDidChangeViewCells((e) => {
			if (this._isDisposed) {
				return;
			}

			const currentRanges = this._hiddenRangeIds.map(id => this._viewModel!.getTrackedRange(id)).filter(range => range !== null) as ICellRange[];
			const newVisibleViewCells: CellViewModel[] = getVisibleCells(this._viewModel!.viewCells as CellViewModel[], currentRanges);

			const oldVisibleViewCells: CellViewModel[] = [];
			const oldViewCellMapping = new Set<string>();
			for (let i = 0; i < this.length; i++) {
				oldVisibleViewCells.push(this.element(i));
				oldViewCellMapping.add(this.element(i).uri.toString());
			}

			const viewDiffs = diff<CellViewModel>(oldVisibleViewCells, newVisibleViewCells, a => {
				return oldViewCellMapping.has(a.uri.toString());
			});

			if (e.synchronous) {
				this._updateElementsInWebview(viewDiffs);
			} else {
				this._viewModelStore.add(DOM.scheduleAtNextAnimationFrame(() => {
					if (this._isDisposed) {
						return;
					}

					this._updateElementsInWebview(viewDiffs);
				}));
			}
		}));

		this._viewModelStore.add(model.onDidChangeSelection((e) => {
			if (e === 'view') {
				return;
			}

			// convert model selections to view selections
			const viewSelections = cellRangesToIndexes(model.getSelections()).map(index => model.cellAt(index)).filter(cell => !!cell).map(cell => this._getViewIndexUpperBound(cell!));
			this.setSelection(viewSelections, undefined, true);
			const primary = cellRangesToIndexes([model.getFocus()]).map(index => model.cellAt(index)).filter(cell => !!cell).map(cell => this._getViewIndexUpperBound(cell!));

			if (primary.length) {
				this.setFocus(primary, undefined, true);
			}
		}));

		const hiddenRanges = model.getHiddenRanges();
		this.setHiddenAreas(hiddenRanges, false);
		const newRanges = reduceCellRanges(hiddenRanges);
		const viewCells = model.viewCells.slice(0) as CellViewModel[];
		newRanges.reverse().forEach(range => {
			const removedCells = viewCells.splice(range.start, range.end - range.start + 1);
			this._onDidRemoveCellsFromView.fire(removedCells);
		});

		this.splice2(0, 0, viewCells);
	}

	private _updateElementsInWebview(viewDiffs: ISplice<CellViewModel>[]) {
		viewDiffs.reverse().forEach((diff) => {
			const hiddenOutputs: ICellOutputViewModel[] = [];
			const deletedOutputs: ICellOutputViewModel[] = [];
			const removedMarkdownCells: ICellViewModel[] = [];

			for (let i = diff.start; i < diff.start + diff.deleteCount; i++) {
				const cell = this.element(i);
				if (cell.cellKind === CellKind.Code) {
					if (this._viewModel!.hasCell(cell.handle)) {
						hiddenOutputs.push(...cell?.outputsViewModels);
					} else {
						deletedOutputs.push(...cell?.outputsViewModels);
					}
				} else {
					removedMarkdownCells.push(cell);
				}
			}

			this.splice2(diff.start, diff.deleteCount, diff.toInsert);

			this._onDidHideOutputs.fire(hiddenOutputs);
			this._onDidRemoveOutputs.fire(deletedOutputs);
			this._onDidRemoveCellsFromView.fire(removedMarkdownCells);
		});
	}

	clear() {
		super.splice(0, this.length);
	}

	setHiddenAreas(_ranges: ICellRange[], triggerViewUpdate: boolean): boolean {
		if (!this._viewModel) {
			return false;
		}

		const newRanges = reduceCellRanges(_ranges);
		// delete old tracking ranges
		const oldRanges = this._hiddenRangeIds.map(id => this._viewModel!.getTrackedRange(id)).filter(range => range !== null) as ICellRange[];
		if (newRanges.length === oldRanges.length) {
			let hasDifference = false;
			for (let i = 0; i < newRanges.length; i++) {
				if (!(newRanges[i].start === oldRanges[i].start && newRanges[i].end === oldRanges[i].end)) {
					hasDifference = true;
					break;
				}
			}

			if (!hasDifference) {
				// they call 'setHiddenAreas' for a reason, even if the ranges are still the same, it's possible that the hiddenRangeSum is not update to date
				this._updateHiddenRangePrefixSum(newRanges);
				return false;
			}
		}

		this._hiddenRangeIds.forEach(id => this._viewModel!.setTrackedRange(id, null, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter));
		const hiddenAreaIds = newRanges.map(range => this._viewModel!.setTrackedRange(null, range, TrackedRangeStickiness.GrowsOnlyWhenTypingAfter)).filter(id => id !== null) as string[];

		this._hiddenRangeIds = hiddenAreaIds;

		// set hidden ranges prefix sum
		this._updateHiddenRangePrefixSum(newRanges);

		if (triggerViewUpdate) {
			this.updateHiddenAreasInView(oldRanges, newRanges);
		}

		return true;
	}

	private _updateHiddenRangePrefixSum(newRanges: ICellRange[]) {
		let start = 0;
		let index = 0;
		const ret: number[] = [];

		while (index < newRanges.length) {
			for (let j = start; j < newRanges[index].start - 1; j++) {
				ret.push(1);
			}

			ret.push(newRanges[index].end - newRanges[index].start + 1 + 1);
			start = newRanges[index].end + 1;
			index++;
		}

		for (let i = start; i < this._viewModel!.length; i++) {
			ret.push(1);
		}

		const values = new Uint32Array(ret.length);
		for (let i = 0; i < ret.length; i++) {
			values[i] = ret[i];
		}

		this.hiddenRangesPrefixSum = new PrefixSumComputer(values);
	}

	/**
	 * oldRanges and newRanges are all reduced and sorted.
	 */
	updateHiddenAreasInView(oldRanges: ICellRange[], newRanges: ICellRange[]) {
		const oldViewCellEntries: CellViewModel[] = getVisibleCells(this._viewModel!.viewCells as CellViewModel[], oldRanges);
		const oldViewCellMapping = new Set<string>();
		oldViewCellEntries.forEach(cell => {
			oldViewCellMapping.add(cell.uri.toString());
		});

		const newViewCellEntries: CellViewModel[] = getVisibleCells(this._viewModel!.viewCells as CellViewModel[], newRanges);

		const viewDiffs = diff<CellViewModel>(oldViewCellEntries, newViewCellEntries, a => {
			return oldViewCellMapping.has(a.uri.toString());
		});

		this._updateElementsInWebview(viewDiffs);
	}

	splice2(start: number, deleteCount: number, elements: CellViewModel[] = []): void {
		// we need to convert start and delete count based on hidden ranges
		if (start < 0 || start > this.view.length) {
			return;
		}

		const focusInside = DOM.isAncestor(document.activeElement, this.rowsContainer);
		super.splice(start, deleteCount, elements);
		if (focusInside) {
			this.domFocus();
		}

		const selectionsLeft = [];
		this.getSelectedElements().map(el => el.handle).forEach(handle => {
			if (this._viewModel!.hasCell(handle)) {
				selectionsLeft.push(handle);
			}
		});

		if (!selectionsLeft.length && this._viewModel!.viewCells.length) {
			// after splice, the selected cells are deleted
			this._viewModel!.updateSelectionsState({ kind: SelectionStateType.Index, focus: { start: 0, end: 1 }, selections: [{ start: 0, end: 1 }] });
		}
	}

	getModelIndex(cell: CellViewModel): number | undefined {
		const viewIndex = this.indexOf(cell);
		return this.getModelIndex2(viewIndex);
	}

	getModelIndex2(viewIndex: number): number | undefined {
		if (!this.hiddenRangesPrefixSum) {
			return viewIndex;
		}

		const modelIndex = this.hiddenRangesPrefixSum.getAccumulatedValue(viewIndex - 1);
		return modelIndex;
	}

	getViewIndex(cell: ICellViewModel) {
		const modelIndex = this._viewModel!.getCellIndex(cell);
		return this.getViewIndex2(modelIndex);
	}

	getViewIndex2(modelIndex: number): number | undefined {
		if (!this.hiddenRangesPrefixSum) {
			return modelIndex;
		}

		const viewIndexInfo = this.hiddenRangesPrefixSum.getIndexOf(modelIndex);

		if (viewIndexInfo.remainder !== 0) {
			if (modelIndex >= this.hiddenRangesPrefixSum.getTotalValue()) {
				// it's already after the last hidden range
				return modelIndex - (this.hiddenRangesPrefixSum.getTotalValue() - this.hiddenRangesPrefixSum.getCount());
			}
			return undefined;
		} else {
			return viewIndexInfo.index;
		}
	}

	private _getVisibleRangesFromIndex(topViewIndex: number, topModelIndex: number, bottomViewIndex: number, bottomModelIndex: number) {
		let stack: number[] = [];
		const ranges: ICellRange[] = [];
		// there are hidden ranges
		let index = topViewIndex;
		let modelIndex = topModelIndex;

		while (index <= bottomViewIndex) {
			const accu = this.hiddenRangesPrefixSum!.getAccumulatedValue(index);
			if (accu === modelIndex + 1) {
				// no hidden area after it
				if (stack.length) {
					if (stack[stack.length - 1] === modelIndex - 1) {
						ranges.push({ start: stack[stack.length - 1], end: modelIndex });
					} else {
						ranges.push({ start: stack[stack.length - 1], end: stack[stack.length - 1] });
					}
				}

				stack.push(modelIndex);
				index++;
				modelIndex++;
			} else {
				// there are hidden ranges after it
				if (stack.length) {
					if (stack[stack.length - 1] === modelIndex - 1) {
						ranges.push({ start: stack[stack.length - 1], end: modelIndex });
					} else {
						ranges.push({ start: stack[stack.length - 1], end: stack[stack.length - 1] });
					}
				}

				stack.push(modelIndex);
				index++;
				modelIndex = accu;
			}
		}

		if (stack.length) {
			ranges.push({ start: stack[stack.length - 1], end: stack[stack.length - 1] });
		}

		return reduceCellRanges(ranges);
	}

	getVisibleRangesPlusViewportAboveBelow() {
		if (this.view.length <= 0) {
			return [];
		}

		const top = clamp(this.getViewScrollTop() - this.renderHeight, 0, this.scrollHeight);
		const bottom = clamp(this.getViewScrollBottom() + this.renderHeight, 0, this.scrollHeight);
		const topViewIndex = clamp(this.view.indexAt(top), 0, this.view.length - 1);
		const topElement = this.view.element(topViewIndex);
		const topModelIndex = this._viewModel!.getCellIndex(topElement);
		const bottomViewIndex = clamp(this.view.indexAt(bottom), 0, this.view.length - 1);
		const bottomElement = this.view.element(bottomViewIndex);
		const bottomModelIndex = this._viewModel!.getCellIndex(bottomElement);

		if (bottomModelIndex - topModelIndex === bottomViewIndex - topViewIndex) {
			return [{ start: topModelIndex, end: bottomModelIndex }];
		} else {
			return this._getVisibleRangesFromIndex(topViewIndex, topModelIndex, bottomViewIndex, bottomModelIndex);
		}
	}

	private _getViewIndexUpperBound(cell: ICellViewModel): number {
		if (!this._viewModel) {
			return -1;
		}

		const modelIndex = this._viewModel.getCellIndex(cell);
		if (!this.hiddenRangesPrefixSum) {
			return modelIndex;
		}

		const viewIndexInfo = this.hiddenRangesPrefixSum.getIndexOf(modelIndex);

		if (viewIndexInfo.remainder !== 0) {
			if (modelIndex >= this.hiddenRangesPrefixSum.getTotalValue()) {
				return modelIndex - (this.hiddenRangesPrefixSum.getTotalValue() - this.hiddenRangesPrefixSum.getCount());
			}
		}

		return viewIndexInfo.index;
	}

	private _getViewIndexUpperBound2(modelIndex: number) {
		if (!this.hiddenRangesPrefixSum) {
			return modelIndex;
		}

		const viewIndexInfo = this.hiddenRangesPrefixSum.getIndexOf(modelIndex);

		if (viewIndexInfo.remainder !== 0) {
			if (modelIndex >= this.hiddenRangesPrefixSum.getTotalValue()) {
				return modelIndex - (this.hiddenRangesPrefixSum.getTotalValue() - this.hiddenRangesPrefixSum.getCount());
			}
		}

		return viewIndexInfo.index;
	}

	focusElement(cell: ICellViewModel) {
		const index = this._getViewIndexUpperBound(cell);

		if (index >= 0 && this._viewModel) {
			// update view model first, which will update both `focus` and `selection` in a single transaction
			const focusedElementHandle = this.element(index).handle;
			this._viewModel.updateSelectionsState({
				kind: SelectionStateType.Handle,
				primary: focusedElementHandle,
				selections: [focusedElementHandle]
			}, 'view');

			// update the view as previous model update will not trigger event
			this.setFocus([index], undefined, false);
		}
	}

	selectElements(elements: ICellViewModel[]) {
		const indices = elements.map(cell => this._getViewIndexUpperBound(cell)).filter(index => index >= 0);
		this.setSelection(indices);
	}

	override focusNext(n: number | undefined, loop: boolean | undefined, browserEvent?: UIEvent, filter?: (element: CellViewModel) => boolean): void {
		this._focusNextPreviousDelegate.onFocusNext(() => {
			super.focusNext(n, loop, browserEvent, filter);
		});
	}

	override focusPrevious(n: number | undefined, loop: boolean | undefined, browserEvent?: UIEvent, filter?: (element: CellViewModel) => boolean): void {
		this._focusNextPreviousDelegate.onFocusPrevious(() => {
			super.focusPrevious(n, loop, browserEvent, filter);
		});
	}

	override setFocus(indexes: number[], browserEvent?: UIEvent, ignoreTextModelUpdate?: boolean): void {
		if (ignoreTextModelUpdate) {
			super.setFocus(indexes, browserEvent);
			return;
		}

		if (!indexes.length) {
			if (this._viewModel) {
				this._viewModel.updateSelectionsState({
					kind: SelectionStateType.Handle,
					primary: null,
					selections: []
				}, 'view');
			}
		} else {
			if (this._viewModel) {
				const focusedElementHandle = this.element(indexes[0]).handle;
				this._viewModel.updateSelectionsState({
					kind: SelectionStateType.Handle,
					primary: focusedElementHandle,
					selections: this.getSelection().map(selection => this.element(selection).handle)
				}, 'view');
			}
		}

		super.setFocus(indexes, browserEvent);
	}

	override setSelection(indexes: number[], browserEvent?: UIEvent | undefined, ignoreTextModelUpdate?: boolean) {
		if (ignoreTextModelUpdate) {
			super.setSelection(indexes, browserEvent);
			return;
		}

		if (!indexes.length) {
			if (this._viewModel) {
				this._viewModel.updateSelectionsState({
					kind: SelectionStateType.Handle,
					primary: this.getFocusedElements()[0]?.handle ?? null,
					selections: []
				}, 'view');
			}
		} else {
			if (this._viewModel) {
				this._viewModel.updateSelectionsState({
					kind: SelectionStateType.Handle,
					primary: this.getFocusedElements()[0]?.handle ?? null,
					selections: indexes.map(index => this.element(index)).map(cell => cell.handle)
				}, 'view');
			}
		}

		super.setSelection(indexes, browserEvent);
	}

	/**
	 * The range will be revealed with as little scrolling as possible.
	 */
	revealElementsInView(range: ICellRange) {
		const startIndex = this._getViewIndexUpperBound2(range.start);

		if (startIndex < 0) {
			return;
		}

		const endIndex = this._getViewIndexUpperBound2(range.end - 1);

		const scrollTop = this.getViewScrollTop();
		const wrapperBottom = this.getViewScrollBottom();
		const elementTop = this.view.elementTop(startIndex);
		if (elementTop >= scrollTop
			&& elementTop < wrapperBottom) {
			// start element is visible
			// check end

			const endElementTop = this.view.elementTop(endIndex);
			const endElementHeight = this.view.elementHeight(endIndex);

			if (endElementTop + endElementHeight <= wrapperBottom) {
				// fully visible
				return;
			}

			if (endElementTop >= wrapperBottom) {
				return this._revealInternal(endIndex, false, CellRevealPosition.Bottom);
			}

			if (endElementTop < wrapperBottom) {
				// end element partially visible
				if (endElementTop + endElementHeight - wrapperBottom < elementTop - scrollTop) {
					// there is enough space to just scroll up a little bit to make the end element visible
					return this.view.setScrollTop(scrollTop + endElementTop + endElementHeight - wrapperBottom);
				} else {
					// don't even try it
					return this._revealInternal(startIndex, false, CellRevealPosition.Top);
				}
			}
		}


		this._revealInView(startIndex);
	}

	revealElementInView(cell: ICellViewModel) {
		const index = this._getViewIndexUpperBound(cell);

		if (index >= 0) {
			this._revealInView(index);
		}
	}

	revealElementInViewAtTop(cell: ICellViewModel) {
		const index = this._getViewIndexUpperBound(cell);

		if (index >= 0) {
			this._revealInternal(index, false, CellRevealPosition.Top);
		}
	}

	revealElementInCenterIfOutsideViewport(cell: ICellViewModel) {
		const index = this._getViewIndexUpperBound(cell);

		if (index >= 0) {
			this._revealInCenterIfOutsideViewport(index);
		}
	}

	revealElementInCenter(cell: ICellViewModel) {
		const index = this._getViewIndexUpperBound(cell);

		if (index >= 0) {
			this._revealInCenter(index);
		}
	}

	async revealElementInCenterIfOutsideViewportAsync(cell: ICellViewModel): Promise<void> {
		const index = this._getViewIndexUpperBound(cell);

		if (index >= 0) {
			return this._revealInCenterIfOutsideViewportAsync(index);
		}
	}

	async revealElementLineInViewAsync(cell: ICellViewModel, line: number): Promise<void> {
		const index = this._getViewIndexUpperBound(cell);

		if (index >= 0) {
			return this._revealLineInViewAsync(index, line);
		}
	}

	async revealElementLineInCenterAsync(cell: ICellViewModel, line: number): Promise<void> {
		const index = this._getViewIndexUpperBound(cell);

		if (index >= 0) {
			return this._revealLineInCenterAsync(index, line);
		}
	}

	async revealElementLineInCenterIfOutsideViewportAsync(cell: ICellViewModel, line: number): Promise<void> {
		const index = this._getViewIndexUpperBound(cell);

		if (index >= 0) {
			return this._revealLineInCenterIfOutsideViewportAsync(index, line);
		}
	}

	async revealElementRangeInViewAsync(cell: ICellViewModel, range: Range): Promise<void> {
		const index = this._getViewIndexUpperBound(cell);

		if (index >= 0) {
			return this._revealRangeInView(index, range);
		}
	}

	async revealElementRangeInCenterAsync(cell: ICellViewModel, range: Range): Promise<void> {
		const index = this._getViewIndexUpperBound(cell);

		if (index >= 0) {
			return this._revealRangeInCenterAsync(index, range);
		}
	}

	async revealElementRangeInCenterIfOutsideViewportAsync(cell: ICellViewModel, range: Range): Promise<void> {
		const index = this._getViewIndexUpperBound(cell);

		if (index >= 0) {
			return this._revealRangeInCenterIfOutsideViewportAsync(index, range);
		}
	}

	domElementOfElement(element: ICellViewModel): HTMLElement | null {
		const index = this._getViewIndexUpperBound(element);
		if (index >= 0) {
			return this.view.domElement(index);
		}

		return null;
	}

	focusView() {
		this.view.domNode.focus();
	}

	getAbsoluteTopOfElement(element: ICellViewModel): number {
		const index = this._getViewIndexUpperBound(element);
		if (index === undefined || index < 0 || index >= this.length) {
			this._getViewIndexUpperBound(element);
			throw new ListError(this.listUser, `Invalid index ${index}`);
		}

		return this.view.elementTop(index);
	}

	triggerScrollFromMouseWheelEvent(browserEvent: IMouseWheelEvent) {
		this.view.triggerScrollFromMouseWheelEvent(browserEvent);
	}


	updateElementHeight2(element: ICellViewModel, size: number): void {
		const index = this._getViewIndexUpperBound(element);
		if (index === undefined || index < 0 || index >= this.length) {
			return;
		}

		const focused = this.getFocus();
		if (!focused.length) {
			this.view.updateElementHeight(index, size, null);
			return;
		}

		const focus = focused[0];

		if (focus <= index) {
			this.view.updateElementHeight(index, size, focus);
			return;
		}

		// the `element` is in the viewport, it's very often that the height update is triggerred by user interaction (collapse, run cell)
		// then we should make sure that the `element`'s visual view position doesn't change.

		if (this.view.elementTop(index) > this.view.scrollTop) {
			this.view.updateElementHeight(index, size, index);
			return;
		}

		this.view.updateElementHeight(index, size, focus);
	}

	// override
	override domFocus() {
		const focused = this.getFocusedElements()[0];
		const focusedDomElement = focused && this.domElementOfElement(focused);

		if (document.activeElement && focusedDomElement && focusedDomElement.contains(document.activeElement)) {
			// for example, when focus goes into monaco editor, if we refocus the list view, the editor will lose focus.
			return;
		}

		if (!isMacintosh && document.activeElement && isContextMenuFocused()) {
			return;
		}

		super.domFocus();
	}

	getViewScrollTop() {
		return this.view.getScrollTop();
	}

	getViewScrollBottom() {
		const topInsertToolbarHeight = this._viewContext.notebookOptions.computeTopInserToolbarHeight(this.viewModel?.viewType);
		return this.getViewScrollTop() + this.view.renderHeight - topInsertToolbarHeight;
	}

	private _revealRange(viewIndex: number, range: Range, revealType: CellRevealType, newlyCreated: boolean, alignToBottom: boolean) {
		const element = this.view.element(viewIndex);
		const scrollTop = this.getViewScrollTop();
		const wrapperBottom = this.getViewScrollBottom();
		const positionOffset = element.getPositionScrollTopOffset(range.startLineNumber, range.startColumn);
		const elementTop = this.view.elementTop(viewIndex);
		const positionTop = elementTop + positionOffset;

		// TODO@rebornix 30 ---> line height * 1.5
		if (positionTop < scrollTop) {
			this.view.setScrollTop(positionTop - 30);
		} else if (positionTop > wrapperBottom) {
			this.view.setScrollTop(scrollTop + positionTop - wrapperBottom + 30);
		} else if (newlyCreated) {
			// newly scrolled into view
			if (alignToBottom) {
				// align to the bottom
				this.view.setScrollTop(scrollTop + positionTop - wrapperBottom + 30);
			} else {
				// align to to top
				this.view.setScrollTop(positionTop - 30);
			}
		}

		if (revealType === CellRevealType.Range) {
			element.revealRangeInCenter(range);
		}
	}

	// List items have real dynamic heights, which means after we set `scrollTop` based on the `elementTop(index)`, the element at `index` might still be removed from the view once all relayouting tasks are done.
	// For example, we scroll item 10 into the view upwards, in the first round, items 7, 8, 9, 10 are all in the viewport. Then item 7 and 8 resize themselves to be larger and finally item 10 is removed from the view.
	// To ensure that item 10 is always there, we need to scroll item 10 to the top edge of the viewport.
	private async _revealRangeInternalAsync(viewIndex: number, range: Range, revealType: CellRevealType): Promise<void> {
		const scrollTop = this.getViewScrollTop();
		const wrapperBottom = this.getViewScrollBottom();
		const elementTop = this.view.elementTop(viewIndex);
		const element = this.view.element(viewIndex);

		if (element.editorAttached) {
			this._revealRange(viewIndex, range, revealType, false, false);
		} else {
			const elementHeight = this.view.elementHeight(viewIndex);
			let upwards = false;

			if (elementTop + elementHeight < scrollTop) {
				// scroll downwards
				this.view.setScrollTop(elementTop);
				upwards = false;
			} else if (elementTop > wrapperBottom) {
				// scroll upwards
				this.view.setScrollTop(elementTop - this.view.renderHeight / 2);
				upwards = true;
			}

			const editorAttachedPromise = new Promise<void>((resolve, reject) => {
				element.onDidChangeEditorAttachState(() => {
					element.editorAttached ? resolve() : reject();
				});
			});

			return editorAttachedPromise.then(() => {
				this._revealRange(viewIndex, range, revealType, true, upwards);
			});
		}
	}

	private async _revealLineInViewAsync(viewIndex: number, line: number): Promise<void> {
		return this._revealRangeInternalAsync(viewIndex, new Range(line, 1, line, 1), CellRevealType.Line);
	}

	private async _revealRangeInView(viewIndex: number, range: Range): Promise<void> {
		return this._revealRangeInternalAsync(viewIndex, range, CellRevealType.Range);
	}

	private async _revealRangeInCenterInternalAsync(viewIndex: number, range: Range, revealType: CellRevealType): Promise<void> {
		const reveal = (viewIndex: number, range: Range, revealType: CellRevealType) => {
			const element = this.view.element(viewIndex);
			const positionOffset = element.getPositionScrollTopOffset(range.startLineNumber, range.startColumn);
			const positionOffsetInView = this.view.elementTop(viewIndex) + positionOffset;
			this.view.setScrollTop(positionOffsetInView - this.view.renderHeight / 2);

			if (revealType === CellRevealType.Range) {
				element.revealRangeInCenter(range);
			}
		};

		const elementTop = this.view.elementTop(viewIndex);
		const viewItemOffset = elementTop;
		this.view.setScrollTop(viewItemOffset - this.view.renderHeight / 2);
		const element = this.view.element(viewIndex);

		if (!element.editorAttached) {
			return getEditorAttachedPromise(element).then(() => reveal(viewIndex, range, revealType));
		} else {
			reveal(viewIndex, range, revealType);
		}
	}

	private async _revealLineInCenterAsync(viewIndex: number, line: number): Promise<void> {
		return this._revealRangeInCenterInternalAsync(viewIndex, new Range(line, 1, line, 1), CellRevealType.Line);
	}

	private _revealRangeInCenterAsync(viewIndex: number, range: Range): Promise<void> {
		return this._revealRangeInCenterInternalAsync(viewIndex, range, CellRevealType.Range);
	}

	private async _revealRangeInCenterIfOutsideViewportInternalAsync(viewIndex: number, range: Range, revealType: CellRevealType): Promise<void> {
		const reveal = (viewIndex: number, range: Range, revealType: CellRevealType) => {
			const element = this.view.element(viewIndex);
			const positionOffset = element.getPositionScrollTopOffset(range.startLineNumber, range.startColumn);
			const positionOffsetInView = this.view.elementTop(viewIndex) + positionOffset;
			this.view.setScrollTop(positionOffsetInView - this.view.renderHeight / 2);

			if (revealType === CellRevealType.Range) {
				element.revealRangeInCenter(range);
			}
		};

		const scrollTop = this.getViewScrollTop();
		const wrapperBottom = this.getViewScrollBottom();
		const elementTop = this.view.elementTop(viewIndex);
		const viewItemOffset = elementTop;
		const element = this.view.element(viewIndex);
		const positionOffset = viewItemOffset + element.getPositionScrollTopOffset(range.startLineNumber, range.startColumn);

		if (positionOffset < scrollTop || positionOffset > wrapperBottom) {
			// let it render
			this.view.setScrollTop(positionOffset - this.view.renderHeight / 2);

			// after rendering, it might be pushed down due to markdown cell dynamic height
			const newPositionOffset = this.view.elementTop(viewIndex) + element.getPositionScrollTopOffset(range.startLineNumber, range.startColumn);
			this.view.setScrollTop(newPositionOffset - this.view.renderHeight / 2);

			// reveal editor
			if (!element.editorAttached) {
				return getEditorAttachedPromise(element).then(() => reveal(viewIndex, range, revealType));
			} else {
				// for example markdown
			}
		} else {
			if (element.editorAttached) {
				element.revealRangeInCenter(range);
			} else {
				// for example, markdown cell in preview mode
				return getEditorAttachedPromise(element).then(() => reveal(viewIndex, range, revealType));
			}
		}
	}

	private async _revealInCenterIfOutsideViewportAsync(viewIndex: number): Promise<void> {
		this._revealInternal(viewIndex, true, CellRevealPosition.Center);
		const element = this.view.element(viewIndex);

		// wait for the editor to be created only if the cell is in editing mode (meaning it has an editor and will focus the editor)
		if (element.getEditState() === CellEditState.Editing && !element.editorAttached) {
			return getEditorAttachedPromise(element);
		}

		return;
	}

	private async _revealLineInCenterIfOutsideViewportAsync(viewIndex: number, line: number): Promise<void> {
		return this._revealRangeInCenterIfOutsideViewportInternalAsync(viewIndex, new Range(line, 1, line, 1), CellRevealType.Line);
	}

	private async _revealRangeInCenterIfOutsideViewportAsync(viewIndex: number, range: Range): Promise<void> {
		return this._revealRangeInCenterIfOutsideViewportInternalAsync(viewIndex, range, CellRevealType.Range);
	}

	private _revealInternal(viewIndex: number, ignoreIfInsideViewport: boolean, revealPosition: CellRevealPosition) {
		if (viewIndex >= this.view.length) {
			return;
		}

		const scrollTop = this.getViewScrollTop();
		const wrapperBottom = this.getViewScrollBottom();
		const elementTop = this.view.elementTop(viewIndex);
		const elementBottom = this.view.elementHeight(viewIndex) + elementTop;

		if (ignoreIfInsideViewport
			&& elementTop >= scrollTop
			&& elementTop < wrapperBottom) {

			if (revealPosition === CellRevealPosition.Center
				&& elementBottom > wrapperBottom
				&& elementTop > (scrollTop + wrapperBottom) / 2) {
				// the element is partially visible and it's below the center of the viewport
			} else {
				return;
			}
		}

		switch (revealPosition) {
			case CellRevealPosition.Top:
				this.view.setScrollTop(elementTop);
				this.view.setScrollTop(this.view.elementTop(viewIndex));
				break;
			case CellRevealPosition.Center:
				this.view.setScrollTop(elementTop - this.view.renderHeight / 2);
				this.view.setScrollTop(this.view.elementTop(viewIndex) - this.view.renderHeight / 2);
				break;
			case CellRevealPosition.Bottom:
				this.view.setScrollTop(this.scrollTop + (elementBottom - wrapperBottom));
				this.view.setScrollTop(this.scrollTop + (this.view.elementTop(viewIndex) + this.view.elementHeight(viewIndex) - this.getViewScrollBottom()));
				break;
			default:
				break;
		}
	}

	private _revealInView(viewIndex: number) {
		const firstIndex = this.view.firstVisibleIndex;
		if (viewIndex < firstIndex) {
			this._revealInternal(viewIndex, true, CellRevealPosition.Top);
		} else {
			this._revealInternal(viewIndex, true, CellRevealPosition.Bottom);
		}
	}

	private _revealInCenter(viewIndex: number) {
		this._revealInternal(viewIndex, false, CellRevealPosition.Center);
	}

	private _revealInCenterIfOutsideViewport(viewIndex: number) {
		this._revealInternal(viewIndex, true, CellRevealPosition.Center);
	}

	setCellSelection(cell: ICellViewModel, range: Range) {
		const element = cell as CellViewModel;
		if (element.editorAttached) {
			element.setSelection(range);
		} else {
			getEditorAttachedPromise(element).then(() => { element.setSelection(range); });
		}
	}


	override style(styles: IListStyles) {
		const selectorSuffix = this.view.domId;
		if (!this.styleElement) {
			this.styleElement = DOM.createStyleSheet(this.view.domNode);
		}
		const suffix = selectorSuffix && `.${selectorSuffix}`;
		const content: string[] = [];

		if (styles.listBackground) {
			if (styles.listBackground.isOpaque()) {
				content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows { background: ${styles.listBackground}; }`);
			} else if (!isMacintosh) { // subpixel AA doesn't exist in macOS
				console.warn(`List with id '${selectorSuffix}' was styled with a non-opaque background color. This will break sub-pixel antialiasing.`);
			}
		}

		if (styles.listFocusBackground) {
			content.push(`.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused { background-color: ${styles.listFocusBackground}; }`);
			content.push(`.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused:hover { background-color: ${styles.listFocusBackground}; }`); // overwrite :hover style in this case!
		}

		if (styles.listFocusForeground) {
			content.push(`.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused { color: ${styles.listFocusForeground}; }`);
		}

		if (styles.listActiveSelectionBackground) {
			content.push(`.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected { background-color: ${styles.listActiveSelectionBackground}; }`);
			content.push(`.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected:hover { background-color: ${styles.listActiveSelectionBackground}; }`); // overwrite :hover style in this case!
		}

		if (styles.listActiveSelectionForeground) {
			content.push(`.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected { color: ${styles.listActiveSelectionForeground}; }`);
		}

		if (styles.listFocusAndSelectionBackground) {
			content.push(`
				.monaco-drag-image,
				.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected.focused { background-color: ${styles.listFocusAndSelectionBackground}; }
			`);
		}

		if (styles.listFocusAndSelectionForeground) {
			content.push(`
				.monaco-drag-image,
				.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected.focused { color: ${styles.listFocusAndSelectionForeground}; }
			`);
		}

		if (styles.listInactiveFocusBackground) {
			content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused { background-color:  ${styles.listInactiveFocusBackground}; }`);
			content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused:hover { background-color:  ${styles.listInactiveFocusBackground}; }`); // overwrite :hover style in this case!
		}

		if (styles.listInactiveSelectionBackground) {
			content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected { background-color:  ${styles.listInactiveSelectionBackground}; }`);
			content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected:hover { background-color:  ${styles.listInactiveSelectionBackground}; }`); // overwrite :hover style in this case!
		}

		if (styles.listInactiveSelectionForeground) {
			content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected { color: ${styles.listInactiveSelectionForeground}; }`);
		}

		if (styles.listHoverBackground) {
			content.push(`.monaco-list${suffix}:not(.drop-target) > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row:hover:not(.selected):not(.focused) { background-color:  ${styles.listHoverBackground}; }`);
		}

		if (styles.listHoverForeground) {
			content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row:hover:not(.selected):not(.focused) { color:  ${styles.listHoverForeground}; }`);
		}

		if (styles.listSelectionOutline) {
			content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.selected { outline: 1px dotted ${styles.listSelectionOutline}; outline-offset: -1px; }`);
		}

		if (styles.listFocusOutline) {
			content.push(`
				.monaco-drag-image,
				.monaco-list${suffix}:focus > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused { outline: 1px solid ${styles.listFocusOutline}; outline-offset: -1px; }
			`);
		}

		if (styles.listInactiveFocusOutline) {
			content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row.focused { outline: 1px dotted ${styles.listInactiveFocusOutline}; outline-offset: -1px; }`);
		}

		if (styles.listHoverOutline) {
			content.push(`.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows > .monaco-list-row:hover { outline: 1px dashed ${styles.listHoverOutline}; outline-offset: -1px; }`);
		}

		if (styles.listDropBackground) {
			content.push(`
				.monaco-list${suffix}.drop-target,
				.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-rows.drop-target,
				.monaco-list${suffix} > div.monaco-scrollable-element > .monaco-list-row.drop-target { background-color: ${styles.listDropBackground} !important; color: inherit !important; }
			`);
		}

		if (styles.listFilterWidgetBackground) {
			content.push(`.monaco-list-type-filter { background-color: ${styles.listFilterWidgetBackground} }`);
		}

		if (styles.listFilterWidgetOutline) {
			content.push(`.monaco-list-type-filter { border: 1px solid ${styles.listFilterWidgetOutline}; }`);
		}

		if (styles.listFilterWidgetNoMatchesOutline) {
			content.push(`.monaco-list-type-filter.no-matches { border: 1px solid ${styles.listFilterWidgetNoMatchesOutline}; }`);
		}

		if (styles.listMatchesShadow) {
			content.push(`.monaco-list-type-filter { box-shadow: 1px 1px 1px ${styles.listMatchesShadow}; }`);
		}

		const newStyles = content.join('\n');
		if (newStyles !== this.styleElement.textContent) {
			this.styleElement.textContent = newStyles;
		}
	}

	getRenderHeight() {
		return this.view.renderHeight;
	}

	override layout(height?: number, width?: number): void {
		this._isInLayout = true;
		super.layout(height, width);
		if (this.renderHeight === 0) {
			this.view.domNode.style.visibility = 'hidden';
		} else {
			this.view.domNode.style.visibility = 'initial';
		}
		this._isInLayout = false;
	}

	override dispose() {
		this._isDisposed = true;
		this._viewModelStore.dispose();
		this._localDisposableStore.dispose();
		super.dispose();

		// un-ref
		this._previousFocusedElements = [];
		this._viewModel = null;
		this._hiddenRangeIds = [];
		this.hiddenRangesPrefixSum = null;
		this._visibleRanges = [];
	}
}

function getEditorAttachedPromise(element: CellViewModel) {
	return new Promise<void>((resolve, reject) => {
		Event.once(element.onDidChangeEditorAttachState)(() => element.editorAttached ? resolve() : reject());
	});
}

function isContextMenuFocused() {
	return !!DOM.findParentWithClass(<HTMLElement>document.activeElement, 'context-view');
}
