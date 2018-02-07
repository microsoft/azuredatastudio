/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!sql/parts/grid/media/slickColorTheme';
import 'vs/css!sql/parts/grid/media/flexbox';
import 'vs/css!sql/parts/grid/media/styles';
import 'vs/css!sql/parts/grid/media/slick.grid';
import 'vs/css!sql/parts/grid/media/slickGrid';

import { Subscription, Subject } from 'rxjs/Rx';
import { ElementRef, QueryList, ChangeDetectorRef, ViewChildren } from '@angular/core';
import { IGridDataRow, ISlickRange, SlickGrid, FieldType } from 'angular2-slickgrid';
import { toDisposableSubscription } from 'sql/parts/common/rxjsUtils';
import * as Constants from 'sql/parts/query/common/constants';
import * as LocalizedConstants from 'sql/parts/query/common/localizedConstants';
import { IGridInfo, IGridDataSet, SaveFormat } from 'sql/parts/grid/common/interfaces';
import * as Utils from 'sql/parts/connection/common/utils';
import { DataService } from 'sql/parts/grid/services/dataService';
import * as actions from 'sql/parts/grid/views/gridActions';
import * as Services from 'sql/parts/grid/services/sharedServices';
import * as GridContentEvents from 'sql/parts/grid/common/gridContentEvents';
import { ResultsVisibleContext, ResultsGridFocussedContext, ResultsMessagesFocussedContext } from 'sql/parts/query/common/queryContext';
import { IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import { error } from 'sql/base/common/log';

import { IAction } from 'vs/base/common/actions';
import { ResolvedKeybinding } from 'vs/base/common/keyCodes';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { AutoColumnSize } from 'sql/base/browser/ui/table/plugins/autoSizeColumns.plugin';
import { DragCellSelectionModel } from 'sql/base/browser/ui/table/plugins/dragCellSelectionModel.plugin';

export abstract class GridParentComponent {
	// CONSTANTS
	// tslint:disable:no-unused-variable
	protected get selectionModel(): DragCellSelectionModel<any> {
		return new DragCellSelectionModel<any>();
	}
	protected get slickgridPlugins(): Array<any> {
		return [
			new AutoColumnSize<any>({})
		];
	}
	protected _rowHeight = 29;
	protected _defaultNumShowingRows = 8;
	protected Constants = Constants;
	protected LocalizedConstants = LocalizedConstants;
	protected Utils = Utils;
	// tslint:disable-next-line:no-unused-variable
	protected startString = new Date().toLocaleTimeString();

	protected shortcutfunc: { [name: string]: Function };

	// tslint:enable

	// FIELDS
	// Service for interaction with the IQueryModel
	protected dataService: DataService;
	protected keybindingService: IKeybindingService;
	protected scopedContextKeyService: IContextKeyService;
	protected contextMenuService: IContextMenuService;
	protected actionProvider: actions.GridActionProvider;

	protected toDispose: IDisposable[];


	// Context keys to set when keybindings are available
	private resultsVisibleContextKey: IContextKey<boolean>;
	private gridFocussedContextKey: IContextKey<boolean>;
	private messagesFocussedContextKey: IContextKey<boolean>;

	// All datasets
	// Place holder data sets to buffer between data sets and rendered data sets
	protected placeHolderDataSets: IGridDataSet[] = [];
	// Datasets currently being rendered on the DOM
	protected renderedDataSets: IGridDataSet[] = this.placeHolderDataSets;
	protected resultActive = true;
	protected _messageActive = true;
	protected activeGrid = 0;

	@ViewChildren('slickgrid') slickgrids: QueryList<SlickGrid>;

	// Edit Data functions
	public onActiveCellChanged: (event: { row: number, column: number }) => void;
	public onCellEditEnd: (event: { row: number, column: number, newValue: any }) => void;
	public onCellEditBegin: (event: { row: number, column: number }) => void;
	public onRowEditBegin: (event: { row: number }) => void;
	public onRowEditEnd: (event: { row: number }) => void;
	public onIsCellEditValid: (row: number, column: number, newValue: any) => boolean;
	public onIsColumnEditable: (column: number) => boolean;
	public overrideCellFn: (rowNumber, columnId, value?, data?) => string;
	public loadDataFunction: (offset: number, count: number) => Promise<IGridDataRow[]>;

	set messageActive(input: boolean) {
		this._messageActive = input;
		if (this.resultActive) {
			this.resizeGrids();
		}
	}

	get messageActive(): boolean {
		return this._messageActive;
	}

	constructor(
		protected _el: ElementRef,
		protected _cd: ChangeDetectorRef,
		protected _bootstrapService: IBootstrapService
	) {
		this.toDispose = [];
	}

	protected baseInit(): void {
		const self = this;
		this.initShortcutsBase();
		if (this._bootstrapService.configurationService) {
			let sqlConfig = this._bootstrapService.configurationService.getValue('sql');
			if (sqlConfig) {
				this._messageActive = sqlConfig['messagesDefaultOpen'];
			}
		}
		this.subscribeWithDispose(this.dataService.gridContentObserver, (type) => {
			switch (type) {
				case GridContentEvents.RefreshContents:
					self.refreshResultsets();
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
				default:
					error('Unexpected grid content event type "' + type + '" sent');
					break;
			}
		});

		this.contextMenuService = this._bootstrapService.contextMenuService;
		this.keybindingService = this._bootstrapService.keybindingService;

		this.bindKeys(this._bootstrapService.contextKeyService);
	}

	/*
	 * Add the subscription to the list of things to be disposed on destroy, or else on a new component init
	 * may get the "destroyed" object still getting called back.
	 */
	protected subscribeWithDispose<T>(subject: Subject<T>, event: (value: any) => void): void {
		let sub: Subscription = subject.subscribe(event);
		this.toDispose.push(toDisposableSubscription(sub));
	}

	private bindKeys(contextKeyService: IContextKeyService): void {
		if (contextKeyService) {
			let gridContextKeyService = this._bootstrapService.contextKeyService.createScoped(this._el.nativeElement);
			this.toDispose.push(gridContextKeyService);
			this.resultsVisibleContextKey = ResultsVisibleContext.bindTo(gridContextKeyService);
			this.resultsVisibleContextKey.set(true);

			this.gridFocussedContextKey = ResultsGridFocussedContext.bindTo(gridContextKeyService);
			this.messagesFocussedContextKey = ResultsMessagesFocussedContext.bindTo(gridContextKeyService);
		}
	}

	protected baseDestroy(): void {
		this.toDispose = dispose(this.toDispose);
	}

	private toggleResultPane(): void {
		this.resultActive = !this.resultActive;
	}

	private toggleMessagePane(): void {
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

	private copySelection(): void {
		let messageText = this.getMessageText();
		if (messageText.length > 0) {
			this._bootstrapService.clipboardService.writeText(messageText);
		} else {
			let activeGrid = this.activeGrid;
			let selection = this.slickgrids.toArray()[activeGrid].getSelectedRanges();
			this.dataService.copyResults(selection, this.renderedDataSets[activeGrid].batchId, this.renderedDataSets[activeGrid].resultId);
		}
	}

	private copyWithHeaders(): void {
		let activeGrid = this.activeGrid;
		let selection = this.slickgrids.toArray()[activeGrid].getSelectedRanges();
		this.dataService.copyResults(selection, this.renderedDataSets[activeGrid].batchId,
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
			this._bootstrapService.clipboardService.writeText(messageText);
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
			}
		};

		this.initShortcuts(shortcuts);
		this.shortcutfunc = shortcuts;
	}

	protected abstract initShortcuts(shortcuts: { [name: string]: Function }): void;

	/**
	 * Send save result set request to service
	 */
	handleContextClick(event: { type: string, batchId: number, resultId: number, index: number, selection: ISlickRange[] }): void {
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
		let selection = this.slickgrids.toArray()[activeGrid].getSelectedRanges();
		this.dataService.sendSaveRequest({ batchIndex: batchId, resultSetNumber: resultId, format: format, selection: selection });
	}

	protected _keybindingFor(action: IAction): ResolvedKeybinding {
		var [kb] = this.keybindingService.lookupKeybindings(action.id);
		return kb;
	}

	openContextMenu(event, batchId, resultId, index): void {
		let slick: any = this.slickgrids.toArray()[index];
		let grid = slick._grid;

		let selection = this.slickgrids.toArray()[index].getSelectedRanges();

		if (selection && selection.length === 0) {
			let cell = (grid as Slick.Grid<any>).getCellFromEvent(event);
			selection = [new Slick.Range(cell.row, cell.cell - 1)];
		}

		let rowIndex = grid.getCellFromEvent(event).row;

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

	/**
	 * Returns a function that selects all elements of a grid. This needs to
	 * return a function in order to capture the scope for this component
	 * @private
	 * @returns {(gridIndex: number) => void}
	 *
	 * @memberOf QueryComponent
	 */
	protected onGridSelectAll(): (gridIndex: number) => void {
		let self = this;
		return (gridIndex: number) => {
			self.activeGrid = gridIndex;
			self.slickgrids.toArray()[this.activeGrid].selection = true;
		};
	}

	private onSelectAllForActiveGrid(): void {
		if (this.activeGrid >= 0 && this.slickgrids.length > this.activeGrid) {
			this.slickgrids.toArray()[this.activeGrid].selection = true;
		}
	}

	/**
	 * Used to convert the string to a enum compatible with SlickGrid
	 */
	protected stringToFieldType(input: string): FieldType {
		let fieldtype: FieldType;
		switch (input) {
			case 'string':
				fieldtype = FieldType.String;
				break;
			default:
				fieldtype = FieldType.String;
				break;
		}
		return fieldtype;
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
			self.slickgrids.toArray()[0].setActive();
			self._cd.detectChanges();
		});
	}

	abstract onScroll(scrollTop): void;

	protected getResultsElement(): any {
		return this._el.nativeElement.querySelector('#results');
	}
	protected getMessagesElement(): any {
		return this._el.nativeElement.querySelector('#messages');
	}
	/**
	 * Force angular to re-render the results grids. Calling this upon unhide (upon focus) fixes UI
	 * glitches that occur when a QueryRestulsEditor is hidden then unhidden while it is running a query.
	 */
	refreshResultsets(): void {
		let tempRenderedDataSets = this.renderedDataSets;
		this.renderedDataSets = [];
		this._cd.detectChanges();
		this.renderedDataSets = tempRenderedDataSets;
		this._cd.detectChanges();
	}

	getSelectedRangeUnderMessages(): Selection {
		if (document.activeElement === this.getMessagesElement()) {
			return window.getSelection();
		} else {
			return undefined;
		}
	}

	selectAllMessages(): void {
		let msgEl = this._el.nativeElement.querySelector('#messages');
		this.selectElementContents(msgEl);
	}

	selectElementContents(el: HTMLElement): void {
		let range = document.createRange();
		range.selectNodeContents(el);
		let sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
	}

	/**
	 * Add handler for clicking on xml link
	 */
	xmlLinkHandler = (cellRef: string, row: number, dataContext: JSON, colDef: any) => {
		const self = this;
		self.handleLink(cellRef, row, dataContext, colDef, 'xml');
	}

	/**
	 * Add handler for clicking on json link
	 */
	jsonLinkHandler = (cellRef: string, row: number, dataContext: JSON, colDef: any) => {
		const self = this;
		self.handleLink(cellRef, row, dataContext, colDef, 'json');
	}

	private handleLink(cellRef: string, row: number, dataContext: JSON, colDef: any, linkType: string): void {
		const self = this;
		let value = self.getCellValueString(dataContext, colDef);
		$(cellRef).children('.xmlLink').click(function (): void {
			self.dataService.openLink(value, colDef.name, linkType);
		});
	}

	private getCellValueString(dataContext: JSON, colDef: any): string {
		let returnVal = '';
		let value = dataContext[colDef.field];
		if (Services.DBCellValue.isDBCellValue(value)) {
			returnVal = value.displayValue;
		} else if (typeof value === 'string') {
			returnVal = value;
		}
		return returnVal;
	}

	/**
	 * Return asyncPostRender handler based on type
	 */
	public linkHandler(type: string): Function {
		if (type === 'xml') {
			return this.xmlLinkHandler;
		} else { // default to JSON handler
			return this.jsonLinkHandler;
		}
	}

	keyEvent(e: KeyboardEvent): void {
		let self = this;
		let handled = self.tryHandleKeyEvent(e);
		if (handled) {
			e.preventDefault();
			e.stopPropagation();
		}
		// Else assume that keybinding service handles routing this to a command
	}

	/**
	 * Called by keyEvent method to give child classes a chance to
	 * handle key events.
	 *
	 * @protected
	 * @abstract
	 * @param {any} e
	 * @returns {boolean}
	 *
	 * @memberOf GridParentComponent
	 */
	protected abstract tryHandleKeyEvent(e): boolean;

	resizeGrids(): void {
		const self = this;
		setTimeout(() => {
			for (let grid of self.renderedDataSets) {
				grid.resized.emit();
			}
		});
	}

	// Private Helper Functions ////////////////////////////////////////////////////////////////////////////
}
