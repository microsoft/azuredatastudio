/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!sql/parts/grid/media/slickColorTheme';
import 'vs/css!sql/parts/grid/media/flexbox';
import 'vs/css!sql/parts/grid/media/styles';
import 'vs/css!sql/parts/grid/media/slick.grid';
import 'vs/css!sql/parts/grid/media/slickGrid';

import {
	ElementRef, QueryList, ChangeDetectorRef, OnInit, OnDestroy, Component, Inject,
	ViewChildren, forwardRef, EventEmitter, Input, ViewChild
} from '@angular/core';
import { IGridDataRow, SlickGrid, VirtualizedCollection } from 'angular2-slickgrid';

import * as LocalizedConstants from 'sql/parts/query/common/localizedConstants';
import * as Services from 'sql/parts/grid/services/sharedServices';
import { IGridIcon, IMessage, IGridDataSet } from 'sql/parts/grid/common/interfaces';
import { GridParentComponent } from 'sql/parts/grid/views/gridParentComponent';
import { GridActionProvider } from 'sql/parts/grid/views/gridActions';
import { IQueryComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { error } from 'sql/base/common/log';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { clone, mixin } from 'sql/base/common/objects';
import { IQueryEditorService } from 'sql/parts/query/common/queryEditorService';
import { escape } from 'sql/base/common/strings';
import { RowNumberColumn } from 'sql/base/browser/ui/table/plugins/rowNumberColumn.plugin';
import { AutoColumnSize } from 'sql/base/browser/ui/table/plugins/autoSizeColumns.plugin';
import { AdditionalKeyBindings } from 'sql/base/browser/ui/table/plugins/additionalKeyBindings.plugin';

import { format } from 'vs/base/common/strings';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';

export const QUERY_SELECTOR: string = 'query-component';

declare type PaneType = 'messages' | 'results';

@Component({
	selector: QUERY_SELECTOR,
	host: { '(window:keydown)': 'keyEvent($event)', '(window:gridnav)': 'keyEvent($event)' },
	templateUrl: decodeURI(require.toUrl('sql/parts/grid/views/query/query.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => QueryComponent) }]
})
export class QueryComponent extends GridParentComponent implements OnInit, OnDestroy {
	// CONSTANTS
	// tslint:disable-next-line:no-unused-variable
	private scrollTimeOutTime: number = 200;
	private windowSize: number = 50;
	private messagePaneHeight: number = 22;
	// tslint:disable-next-line:no-unused-variable
	private maxScrollGrids: number = 8;

	// create a function alias to use inside query.component
	// tslint:disable-next-line:no-unused-variable
	protected stringsFormat: any = format;

	protected plugins = new Array<Array<Slick.Plugin<any>>>();

	// tslint:disable-next-line:no-unused-variable
	private dataIcons: IGridIcon[] = [
		{
			showCondition: () => { return this.dataSets.length > 1; },
			icon: () => {
				return this.renderedDataSets.length === 1
					? 'exitFullScreen'
					: 'extendFullScreen';
			},
			hoverText: () => {
				return this.renderedDataSets.length === 1
					? LocalizedConstants.restoreLabel
					: LocalizedConstants.maximizeLabel;
			},
			functionality: (batchId, resultId, index) => {
				this.magnify(index);
			}
		},
		{
			showCondition: () => { return true; },
			icon: () => { return 'saveCsv'; },
			hoverText: () => { return LocalizedConstants.saveCSVLabel; },
			functionality: (batchId, resultId, index) => {
				let selection = this.getSelection(index);
				if (selection.length <= 1) {
					this.handleContextClick({ type: 'savecsv', batchId: batchId, resultId: resultId, index: index, selection: selection });
				} else {
					this.dataService.showWarning(LocalizedConstants.msgCannotSaveMultipleSelections);
				}
			}
		},
		{
			showCondition: () => { return true; },
			icon: () => { return 'saveJson'; },
			hoverText: () => { return LocalizedConstants.saveJSONLabel; },
			functionality: (batchId, resultId, index) => {
				let selection = this.getSelection(index);
				if (selection.length <= 1) {
					this.handleContextClick({ type: 'savejson', batchId: batchId, resultId: resultId, index: index, selection: selection });
				} else {
					this.dataService.showWarning(LocalizedConstants.msgCannotSaveMultipleSelections);
				}
			}
		},
		{
			showCondition: () => { return true; },
			icon: () => { return 'saveExcel'; },
			hoverText: () => { return LocalizedConstants.saveExcelLabel; },
			functionality: (batchId, resultId, index) => {
				let selection = this.getSelection(index);
				if (selection.length <= 1) {
					this.handleContextClick({ type: 'saveexcel', batchId: batchId, resultId: resultId, index: index, selection: selection });
				} else {
					this.dataService.showWarning(LocalizedConstants.msgCannotSaveMultipleSelections);
				}
			}
		},
		{
			showCondition: () => { return true; },
			icon: () => { return 'saveXml'; },
			hoverText: () => { return LocalizedConstants.saveXMLLabel; },
			functionality: (batchId, resultId, index) => {
				let selection = this.getSelection(index);
				if (selection.length <= 1) {
					this.handleContextClick({ type: 'savexml', batchId: batchId, resultId: resultId, index: index, selection: selection });
				} else {
					this.dataService.showWarning(LocalizedConstants.msgCannotSaveMultipleSelections);
				}
			}
		},
		{
			showCondition: () => {
				return this.configurationService.getValue('workbench')['enablePreviewFeatures'];
			},
			icon: () => { return 'viewChart'; },
			hoverText: () => { return LocalizedConstants.viewChartLabel; },
			functionality: (batchId, resultId, index) => {
				this.showChartForGrid(index);
			}
		}
	];

	// FIELDS
	// Service for interaction with the IQueryModel

	// All datasets
	private dataSets: IGridDataSet[] = [];
	private messages: IMessage[] = [];
	private messageStore: IMessage[] = [];
	private messageTimeout: number;
	private lastMessageHandleTime: number = 0;
	private scrollTimeOut: number;
	private resizing = false;
	private resizeHandleTop: string = '0';
	private scrollEnabled = true;
	private rowHeight: number;
	// tslint:disable-next-line:no-unused-variable
	private firstRender = true;
	private totalElapsedTimeSpan: number;
	private complete = false;
	private sentPlans: Map<number, string> = new Map<number, string>();
	private hasQueryPlan: boolean = false;
	private queryPlanResultSetId: number = 0;
	public queryExecutionStatus: EventEmitter<string> = new EventEmitter<string>();
	public queryPlanAvailable: EventEmitter<string> = new EventEmitter<string>();
	public showChartRequested: EventEmitter<IGridDataSet> = new EventEmitter<IGridDataSet>();
	public goToNextQueryOutputTabRequested: EventEmitter<void> = new EventEmitter<void>();
	public onActiveCellChanged: (gridIndex: number) => void;

	private savedViewState: {
		gridSelections: Slick.Range[][];
		resultsScroll: number;
		messagePaneScroll: number;
		slickGridScrolls: { vertical: number; horizontal: number }[];
	};

	@Input() public queryParameters: IQueryComponentParams;

	@ViewChildren('slickgrid') slickgrids: QueryList<SlickGrid>;
	// tslint:disable-next-line:no-unused-variable
	@ViewChild('resultsPane', { read: ElementRef }) private _resultsPane: ElementRef;
	@ViewChild('queryLink', { read: ElementRef }) private _queryLinkElement: ElementRef;
	@ViewChild('messagesContainer', { read: ElementRef }) private _messagesContainer: ElementRef;
	@ViewChild('resultsScrollBox', { read: ElementRef }) private _resultsScrollBox: ElementRef;
	@ViewChildren('slickgrid', { read: ElementRef }) private _slickgridElements: QueryList<ElementRef>;
	constructor(
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) cd: ChangeDetectorRef,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IContextMenuService) contextMenuService: IContextMenuService,
		@Inject(IKeybindingService) keybindingService: IKeybindingService,
		@Inject(IContextKeyService) contextKeyService: IContextKeyService,
		@Inject(IConfigurationService) configurationService: IConfigurationService,
		@Inject(IClipboardService) clipboardService: IClipboardService,
		@Inject(IQueryEditorService) queryEditorService: IQueryEditorService,
		@Inject(INotificationService) notificationService: INotificationService,
	) {
		super(el, cd, contextMenuService, keybindingService, contextKeyService, configurationService, clipboardService, queryEditorService, notificationService);
		this._el.nativeElement.className = 'slickgridContainer';
		this.rowHeight = configurationService.getValue<any>('resultsGrid').rowHeight;
		configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('resultsGrid')) {
				this.rowHeight = configurationService.getValue<any>('resultsGrid').rowHeight;
				this.slickgrids.forEach(i => {
					i.rowHeight = this.rowHeight;
				});
				this.resizeGrids();
			}
		});
	}

	/**
	 * Called by Angular when the object is initialized
	 */
	ngOnInit(): void {
		const self = this;

		this.dataService = this.queryParameters.dataService;
		this.actionProvider = this.instantiationService.createInstance(GridActionProvider, this.dataService, this.onGridSelectAll());

		this.baseInit();
		this.setupResizeBind();

		this.subscribeWithDispose(this.dataService.queryEventObserver, (event) => {
			switch (event.type) {
				case 'start':
					self.handleStart(self, event);
					break;
				case 'complete':
					self.handleComplete(self, event);
					break;
				case 'message':
					self.handleMessage(self, event);
					break;
				case 'resultSet':
					self.handleResultSet(self, event);
					break;
				default:
					error('Unexpected query event type "' + event.type + '" sent');
					break;
			}
			self._cd.detectChanges();
		});

		this.queryParameters.onSaveViewState(() => this.saveViewState());
		this.queryParameters.onRestoreViewState(() => this.restoreViewState());

		this.dataService.onAngularLoaded();
	}

	public ngOnDestroy(): void {
		this.baseDestroy();
	}

	protected initShortcuts(shortcuts: { [name: string]: Function }): void {
		shortcuts['event.nextGrid'] = () => {
			this.navigateToGrid(this.activeGrid + 1);
		};
		shortcuts['event.prevGrid'] = () => {
			this.navigateToGrid(this.activeGrid - 1);
		};
		shortcuts['event.maximizeGrid'] = () => {
			this.magnify(this.activeGrid);
		};
	}

	handleStart(self: QueryComponent, event: any): void {
		self.messages = [];
		self.dataSets = [];
		self.placeHolderDataSets = [];
		self.renderedDataSets = self.placeHolderDataSets;
		self.totalElapsedTimeSpan = undefined;
		self.complete = false;
		self.activeGrid = 0;

		this.onActiveCellChanged = this.onCellSelect;

		// reset query plan info and send notification to subscribers
		self.hasQueryPlan = false;
		self.sentPlans = new Map<number, string>();
		self.queryExecutionStatus.emit('start');
		self.firstRender = true;
	}

	handleComplete(self: QueryComponent, event: any): void {
		self.totalElapsedTimeSpan = event.data;
		self.complete = true;
	}

	handleMessage(self: QueryComponent, event: any): void {
		self.messageStore.push(event.data);
		// Ensure that messages are updated at least every 10 seconds during long-running queries
		if (self.messageTimeout !== undefined && Date.now() - self.lastMessageHandleTime < 10000) {
			clearTimeout(self.messageTimeout);
		} else {
			self.lastMessageHandleTime = Date.now();
		}
		self.messageTimeout = setTimeout(() => {
			while (self.messageStore.length > 0) {
				let lastMessage = self.messages.length > 0 ? self.messages[self.messages.length - 1] : undefined;
				let nextMessage = self.messageStore[0];
				// If the next message has the same metadata as the previous one, just append its text to avoid rendering an entirely new message
				if (lastMessage !== undefined && lastMessage.batchId === nextMessage.batchId && lastMessage.isError === nextMessage.isError
					&& lastMessage.link === nextMessage.link && lastMessage.link === undefined) {
					lastMessage.message += '\n' + nextMessage.message;
				} else {
					self.messages.push(nextMessage);
				}
				self.messageStore = self.messageStore.slice(1);
			}
			self._cd.detectChanges();
			self.scrollMessages();
		}, 100);
	}

	handleResultSet(self: QueryComponent, event: any): void {
		let resultSet = event.data;

		// No column info found, so define a column of no name by default
		if (!resultSet.columnInfo) {
			resultSet.columnInfo = [];
			resultSet.columnInfo[0] = { columnName: '' };
		}
		// Setup a function for generating a promise to lookup result subsets
		let loadDataFunction = (offset: number, count: number): Promise<IGridDataRow[]> => {
			return new Promise<IGridDataRow[]>((resolve, reject) => {
				self.dataService.getQueryRows(offset, count, resultSet.batchId, resultSet.id).subscribe(rows => {
					let gridData: IGridDataRow[] = [];
					for (let row = 0; row < rows.rows.length; row++) {
						// Push row values onto end of gridData for slickgrid
						gridData.push({
							values: [{}].concat(rows.rows[row].map(c => {
								return mixin({ ariaLabel: escape(c.displayValue) }, c);
							}))
						});
					}

					// if this is a query plan resultset we haven't processed yet then forward to subscribers
					if (self.hasQueryPlan && resultSet.id === self.queryPlanResultSetId && !self.sentPlans[resultSet.id]) {
						self.sentPlans[resultSet.id] = rows.rows[0][0].displayValue;
						self.queryPlanAvailable.emit(rows.rows[0][0].displayValue);
					}
					resolve(gridData);
				});
			});
		};

		// Precalculate the max height and min height
		let maxHeight: string = 'inherit';
		if (resultSet.rowCount < self._defaultNumShowingRows) {
			let maxHeightNumber: number = Math.max((resultSet.rowCount + 1) * self._rowHeight, self.dataIcons.length * 30) + 10;
			maxHeight = maxHeightNumber.toString() + 'px';
		}

		let minHeight: string = maxHeight;
		if (resultSet.rowCount >= self._defaultNumShowingRows) {
			let minHeightNumber: number = (self._defaultNumShowingRows + 1) * self._rowHeight + 10;
			minHeight = minHeightNumber.toString() + 'px';
		}

		let rowNumberColumn = new RowNumberColumn({ numberOfRows: resultSet.rowCount });

		// Store the result set from the event
		let dataSet: IGridDataSet = {
			resized: undefined,
			batchId: resultSet.batchId,
			resultId: resultSet.id,
			totalRows: resultSet.rowCount,
			maxHeight: maxHeight,
			minHeight: minHeight,
			dataRows: new VirtualizedCollection(
				self.windowSize,
				resultSet.rowCount,
				loadDataFunction,
				index => { return { values: [] }; }
			),
			columnDefinitions: [rowNumberColumn.getColumnDefinition()].concat(resultSet.columnInfo.map((c, i) => {
				let isLinked = c.isXml || c.isJson;
				let linkType = c.isXml ? 'xml' : 'json';

				return {
					id: i.toString(),
					name: c.columnName === 'Microsoft SQL Server 2005 XML Showplan'
						? 'XML Showplan'
						: escape(c.columnName),
					field: i.toString(),
					formatter: isLinked ? Services.hyperLinkFormatter : Services.textFormatter,
					asyncPostRender: isLinked ? self.linkHandler(linkType) : undefined
				};
			}))
		};
		self.plugins.push([rowNumberColumn, new AutoColumnSize(), new AdditionalKeyBindings()]);
		self.dataSets.push(dataSet);

		// check if the resultset is for a query plan
		for (let i = 0; i < resultSet.columnInfo.length; ++i) {
			let column = resultSet.columnInfo[i];
			if (column.columnName === 'Microsoft SQL Server 2005 XML Showplan') {
				this.hasQueryPlan = true;
				this.queryPlanResultSetId = resultSet.id;
				break;
			}
		}

		// Create a dataSet to render without rows to reduce DOM size
		let undefinedDataSet = clone(dataSet);
		undefinedDataSet.columnDefinitions = dataSet.columnDefinitions;
		undefinedDataSet.dataRows = undefined;
		undefinedDataSet.resized = new EventEmitter();
		self.placeHolderDataSets.push(undefinedDataSet);
		self.onScroll(0);
	}

	onCellSelect(gridIndex: number): void {
		this.activeGrid = gridIndex;
	}

	openMessagesContextMenu(event: any): void {
		let self = this;
		event.preventDefault();
		let selectedRange = this.getSelectedRangeUnderMessages();
		let selectAllFunc = () => self.selectAllMessages();
		let anchor = { x: event.x + 1, y: event.y };
		this.contextMenuService.showContextMenu({
			getAnchor: () => anchor,
			getActions: () => this.actionProvider.getMessagesActions(this.dataService, selectAllFunc),
			getKeyBinding: (action) => this._keybindingFor(action),
			onHide: (wasCancelled?: boolean) => {
			},
			getActionsContext: () => (selectedRange)
		});
	}


	/**
	 * Handles rendering the results to the DOM that are currently being shown
	 * and destroying any results that have moved out of view
	 * @param scrollTop The scrolltop value, if not called by the scroll event should be 0
	 */
	onScroll(scrollTop): void {
		const self = this;
		clearTimeout(self.scrollTimeOut);
		this.scrollTimeOut = setTimeout(() => {
			if (self.dataSets.length < self.maxScrollGrids) {
				self.scrollEnabled = false;
				for (let i = 0; i < self.placeHolderDataSets.length; i++) {
					self.placeHolderDataSets[i].dataRows = self.dataSets[i].dataRows;
					self.placeHolderDataSets[i].resized.emit();
				}
			} else {
				let gridHeight = self._el.nativeElement.getElementsByTagName('slick-grid')[0].offsetHeight;
				let tabHeight = self.getResultsElement().offsetHeight;
				let numOfVisibleGrids = Math.ceil((tabHeight / gridHeight)
					+ ((scrollTop % gridHeight) / gridHeight));
				let min = Math.floor(scrollTop / gridHeight);
				let max = min + numOfVisibleGrids;
				for (let i = 0; i < self.placeHolderDataSets.length; i++) {
					if (i >= min && i < max) {
						if (self.placeHolderDataSets[i].dataRows === undefined) {
							self.placeHolderDataSets[i].dataRows = self.dataSets[i].dataRows;
							self.placeHolderDataSets[i].resized.emit();
						}
					} else if (self.placeHolderDataSets[i].dataRows !== undefined) {
						self.placeHolderDataSets[i].dataRows = undefined;
					}
				}
			}

			self._cd.detectChanges();
		}, self.scrollTimeOutTime);
	}

	onSelectionLinkClicked(index: number): void {
		this.dataService.setEditorSelection(index);
	}

	onKey(e: Event, index: number) {
		if (DOM.isAncestor(<HTMLElement>e.target, this._queryLinkElement.nativeElement) && e instanceof KeyboardEvent) {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter)) {
				this.onSelectionLinkClicked(index);
				e.stopPropagation();
			}
		}
	}

	/**
	 * Sets up the resize for the messages/results panes bar
	 */
	setupResizeBind(): void {
		const self = this;

		let resizeHandleElement: HTMLElement = self._el.nativeElement.querySelector('#messageResizeHandle');
		let $resizeHandle = $(resizeHandleElement);
		let $messages = $(self.getMessagesElement());

		$resizeHandle.bind('dragstart', (e) => {
			self.resizing = true;
			self.resizeHandleTop = self.calculateResizeHandleTop(e.pageY);
			self._cd.detectChanges();
			return true;
		});

		$resizeHandle.bind('drag', (e) => {
			// Update the animation if the drag is within the allowed range.
			if (self.isDragWithinAllowedRange(e.pageY, resizeHandleElement)) {
				self.resizeHandleTop = self.calculateResizeHandleTop(e.pageY);
				self.resizing = true;
				self._cd.detectChanges();

				// Stop the animation if the drag is out of the allowed range.
				// The animation is resumed when the drag comes back into the allowed range.
			} else {
				self.resizing = false;
			}
		});

		$resizeHandle.bind('dragend', (e) => {
			self.resizing = false;
			// Redefine the min size for the messages based on the final position
			// if the drag is within the allowed rang
			if (self.isDragWithinAllowedRange(e.pageY, resizeHandleElement)) {
				let minHeightNumber = this.getMessagePaneHeightFromDrag(e.pageY);
				$messages.css('min-height', minHeightNumber + 'px');
				self._cd.detectChanges();
				self.resizeGrids();

				// Otherwise just update the UI to show that the drag is complete
			} else {
				self._cd.detectChanges();
			}
		});
	}

	/**
	 * Returns true if the resize of the messagepane given by the drag at top=eventPageY is valid,
	 * false otherwise. A drag is valid if it is below the bottom of the resultspane and
	 * this.messagePaneHeight pixels above the bottom of the entire angular component.
	 */
	isDragWithinAllowedRange(eventPageY: number, resizeHandle: HTMLElement): boolean {
		let resultspaneElement: HTMLElement = this._el.nativeElement.querySelector('#resultspane');
		let minHeight = this.getMessagePaneHeightFromDrag(eventPageY);

		if (resultspaneElement &&
			minHeight > 0 &&
			resultspaneElement.getBoundingClientRect().bottom < eventPageY
		) {
			return true;
		}
		return false;
	}

	/**
	 * Calculates the position of the top of the resize handle given the Y-axis drag
	 * coordinate as eventPageY.
	 */
	calculateResizeHandleTop(eventPageY: number): string {
		let resultsWindowTop: number = this._el.nativeElement.getBoundingClientRect().top;
		let relativeTop: number = eventPageY - resultsWindowTop;
		return relativeTop + 'px';
	}

	/**
	 * Returns the height the message pane would be if it were resized so that its top would be set to eventPageY.
	 * This will return a negative value if eventPageY is below the bottom limit.
	 */
	getMessagePaneHeightFromDrag(eventPageY: number): number {
		let bottomDragLimit: number = this._el.nativeElement.getBoundingClientRect().bottom - this.messagePaneHeight;
		return bottomDragLimit - eventPageY;
	}

	/**
	 * Ensures the messages tab is scrolled to the bottom
	 */
	scrollMessages(): void {
		let messagesDiv = this.getMessagesElement();
		messagesDiv.scrollTop = messagesDiv.scrollHeight;
	}

	/**
	 *
	 */
	protected tryHandleKeyEvent(e): boolean {
		return false;
	}

	/**
	 * Handles rendering and unrendering necessary resources in order to properly
	 * navigate from one grid another. Should be called any time grid navigation is performed
	 * @param targetIndex The index in the renderedDataSets to navigate to
	 * @returns A boolean representing if the navigation was successful
	 */
	navigateToGrid(targetIndex: number): boolean {
		// check if the target index is valid
		if (targetIndex >= this.renderedDataSets.length || !this.hasFocus()) {
			return false;
		}

		// Deselect any text since we are navigating to a new grid
		// Do this even if not switching grids, since this covers clicking on the grid after message selection
		window.getSelection().removeAllRanges();

		// check if you are actually trying to change navigation
		if (this.activeGrid === targetIndex) {
			return false;
		}

		this.slickgrids.toArray()[this.activeGrid].selection = false;
		this.slickgrids.toArray()[targetIndex].setActive();
		this.activeGrid = targetIndex;

		// scrolling logic
		let resultsWindow = $('#results');
		let scrollTop = resultsWindow.scrollTop();
		let scrollBottom = scrollTop + resultsWindow.height();
		let gridHeight = $(this._el.nativeElement).find('slick-grid').height();
		if (scrollBottom < gridHeight * (targetIndex + 1)) {
			scrollTop += (gridHeight * (targetIndex + 1)) - scrollBottom;
			resultsWindow.scrollTop(scrollTop);
		}
		if (scrollTop > gridHeight * targetIndex) {
			scrollTop = (gridHeight * targetIndex);
			resultsWindow.scrollTop(scrollTop);
		}

		return true;
	}

	public hasFocus(): boolean {
		return DOM.isAncestor(document.activeElement, this._el.nativeElement);
	}

	resizeGrids(): void {
		const self = this;
		setTimeout(() => {
			for (let grid of self.renderedDataSets) {
				grid.resized.emit();
			}
		});
	}

	protected showChartForGrid(index: number) {
		if (this.renderedDataSets.length > index) {
			this.showChartRequested.emit(this.renderedDataSets[index]);
		}
	}

	protected goToNextQueryOutputTab(): void {
		this.goToNextQueryOutputTabRequested.emit();
	}

	protected toggleResultPane(): void {
		this.resultActive = !this.resultActive;
		this._cd.detectChanges();
		if (this.resultActive) {
			this.resizeGrids();
			this.slickgrids.toArray()[this.activeGrid].setActive();
		}
	}

	protected toggleMessagePane(): void {
		this.messageActive = !this.messageActive;
		this._cd.detectChanges();
		if (this.messageActive && this._messagesContainer) {
			let header = <HTMLElement>this._messagesContainer.nativeElement;
			header.focus();
		}
	}

	/* Helper function to toggle messages and results panes */
	// tslint:disable-next-line:no-unused-variable
	private togglePane(pane: PaneType): void {
		if (pane === 'messages') {
			this.toggleMessagePane();
		} else if (pane === 'results') {
			this.toggleResultPane();
		}
	}

	private saveViewState(): void {
		let gridSelections = this.slickgrids.map(grid => grid.getSelectedRanges());
		let resultsScrollElement = (this._resultsScrollBox.nativeElement as HTMLElement);
		let resultsScroll = resultsScrollElement.scrollTop;
		let messagePaneScroll = (this._messagesContainer.nativeElement as HTMLElement).scrollTop;
		let slickGridScrolls = this._slickgridElements.map(element => {
			// Get the slick grid's viewport element and save its scroll position
			let scrollElement = (element.nativeElement as HTMLElement).children[0].children[3];
			return {
				vertical: scrollElement.scrollTop,
				horizontal: scrollElement.scrollLeft
			};
		});

		this.savedViewState = {
			gridSelections,
			messagePaneScroll,
			resultsScroll,
			slickGridScrolls
		};
	}

	private restoreViewState(): void {
		if (this.savedViewState) {
			this.slickgrids.forEach((grid, index) => grid.selection = this.savedViewState.gridSelections[index]);
			(this._resultsScrollBox.nativeElement as HTMLElement).scrollTop = this.savedViewState.resultsScroll;
			(this._messagesContainer.nativeElement as HTMLElement).scrollTop = this.savedViewState.messagePaneScroll;
			this._slickgridElements.forEach((element, index) => {
				let scrollElement = (element.nativeElement as HTMLElement).children[0].children[3];
				let savedScroll = this.savedViewState.slickGridScrolls[index];
				scrollElement.scrollTop = savedScroll.vertical;
				scrollElement.scrollLeft = savedScroll.horizontal;
			});
			this.savedViewState = undefined;
		}
	}

	layout() {
		this.resizeGrids();
	}
}
