/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { Observer } from 'rxjs/Observer';

import { EditUpdateCellResult, EditSubsetResult, EditCreateRowResult } from 'azdata';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import { ResultSerializer } from 'sql/workbench/parts/query/common/resultSerializer';
import { ISaveRequest } from 'sql/workbench/parts/grid/common/interfaces';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

/**
 * DataService handles the interactions between QueryModel and app.component. Thus, it handles
 * query running and grid interaction communication for a single URI.
 */
export class DataService {

	public queryEventObserver: Subject<any>;
	public gridContentObserver: Subject<any>;
	private editQueue: Promise<any>;

	constructor(
		private _uri: string,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IQueryModelService private _queryModel: IQueryModelService
	) {
		this.queryEventObserver = new Subject();
		this.gridContentObserver = new Subject();
		this.editQueue = Promise.resolve();
	}

	/**
	 * Get a specified number of rows starting at a specified row. Should only
	 * be used for edit sessions.
	 * @param rowStart	The row to start retrieving from (inclusive)
	 * @param numberOfRows	The maximum number of rows to return
	 */
	getEditRows(rowStart: number, numberOfRows: number): Observable<EditSubsetResult> {
		const self = this;
		return Observable.create(function (observer: Observer<EditSubsetResult>) {
			self._queryModel.getEditRows(self._uri, rowStart, numberOfRows).then(results => {
				observer.next(results);
			});
		});
	}

	updateCell(rowId: number, columnId: number, newValue: string): Thenable<EditUpdateCellResult> {
		const self = this;
		self.editQueue = self.editQueue.then(() => {
			return self._queryModel.updateCell(self._uri, rowId, columnId, newValue).then(result => {
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
			return self._queryModel.commitEdit(self._uri).then(result => {
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
			return self._queryModel.createRow(self._uri).then(result => {
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
			return self._queryModel.deleteRow(self._uri, rowId).then(result => {
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
			return self._queryModel.revertCell(self._uri, rowId, columnId).then(result => {
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
			return self._queryModel.revertRow(self._uri, rowId).then(result => {
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
	 * @param uri of the calling document
	 * @param batchId The batch id of the batch with the result to save
	 * @param resultId The id of the result to save as csv
	 */
	sendSaveRequest(saveRequest: ISaveRequest): void {
		let serializer = this._instantiationService.createInstance(ResultSerializer);
		serializer.saveResults(this._uri, saveRequest);
	}

	/**
	 * Sends a copy request
	 * @param selection The selection range to copy
	 * @param batchId The batch id of the result to copy from
	 * @param resultId The result id of the result to copy from
	 * @param includeHeaders [Optional]: Should column headers be included in the copy selection
	 */
	copyResults(selection: Slick.Range[], batchId: number, resultId: number, includeHeaders?: boolean): void {
		this._queryModel.copyResults(this._uri, selection, batchId, resultId, includeHeaders);
	}

	onAngularLoaded(): void {
		this._queryModel.onAngularLoaded(this._uri);
	}
}
