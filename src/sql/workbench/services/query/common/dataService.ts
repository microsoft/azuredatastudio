/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditUpdateCellResult, EditSubsetResult, EditCreateRowResult } from 'azdata';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import { ResultSerializer, ISaveRequest } from 'sql/workbench/services/query/common/resultSerializer';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Emitter } from 'vs/base/common/event';

/**
 * DataService handles the interactions between QueryModel and app.component. Thus, it handles
 * query running and grid interaction communication for a single URI.
 */
export class DataService {

	public fireQueryEvent(event: any) {
		this._queryEvents.fire(event);
	}
	private readonly _queryEvents = new Emitter<any>();
	public readonly queryEvents = this._queryEvents.event;

	public fireGridContent(event: any) {
		this._gridContent.fire(event);
	}
	private readonly _gridContent = new Emitter<any>();
	public readonly gridContent = this._gridContent.event;

	private editQueue: Promise<any>;

	constructor(
		public uri: string,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IQueryModelService private _queryModel: IQueryModelService
	) {
		this.editQueue = Promise.resolve();
	}

	/**
	 * Get a specified number of rows starting at a specified row. Should only
	 * be used for edit sessions.
	 * @param rowStart	The row to start retrieving from (inclusive)
	 * @param numberOfRows	The maximum number of rows to return
	 */
	getEditRows(rowStart: number, numberOfRows: number): Promise<EditSubsetResult | undefined> {
		return this._queryModel.getEditRows(this.uri, rowStart, numberOfRows);
	}

	updateCell(rowId: number, columnId: number, newValue: string): Thenable<EditUpdateCellResult> {
		const self = this;
		self.editQueue = self.editQueue.then(() => {
			return self._queryModel.updateCell(self.uri, rowId, columnId, newValue).then(result => {
				return result;
			}, error => {
				// Start our editQueue over due to the rejected promise
				self.editQueue = Promise.resolve();
				return Promise.reject(error);
			});
		});
		return self.editQueue;
	}

	commitEdit(): Thenable<void> {
		const self = this;
		self.editQueue = self.editQueue.then(() => {
			return self._queryModel.commitEdit(self.uri).then(result => {
				return result;
			}, error => {
				// Start our editQueue over due to the rejected promise
				self.editQueue = Promise.resolve();
				return Promise.reject(error);
			});
		});
		return self.editQueue;
	}

	createRow(): Thenable<EditCreateRowResult> {
		const self = this;
		self.editQueue = self.editQueue.then(() => {
			return self._queryModel.createRow(self.uri).then(result => {
				return result;
			}, error => {
				// Start our editQueue over due to the rejected promise
				self.editQueue = Promise.resolve();
				return Promise.reject(error);
			});
		});
		return self.editQueue;
	}

	deleteRow(rowId: number): Thenable<void> {
		const self = this;
		self.editQueue = self.editQueue.then(() => {
			return self._queryModel.deleteRow(self.uri, rowId).then(result => {
				return result;
			}, error => {
				// Start our editQueue over due to the rejected promise
				self.editQueue = Promise.resolve();
				self._queryModel.showCommitError(error.message);
				return Promise.reject(error);
			});
		});
		return self.editQueue;
	}

	revertCell(rowId: number, columnId: number): Thenable<void> {
		const self = this;
		self.editQueue = self.editQueue.then(() => {
			return self._queryModel.revertCell(self.uri, rowId, columnId).then(result => {
				return result;
			}, error => {
				// Start our editQueue over due to the rejected promise
				self.editQueue = Promise.resolve();
				return Promise.reject(error);
			});
		});
		return self.editQueue;
	}

	revertRow(rowId: number): Thenable<void> {
		const self = this;
		self.editQueue = self.editQueue.then(() => {
			return self._queryModel.revertRow(self.uri, rowId).then(result => {
				return result;
			}, error => {
				// Start our editQueue over due to the rejected promise
				self.editQueue = Promise.resolve();
				return Promise.reject(error);
			});
		});
		return self.editQueue;
	}

	/**
	 * send request to save the selected result set as csv
	 */
	sendSaveRequest(saveRequest: ISaveRequest): void {
		let serializer = this._instantiationService.createInstance(ResultSerializer);
		serializer.saveResults(this.uri, saveRequest);
	}

	/**
	 * Sends a copy request
	 * @param selection The selection range to copy
	 * @param batchId The batch id of the result to copy from
	 * @param resultId The result id of the result to copy from
	 * @param includeHeaders [Optional]: Should column headers be included in the copy selection
	 */
	copyResults(selection: Slick.Range[], batchId: number, resultId: number, includeHeaders?: boolean): void {
		this._queryModel.copyResults(this.uri, selection, batchId, resultId, includeHeaders);
	}

	onLoaded(): void {
		this._queryModel.onLoaded(this.uri);
	}
}
