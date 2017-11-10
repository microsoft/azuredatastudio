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

import { clone } from 'vs/base/common/objects';

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

	private currentCell: { row: number, column: number } = null;
	private rowEditInProgress: boolean = false;
	private removingNewRow: boolean = false;

	// Edit Data functions
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
		this.actionProvider = new EditDataGridActionProvider(this.dataService, this.onGridSelectAll(), this.onDeleteRow(), this.onRevertRow());
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

		this.onCellEditEnd = (event: { row: number, column: number, newValue: any }): void => {
			self.rowEditInProgress = true;

			// Update the cell accordingly
			self.dataService.updateCell(this.idMapping[event.row], event.column, event.newValue)
				.then(
					result => {
						self.setCellDirtyState(event.row, event.column + 1, result.cell.isDirty);
						self.setRowDirtyState(event.row, result.isRowDirty);
					},
					error => {
						// On error updating cell, jump back to the cell that was being edited
						self.focusCell(event.row, event.column + 1);
					}
				);
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
			self.dataService.deleteRow(index).then(() => {
				self.dataService.commitEdit().then(() => {
					self.removeRow(index, 0);
				});
			});
		};
	}

	onRevertRow(): (index: number) => void {
		const self = this;
		return (index: number): void => {
			// Force focus to the first cell (completing any active edit operation)
			self.focusCell(index, 0, false);

			// Perform a revert row operation
			self.dataService.revertRow(index)
				.then(() => {	self.dataService.commitEdit(); })
				.then(() => {	self.refreshResultsets(); });
		};
	}

	onCellSelect(row: number, column: number): void {
		let self = this;

		// TODO: We can skip this step if we're allowing multiple commits
		if (this.rowEditInProgress) {
			// We're in the middle of a row edit, so we need to commit if we move to a different row
			if (row !== this.currentCell.row) {
				this.dataService.commitEdit()
					.then(
						result => {
							// Committing was successful. Clean the grid, turn off the row edit flag, then select again
							self.setGridClean();
							self.rowEditInProgress = false;
							self.onCellSelect(row, column);
						}, error => {
							// Committing failed, so jump back to the last selected cell
							self.focusCell(self.currentCell.row, self.currentCell.column);
						}
					);
				return;
			}
		} else {
			// We're not in the middle of a row edit, so we can move anywhere
			// Checking for removing new row makes sure we don't re-add the new row after we've
			// jumped to the first cell of the "new row"
			if (this.isNullRow(row) && !this.removingNewRow) {
				// We moved into the "new row", add another new row
				this.addRow(row, column);
			}
		}

		// Set the cell we moved to as the current cell
		this.currentCell = { row: row, column: column };
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

		// Reset selected cell state
		this.currentCell = null;
		this.rowEditInProgress = false;
		this.removingNewRow = false;

		// HACK: unsafe reference to the slickgrid object
		// TODO: Reimplement by adding selectCell event to angular2-slickgrid
		self._cd.detectChanges();
		let slick: any = self.slickgrids.toArray()[0];
		let grid: Slick.Grid<any> = slick._grid;

		grid.onActiveCellChanged.subscribe((event: Slick.EventData, data: Slick.OnActiveCellChangedEventArgs<any>) => {
			self.onCellSelect(data.row, data.cell);
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

		if (e.keyCode === jQuery.ui.keyCode.ESCAPE && this.currentCell.row === currentNewRowIndex) {
			// revert our last new row
			this.removingNewRow = true;

			this.dataService.revertRow(this.idMapping[currentNewRowIndex])
				.then(() => {
					this.removeRow(currentNewRowIndex, 0);
					this.rowEditInProgress = false;
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
	private addRow(row: number, column: number): void {
		// Add a new row to the edit session in the tools service
		this.dataService.createRow();

		// Adding an extra row for 'new row' functionality
		this.rowEditInProgress = true;
		this.dataSet.totalRows++;
		this.dataSet.maxHeight = this.getMaxHeight(this.dataSet.totalRows);
		this.dataSet.minHeight = this.getMinHeight(this.dataSet.totalRows);
		this.dataSet.dataRows = new VirtualizedCollection(
			this.windowSize,
			this.dataSet.totalRows,
			this.loadDataFunction,
			index => { return { values: [] }; }
		);

		// Refresh grid
		this.onScroll(0);

		// Mark the row as dirty once the scroll has completed
		setTimeout(() => {
			this.setRowDirtyState(row, true);
		}, this.scrollTimeOutTime);
	}

	// removes a row from the end of slickgrid (just for rendering purposes)
	// Then sets the focused call afterwards
	private removeRow(row: number, column: number): void {
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
