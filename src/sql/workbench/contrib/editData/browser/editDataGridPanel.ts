/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/editData';

import { VirtualizedCollection, AsyncDataProvider, ISlickColumn } from 'sql/base/browser/ui/table/asyncDataView';
import { Table } from 'sql/base/browser/ui/table/table';

import { IGridDataSet } from 'sql/workbench/contrib/grid/browser/interfaces';
import * as Services from 'sql/base/browser/ui/table/formatters';
import { GridParentComponent } from 'sql/workbench/contrib/editData/browser/gridParentComponent';
import { EditDataGridActionProvider } from 'sql/workbench/contrib/editData/browser/editDataGridActions';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { RowNumberColumn } from 'sql/base/browser/ui/table/plugins/rowNumberColumn.plugin';
import { AutoColumnSize } from 'sql/base/browser/ui/table/plugins/autoSizeColumns.plugin';
import { AdditionalKeyBindings } from 'sql/base/browser/ui/table/plugins/additionalKeyBindings.plugin';
import { escape } from 'sql/base/common/strings';
import { DataService } from 'sql/workbench/services/query/common/dataService';
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
import { Event } from 'vs/base/common/event';
import { equals } from 'vs/base/common/arrays';
import * as DOM from 'vs/base/browser/dom';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';

export class EditDataGridPanel extends GridParentComponent {
	// The time(in milliseconds) we wait before refreshing the grid.
	// We use clearTimeout and setTimeout pair to avoid unnecessary refreshes.
	// Timeout is set to allow the grid to refresh fully before allowing a manual refresh.
	private refreshGridTimeoutInMs = 1000;

	// The timeout handle for the refresh grid task
	private refreshGridTimeoutHandle: any;

	// Optimized for the edit top 200 rows scenario, only need to retrieve the data once
	// to make the scroll experience smoother
	private windowSize = 200;

	// FIELDS
	// All datasets
	private gridDataProvider: AsyncDataProvider<any>;
	//main dataset to work on.
	private dataSet: IGridDataSet;
	private oldDataRows: VirtualizedCollection<any>;
	private oldGridData: {}[];
	private firstRender = true;
	private firstLoad = true;
	private enableEditing = true;
	private noAutoSelectOnRender = false;
	// Last cell selected by the user.
	private lastClickedCell: { row: number, column: number, isEditable: boolean };
	// value of the cell after a user has finished editing (for submitting).
	private currentEditCellValue: string;
	private newRowVisible: boolean;
	private removingNewRow: boolean;
	private tabPressedAtLastColumn: boolean;
	private rowIdMappings: { [gridRowId: number]: number } = {};
	private dirtyCells: { row: number, column: number }[] = [];
	protected plugins = new Array<Slick.Plugin<any>>();
	private newlinePattern: string;
	// User inputted string saved in case of an invalid edit
	private lastEnteredString: string;
	// List of column names with their indexes stored.
	private columnNameToIndex: { [columnNumber: number]: string } = {};

  // Prevent the cell submission function from being called multiple times.
	private cellSubmitInProgress: boolean;

	private saveViewStateCalled: boolean;

	private restoreViewStateCalled: boolean;

	private alreadyDisposed: boolean;

	// Strings immediately before and after an edit.
	private originalStringValue: string;
	private lastStringBeforeSelect: string;
	private endStringValue: string;

	private rowAdded: boolean;

	// Used when saving is being done.
	private saveActive: boolean;
	private saveSuccess: boolean;

	// Edit Data functions
	public onActiveCellChanged: (event: Slick.OnActiveCellChangedEventArgs<any>) => void;
	public onCellChange: (event: Slick.OnCellChangeEventArgs<any>) => Promise<void>;
	public onIsCellEditValid: (row: number, column: number, newValue: any) => boolean;
	public onIsColumnEditable: (column: number) => boolean;
	public overrideCellFn: (rowNumber, columnId, value?, data?) => string;
	public loadDataFunction: (offset: number, count: number) => Promise<{}[]>;
	public onBeforeAppendCell: (row: number, column: number) => string;
	public onRefreshComplete: Promise<void>;

	private savedViewState: {
		gridSelections: Slick.Range[];
		scrollTop;
		scrollLeft;
	};

	constructor(
		dataService: DataService,
		onSaveViewState: Event<void>,
		onRestoreViewState: Event<void>,
		@IInstantiationService protected instantiationService: IInstantiationService,
		@INotificationService protected notificationService: INotificationService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IConfigurationService configurationService: IConfigurationService,
		@IClipboardService clipboardService: IClipboardService,
		@IQueryEditorService queryEditorService: IQueryEditorService,
		@ILogService logService: ILogService,
		@IAccessibilityService private accessibilityService: IAccessibilityService,
		@IQuickInputService private quickInputService: IQuickInputService
	) {
		super(contextMenuService, keybindingService, contextKeyService, configurationService, clipboardService, queryEditorService, logService);
		this.nativeElement = document.createElement('div');
		this.nativeElement.className = 'editDataGridPanel';
		this.nativeElement.classList.add('slickgridContainer');
		// Disable selecting the table until data has loaded otherwise data will be corrupt and the table will be unable to be updated..
		this.nativeElement.classList.add('loadingRows');
		this.dataService = dataService;
		this.actionProvider = this.instantiationService.createInstance(EditDataGridActionProvider, this.dataService, this.onGridSelectAll(), this.onDeleteRow(), this.onRevertRow());
		this.toDispose.add(onRestoreViewState(() => this.restoreViewState()));
		this.toDispose.add(onSaveViewState(() => this.saveViewState()));
		this.onInit();
	}

	/**
	 * Called when the object is initialized
	 */
	onInit(): void {
		const self = this;
		this.baseInit();
		this._register(DOM.addDisposableListener(this.nativeElement, DOM.EventType.KEY_DOWN, e => this.tryHandleKeyEvent(new StandardKeyboardEvent(e))));

		// Add the subscription to the list of things to be disposed on destroy, or else on a new component init
		// may get the "destroyed" object still getting called back.
		this.toDispose.add(this.dataService.queryEvents(event => {
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
					this.onRefreshComplete = self.handleResultSet(self, event);
					break;
				case 'editSessionReady':
					self.handleEditSessionReady(self, event);
					break;
				default:
					this.logService.error('Unexpected query event type "' + event.type + '" sent');
					break;
			}
		}));
		this.dataService.onLoaded();
	}

	public override render(container: HTMLElement): void {
		container.appendChild(this.nativeElement);
	}

	protected initShortcuts(shortcuts: { [name: string]: Function }): void {
		// TODO add any Edit Data-specific shortcuts here
	}

	public isGridDirty(): boolean {
		let currValue = this.table?.grid?.getCellEditor()?.serializeValue();
		if (this.dirtyCells.length > 0 || (this.table?.grid?.getCellEditor()?.isValueChanged() && !(this.originalStringValue === 'NULL' && (currValue === '' || currValue === undefined)))) {
			return true;
		}
		else {
			return false;
		}
	}

	public isSavingActive(): boolean {
		return this.saveActive;
	}

	public async savingGrid(): Promise<boolean> {
		if (!this.saveActive) {
			this.saveActive = true;
			let currentActiveCell = this.table.grid.getActiveCell();
			let newValue = this.table.grid.getCellEditor().serializeValue();
			let isDirty = this.table.grid.getCellEditor().isValueChanged() && !(this.originalStringValue === 'NULL' && (newValue === '' || newValue === undefined));
			if (!isDirty) {
				this.saveActive = false;
				return Promise.resolve(true);
			}
			this.currentEditCellValue = newValue;
			let currentNewCell = { row: currentActiveCell.row, column: currentActiveCell.cell, isEditable: true, isDirty: isDirty };
			await this.submitCellTask(currentNewCell);
			if (this.saveSuccess) {
				try {
					await this.commitEditTask();
				}
				catch (e) {
					this.saveActive = false;
					throw new Error('Commit failed due to overlapping rows: ' + e.toString());
				}
			}
			else {
				this.saveActive = false;
				throw new Error('Invalid data entered into cell.');
			}
		}
		// default case.
		this.saveActive = false;
		return Promise.resolve(true);
	}

	handleStart(self: EditDataGridPanel, event: any): void {
		self.dataSet = undefined;
		self.oldDataRows = undefined;
		self.oldGridData = undefined;
		self.placeHolderDataSets = [];
		self.renderedDataSets = self.placeHolderDataSets;

		// Hooking up edit functions handle
		this.onIsCellEditValid = (row, column, value): boolean => {
			// TODO can only run sync code
			return true;
		};

		this.onActiveCellChanged = this.onCellSelect;

		this.onCellChange = async (event: Slick.OnCellChangeEventArgs<any>): Promise<void> => {

			if (this.saveViewStateCalled) {
				// The saveViewState function will handle cell submitting functions.
				return;
			}

			if (this.cellSubmitInProgress) {
				return;
			}

			let isDirtyStatus = false;
			if (self.currentEditCellValue !== event.item[event.cell]) {
				isDirtyStatus = true;
			}
			// Store the value that was set
			self.currentEditCellValue = event.item[event.cell];

			let currentNewCell = { row: event.row, column: event.cell, isEditable: true, isDirty: isDirtyStatus };

			await this.submitCellTask(currentNewCell);
		};

		this.overrideCellFn = (rowNumber, columnId, value?, data?): string => {
			let returnVal = '';
			// replace the line breaks with space since the edit text control cannot
			// render line breaks and strips them, updating the value.
			/* tslint:disable:no-null-keyword */
			let valueMissing = value === undefined || value === null || (Services.DBCellValue.isDBCellValue(value) && value.isNull);
			let isStringNull = (Services.DBCellValue.isDBCellValue(value) && !value.isNull && value.displayValue === 'NULL');
			if (valueMissing) {
				returnVal = 'NULL';
			}
			else if (isStringNull) {
				returnVal = '\'NULL\'';
			}
			else if (Services.DBCellValue.isDBCellValue(value)) {
				returnVal = this.replaceLinebreaks(value.displayValue);
			}
			else if (typeof value === 'string') {
				returnVal = this.replaceLinebreaks(value);
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

		// Setup a function for generating a promise to lookup result subsets
		this.loadDataFunction = (offset: number, count: number): Promise<{}[]> => {
			return self.dataService.getEditRows(offset, count).then(result => {
				if (this.dataSet) {
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
							if (c.id !== 'rowNumber') {
								p[c.field] = { displayValue: 'NULL', ariaLabel: 'NULL', isNull: true };
							}
							return p;
						}, {}));
					}
					if (gridData && gridData !== this.oldGridData) {
						this.oldGridData = gridData;
					}
					return gridData;
				}
				else {
					this.logService.error('Grid data is nonexistent, using last known good grid');
					return this.oldGridData;
				}
			});
		};
	}

	onDeleteRow(): (index: number) => void {
		const self = this;
		return (index: number): void => {
			// If the user is deleting a new row that hasn't been committed yet then use the revert code
			if (self.newRowVisible && index === self.dataSet.dataRows.getLength() - 2) {
				self.revertSelectedRow(index).catch(onUnexpectedError);
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
					.then(() => self.removeRow(index, true));
			}
		};
	}

	onRevertRow(): () => void {
		const self = this;
		return (): void => {
			self.focusCell(this.lastClickedCell.row, self.lastClickedCell.column);
			self.revertSelectedCell(self.lastClickedCell.row, self.lastClickedCell.column).catch(onUnexpectedError);
			self.revertSelectedRow(self.lastClickedCell.row).catch(onUnexpectedError);
		};
	}

	onCellSelect(event: Slick.OnActiveCellChangedEventArgs<any>): void {
		let row = event.row;
		let column = event.cell;
		let isEditable = true;

		// Skip processing if the newly selected cell is undefined or we don't have column
		// definition for the column (ie, the selection was reset)
		if (row === undefined || column === undefined) {
			return;
		}

		if (this.lastClickedCell.row !== row && this.lastClickedCell.column !== column && this.firstRender) {
			return;
		}

		if (this.lastClickedCell.row === row && this.lastClickedCell.column === column) {
			return;
		}

		let isNullChange = (this.endStringValue === 'NULL' && this.lastStringBeforeSelect === '') || (this.endStringValue === '' && this.lastStringBeforeSelect === 'NULL');

		// Only commit if we are changing from a dirty row and the cell last edited did not change from before (the cell submit function will handle the commit in that case).
		if (this.isRowDirty(this.lastClickedCell.row) && row !== this.lastClickedCell.row && !(!isNullChange && (this.lastStringBeforeSelect !== this.endStringValue))) {
			this.commitEditTask().then(() => {
				this.lastClickedCell = { row, column, isEditable };
				return Promise.resolve();
			},
				() => {
					// Commit failed, don't move from the current cell.
					this.focusCell(this.lastClickedCell.row, this.lastClickedCell.column, true);
				});
		}
		else {
			// get the cell we have just immediately clicked (to set as the new active cell in handleChanges), only done if another cell is not currently being processed.
			this.lastClickedCell = { row, column, isEditable };
		}
	}

	private commitEditTask(): Thenable<void> {
		return this.dataService.commitEdit().then(() => {
			// Committing was successful, clean the grid
			this.setGridClean();
			this.rowIdMappings = {};
			this.newRowVisible = false;
			return Promise.resolve();
		});
	}

	public async revertForDontSave(): Promise<void> {
		(this.table as any)._grid.getEditorLock().cancelCurrentEdit();
		await this.revertSelectedCell(this.lastClickedCell.row, this.lastClickedCell.column).catch(onUnexpectedError);
		await this.revertSelectedRow(this.lastClickedCell.row).catch(onUnexpectedError);
	}

	public override dispose(): void {
		//DO NOT DISPOSE, need to still keep, only dispose when editor is destroyed.
		return;
	}

	public async safeDispose(): Promise<void> {
		if (!this.alreadyDisposed && !this.saveViewStateCalled && this.table) {
			this.alreadyDisposed = true;
		}
		this.saveViewStateCalled = false;
		super.dispose();
	}

	/**
	 * Disables editing the grid temporarily when clicking on a cell (to allow for any processing tasks to be finished first such as adding a new row).
	 * @param state The variable telling whether to enable selection of the table cells or not.
	 */
	private updateEnabledState(state: boolean): void {
		let newOptions = this.table.grid.getOptions();
		newOptions.editable = state;
		// Need to suppress rerendering to avoid infinite loop when changing new row.
		// When setOptions is called with rerendering, it triggers an onCellSelect in our code (which is by design currently),
		// and thus an infinite loop is caused.
		this.table.grid.setOptions(newOptions, true);
	}

	/**
	 * Main function to handle submitting cell data and committing them (when row has changed immediately after cell submission).
	 * @param cellToSubmit cell to submit and commit in case we change row.
	 */
	private async submitCellTask(cellToSubmit): Promise<void> {
		let self = this;
		this.saveSuccess = true;
		// disable editing the grid temporarily as any text entered while the grid is being refreshed will be lost upon completion.
		this.cellSubmitInProgress = true;
		this.updateEnabledState(false);
		this.cellSubmitInProgress = false;
		return this.submitCurrentCellChange(cellToSubmit,
			async (result: EditUpdateCellResult) => {
				// Cell update was successful, update the flags
				self.setCellDirtyState(cellToSubmit.row, cellToSubmit.column, result.cell.isDirty);
				self.setRowDirtyState(cellToSubmit.row, result.isRowDirty);
				let lastColumnCheck = this.isLastColumn(cellToSubmit.column);
				// Commit indicating we have pressed enter on a null row.
				let nullCommit = this.rowAdded && this.isNullRow(cellToSubmit.row + 1) && this.lastClickedCell.row === cellToSubmit.row && this.lastClickedCell.column === cellToSubmit.column;
				this.rowAdded = false;
				// Commit indicating regular enter press on existing row.
				let regularCommit = cellToSubmit.row !== this.lastClickedCell.row && this.isRowDirty(cellToSubmit.row);
				if (regularCommit || nullCommit) {
					await this.commitEditTask().then(() => {
						// Mark the first cell of the placeholder row to be focused.
						if (nullCommit && lastColumnCheck && this.tabPressedAtLastColumn) {
							this.lastClickedCell = { row: cellToSubmit.row + 1, column: 1, isEditable: true };
							this.tabPressedAtLastColumn = false;
						}
						// Mark the cell directly below (the newly created placeholder row) to be focused.
						else if (nullCommit && this.lastClickedCell.row === cellToSubmit.row && this.lastClickedCell.column === cellToSubmit.column) {
							this.lastClickedCell = { row: cellToSubmit.row + 1, column: cellToSubmit.column, isEditable: true };
						}
					},
						() => {
							// Don't change position, commit has failed
							this.saveSuccess = false;
							this.lastClickedCell = { row: cellToSubmit.row, column: cellToSubmit.column, isEditable: true };
						});
				}
				// At the end of a successful cell select, update the currently selected cell
				this.cellSubmitInProgress = true;
				this.updateEnabledState(true);
				this.cellSubmitInProgress = false;
				this.focusCell(this.lastClickedCell.row, this.lastClickedCell.column);
			},
			() => {
				// Cell update failed, jump back to the last cell we were on
				this.saveSuccess = false;
				this.cellSubmitInProgress = true;
				this.updateEnabledState(true);
				this.cellSubmitInProgress = false;
				this.focusCell(cellToSubmit.row, cellToSubmit.column, true);
				// Cannot insert text for existing row here as that causes an infinite loop, this is for new row only.
				// Existing row text is handled in renderGridDataRowsRange.
				// During a new row, the renderGridDataRowsRange version of the text insert is disabled for the same reasons.
				if (this.isNullRow(cellToSubmit.row) && this.lastEnteredString) {
					document.execCommand('selectAll');
					document.execCommand('delete');
					document.execCommand('insertText', false, this.lastEnteredString);
				}
			});
	}

	handleComplete(self: EditDataGridPanel, event: any): void {
	}

	handleEditSessionReady(self, event): void {
		// TODO: update when edit session is ready
	}

	handleMessage(self: EditDataGridPanel, event: any): void {
		if (event.data && event.data.isError) {
			self.notificationService.notify({
				severity: Severity.Error,
				message: event.data.message
			});
		}
	}

	async handleResultSet(self: EditDataGridPanel, event: any): Promise<void> {
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

		let rowNumberColumn = new RowNumberColumn();

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
				index => { return {}; },
				resultSet.rowCount,
				await this.loadDataFunction,
			),
			columnDefinitions: [rowNumberColumn.getColumnDefinition()].concat(resultSet.columnInfo.map((c, i) => {
				let columnIndex = (i + 1).toString();
				return {
					id: columnIndex,
					name: escape(c.columnName),
					field: columnIndex,
					formatter: this.getColumnFormatter,
					isEditable: c.isUpdatable
				};
			}))
		};
		self.plugins.push(rowNumberColumn, new AutoColumnSize({ maxWidth: this.configurationService.getValue<number>('resultsGrid.maxColumnWidth') }), new AdditionalKeyBindings());
		self.dataSet = dataSet;
		self.gridDataProvider = new AsyncDataProvider(dataSet.dataRows);

		// Create a dataSet to render without rows to reduce DOM size
		let undefinedDataSet = deepClone(dataSet);
		undefinedDataSet.columnDefinitions = dataSet.columnDefinitions;
		undefinedDataSet.dataRows = undefined;
		self.placeHolderDataSets.push(undefinedDataSet);
		if (self.placeHolderDataSets[0]) {
			this.refreshDatasets();
		}
		await self.refreshGrid(true);
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
	private replaceLinebreaks(inputStr: string): string {
		let newlineMatches = inputStr.match(/(\r\n|\n|\r)/g);
		if (newlineMatches && newlineMatches.length > 0) {
			this.newlinePattern = newlineMatches[0];
		}
		return inputStr.replace(/(\r\n|\n|\r)/g, '\u0000');
	}

	/**
	 * Code that handles the refresh of the grid.
	 * @param isManual flag used when called by handleResultSet, for required additional processing.
	 */
	private refreshGrid(isManual?: boolean): Thenable<void> {
		return new Promise<void>(async (resolve, reject) => {

			clearTimeout(this.refreshGridTimeoutHandle);

			this.refreshGridTimeoutHandle = setTimeout(() => {
				try {
					if (this.dataSet) {
						this.placeHolderDataSets[0].dataRows = this.dataSet.dataRows;
						this.onResize();
					}


					if (this.placeHolderDataSets[0].dataRows && this.oldDataRows !== this.placeHolderDataSets[0].dataRows) {
						this.detectChange();
						this.oldDataRows = this.placeHolderDataSets[0].dataRows;
					}
				}
				catch {
					this.logService.error('data set is empty, refresh cancelled.');
					reject();
				}
				if (this.firstRender) {
					this.currentEditCellValue = undefined;
					this.lastClickedCell = { row: 0, column: 1, isEditable: true };
					// Re-enable selecting once table has been loaded properly.
					this.nativeElement.classList.remove('loadingRows');
					// Need to resize table once its been unhidden.
					this.onResize();
					this.setActive();
				}
				else if (isManual) {
					this.currentEditCellValue = undefined;
					this.removingNewRow = false;
					this.newRowVisible = false;
					this.dirtyCells = [];
				}
				//allow for the grid to render fully before returning.
				setTimeout(() => resolve(), 500);
			}, this.refreshGridTimeoutInMs);
		});
	}

	private setActive() {
		if (this.firstRender && this.table) {
			this.table.setActiveCell(0, 1);
			this.firstRender = false;
		}
	}

	protected detectChange(): void {
		if (this.firstLoad) {
			this.handleChanges({
				['dataRows']: { currentValue: this.dataSet.dataRows, firstChange: this.firstLoad, previousValue: undefined },
				['columnDefinitions']: { currentValue: this.dataSet.columnDefinitions, firstChange: this.firstLoad, previousValue: undefined }
			});
			this.handleInitializeTable();
			this.firstLoad = false;
		}
		else {
			this.table.setData(this.gridDataProvider);
			this.handleChanges({
				['dataRows']: { currentValue: this.dataSet.dataRows, firstChange: this.firstLoad, previousValue: this.oldDataRows }
			});
		}
	}

	protected tryHandleKeyEvent(e: StandardKeyboardEvent): boolean {
		let handled: boolean = false;

		if (e.keyCode === KeyCode.Escape) {
			if (this.lastClickedCell && this.isNullRow(this.lastClickedCell.row)) {
				this.focusCell(this.lastClickedCell.row, this.lastClickedCell.column);
				document.execCommand('selectAll');
				document.execCommand('delete');
				document.execCommand('insertText', false, 'NULL');
			}
			else if (this.isRowDirty(this.lastClickedCell.row) && !this.hasCellStringChanged()) {
				this.revertSelectedRow(this.lastClickedCell.row).catch(onUnexpectedError);
			}
			else if (this.hasCellStringChanged()) {
				this.revertSelectedCell(this.lastClickedCell.row, this.lastClickedCell.column).catch(onUnexpectedError);
				this.lastEnteredString = undefined;
			}
			this.focusCell(this.lastClickedCell.row, this.lastClickedCell.column);
			handled = true;
		}
		if (e.keyCode === KeyCode.Tab) {
			// Check if the tab is pressed on the last cell of the null row.
			// This is done so that we can alert the submit cell function to move to the right cell.
			if (this.isNullRow(this.lastClickedCell.row) && this.isLastColumn(this.lastClickedCell.column)) {
				this.tabPressedAtLastColumn = true;
			}
		}
		if (e.ctrlKey && e.keyCode === KeyCode.Digit0) {
			//Replace contents with NULL in cell contents.
			document.execCommand('selectAll');
			document.execCommand('delete');
			document.execCommand('insertText', false, 'NULL');
			handled = true;
		}

		return handled;
	}

	/**
	 * Force re-rendering of the results grids. Calling this upon unhide (upon focus) fixes UI
	 * glitches that occur when a QueryResultsEditor is hidden then unhidden while it is running a query.
	 */
	override refreshDatasets(): void {
		let tempRenderedDataSets = this.renderedDataSets;
		this.renderedDataSets = [];
		this.handleChanges({
			['dataRows']: { currentValue: undefined, firstChange: this.firstLoad, previousValue: this.dataSet.dataRows },
			['columnDefinitions']: { currentValue: undefined, firstChange: this.firstLoad, previousValue: this.dataSet.columnDefinitions }
		});
		this.renderedDataSets = tempRenderedDataSets;
		this.handleChanges({
			['dataRows']: { currentValue: this.renderedDataSets[0].dataRows, firstChange: this.firstLoad, previousValue: undefined },
			['columnDefinitions']: { currentValue: this.renderedDataSets[0].columnDefinitions, firstChange: this.firstLoad, previousValue: this.dataSet.columnDefinitions }
		});
	}

	// Private Helper Functions ////////////////////////////////////////////////////////////////////////////

	private async revertSelectedRow(rowNumber: number): Promise<void> {
		let currentNewRowIndex = this.dataSet.totalRows - 2;
		if (this.newRowVisible && rowNumber === currentNewRowIndex) {
			// revert our last new row
			this.removingNewRow = true;

			await this.dataService.revertRow(this.rowIdMappings[currentNewRowIndex])
				.then(() => {
					this.rowIdMappings[currentNewRowIndex] = undefined;
					return this.commitEditTask().then(() => this.removeRow(currentNewRowIndex, true));
				}).then(() => {
					this.newRowVisible = false;
					this.currentEditCellValue = undefined;
				});
		} else {
			try {
				// Perform a revert row operation
				await this.dataService.revertRow(rowNumber);
			} finally {
				// The operation may fail if there were no changes sent to the service to revert,
				// so clear any existing client-side edit and refresh on-screen data
				// do not refresh the whole dataset as it will move the focus away to the first row.
				//
				this.dirtyCells = [];
				this.setRowDirtyState(rowNumber, false);
				this.currentEditCellValue = undefined;
				this.dataSet.dataRows.resetWindowsAroundIndex(rowNumber);
			}
		}
	}

	// Private Helper Functions ////////////////////////////////////////////////////////////////////////////
	private async revertSelectedCell(rowNumber: number, columnNumber: number): Promise<void> {
		// Perform a revert cell operation on a specified cell
		await this.dataService.revertCell(rowNumber, columnNumber - 1);
		// The operation may fail if there were no changes sent to the service to revert,
		// so clear any existing client-side edit and refresh on-screen data
		// do not refresh the whole dataset as it will move the focus away to the first row.
		//
		this.setCellDirtyState(rowNumber, columnNumber, false);
		this.currentEditCellValue = undefined;
		this.dataSet.dataRows.resetWindowsAroundIndex(rowNumber);
	}

	// Function for submitting data of a cell, also adds a new row in case of data being added in the placeholder row.
	private async submitCurrentCellChange(cellToAdd, resultHandler, errorHandler): Promise<void> {
		let self = this;
		let refreshGrid = false;
		if (cellToAdd && cellToAdd.isEditable && this.currentEditCellValue !== undefined && !this.removingNewRow) {
			let result = undefined;
			try {
				if (this.isNullRow(cellToAdd.row)) {
					this.rowAdded = refreshGrid = true;
					// We've entered the "new row", so we need to add a row and jump to it
					await self.addRow(cellToAdd.row);
				}
				// We're exiting a read/write cell after having changed the value, update the cell value in the service
				// Use the mapped row ID if we're on that row
				let sessionRowId = self.rowIdMappings[cellToAdd.row] !== undefined
					? self.rowIdMappings[cellToAdd.row]
					: cellToAdd.row;

				result = await self.dataService.updateCell(sessionRowId, cellToAdd.column - 1, this.newlinePattern ? self.currentEditCellValue.replace('\u0000', this.newlinePattern) : self.currentEditCellValue);
			}
			catch (error) {
				// save the user's current input so that it can be restored after revert.
				self.lastEnteredString = self.currentEditCellValue;
				self.currentEditCellValue = undefined;
				// Switch lastClickedCell back to the cell to submit.
				this.lastClickedCell = { row: cellToAdd.row, column: cellToAdd.column, isEditable: true };
				if (refreshGrid) {
					this.rowAdded = false;
					await this.revertSelectedRow(cellToAdd.row).catch(onUnexpectedError);
				}

				await this.revertSelectedCell(cellToAdd.row, cellToAdd.column).catch(onUnexpectedError);
				errorHandler(error);
				return;
			}
			// last entered input is no longer needed as we have entered a valid input to commit.
			self.lastEnteredString = undefined;
			self.currentEditCellValue = undefined;
			if (refreshGrid) {
				await self.refreshGrid();
				// Scroll to the newly added null row.
				self.table.grid.scrollRowIntoView(cellToAdd.row + 1);
			}
			resultHandler(result);
		}
	}

	// Checks if input row is our NULL new row
	private isNullRow(row: number): boolean {
		// Null row is always at index (totalRows - 1)
		if (this.dataSet) {
			return (row === this.dataSet.totalRows - 1);
		}
		return false;
	}

	// Checks if input column is the last column
	private isLastColumn(column): boolean {
		if (this.dataSet) {
			return (column === this.dataSet.columnDefinitions.length - 1);
		}
		return false;
	}

	// Adds CSS classes to slickgrid cells to indicate a dirty state
	private setCellDirtyState(row: number, column: number, dirtyState: boolean): void {
		let slick: any = this.table;
		let grid = slick._grid;
		let cell = { row, column };
		if (dirtyState) {
			// Change cell color
			jQuery(grid.getCellNode(row, column)).addClass('dirtyCell').removeClass('selected');
			if (this.dirtyCells.indexOf(cell) === -1) {
				this.dirtyCells.push(cell);
			}
		} else {
			jQuery(grid.getCellNode(row, column)).removeClass('dirtyCell');
			if (this.dirtyCells.indexOf(cell) !== -1) {
				this.dirtyCells.splice(this.dirtyCells.indexOf(cell), 1);
			}
		}
	}

	// Adds CSS classes to slickgrid rows to indicate a dirty state
	private setRowDirtyState(row: number, dirtyState: boolean): void {
		let slick: any = this.table;
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
	private addRow(row: number): Thenable<void> {
		let self = this;
		this.noAutoSelectOnRender = true;

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
					index => { return {}; },
					self.dataSet.totalRows,
					self.loadDataFunction,
				);
				self.gridDataProvider = new AsyncDataProvider(self.dataSet.dataRows);
			});
	}


	// removes a row from the end of slickgrid (just for rendering purposes)
	private removeRow(row: number, withRefresh: boolean): Thenable<void> {
		// Removing the new row
		this.dataSet.totalRows--;
		this.dataSet.dataRows = new VirtualizedCollection(
			this.windowSize,
			index => { return {}; },
			this.dataSet.totalRows,
			this.loadDataFunction,
		);
		this.gridDataProvider = new AsyncDataProvider(this.dataSet.dataRows);
		// refresh results view
		if (withRefresh) {
			return this.refreshGrid().then(() => {
				this.removingNewRow = false;
			});
		}
		else {
			return Promise.resolve();
		}
	}

	private focusCell(row: number, column: number, forceEdit: boolean = false): void {
		let slick: any = this.table;
		let grid = slick._grid;
		grid.gotoCell(row, column, forceEdit);
	}

	private getMaxHeight(rowCount: number): any {
		return rowCount < this.defaultNumShowingRows
			? ((rowCount + 1) * this.rowHeight) + 10
			: 'inherit';
	}

	private getMinHeight(rowCount: number): any {
		return rowCount > this.defaultNumShowingRows
			? (this.defaultNumShowingRows + 1) * this.rowHeight + 10
			: this.getMaxHeight(rowCount);
	}

	private async saveViewState(): Promise<void> {
		if (!this.alreadyDisposed) {
			this.saveViewStateCalled = true;
			let grid = this.table;
			if (grid) {
				let gridSelections = grid.getSelectedRanges();
				let gridObject = grid as any;
				let viewport = (gridObject._grid.getCanvasNode() as HTMLElement).parentElement;
				this.savedViewState = {
					gridSelections,
					scrollTop: viewport.scrollTop,
					scrollLeft: viewport.scrollLeft
				};

				// Save the cell that is currently being edited if it is dirty.
				// Note: This is only updating the data in tools service, not saving the change to database.
				// This is added to fix the data inconsistency: the updated value is displayed but won't be saved to the database
				// when committing the changes for the row.
				if (this.lastClickedCell.row !== undefined && this.lastClickedCell.column !== undefined && this.lastClickedCell.isEditable) {
					let newValue = gridObject._grid.getCellEditor().serializeValue();
					let isDirty = gridObject._grid.getCellEditor().isValueChanged() && !(this.originalStringValue === 'NULL' && (newValue === '' || newValue === undefined));
					if (isDirty) {
						this.currentEditCellValue = newValue;
						gridObject._grid.getEditorLock().commitCurrentEdit();
						await this.submitCurrentCellChange(this.lastClickedCell, async (result: EditUpdateCellResult) => {
							this.rowAdded = false;
							this.setCellDirtyState(this.lastClickedCell.row, this.lastClickedCell.column, result.cell.isDirty);
							this.setRowDirtyState(this.lastClickedCell.row, result.isRowDirty);
							await this.commitEditTask();
						}, (error: any) => onUnexpectedError);
					}
				}
			}
		}
	}

	private restoreViewState(): void {
		if (this.savedViewState) {
			// Row selections are undefined in original slickgrid, removed for no purpose
			let viewport = ((this.table as any)._grid.getCanvasNode() as HTMLElement).parentElement;
			viewport.scrollLeft = this.savedViewState.scrollLeft;
			viewport.scrollTop = this.savedViewState.scrollTop;
			this.savedViewState = undefined;

			// This block of code is responsible for restoring the dirty state indicators if slickgrid decides not to re-render the dirty row
			// Other scenarios will be taken care of by getAdditionalCssClassesForCell method when slickgrid needs to re-render the rows.
			if (this.lastClickedCell?.row !== undefined) {
				if (this.isRowDirty(this.lastClickedCell.row)) {
					this.setRowDirtyState(this.lastClickedCell.row, true);

					this.dirtyCells.forEach(cell => {
						this.setCellDirtyState(cell.row, cell.column, true);
					});
				}
				// Layout function will be called shortly after this, which resets the focused cell, must notify the onResize call to restore the cell.
				this.restoreViewStateCalled = true;
			}
		}
		this.saveViewStateCalled = false;
	}

	private isRowDirty(row: number): boolean {
		for (let i = 0; i < this.dirtyCells.length; i++) {
			if (this.dirtyCells[i].row === row) {
				return true;
			}
		}
		return false;
	}

	private isCellDirty(row: number, column: number): boolean {
		for (let i = 0; i < this.dirtyCells.length; i++) {
			if (this.dirtyCells[i].row === row && this.dirtyCells[i].column === column) {
				return true;
			}
		}
		return false;
	}

	private createNewTable(): void {
		let newGridContainer = document.createElement('div');
		newGridContainer.className = 'editDataGrid';

		if (this.placeHolderDataSets) {
			let dataSet = this.placeHolderDataSets[0];
			let options = {
				enableCellNavigation: true,
				enableColumnReorder: false,
				renderRowWithRange: true,
				showHeader: true,
				rowHeight: this.rowHeight,
				defaultColumnWidth: 120,
				defaultFormatter: undefined,
				editable: this.enableEditing,
				autoEdit: this.enableEditing,
				enableAddRow: false,
				enableAsyncPostRender: false,
				editorFactory: {
					getEditor: (column: ISlickColumn<any>) => this.getColumnEditor(column)
				}
			};

			if (dataSet.columnDefinitions) {
				this.table = new Table(this.nativeElement.appendChild(newGridContainer), this.accessibilityService, this.quickInputService, { dataProvider: this.gridDataProvider, columns: dataSet.columnDefinitions }, options);
				for (let plugin of this.plugins) {
					this.table.registerPlugin(plugin);
				}
				for (let i = 0; i < dataSet.columnDefinitions.length; i++) {
					this.columnNameToIndex[this.dataSet.columnDefinitions[i].name] = i;
				}
			}
		}
		else {
			this.table = new Table(this.nativeElement.appendChild(newGridContainer), this.accessibilityService, this.quickInputService);
		}
	}

	getOverridableTextEditorClass(): any {
		let self = this;
		class OverridableTextEditor {
			private _textEditor: any;
			public keyCaptureList: number[];

			constructor(private _args: any) {
				this._textEditor = new Slick.Editors.Text(_args);
				const END = 35;
				const HOME = 36;

				// These are the special keys the text editor should capture instead of letting
				// the grid handle them
				this.keyCaptureList = [END, HOME];
			}

			destroy(): void {
				this._textEditor.destroy();
			}

			focus(): void {
				this._textEditor.focus();
			}

			getValue(): string {
				return this._textEditor.getValue();
			}

			setValue(val): void {
				this._textEditor.setValue(val);
			}

			loadValue(item, rowNumber): void {
				const itemForDisplay = deepClone(item);
				if (self.overrideCellFn) {
					let overrideValue = self.overrideCellFn(rowNumber, this._args.column.id, itemForDisplay[this._args.column.id]);
					if (overrideValue !== undefined) {
						itemForDisplay[this._args.column.id] = overrideValue;
					}
				}
				this._textEditor.loadValue(itemForDisplay);
			}

			serializeValue(): string {
				return this._textEditor.serializeValue();
			}

			applyValue(item, state): void {
				let activeRow = self.lastClickedCell.row;
				let currentRow = self.dataSet.dataRows.at(activeRow);
				let colIndex = self.getColumnIndex(this._args.column.name);
				let dataLength: number = self.dataSet.dataRows.getLength();

				// If this is not the "new row" at the very bottom
				if (activeRow !== dataLength) {
					currentRow[colIndex] = state;
					this._textEditor.applyValue(item, state);
				}
			}

			isValueChanged(): boolean {
				return this._textEditor.isValueChanged();
			}

			validate(): any {
				let activeRow = self.lastClickedCell.row;
				let result: any = { valid: true, msg: undefined };
				let colIndex: number = self.getColumnIndex(this._args.column.name);
				let newValue: any = this._textEditor.getValue();
				if (self.onIsCellEditValid && !self.onIsCellEditValid(activeRow, colIndex, newValue)) {
					result.valid = false;
				}

				return result;
			}
		}

		return OverridableTextEditor;
	}

	private getColumnEditor(column: ISlickColumn<any>): any {
		if (column.isEditable === false || typeof column.isEditable === 'undefined') {
			return undefined;
		}
		let columnId = column.id;
		let canEditColumn = columnId !== undefined;
		if (canEditColumn) {
			return this.getOverridableTextEditorClass();
		}
		return undefined;
	}

	public getColumnIndex(name: string): number {
		return this.columnNameToIndex[name];
	}

	handleChanges(changes: { [propName: string]: any }): void {
		let columnDefinitionChanges = changes['columnDefinitions'];
		let activeCell: Slick.Cell | undefined = undefined;
		let hasGridStructureChanges = false;
		let wasEditing = this.table ? !!this.table.grid.getCellEditor() : false;

		if (this.table) {
			// Get the active cell we have just clicked to be the new active cell (cell needs to be manually set as active in slickgrid).
			if (this.lastClickedCell) {
				activeCell = { row: this.lastClickedCell.row, cell: this.lastClickedCell.column };
			}
			else {
				// Get the last selected cell as the active cell as a backup.
				activeCell = this.table.grid.getActiveCell();
			}
		}

		if (columnDefinitionChanges && !equals(columnDefinitionChanges.previousValue, columnDefinitionChanges.currentValue)) {
			if (!this.table) {
				this.createNewTable();
			} else {
				this.table.grid.resetActiveCell();
				this.table.grid.setColumns(this.dataSet.columnDefinitions);
			}
			hasGridStructureChanges = true;

			if (!columnDefinitionChanges.currentValue || columnDefinitionChanges.currentValue.length === 0) {
				activeCell = undefined;
			}
			if (activeCell) {
				let columnThatContainedActiveCell = columnDefinitionChanges.previousValue[Math.max(activeCell.cell - 1, 0)];
				let newActiveColumnIndex = columnThatContainedActiveCell
					? columnDefinitionChanges.currentValue.findIndex(c => c.id === columnThatContainedActiveCell.id)
					: -1;
				activeCell.cell = newActiveColumnIndex !== -1 ? newActiveColumnIndex + 1 : 0;
			}
		}

		if (changes['dataRows']
			|| (changes['highlightedCells'] && !equals(changes['highlightedCells'].currentValue, changes['highlightedCells'].previousValue))
			|| (changes['blurredColumns'] && !equals(changes['blurredColumns'].currentValue, changes['blurredColumns'].previousValue))
			|| (changes['columnsLoading'] && !equals(changes['columnsLoading'].currentValue, changes['columnsLoading'].previousValue))) {
			this.setCallbackOnDataRowsChanged();
			this.table.rerenderGrid();
			hasGridStructureChanges = true;
		}

		if (hasGridStructureChanges) {
			if (activeCell) {
				this.table.grid.setActiveCell(activeCell.row, activeCell.cell);
			} else {
				this.table.grid.resetActiveCell();
			}
		}

		if (wasEditing && hasGridStructureChanges) {
			this.table.grid.editActiveCell(this.table.grid.getCellEditor());
		}
	}

	private setCallbackOnDataRowsChanged(): void {
		//check if dataRows exist before we enable editing or slickgrid will complain
		if (this.dataSet.dataRows) {
			this.changeEditSession(true);
			this.dataSet.dataRows.setCollectionChangedCallback((startIndex: number, count: number) => {
				this.renderGridDataRowsRange(startIndex, count);
			});
		}
	}

	private changeEditSession(enabled: boolean): void {
		this.enableEditing = enabled;
		let options: any = this.table.grid.getOptions();
		options.editable = enabled;
		options.enableAddRow = false;
		this.table.grid.setOptions(options);
	}

	private renderGridDataRowsRange(startIndex: number, count: number): void {
		this.invalidateRange(startIndex, startIndex + count);
		//restore dirty state css classes after cell revert.
		if (this.lastClickedCell && this.isRowDirty(this.lastClickedCell.row)) {
			for (let i = 1; i < this.dataSet.columnDefinitions.length; i++) {
				if (this.isCellDirty(this.lastClickedCell.row, i)) {
					this.setCellDirtyState(this.lastClickedCell.row, i, true);
				}
			}
		}
		if (!this.noAutoSelectOnRender && !this.firstRender) {
			this.focusCell(this.lastClickedCell.row, this.lastClickedCell.column);
			// Restore the last entered string from the user in case an invalid edit was happened, to allow users to keep their string.
			// very brief flickering may occur as this function is called a couple of times after an invalid cell is reverted.
			// Skip null row as this is already handled with the cell submit function (also to prevent infinite loop).
			// The insert must be set there for null row to get the reverted string change to register after new row removal/revert.
			if (!this.isNullRow(this.lastClickedCell.row) && this.lastEnteredString) {
				document.execCommand('selectAll');
				document.execCommand('delete');
				document.execCommand('insertText', false, this.lastEnteredString);
			}
		}
		else {
			this.noAutoSelectOnRender = false;
		}
	}

	private invalidateRange(start: number, end: number): void {
		let refreshedRows = Array.from({ length: (end - start) }, (v, k) => k + start);
		this.table.grid.invalidateRows(refreshedRows, true);
		this.table.grid.render();
	}

	private setupEvents(): void {
		this.table.grid.onCellChange.subscribe(async (e, args) => {
			await this.onCellChange(args);
		});
		this.table.grid.onBeforeEditCell.subscribe((e, args) => {
			this.onBeforeEditCell(args);
		});
		this.table.grid.onBeforeCellEditorDestroy.subscribe((e, args) => {
			this.onBeforeCellEditorDestroy(args);
		});
		// Subscribe to all active cell changes to be able to catch when we tab to the header on the next row
		this.table.grid.onActiveCellChanged.subscribe((e, args) => {
			// Emit that we've changed active cells
			this.onActiveCellChanged(args);
		});
		this.table.grid.onContextMenu.subscribe((e, args) => {
			this.openContextMenu(e, this.dataSet.batchId, this.dataSet.resultId, 0);
		});
		this.table.grid.onBeforeAppendCell.subscribe((e, args) => {
			// Since we need to return a string here, we are calling a function instead of event emitter like other events handlers
			return this.onBeforeAppendCell ? this.onBeforeAppendCell(args.row, args.cell) : undefined;
		});
	}

	// Get the value of the last string of the previous cell when moving to a different cell, and the value of the string of the cell just clicked.
	onBeforeEditCell(event: Slick.OnBeforeEditCellEventArgs<any>): void {
		this.lastStringBeforeSelect = this.originalStringValue;
		this.logService.debug('onBeforeEditCell called with grid: ' + event.grid + ' row: ' + event.row
			+ ' cell: ' + event.cell + ' item: ' + event.item + ' column: ' + event.column);

		let backupValue = (Object.keys(event.item).length > 0) ? event.item[event.cell] : this.originalStringValue;
		let getString = typeof backupValue === 'string' ? backupValue : backupValue.displayValue;
		this.originalStringValue = getString;
	}

	// Get the value of the cell after finishing editing.
	onBeforeCellEditorDestroy(event: Slick.OnBeforeCellEditorDestroyEventArgs<any>): void {
		this.endStringValue = event.editor.serializeValue();
	}

	handleInitializeTable(): void {
		// handleInitializeTable() will be called *after* the first time handleChanges() is called
		// so, grid must be there already

		if (this.placeHolderDataSets[0].dataRows && this.placeHolderDataSets[0].dataRows.getLength() > 0) {
			this.table.grid.scrollRowToTop(0);
		}

		// subscribe to slick events
		// https://github.com/mleibman/SlickGrid/wiki/Grid-Events
		this.setupEvents();
	}

	private hasCellStringChanged(): boolean {
		if ((this.endStringValue === 'NULL' && this.originalStringValue === '') || (this.endStringValue === '' && this.originalStringValue === 'NULL')) {
			return false;
		}
		else {
			return this.originalStringValue !== this.endStringValue;
		}
	}

	protected override onResize() {
		super.onResize();
		// After layout resize, resume focus on the last clickedCell we last left.
		if (this.restoreViewStateCalled) {
			this.restoreViewStateCalled = false;
			this.focusCell(this.lastClickedCell.row, this.lastClickedCell.column, true);
			// Bring back last entered value in case of revert from invalid commit.
			if (this.lastEnteredString) {
				document.execCommand('selectAll');
				document.execCommand('delete');
				document.execCommand('insertText', false, this.lastEnteredString);
			}
		}
	}


	/*Formatter for Column*/
	private getColumnFormatter(row: number | undefined, cell: any | undefined, value: any, columnDef: any | undefined, dataContext: any | undefined): string {
		let valueToDisplay = '';
		let cellClasses = 'grid-cell-value-container';
		/* tslint:disable:no-null-keyword */
		let valueMissing = value === undefined || value === null || (Services.DBCellValue.isDBCellValue(value) && value.isNull) || value === 'NULL';
		let isStringNull = (Services.DBCellValue.isDBCellValue(value) && !value.isNull && value.displayValue === 'NULL');
		let isRerenderNull = (Services.DBCellValue.isDBCellValue(value) && !value.isNull && value.displayValue === '');
		if (valueMissing || isRerenderNull) {
			valueToDisplay = 'NULL';
			cellClasses += ' missing-value';
		}
		else if (isStringNull) {
			valueToDisplay = '\'NULL\'';
		}
		else if (Services.DBCellValue.isDBCellValue(value)) {
			valueToDisplay = (value.displayValue + '');
			valueToDisplay = escape(valueToDisplay.length > 250 ? valueToDisplay.slice(0, 250) + '...' : valueToDisplay);
		}
		else if (typeof value === 'string' || (value && value.text)) {
			if (value.text) {
				valueToDisplay = value.text;
			} else {
				valueToDisplay = value;
			}
			valueToDisplay = escape(valueToDisplay.length > 250 ? valueToDisplay.slice(0, 250) + '...' : valueToDisplay);
		}
		return '<span title="' + valueToDisplay + '" class="' + cellClasses + '">' + valueToDisplay + '</span>';
	}
}
