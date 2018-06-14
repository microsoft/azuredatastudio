
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Action } from 'vs/base/common/actions';
import { localize } from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';

import QueryRunner from 'sql/parts/query/execution/queryRunner';
import { SaveFormat } from 'sql/parts/grid/common/interfaces';
import { Table } from 'sql/base/browser/ui/table/table';

export interface IGridActionContext {
	cell: { row: number; cell: number; };
	selection: Slick.Range[];
	runner: QueryRunner;
	batchId: number;
	resultId: number;
	table: Table<any>;
}

export class SaveResultAction extends Action {
	public static SAVECSV_ID = 'grid.saveAsCsv';
	public static SAVECSV_LABEL = localize('saveAsCsv', 'Save As CSV');

	public static SAVEJSON_ID = 'grid.saveAsJson';
	public static SAVEJSON_LABEL = localize('saveAsJson', 'Save As JSON');

	public static SAVEEXCEL_ID = 'grid.saveAsExcel';
	public static SAVEEXCEL_LABEL = localize('saveAsExcel', 'Save As Excel');

	constructor(
		id: string,
		label: string,
		private format: SaveFormat
	) {
		super(id, label);
	}

	public run(context: IGridActionContext): TPromise<boolean> {
		context.runner.serializeResults(context.batchId, context.resultId, this.format, context.selection);
		return TPromise.as(true);
	}
}

export class CopyResultAction extends Action {
	public static COPY_ID = 'grid.copySelection';
	public static COPY_LABEL = localize('copySelection', 'Copy');

	public static COPYWITHHEADERS_ID = 'grid.copyWithHeaders';
	public static COPYWITHHEADERS_LABEL = localize('copyWithHeaders', 'Copy With Headers');

	constructor(
		id: string,
		label: string,
		private copyHeader: boolean,
	) {
		super(id, label);
	}

	public run(context: IGridActionContext): TPromise<boolean> {
		context.runner.copyResults(context.selection, context.batchId, context.resultId, this.copyHeader);
		return TPromise.as(true);
	}
}

export class SelectAllGridAction extends Action {
	public static ID = 'grid.selectAll';
	public static LABEL = localize('selectAll', 'Select All');

	constructor() {
		super(SelectAllGridAction.ID, SelectAllGridAction.LABEL);
	}

	public run(context: IGridActionContext): TPromise<boolean> {
		context.table.setSelectedRows(true);
		return TPromise.as(true);
	}
}
