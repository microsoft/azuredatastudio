/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/editData';

import { ElementRef, ChangeDetectorRef, OnInit, OnDestroy, Component, Inject, forwardRef, EventEmitter } from '@angular/core';
import { VirtualizedCollection } from 'angular2-slickgrid';

import { IGridDataSet } from 'sql/workbench/parts/grid/common/interfaces';
import * as Services from 'sql/base/browser/ui/table/formatters';
import { IEditDataComponentParams, IBootstrapParams } from 'sql/platform/bootstrap/common/bootstrapParams';
import { GridParentComponent } from 'sql/workbench/parts/editData/browser/gridParentComponent';
import { EditDataGridActionProvider } from 'sql/workbench/parts/editData/browser/editDataGridActions';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { RowNumberColumn } from 'sql/base/browser/ui/table/plugins/rowNumberColumn.plugin';
import { AutoColumnSize } from 'sql/base/browser/ui/table/plugins/autoSizeColumns.plugin';
import { AdditionalKeyBindings } from 'sql/base/browser/ui/table/plugins/additionalKeyBindings.plugin';
import { escape } from 'sql/base/common/strings';

import { INotificationService } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { KeyCode } from 'vs/base/common/keyCodes';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { EditUpdateCellResult } from 'azdata';
import { ILogService } from 'vs/platform/log/common/log';
import { deepClone } from 'vs/base/common/objects';
export const EDITDATA_SELECTOR: string = 'editdata-component';

@Component({
	selector: EDITDATA_SELECTOR,
	host: { '(window:keydown)': 'keyEvent($event)', '(window:gridnav)': 'keyEvent($event)' },
	templateUrl: decodeURI(require.toUrl('./editData.component.html'))
})
export class EditDataComponent extends GridParentComponent implements OnInit, OnDestroy {
	// The time(in milliseconds) we wait before refreshing the grid.
	// We use clearTimeout and setTimeout pair to avoid unnecessary refreshes.
	private refreshGridTimeoutInMs = 200;

	// The timeout handle for the refresh grid task
	private refreshGridTimeoutHandle: any;

	// Optimized for the edit top 200 rows scenario, only need to retrieve the data once
	// to make the scroll experience smoother
	private windowSize = 200;

	// FIELDS
	// All datasets
	private dataSet: IGridDataSet;
	private firstRender = true;
	private totalElapsedTimeSpan: number;
	private complete = false;
	// Current selected cell state
	private currentCell: { row: number, column: number, isEditable: boolean, isDirty: boolean };
	private currentEditCellValue: string;
	private newRowVisible: boolean;
	private removingNewRow: boolean;
	private rowIdMappings: { [gridRowId: number]: number } = {};
	private dirtyCells: number[] = [];
	protected plugins = new Array<Array<Slick.Plugin<any>>>();

	// Edit Data functions
	public onActiveCellChanged: (event: Slick.OnActiveCellChangedEventArgs<any>) => void;
	public onCellEditEnd: (event: Slick.OnCellChangeEventArgs<any>) => void;
	public onIsCellEditValid: (row: number, column: number, newValue: any) => boolean;
	public onIsColumnEditable: (column: number) => boolean;
	public overrideCellFn: (rowNumber, columnId, value?, data?) => string;
	public loadDataFunction: (offset: number, count: number) => Promise<{}[]>;
	public onBeforeAppendCell: (row: number, column: number) => string;
	public onGridRendered: (event: Slick.OnRenderedEventArgs<any>) => void;

	private savedViewState: {
		gridSelections: Slick.Range[];
		scrollTop;
		scrollLeft;
	};

	constructor(
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) cd: ChangeDetectorRef,
		@Inject(IBootstrapParams) params: IEditDataComponentParams,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(IContextMenuService) contextMenuService: IContextMenuService,
		@Inject(IKeybindingService) keybindingService: IKeybindingService,
		@Inject(IContextKeyService) contextKeyService: IContextKeyService,
		@Inject(IConfigurationService) configurationService: IConfigurationService,
		@Inject(IClipboardService) clipboardService: IClipboardService,
		@Inject(IQueryEditorService) queryEditorService: IQueryEditorService,
		@Inject(ILogService) logService: ILogService
	) {
		super(el, cd, contextMenuService, keybindingService, contextKeyService, configurationService, clipboardService, queryEditorService, logService);
		this._el.nativeElement.className = 'slickgridContainer';
		this.dataService = params.dataService;
		this.actionProvider = this.instantiationService.createInstance(EditDataGridActionProvider, this.dataService, this.onGridSelectAll(), this.onDeleteRow(), this.onRevertRow());
		params.onRestoreViewState(() => this.restoreViewState());
		params.onSaveViewState(() => this.saveViewState());
	}

	/**
	 * Called by Angular when the object is initialized
	 */
	ngOnInit(): void {
		const self = this;
		this.baseInit();

		// Add the subscription to the list of things to be disposed on destroy, or else on a new component init
		// may get the "destroyed" object still getting called back.
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
				case 'editSessionReady':
					self.handleEditSessionReady(self, event);
					break;
				default:
					this.logService.error('Unexpected query event type "' + event.type + '" sent');
					break;
			}
			self._cd.detectChanges();
		});

		this.dataService.onAngularLoaded();
	}

	protected initShortcuts(shortcuts: { [name: string]: Function }): void {
		// TODO add any Edit Data-specific shortcuts here
	}

	public ngOnDestroy(): void {
		this.baseDestroy();
	}

	handleStart(self: EditDataComponent, event: any): void {
		self.dataSet = undefined;
		self.placeHolderDataSets = [];
		self.renderedDataSets = self.placeHolderDataSets;
		this._cd.detectChanges();
		self.totalElapsedTimeSpan = undefined;
		self.complete = false;

		// Hooking up edit functions
		this.onIsCellEditValid = (row, column, value): boolean => {
			// TODO can only run sync code
			return true;
		};

		this.onActiveCellChanged = this.onCellSelect;

		this.onCellEditEnd = (event: Slick.OnCellChangeEventArgs<any>): void => {
			if (self.currentEditCellValue !== event.item[event.cell]) {
				self.currentCell.isDirty = true;
			}
			// Store the value that was set
			self.currentEditCellValue = event.item[event.cell];
		};

		this.overrideCellFn = (rowNumber, columnId, value?, data?): string => {
			let returnVal = '';
			// replace the line breaks with space since the edit text control cannot
			// render line breaks and strips them, updating the value.
			if (Services.DBCellValue.isDBCellValue(value)) {
				returnVal = this.spacefyLinebreaks(value.displayValue);
			} else if (typeof value === 'string') {
				returnVal = this.spacefyLinebreaks(value);
			}
			return returnVal;
		};

		// This is the event slickgrid will raise in order to get the additional cell CSS classes for the cell
		// Due to performance advantage we are using this event instead of the onViewportChanged event.
		this.onBeforeAppendCell = (row: number, column: number): string => {
			let cellClass = undefined;
			if (this.isRowDirty(row) && column === 0) {
				cellClass = ' dirtyRowHeader ';
			} else if (this.isCellDirty(row, column)) {
				cellClass = ' dirtyCell ';
			}

			return cellClass;
		};

		this.onGridRendered = (args: Slick.OnRenderedEventArgs<any>): void => {
			// After rendering move the focus back to the previous active cell
			if (this.currentCell.column !== undefined && this.currentCell.row !== undefined
				&& this.isCellOnScreen(this.currentCell.row, this.currentCell.column)) {
				this.focusCell(this.currentCell.row, this.currentCell.column, false);
			}
		};

		// Setup a function for generating a promise to lookup result subsets
		this.loadDataFunction = (offset: number, count: number): Promise<{}[]> => {
			return new Promise<{}[]>((resolve, reject) => {
				self.dataService.getEditRows(offset, count).subscribe(result => {
					let gridData = result.subset.map(r => {
						let dataWithSchema = {};
						// skip the first column since its a number column
						for (let i = 1; i < this.dataSet.columnDefinitions.length; i++) {
							dataWithSchema[this.dataSet.columnDefinitions[i].field] = {
								displayValue: r.cells[i - 1].displayValue,
								ariaLabel: escape(r.cells[i - 1].displayValue),
								isNull: r.cells[i - 1].isNull
							};
						}
						return dataWithSchema;
					});

					// should add null row?
					if (offset + count > this.dataSet.totalRows - 1) {
						gridData.push(this.dataSet.columnDefinitions.reduce((p, c) => {
							p[c.field] = 'NULL';
							return p;
						}, {}));
					}

					resolve(gridData);
				});
			});
		};
	}

	onDeleteRow(): (index: number) => void {
		const self = this;
		return (index: number): void => {
			// If the user is deleting a new row that hasn't been committed yet then use the revert code
			if (self.newRowVisible && index === self.dataSet.dataRows.getLength() - 2) {
				self.revertCurrentRow();
			}
			else if (self.isNullRow(index)) {
				// Don't try to delete NULL (new) row since it doesn't actually exist and will throw an error
				// TODO #478 : We should really just stop the context menu from showing up for this row, but that's a bit more involved
				//	  so until then at least make it not display an error
				return;
			}
			else {
				self.dataService.deleteRow(index)
					.then(() => self.dataService.commitEdit())
					.then(() => self.removeRow(index));
			}
		};
	}

	onRevertRow(): () => void {
		const self = this;
		return (): void => {
			self.revertCurrentRow();
		};
	}

	onCellSelect(event: Slick.OnActiveCellChangedEventArgs<any>): void {
		let self = this;
		let row = event.row;
		let column = event.cell;

		// Skip processing if the newly selected cell is undefined or we don't have column
		// definition for the column (ie, the selection was reset)
		if (row === undefined || column === undefined) {
			return;
		}

		// Skip processing if the cell hasn't moved (eg, we reset focus to the previous cell after a failed update)
		if (this.currentCell.row === row && this.currentCell.column === column && this.currentCell.isDirty === false) {
			return;
		}

		let cellSelectTasks: Promise<void> = this.submitCurrentCellChange(
			(result: EditUpdateCellResult) => {
				// Cell update was successful, update the flags
				self.setCellDirtyState(self.currentCell.row, self.currentCell.column, result.cell.isDirty);
				self.setRowDirtyState(self.currentCell.row, result.isRowDirty);
				return Promise.resolve();
			},
			(error) => {
				// Cell update failed, jump back to the last cell we were on
				self.focusCell(self.currentCell.row, self.currentCell.column, true);
				return Promise.reject(null);
			});

		if (this.currentCell.row !== row) {
			// We're changing row, commit the changes
			cellSelectTasks = cellSelectTasks.then(() => {
				return self.dataService.commitEdit().then(result => {
					// Committing was successful, clean the grid
					self.setGridClean();
					self.rowIdMappings = {};
					self.newRowVisible = false;
					return Promise.resolve();
				}, error => {
					// Committing failed, jump back to the last selected cell
					self.focusCell(self.currentCell.row, self.currentCell.column);
					return Promise.reject(null);
				});
			});
		}

		// At the end of a successful cell select, update the currently selected cell
		cellSelectTasks = cellSelectTasks.then(() => {
			self.setCurrentCell(row, column);
		});

		// Cap off any failed promises, since they'll be handled
		cellSelectTasks.catch(() => { });
	}

	handleComplete(self: EditDataComponent, event: any): void {
		self.totalElapsedTimeSpan = event.data;
		self.complete = true;
	}

	handleEditSessionReady(self, event): void {
		// TODO: update when edit session is ready
	}

	handleMessage(self: EditDataComponent, event: any): void {
		if (event.data && event.data.isError) {
			self.notificationService.notify({
				severity: Severity.Error,
				message: event.data.message
			});
		}
	}

	handleResultSet(self: EditDataComponent, event: any): void {
		// Clone the data before altering it to avoid impacting other subscribers
		let resultSet = Object.assign({}, event.data);
		if (!resultSet.complete) {
			return;
		}

		// Add an extra 'new row'
		resultSet.rowCount++;
		// Precalculate the max height and min height
		let maxHeight = this.getMaxHeight(resultSet.rowCount);
		let minHeight = this.getMinHeight(resultSet.rowCount);

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
				this.loadDataFunction,
				index => { return {}; }
			),
			columnDefinitions: [rowNumberColumn.getColumnDefinition()].concat(resultSet.columnInfo.map((c, i) => {
				let columnIndex = (i + 1).toString();
				return {
					id: columnIndex,
					name: escape(c.columnName),
					field: columnIndex,
					formatter: Services.textFormatter,
					isEditable: c.isUpdatable
				};
			}))
		};
		self.plugins.push([rowNumberColumn, new AutoColumnSize({ maxWidth: this.configurationService.getValue<number>('resultsGrid.maxColumnWidth') }), new AdditionalKeyBindings()]);
		self.dataSet = dataSet;

		// Create a dataSet to render without rows to reduce DOM size
		let undefinedDataSet = deepClone(dataSet);
		undefinedDataSet.columnDefinitions = dataSet.columnDefinitions;
		undefinedDataSet.dataRows = undefined;
		undefinedDataSet.resized = new EventEmitter();
		self.placeHolderDataSets.push(undefinedDataSet);
		self.refreshGrid();

		// Setup the state of the selected cell
		this.resetCurrentCell();
		this.currentEditCellValue = undefined;
		this.removingNewRow = false;
		this.newRowVisible = false;
		this.dirtyCells = [];
	}

	/**
	 * Handles rendering the results to the DOM that are currently being shown
	 * and destroying any results that have moved out of view
	 * @param scrollTop The scrolltop value, if not called by the scroll event should be 0
	 */
	onScroll(scrollTop): void {
		this.refreshGrid();
	}

	/**
	 * Replace the line breaks with space.
	 */
	private spacefyLinebreaks(inputStr: string): string {
		return inputStr.replace(/(\r\n|\n|\r)/g, ' ');
	}

	private refreshGrid(): Thenable<void> {
		return new Promise<void>((resolve, reject) => {
			const self = this;
			clearTimeout(self.refreshGridTimeoutHandle);
			this.refreshGridTimeoutHandle = setTimeout(() => {
				for (let i = 0; i < self.placeHolderDataSets.length; i++) {
					self.placeHolderDataSets[i].dataRows = self.dataSet.dataRows;
					self.placeHolderDataSets[i].resized.emit();
				}

				self._cd.detectChanges();

				if (self.firstRender) {
					let setActive = function () {
						if (self.firstRender && self.slickgrids.toArray().length > 0) {
							self.slickgrids.toArray()[0].setActive();
							self.firstRender = false;
						}
					};

					setTimeout(() => {
						setActive();
					});
				}
				resolve();
			}, self.refreshGridTimeoutInMs);
		});
	}

	protected tryHandleKeyEvent(e: StandardKeyboardEvent): boolean {
		let handled: boolean = false;
		// If the esc key was pressed while in a create session
		let currentNewRowIndex = this.dataSet.totalRows - 2;

		if (e.keyCode === KeyCode.Escape) {
			this.revertCurrentRow();
			handled = true;
		}
		return handled;
	}

	// Private Helper Functions ////////////////////////////////////////////////////////////////////////////

	private async revertCurrentRow(): Promise<void> {
		let currentNewRowIndex = this.dataSet.totalRows - 2;
		if (this.newRowVisible && this.currentCell.row === currentNewRowIndex) {
			// revert our last new row
			this.removingNewRow = true;

			this.dataService.revertRow(this.rowIdMappings[currentNewRowIndex])
				.then(() => {
					return this.removeRow(currentNewRowIndex);
				}).then(() => {
					this.newRowVisible = false;
					this.resetCurrentCell();
				});
		} else {
			try {
				// Perform a revert row operation
				if (this.currentCell && this.currentCell.row !== undefined) {
					await this.dataService.revertRow(this.currentCell.row);
				}
			} finally {
				// The operation may fail if there were no changes sent to the service to revert,
				// so clear any existing client-side edit and refresh on-screen data
				// do not refresh the whole dataset as it will move the focus away to the first row.
				//
				this.currentEditCellValue = undefined;
				this.dirtyCells = [];
				let row = this.currentCell.row;
				this.resetCurrentCell();

				if (row !== undefined) {
					this.dataSet.dataRows.resetWindowsAroundIndex(row);
				}
			}
		}
	}

	private submitCurrentCellChange(resultHandler, errorHandler): Promise<void> {
		let self = this;
		let updateCellPromise: Promise<void> = Promise.resolve();
		let refreshGrid = false;
		if (this.currentCell && this.currentCell.isEditable && this.currentEditCellValue !== undefined && !this.removingNewRow) {
			if (this.isNullRow(this.currentCell.row)) {
				refreshGrid = true;
				// We've entered the "new row", so we need to add a row and jump to it
				updateCellPromise = updateCellPromise.then(() => {
					return self.addRow(this.currentCell.row);
				});
			}
			// We're exiting a read/write cell after having changed the value, update the cell value in the service
			updateCellPromise = updateCellPromise.then(() => {
				// Use the mapped row ID if we're on that row
				let sessionRowId = self.rowIdMappings[self.currentCell.row] !== undefined
					? self.rowIdMappings[self.currentCell.row]
					: self.currentCell.row;

				return self.dataService.updateCell(sessionRowId, self.currentCell.column - 1, self.currentEditCellValue);
			}).then(
				result => {
					self.currentEditCellValue = undefined;
					let refreshPromise: Thenable<void> = Promise.resolve();
					if (refreshGrid) {
						refreshPromise = self.refreshGrid();
					}
					return refreshPromise.then(() => {
						return resultHandler(result);
					});
				},
				error => {
					return errorHandler(error);
				}
			);
		}
		return updateCellPromise;
	}

	// Checks if input row is our NULL new row
	private isNullRow(row: number): boolean {
		// Null row is always at index (totalRows - 1)
		return (row === this.dataSet.totalRows - 1);
	}

	// Adds CSS classes to slickgrid cells to indicate a dirty state
	private setCellDirtyState(row: number, column: number, dirtyState: boolean): void {
		let slick: any = this.slickgrids.toArray()[0];
		let grid = slick._grid;
		if (dirtyState) {
			// Change cell color
			jQuery(grid.getCellNode(row, column)).addClass('dirtyCell').removeClass('selected');
			if (this.dirtyCells.indexOf(column) === -1) {
				this.dirtyCells.push(column);
			}
		} else {
			jQuery(grid.getCellNode(row, column)).removeClass('dirtyCell');
			if (this.dirtyCells.indexOf(column) !== -1) {
				this.dirtyCells.splice(this.dirtyCells.indexOf(column), 1);
			}
		}
	}

	// Adds CSS classes to slickgrid rows to indicate a dirty state
	private setRowDirtyState(row: number, dirtyState: boolean): void {
		let slick: any = this.slickgrids.toArray()[0];
		let grid = slick._grid;
		if (dirtyState) {
			// Change row header color
			jQuery(grid.getCellNode(row, 0)).addClass('dirtyRowHeader');
		} else {
			jQuery(grid.getCellNode(row, 0)).removeClass('dirtyRowHeader');
		}
	}

	// Sets CSS to clean the entire grid of dirty state cells and rows
	private setGridClean(): void {
		// Remove dirty classes from the entire table
		let allRows = jQuery(jQuery('.grid-canvas').children());
		let allCells = jQuery(allRows.children());
		allCells.removeClass('dirtyCell').removeClass('dirtyRowHeader');
		this.dirtyCells = [];
	}

	// Adds an extra row to the end of slickgrid (just for rendering purposes)
	// Then sets the focused call afterwards
	private addRow(row: number): Thenable<void> {
		let self = this;

		// Add a new row to the edit session in the tools service
		return this.dataService.createRow()
			.then(result => {
				// Map the new row ID to the row ID we have
				self.rowIdMappings[row] = result.newRowId;
				self.newRowVisible = true;

				// Add a new "new row" to the end of the results
				// Adding an extra row for 'new row' functionality
				self.dataSet.totalRows++;
				self.dataSet.maxHeight = self.getMaxHeight(self.dataSet.totalRows);
				self.dataSet.minHeight = self.getMinHeight(self.dataSet.totalRows);
				self.dataSet.dataRows = new VirtualizedCollection(
					self.windowSize,
					self.dataSet.totalRows,
					self.loadDataFunction,
					index => { return {}; }
				);
			});
	}


	// removes a row from the end of slickgrid (just for rendering purposes)
	// Then sets the focused call afterwards
	private removeRow(row: number): Thenable<void> {
		// Removing the new row
		this.dataSet.totalRows--;
		this.dataSet.dataRows = new VirtualizedCollection(
			this.windowSize,
			this.dataSet.totalRows,
			this.loadDataFunction,
			index => { return {}; }
		);

		// refresh results view
		return this.refreshGrid().then(() => {
			// Set focus to the row index column of the removed row if the current selection is in the removed row
			if (this.currentCell.row === row && !this.removingNewRow) {
				this.focusCell(row, 1);
			}
			this.removingNewRow = false;
		});
	}

	private focusCell(row: number, column: number, forceEdit: boolean = true): void {
		let slick: any = this.slickgrids.toArray()[0];
		let grid = slick._grid;
		grid.gotoCell(row, column, forceEdit);
	}

	private getMaxHeight(rowCount: number): any {
		return rowCount < this._defaultNumShowingRows
			? ((rowCount + 1) * this._rowHeight) + 10
			: 'inherit';
	}

	private getMinHeight(rowCount: number): any {
		return rowCount > this._defaultNumShowingRows
			? (this._defaultNumShowingRows + 1) * this._rowHeight + 10
			: this.getMaxHeight(rowCount);
	}

	private saveViewState(): void {
		let grid = this.slickgrids.toArray()[0];
		let self = this;
		if (grid) {
			let gridSelections = grid.getSelectedRanges();
			let gridObject = grid as any;
			let viewport = (gridObject._grid.getCanvasNode() as HTMLElement).parentElement;
			this.savedViewState = {
				gridSelections,
				scrollTop: viewport.scrollTop,
				scrollLeft: viewport.scrollLeft
			};

			// Save the cell that is currently being edited.
			// Note: This is only updating the data in tools service, not saving the change to database.
			// This is added to fix the data inconsistency: the updated value is displayed but won't be saved to the database
			// when committing the changes for the row.
			if (this.currentCell.row !== undefined && this.currentCell.column !== undefined && this.currentCell.isEditable) {
				gridObject._grid.getEditorLock().commitCurrentEdit();
				this.submitCurrentCellChange((result: EditUpdateCellResult) => {
					self.setCellDirtyState(self.currentCell.row, self.currentCell.column, result.cell.isDirty);
				}, (error: any) => {
					self.notificationService.error(error);
				});
			}
		}
	}

	private restoreViewState(): void {
		if (this.savedViewState) {
			this.slickgrids.toArray()[0].selection = this.savedViewState.gridSelections;
			let viewport = ((this.slickgrids.toArray()[0] as any)._grid.getCanvasNode() as HTMLElement).parentElement;
			viewport.scrollLeft = this.savedViewState.scrollLeft;
			viewport.scrollTop = this.savedViewState.scrollTop;
			this.savedViewState = undefined;

			// This block of code is responsible for restoring the dirty state indicators if slickgrid decides not to re-render the dirty row
			// Other scenarios will be taken care of by getAdditionalCssClassesForCell method when slickgrid needs to re-render the rows.
			if (this.currentCell.row !== undefined) {
				if (this.isRowDirty(this.currentCell.row)) {
					this.setRowDirtyState(this.currentCell.row, true);

					this.dirtyCells.forEach(cell => {
						this.setCellDirtyState(this.currentCell.row, cell, true);
					});
				}
			}
		}
	}

	private isRowDirty(row: number): boolean {
		return this.currentCell.row === row && this.dirtyCells.length > 0;
	}

	private isCellDirty(row: number, column: number): boolean {
		return this.currentCell.row === row && this.dirtyCells.indexOf(column) !== -1;
	}

	private isCellOnScreen(row: number, column: number): boolean {
		let slick: any = this.slickgrids.toArray()[0];
		let grid = slick._grid;
		let viewport = grid.getViewport();
		let cellBox = grid.getCellNodeBox(row, column);
		return viewport && cellBox
			&& viewport.leftPx <= cellBox.left && viewport.rightPx >= cellBox.right
			&& viewport.top <= row && viewport.bottom >= row;
	}

	private resetCurrentCell() {
		this.currentCell = {
			row: undefined,
			column: undefined,
			isEditable: false,
			isDirty: false
		};
	}

	private setCurrentCell(row: number, column: number) {
		// Only update if we're actually changing cells
		if (this.currentCell && (row !== this.currentCell.row || column !== this.currentCell.column)) {
			this.currentCell = {
				row: row,
				column: column,
				isEditable: this.dataSet.columnDefinitions[column]
					? this.dataSet.columnDefinitions[column].isEditable
					: false,
				isDirty: false
			};
		}

	}
}
