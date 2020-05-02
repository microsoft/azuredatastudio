/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/flexbox';
import 'vs/css!./media/styles';

import { Table } from 'sql/base/browser/ui/table/table';
import { Subscription, Subject } from 'rxjs/Rx';
import * as Constants from 'sql/platform/query/common/constants';
import { IGridInfo, IGridDataSet } from 'sql/workbench/contrib/grid/browser/interfaces';
import * as Utils from 'sql/platform/connection/common/utils';
import { DataService } from 'sql/workbench/services/query/common/dataService';
import * as actions from 'sql/workbench/contrib/editData/browser/gridActions';
import * as GridContentEvents from 'sql/workbench/services/query/common/gridContentEvents';
import { ResultsVisibleContext, ResultsGridFocussedContext, ResultsMessagesFocussedContext, QueryEditorVisibleContext } from 'sql/workbench/contrib/query/common/queryContext';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';

import { IAction } from 'vs/base/common/actions';
import { ResolvedKeybinding } from 'vs/base/common/keyCodes';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { DisposableStore, Disposable } from 'vs/base/common/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { ILogService } from 'vs/platform/log/common/log';
import { subscriptionToDisposable } from 'sql/base/browser/lifecycle';
import { SaveFormat } from 'sql/workbench/services/query/common/resultSerializer';


export abstract class GridParentComponent extends Disposable {
	// CONSTANTS
	// tslint:disable:no-unused-variable

	protected get selectionModel() { return new CellSelectionModel(); }
	protected rowHeight = 29;
	protected defaultNumShowingRows = 8;
	protected Constants = Constants;
	protected Utils = Utils;
	// tslint:disable-next-line:no-unused-variable
	protected startString = new Date().toLocaleTimeString();

	protected shortcutfunc: { [name: string]: Function };

	// tslint:enable

	// FIELDS
	// Service for interaction with the IQueryModel
	protected dataService: DataService;
	protected actionProvider: actions.GridActionProvider;

	protected toDispose = new DisposableStore();

	// Context keys to set when keybindings are available
	private resultsVisibleContextKey: IContextKey<boolean>;
	private gridFocussedContextKey: IContextKey<boolean>;
	private messagesFocussedContextKey: IContextKey<boolean>;
	private queryEditorVisible: IContextKey<boolean>;

	// All datasets
	// Place holder data sets to buffer between data sets and rendered data sets
	protected placeHolderDataSets: IGridDataSet[] = [];
	// Datasets currently being rendered on the DOM
	protected renderedDataSets: IGridDataSet[] = this.placeHolderDataSets;
	protected resultActive = true;
	protected messageActiveBool = true;
	protected activeGrid = 0;
	protected nativeElement: HTMLElement;
	protected table: Table<any>;

	set messageActive(input: boolean) {
		this.messageActiveBool = input;
		if (this.resultActive) {
			this.resizeGrids();
		}
	}

	get messageActive(): boolean {
		return this.messageActiveBool;
	}

	constructor(
		@IContextMenuService protected contextMenuService: IContextMenuService,
		@IKeybindingService protected keybindingService: IKeybindingService,
		@IContextKeyService protected contextKeyService: IContextKeyService,
		@IConfigurationService protected configurationService: IConfigurationService,
		@IClipboardService protected clipboardService: IClipboardService,
		@IQueryEditorService protected queryEditorService: IQueryEditorService,
		@ILogService protected logService: ILogService
	) {
		super();
	}

	protected baseInit(): void {
		const self = this;
		this.initShortcutsBase();
		if (this.configurationService) {
			let sqlConfig = this.configurationService.getValue('sql');
			if (sqlConfig) {
				this.messageActiveBool = sqlConfig['messagesDefaultOpen'];
			}
		}
		this.toDispose.add(this.dataService.gridContent(type => {
			switch (type) {
				case GridContentEvents.RefreshContents:
					self.refreshDatasets();
					break;
				case GridContentEvents.ResizeContents:
					self.resizeGrids();
					break;
				case GridContentEvents.CopySelection:
					self.copySelection();
					break;
				case GridContentEvents.CopyWithHeaders:
					self.copyWithHeaders();
					break;
				case GridContentEvents.CopyMessagesSelection:
					self.copyMessagesSelection();
					break;
				case GridContentEvents.ToggleResultPane:
					self.toggleResultPane();
					break;
				case GridContentEvents.ToggleMessagePane:
					self.toggleMessagePane();
					break;
				case GridContentEvents.SelectAll:
					self.onSelectAllForActiveGrid();
					break;
				case GridContentEvents.SelectAllMessages:
					self.selectAllMessages();
					break;
				case GridContentEvents.SaveAsCsv:
					self.sendSaveRequest(SaveFormat.CSV);
					break;
				case GridContentEvents.SaveAsJSON:
					self.sendSaveRequest(SaveFormat.JSON);
					break;
				case GridContentEvents.SaveAsExcel:
					self.sendSaveRequest(SaveFormat.EXCEL);
					break;
				case GridContentEvents.SaveAsXML:
					self.sendSaveRequest(SaveFormat.XML);
					break;
				case GridContentEvents.GoToNextQueryOutputTab:
					self.goToNextQueryOutputTab();
					break;
				case GridContentEvents.ViewAsChart:
					self.showChartForGrid(self.activeGrid);
					break;
				case GridContentEvents.ViewAsVisualizer:
					self.showVisualizerForGrid(self.activeGrid);
					break;
				case GridContentEvents.GoToNextGrid:
					self.goToNextGrid();
					break;
				default:
					this.logService.error('Unexpected grid content event type "' + type + '" sent');
					break;
			}
		}));

		this.bindKeys(this.contextKeyService);
	}

	/*
	 * Add the subscription to the list of things to be disposed on destroy, or else on a new component init
	 * may get the "destroyed" object still getting called back.
	 */
	protected subscribeWithDispose<T>(subject: Subject<T>, event: (value: any) => void): void {
		let sub: Subscription = subject.subscribe(event);
		this.toDispose.add(subscriptionToDisposable(sub));
	}

	private bindKeys(contextKeyService: IContextKeyService): void {
		if (contextKeyService) {
			this.queryEditorVisible = QueryEditorVisibleContext.bindTo(contextKeyService);
			this.queryEditorVisible.set(true);

			let gridContextKeyService = this.contextKeyService.createScoped(this.nativeElement);
			this.toDispose.add(gridContextKeyService);
			this.resultsVisibleContextKey = ResultsVisibleContext.bindTo(gridContextKeyService);
			this.resultsVisibleContextKey.set(true);

			this.gridFocussedContextKey = ResultsGridFocussedContext.bindTo(gridContextKeyService);
			this.messagesFocussedContextKey = ResultsMessagesFocussedContext.bindTo(gridContextKeyService);
		}
	}

	protected baseDestroy(): void {
		this.toDispose.dispose();
	}

	protected toggleResultPane(): void {
		this.resultActive = !this.resultActive;
		if (this.resultActive) {
			this.resizeGrids();
		}
	}

	protected toggleMessagePane(): void {
		this.messageActive = !this.messageActive;
	}

	protected onGridFocus() {
		this.gridFocussedContextKey.set(true);
	}

	protected onGridFocusout() {
		this.gridFocussedContextKey.set(false);
	}

	protected onMessagesFocus() {
		this.messagesFocussedContextKey.set(true);
	}

	protected onMessagesFocusout() {
		this.messagesFocussedContextKey.set(false);
	}

	protected getSelection(index?: number): Slick.Range[] {
		let selection = this.table.getSelectedRanges();
		if (selection) {
			selection = selection.map(c => { return <Slick.Range>{ fromCell: c.fromCell - 1, toCell: c.toCell - 1, toRow: c.toRow, fromRow: c.fromRow }; });
			return selection;
		} else {
			return undefined;
		}
	}

	private copySelection(): void {
		let messageText = this.getMessageText();
		if (messageText.length > 0) {
			this.clipboardService.writeText(messageText);
		} else {
			let activeGrid = this.activeGrid;
			this.dataService.copyResults(this.getSelection(activeGrid), this.renderedDataSets[activeGrid].batchId, this.renderedDataSets[activeGrid].resultId);
		}
	}

	private copyWithHeaders(): void {
		let activeGrid = this.activeGrid;
		this.dataService.copyResults(this.getSelection(activeGrid), this.renderedDataSets[activeGrid].batchId,
			this.renderedDataSets[activeGrid].resultId, true);
	}

	private copyMessagesSelection(): void {
		let messageText = this.getMessageText();
		if (messageText.length === 0) {
			// Since we know we're specifically copying messages, do a select all if nothing is selected
			this.selectAllMessages();
			messageText = this.getMessageText();
		}
		if (messageText.length > 0) {
			this.clipboardService.writeText(messageText);
		}
	}

	private getMessageText(): string {
		if (document.activeElement === this.getMessagesElement()) {
			if (window.getSelection()) {
				return window.getSelection().toString();
			}
		}
		return '';
	}

	protected goToNextQueryOutputTab(): void {
	}

	protected showChartForGrid(index: number) {
	}

	protected showVisualizerForGrid(index: number) {
	}

	protected goToNextGrid() {
		if (this.renderedDataSets.length > 0) {
			let next = this.activeGrid + 1;
			if (next >= this.renderedDataSets.length) {
				next = 0;
			}
			this.navigateToGrid(next);
		}
	}

	protected navigateToGrid(index: number) {
	}

	private initShortcutsBase(): void {
		let shortcuts = {
			'ToggleResultPane': () => {
				this.toggleResultPane();
			},
			'ToggleMessagePane': () => {
				this.toggleMessagePane();
			},
			'CopySelection': () => {
				this.copySelection();
			},
			'CopyWithHeaders': () => {
				this.copyWithHeaders();
			},
			'SelectAll': () => {
				this.onSelectAllForActiveGrid();
			},
			'SaveAsCSV': () => {
				this.sendSaveRequest(SaveFormat.CSV);
			},
			'SaveAsJSON': () => {
				this.sendSaveRequest(SaveFormat.JSON);
			},
			'SaveAsExcel': () => {
				this.sendSaveRequest(SaveFormat.EXCEL);
			},
			'SaveAsXML': () => {
				this.sendSaveRequest(SaveFormat.XML);
			},
			'GoToNextQueryOutputTab': () => {
				this.goToNextQueryOutputTab();
			}
		};

		this.initShortcuts(shortcuts);
		this.shortcutfunc = shortcuts;
	}

	protected abstract initShortcuts(shortcuts: { [name: string]: Function }): void;

	/**
	 * Send save result set request to service
	 */
	handleContextClick(event: { type: string, batchId: number, resultId: number, index: number, selection: Slick.Range[] }): void {
		switch (event.type) {
			case 'savecsv':
				this.dataService.sendSaveRequest({ batchIndex: event.batchId, resultSetNumber: event.resultId, format: SaveFormat.CSV, selection: event.selection });
				break;
			case 'savejson':
				this.dataService.sendSaveRequest({ batchIndex: event.batchId, resultSetNumber: event.resultId, format: SaveFormat.JSON, selection: event.selection });
				break;
			case 'saveexcel':
				this.dataService.sendSaveRequest({ batchIndex: event.batchId, resultSetNumber: event.resultId, format: SaveFormat.EXCEL, selection: event.selection });
				break;
			case 'savexml':
				this.dataService.sendSaveRequest({ batchIndex: event.batchId, resultSetNumber: event.resultId, format: SaveFormat.XML, selection: event.selection });
				break;
			case 'selectall':
				this.activeGrid = event.index;
				this.onSelectAllForActiveGrid();
				break;
			case 'copySelection':
				this.dataService.copyResults(event.selection, event.batchId, event.resultId);
				break;
			case 'copyWithHeaders':
				this.dataService.copyResults(event.selection, event.batchId, event.resultId, true);
				break;
			default:
				break;
		}
	}

	private sendSaveRequest(format: SaveFormat) {
		let activeGrid = this.activeGrid;
		let batchId = this.renderedDataSets[activeGrid].batchId;
		let resultId = this.renderedDataSets[activeGrid].resultId;
		this.dataService.sendSaveRequest({ batchIndex: batchId, resultSetNumber: resultId, format: format, selection: this.getSelection(activeGrid) });
	}

	protected _keybindingFor(action: IAction): ResolvedKeybinding {
		let [kb] = this.keybindingService.lookupKeybindings(action.id);
		return kb;
	}

	openContextMenu(event, batchId, resultId, index): void {
		let grid = this.table.grid;
		let selection = this.getSelection(index);

		if (selection && selection.length === 0) {
			let cell = grid.getCellFromEvent(event);
			selection = [new Slick.Range(cell.row, cell.cell - 1)];
		}

		let rowIndex = grid.getCellFromEvent(event).row;
		if (rowIndex !== grid.getDataLength() - 1) {
			let actionContext: IGridInfo = {
				batchIndex: batchId,
				resultSetNumber: resultId,
				selection: selection,
				gridIndex: index,
				rowIndex: rowIndex
			};

			let anchor = { x: event.pageX + 1, y: event.pageY };

			this.contextMenuService.showContextMenu({
				getAnchor: () => anchor,
				getActions: () => this.actionProvider.getGridActions(),
				getKeyBinding: (action) => this._keybindingFor(action),
				getActionsContext: () => (actionContext)
			});
		}
	}

	/**
	 * Returns a function that selects all elements of a grid. This needs to
	 * return a function in order to capture the scope for this component
	 *
	 * @memberOf QueryComponent
	 */
	protected onGridSelectAll(): (gridIndex: number) => void {
		let self = this;
		return (gridIndex: number) => {
			self.activeGrid = gridIndex;
			let grid = self.table;
			grid.setActiveCell(0, 1);
			grid.setSelectedRows(true);
		};
	}

	private onSelectAllForActiveGrid(): void {
		this.table.setSelectedRows(true);
	}

	/**
	 * Makes a resultset take up the full result height if this is not already true
	 * Otherwise rerenders the result sets from default
	 */
	magnify(index: number): void {
		const self = this;
		if (this.renderedDataSets.length > 1) {
			this.renderedDataSets = [this.placeHolderDataSets[index]];
		} else {
			this.renderedDataSets = this.placeHolderDataSets;
			this.onScroll(0);
		}
		setTimeout(() => {
			self.resizeGrids();
			self.table.setActiveCell(0, 1);
		});
	}

	abstract onScroll(scrollTop): void;

	protected getResultsElement(): any {
		return this.nativeElement.querySelector('#results');
	}
	protected getMessagesElement(): any {
		return this.nativeElement.querySelector('#messages');
	}
	/**
	 * Force re-rendering of the results grids. Calling this upon unhide (upon focus) fixes UI
	 * glitches that occur when a QueryRestulsEditor is hidden then unhidden while it is running a query.
	 * Detect Changes has been moved to editDataGridPanel version of this.
	 */
	refreshDatasets(): void {
		let tempRenderedDataSets = this.renderedDataSets;
		this.renderedDataSets = [];
		this.renderedDataSets = tempRenderedDataSets;
	}

	getSelectedRangeUnderMessages(): Selection {
		if (document.activeElement === this.getMessagesElement()) {
			return window.getSelection();
		} else {
			return undefined;
		}
	}

	selectAllMessages(): void {
		let msgEl = this.nativeElement.querySelector('#messages');
		this.selectElementContents(<HTMLElement>msgEl);
	}

	selectElementContents(el: HTMLElement): void {
		let range = document.createRange();
		range.selectNodeContents(el);
		let sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
	}

	keyEvent(e: KeyboardEvent): void {
		if (this.tryHandleKeyEvent(new StandardKeyboardEvent(e))) {
			e.preventDefault();
			e.stopPropagation();
		}
		// Else assume that keybinding service handles routing this to a command
	}

	/**
	 * Called by keyEvent method to give child classes a chance to
	 * handle key events.
	 *
	 * @memberOf GridParentComponent
	 */
	protected abstract tryHandleKeyEvent(e: StandardKeyboardEvent): boolean;

	resizeGrids(): void {
		setTimeout(() => {
			this.onResize();
		});
	}

	protected onResize() {
		this.table?.resizeCanvas();
	}

	/**
	 * used to render the native element into the container.
	 * */
	public render(container: HTMLElement): void {
		container.appendChild(this.nativeElement);
	}
}
