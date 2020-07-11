/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vs/nls';

import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import Severity from 'vs/base/common/severity';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { ILogService } from 'vs/platform/log/common/log';
import { Emitter } from 'vs/base/common/event';

export interface IEditSessionReadyEvent {
	ownerUri: string;
	success: boolean;
	message: string;
}

export default class EditQueryRunner extends QueryRunner {

	private readonly _onEditSessionReady = this._register(new Emitter<IEditSessionReadyEvent>());
	public readonly onEditSessionReady = this._onEditSessionReady.event;

	constructor(
		public uri: string,
		@INotificationService private readonly notificationService: INotificationService,
		@IQueryManagementService queryManagementService: IQueryManagementService,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService instantiationService: IInstantiationService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@ILogService logService: ILogService
	) {
		super(uri, queryManagementService, configurationService, instantiationService, textResourcePropertiesService, logService);
	}

	/*
	 * Handle a session ready event for Edit Data
	 */
	public async initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Promise<void> {
		// Update internal state to show that we're executing the query
		this._isExecuting = true;
		this._totalElapsedMilliseconds = 0;
		// TODO issue #228 add statusview callbacks here

		try {
			await this.queryManagementService.initializeEdit(ownerUri, schemaName, objectName, objectType, rowLimit, queryString);
			// The query has started, so lets fire up the result pane
			this._onQueryStart.fire();
			this.queryManagementService.registerRunner(this, ownerUri);
		} catch (error) {
			// Attempting to launch the query failed, show the error message

			// TODO issue #228 add statusview callbacks here
			this._isExecuting = false;
			this.notificationService.error(nls.localize('query.initEditExecutionFailed', "Initialize edit data session failed: ") + error);
		}
	}

	/**
	 * Retrieves a number of rows from an edit session
	 * @param rowStart     The index of the row to start returning (inclusive)
	 * @param numberOfRows The number of rows to return
	 */
	public async getEditRows(rowStart: number, numberOfRows: number): Promise<azdata.EditSubsetResult> {
		let rowData: azdata.EditSubsetParams = {
			ownerUri: this.uri,
			rowCount: numberOfRows,
			rowStartIndex: rowStart
		};

		const result = await this.queryManagementService.getEditRows(rowData);
		if (!result.hasOwnProperty('rowCount')) {
			let error = `Nothing returned from subset query`;
			this.notificationService.notify({
				severity: Severity.Error,
				message: error
			});
			throw new Error(error);
		}
		return result;
	}

	public handleEditSessionReady(ownerUri: string, success: boolean, message: string): void {
		this._onEditSessionReady.fire({ ownerUri, success, message });
	}

	public updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Promise<azdata.EditUpdateCellResult> {
		return this.queryManagementService.updateCell(ownerUri, rowId, columnId, newValue);
	}

	public commitEdit(ownerUri: string): Promise<void> {
		return this.queryManagementService.commitEdit(ownerUri);
	}

	public createRow(ownerUri: string): Promise<azdata.EditCreateRowResult> {
		return this.queryManagementService.createRow(ownerUri).then(result => {
			return result;
		});
	}

	public deleteRow(ownerUri: string, rowId: number): Promise<void> {
		return this.queryManagementService.deleteRow(ownerUri, rowId);
	}

	public revertCell(ownerUri: string, rowId: number, columnId: number): Promise<azdata.EditRevertCellResult> {
		return this.queryManagementService.revertCell(ownerUri, rowId, columnId);
	}

	public revertRow(ownerUri: string, rowId: number): Promise<void> {
		return this.queryManagementService.revertRow(ownerUri, rowId);
	}

	public disposeEdit(ownerUri: string): Promise<void> {
		return this.queryManagementService.disposeEdit(ownerUri);
	}

}
