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
import 'vs/css!./media/editData';

import { ElementRef, ChangeDetectorRef, OnInit, OnDestroy, Component, Inject, forwardRef, EventEmitter } from '@angular/core';
import { IGridDataRow, VirtualizedCollection } from 'angular2-slickgrid';
import { IGridDataSet } from 'sql/parts/grid/common/interfaces';
import * as Services from 'sql/parts/grid/services/sharedServices';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { EditDataComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { GridParentComponent } from 'sql/parts/grid/views/gridParentComponent';
import { EditDataGridActionProvider } from 'sql/parts/grid/views/editData/editDataGridActions';
import { error } from 'sql/base/common/log';
import { clone } from 'sql/base/common/objects';

export const EDITDATA_SELECTOR: string = 'editdata-component';

@Component({
	selector: EDITDATA_SELECTOR,
	host: { '(window:keydown)': 'keyEvent($event)', '(window:gridnav)': 'keyEvent($event)' },
	templateUrl: decodeURI(require.toUrl('sql/parts/grid/views/editData/editData.component.html'))
})

export class EditDataComponent extends GridParentComponent implements OnInit, OnDestroy {
	// CONSTANTS
	private scrollTimeOutTime = 200;
	private windowSize = 50;

	// FIELDS
	// All datasets
	private dataSet: IGridDataSet;
	private scrollTimeOut: number;
	private messagesAdded = false;
	private scrollEnabled = true;
	private firstRender = true;
	private totalElapsedTimeSpan: number;
	private complete = false;
	private idMapping: { [row: number]: number } = {};

	// Current selected cell state
	private currentCell: { row: number, column: number, isEditable: boolean };
	private currentEditCellValue: string;
	private newRowVisible: boolean;
	private removingNewRow: boolean;
	private rowIdMappings: {[gridRowId: number]: number} = {};

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

	constructor(
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) cd: ChangeDetectorRef,
		@Inject(BOOTSTRAP_SERVICE_ID) bootstrapService: IBootstrapService
	) {
		super(el, cd, bootstrapService);
		this._el.nativeElement.className = 'slickgridContainer';
		let editDataParameters: EditDataComponentParams = this._bootstrapService.getBootstrapParams(this._el.nativeElement.tagName);
		this.dataService = editDataParameters.dataService;
		this.actionProvider = this._bootstrapService.instantiationService.createInstance(EditDataGridActionProvider, this.dataService, this.onGridSelectAll(), this.onDeleteRow(), this.onRevertRow());
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
					error('Unexpected query event type "' + event.type + '" sent');
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
		self.totalElapsedTimeSpan = undefined;
		self.complete = false;
		self.messagesAdded = false;

		// Hooking up edit functions
		this.onIsCellEditValid = (row, column, value): boolean => {
			// TODO can only run sync code
			return true;
		};

		this.onActiveCellChanged = this.onCellSelect;

		this.onCellEditEnd = (event: { row: number, column: number, newValue: any }): void => {
			// Store the value that was set
			self.currentEditCellValue = event.newValue;
		};

		this.onCellEditBegin = (event: { row: number, column: number }): void => { };

		this.onRowEditBegin = (event: { row: number }): void => { };

		this.onRowEditEnd = (event: { row: number }): void => { };

		this.onIsColumnEditable = (column: number): boolean => {
			let result = false;
			// Check that our variables exist
			if (column !== undefined && !!this.dataSet && !!this.dataSet.columnDefinitions[column]) {
				result = this.dataSet.columnDefinitions[column].isEditable;
			}

			// If no column definition exists then the row is not editable
			return result;
		};

		this.overrideCellFn = (rowNumber, columnId, value?, data?): string => {
			let returnVal = '';
			if (Services.DBCellValue.isDBCellValue(value)) {
				returnVal = value.displayValue;
			} else if (typeof value === 'string') {
				returnVal = value;
			}
			return returnVal;
		};

		// Setup a function for generating a promise to lookup result subsets
		this.loadDataFunction = (offset: number, count: number): Promise<IGridDataRow[]> => {
			return new Promise<IGridDataRow[]>((resolve, reject) => {
				self.dataService.getEditRows(offset, count).subscribe(result => {
					let rowIndex = offset;
					let gridData: IGridDataRow[] = result.subset.map(row => {
						self.idMapping[rowIndex] = row.id;
						rowIndex++;
						return { values: row.cells, row: row.id };
					});

					// Append a NULL row to the end of gridData
					let newLastRow = gridData.length === 0 ? 0 : (gridData[gridData.length - 1].row + 1);
					gridData.push({ values: self.dataSet.columnDefinitions.map(cell => { return { displayValue: 'NULL', isNull: false }; }), row: newLastRow });
					resolve(gridData);
				});
			});
		};
	}

	onDeleteRow(): (index: number) => void {
		const self = this;
		return (index: number): void => {
			self.dataService.deleteRow(index)
				.then(() => self.dataService.commitEdit())
				.then(() => self.removeRow(index));
		};
	}

	onRevertRow(): (index: number) => void {
		const self = this;
		return (index: number): void => {
			// Force focus to the first cell (completing any active edit operation)
			self.focusCell(index, 0, false);

			// Perform a revert row operation
			self.dataService.revertRow(index)
				.then(() => self.refreshResultsets());
		};
	}

	onCellSelect(event: { row: number, column: number }): void {
		let self = this;
		let row = event.row;
		let column = event.column;

		// Skip processing if the newly selected cell is undefined or we don't have column
		// definition for the column (ie, the selection was reset)
		if (row === undefined || column === undefined) {
			return;
		}

		// Skip processing if the cell hasn't moved (eg, we reset focus to the previous cell after a failed update)
		if (this.currentCell.row === row && this.currentCell.column === column) {
			return;
		}

		let cellSelectTasks: Promise<void> = Promise.resolve();

		if (this.currentCell.isEditable && this.currentEditCellValue !== null && !this.removingNewRow) {
			// We're exiting a read/write cell after having changed the value, update the cell value in the service
			cellSelectTasks = cellSelectTasks.then(() => {
				// Use the mapped row ID if we're on that row
				let sessionRowId = self.rowIdMappings[self.currentCell.row] !== undefined
					? self.rowIdMappings[self.currentCell.row]
					: self.currentCell.row;

				return self.dataService.updateCell(sessionRowId, self.currentCell.column - 1, self.currentEditCellValue)
					.then(
						result => {
							// Cell update was successful, update the flags
							self.currentEditCellValue = null;
							self.setCellDirtyState(row, self.currentCell.column, result.cell.isDirty);
							self.setRowDirtyState(row, result.isRowDirty);
							return Promise.resolve();
						},
						error => {
							// Cell update failed, jump back to the last cell we were on
							self.focusCell(self.currentCell.row, self.currentCell.column, true);
							return Promise.reject(null);
						}
					);
			});
		}

		if (this.currentCell.row !== row) {
			// We're changing row, commit the changes
			cellSelectTasks = cellSelectTasks.then(() => {
				return self.dataService.commitEdit()
					.then(
						result => {
							// Committing was successful, clean the grid
							self.setGridClean();
							self.rowIdMappings = {};
							self.newRowVisible = false;
							return Promise.resolve();
						},
						error => {
							// Committing failed, jump back to the last selected cell
							self.focusCell(self.currentCell.row, self.currentCell.column);
							return Promise.reject(null);
						}
					);
			});
		}

		if (this.isNullRow(row) && !this.removingNewRow) {
			// We've entered the "new row", so we need to add a row and jump to it
			cellSelectTasks = cellSelectTasks.then(() => {
				self.addRow(row);
			});
		}

		// At the end of a successful cell select, update the currently selected cell
		cellSelectTasks = cellSelectTasks.then(() => {
			self.currentCell = {
				row: row,
				column: column,
				isEditable: self.dataSet.columnDefinitions[column - 1]
					? self.dataSet.columnDefinitions[column - 1].isEditable
					: false
			};
		});

		// Cap off any failed promises, since they'll be handled
		cellSelectTasks.catch(() => {});
	}

	handleComplete(self: EditDataComponent, event: any): void {
		self.totalElapsedTimeSpan = event.data;
		self.complete = true;
		self.messagesAdded = true;
	}

	handleEditSessionReady(self, event): void {
		// TODO: update when edit session is ready
	}

	handleMessage(self: EditDataComponent, event: any): void {
		// TODO: what do we do with messages?
	}

	handleResultSet(self: EditDataComponent, event: any): void {
		// Clone the data before altering it to avoid impacting other subscribers
		let resultSet = Object.assign({}, event.data);

		// Add an extra 'new row'
		resultSet.rowCount++;
		// Precalculate the max height and min height
		let maxHeight = this.getMaxHeight(resultSet.rowCount);
		let minHeight = this.getMinHeight(resultSet.rowCount);

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
				index => { return { values: [] }; }
			),
			columnDefinitions: resultSet.columnInfo.map((c, i) => {
				let isLinked = c.isXml || c.isJson;
				let linkType = c.isXml ? 'xml' : 'json';
				return {
					id: i.toString(),
					name: c.columnName === 'Microsoft SQL Server 2005 XML Showplan'
						? 'XML Showplan'
						: c.columnName,
					type: self.stringToFieldType('string'),
					formatter: isLinked ? Services.hyperLinkFormatter : Services.textFormatter,
					asyncPostRender: isLinked ? self.linkHandler(linkType) : undefined,
					isEditable: c.isUpdatable
				};
			})
		};
		self.dataSet = dataSet;

		// Create a dataSet to render without rows to reduce DOM size
		let undefinedDataSet = clone(dataSet);
		undefinedDataSet.columnDefinitions = dataSet.columnDefinitions;
		undefinedDataSet.dataRows = undefined;
		undefinedDataSet.resized = new EventEmitter();
		self.placeHolderDataSets.push(undefinedDataSet);
		self.messagesAdded = true;
		self.onScroll(0);

		// Setup the state of the selected cell
		this.currentCell = { row: null, column: null, isEditable: null };
		this.currentEditCellValue = null;
		this.removingNewRow = false;
		this.newRowVisible = false;
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
			self.scrollEnabled = false;
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
		}, self.scrollTimeOutTime);
	}

	protected tryHandleKeyEvent(e): boolean {
		let handled: boolean = false;
		// If the esc key was pressed while in a create session
		let currentNewRowIndex = this.dataSet.totalRows - 2;

		if (e.keyCode === jQuery.ui.keyCode.ESCAPE && this.newRowVisible && this.currentCell.row === currentNewRowIndex) {
			// revert our last new row
			this.removingNewRow = true;

			this.dataService.revertRow(this.idMapping[currentNewRowIndex])
				.then(() => {
					this.removeRow(currentNewRowIndex);
					this.newRowVisible = false;
				});
			handled = true;
		}
		return handled;
	}

	// Private Helper Functions ////////////////////////////////////////////////////////////////////////////

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
			$(grid.getCellNode(row, column)).addClass('dirtyCell').removeClass('selected');
		} else {
			$(grid.getCellNode(row, column)).removeClass('dirtyCell');
		}
	}

	// Adds CSS classes to slickgrid rows to indicate a dirty state
	private setRowDirtyState(row: number, dirtyState: boolean): void {
		let slick: any = this.slickgrids.toArray()[0];
		let grid = slick._grid;
		if (dirtyState) {
			// Change row header color
			$(grid.getCellNode(row, 0)).addClass('dirtyRowHeader');
		} else {
			$(grid.getCellNode(row, 0)).removeClass('dirtyRowHeader');
		}
	}

	// Sets CSS to clean the entire grid of dirty state cells and rows
	private setGridClean(): void {
		// Remove dirty classes from the entire table
		let allRows = $($('.grid-canvas').children());
		let allCells = $(allRows.children());
		allCells.removeClass('dirtyCell').removeClass('dirtyRowHeader');
	}

	// Adds an extra row to the end of slickgrid (just for rendering purposes)
	// Then sets the focused call afterwards
	private addRow(row: number): void {
		let self = this;

		// Add a new row to the edit session in the tools service
		this.dataService.createRow()
			.then(result => {
				// Map the new row ID to the row ID we have
				self.rowIdMappings[row] = result.newRowId;
				self.newRowVisible = true;

				// Add a new "new row" to the end of the results
				// Adding an extra row for 'new row' functionality
				self.dataSet.totalRows++;
				self.dataSet.maxHeight = self.getMaxHeight(this.dataSet.totalRows);
				self.dataSet.minHeight = self.getMinHeight(this.dataSet.totalRows);
				self.dataSet.dataRows = new VirtualizedCollection(
					self.windowSize,
					self.dataSet.totalRows,
					self.loadDataFunction,
					index => { return { values: [] }; }
				);

				// Refresh grid
				self.onScroll(0);

				// Mark the row as dirty once the scroll has completed
				setTimeout(() => {
					self.setRowDirtyState(row, true);
				}, self.scrollTimeOutTime);
			});
	}

	// removes a row from the end of slickgrid (just for rendering purposes)
	// Then sets the focused call afterwards
	private removeRow(row: number): void {
		// Removing the new row
		this.dataSet.totalRows--;
		this.dataSet.dataRows = new VirtualizedCollection(
			this.windowSize,
			this.dataSet.totalRows,
			this.loadDataFunction,
			index => { return { values: [] }; }
		);

		// refresh results view
		this.onScroll(0);

		// Set focus to the row index column of the removed row
		setTimeout(() => {
			this.focusCell(row, 0);
			this.removingNewRow = false;
		}, this.scrollTimeOutTime);
	}

	private focusCell(row: number, column: number, forceEdit: boolean=true): void {
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
}
