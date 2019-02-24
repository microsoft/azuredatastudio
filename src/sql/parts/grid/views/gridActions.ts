/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IGridInfo, SaveFormat } from 'sql/parts/grid/common/interfaces';
import { DataService } from 'sql/parts/grid/services/dataService';

import { localize } from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { IAction, Action } from 'vs/base/common/actions';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export const GRID_SAVECSV_ID = 'grid.saveAsCsv';
export const GRID_SAVEJSON_ID = 'grid.saveAsJson';
export const GRID_SAVEEXCEL_ID = 'grid.saveAsExcel';
export const GRID_SAVEXML_ID = 'grid.saveAsXml';
export const GRID_COPY_ID = 'grid.copySelection';
export const GRID_COPYWITHHEADERS_ID = 'grid.copyWithHeaders';
export const GRID_SELECTALL_ID = 'grid.selectAll';
export const MESSAGES_SELECTALL_ID = 'grid.messages.selectAll';
export const MESSAGES_COPY_ID = 'grid.messages.copy';
export const TOGGLERESULTS_ID = 'grid.toggleResultPane';
export const TOGGLEMESSAGES_ID = 'grid.toggleMessagePane';
export const GOTONEXTQUERYOUTPUTTAB_ID = 'query.goToNextQueryOutputTab';
export const GRID_VIEWASCHART_ID = 'grid.viewAsChart';
export const GRID_GOTONEXTGRID_ID = 'grid.goToNextGrid';

export class GridActionProvider {

	constructor(
		protected _dataService: DataService,
		protected _selectAllCallback: (index: number) => void,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {

	}

	/**
	 * Return actions given a click on a grid
	 */
	public getGridActions(): IAction[] {
		let actions: IAction[] = [];
		actions.push(new SaveResultAction(SaveResultAction.SAVECSV_ID, SaveResultAction.SAVECSV_LABEL, SaveFormat.CSV, this._dataService));
		actions.push(new SaveResultAction(SaveResultAction.SAVEJSON_ID, SaveResultAction.SAVEJSON_LABEL, SaveFormat.JSON, this._dataService));
		actions.push(new SaveResultAction(SaveResultAction.SAVEEXCEL_ID, SaveResultAction.SAVEEXCEL_LABEL, SaveFormat.EXCEL, this._dataService));
		actions.push(new SaveResultAction(SaveResultAction.SAVEXML_ID, SaveResultAction.SAVEXML_LABEL, SaveFormat.XML, this._dataService));
		actions.push(new SelectAllGridAction(SelectAllGridAction.ID, SelectAllGridAction.LABEL, this._selectAllCallback));
		actions.push(new CopyResultAction(CopyResultAction.COPY_ID, CopyResultAction.COPY_LABEL, false, this._dataService));
		actions.push(new CopyResultAction(CopyResultAction.COPYWITHHEADERS_ID, CopyResultAction.COPYWITHHEADERS_LABEL, true, this._dataService));

		return actions;
	}

	/**
	 * Return actions given a click on a messages pane
	 */
	public getMessagesActions(dataService: DataService, selectAllCallback: () => void): IAction[] {
		let actions: IAction[] = [];
		actions.push(this._instantiationService.createInstance(CopyMessagesAction, CopyMessagesAction.ID, CopyMessagesAction.LABEL));
		actions.push(new SelectAllMessagesAction(SelectAllMessagesAction.ID, SelectAllMessagesAction.LABEL, selectAllCallback));
		return actions;
	}
}

export class SaveResultAction extends Action {
	public static SAVECSV_ID = GRID_SAVECSV_ID;
	public static SAVECSV_LABEL = localize('saveAsCsv', 'Save As CSV');

	public static SAVEJSON_ID = GRID_SAVEJSON_ID;
	public static SAVEJSON_LABEL = localize('saveAsJson', 'Save As JSON');

	public static SAVEEXCEL_ID = GRID_SAVEEXCEL_ID;
	public static SAVEEXCEL_LABEL = localize('saveAsExcel', 'Save As Excel');

	public static SAVEXML_ID = GRID_SAVEXML_ID;
	public static SAVEXML_LABEL = localize('saveAsXml', 'Save As XML');

	constructor(
		id: string,
		label: string,
		private format: SaveFormat,
		private dataService: DataService
	) {
		super(id, label);
	}

	public run(gridInfo: IGridInfo): TPromise<boolean> {
		this.dataService.sendSaveRequest({
			batchIndex: gridInfo.batchIndex,
			resultSetNumber: gridInfo.resultSetNumber,
			selection: gridInfo.selection,
			format: this.format
		});
		return TPromise.as(true);
	}
}

export class CopyResultAction extends Action {
	public static COPY_ID = GRID_COPY_ID;
	public static COPY_LABEL = localize('copySelection', 'Copy');

	public static COPYWITHHEADERS_ID = GRID_COPYWITHHEADERS_ID;
	public static COPYWITHHEADERS_LABEL = localize('copyWithHeaders', 'Copy With Headers');

	constructor(
		id: string,
		label: string,
		private copyHeader: boolean,
		private dataService: DataService
	) {
		super(id, label);
	}

	public run(gridInfo: IGridInfo): TPromise<boolean> {
		this.dataService.copyResults(gridInfo.selection, gridInfo.batchIndex, gridInfo.resultSetNumber, this.copyHeader);
		return TPromise.as(true);
	}
}

export class SelectAllGridAction extends Action {
	public static ID = GRID_SELECTALL_ID;
	public static LABEL = localize('selectAll', 'Select All');

	constructor(
		id: string,
		label: string,
		private selectAllCallback: (index: number) => void
	) {
		super(id, label);
	}

	public run(gridInfo: IGridInfo): TPromise<boolean> {
		this.selectAllCallback(gridInfo.gridIndex);
		return TPromise.as(true);
	}
}

export class SelectAllMessagesAction extends Action {
	public static ID = MESSAGES_SELECTALL_ID;
	public static LABEL = localize('selectAll', 'Select All');

	constructor(
		id: string,
		label: string,
		private selectAllCallback: () => void
	) {
		super(id, label);
	}

	public run(): TPromise<boolean> {
		this.selectAllCallback();
		return TPromise.as(true);
	}
}

export class CopyMessagesAction extends Action {
	public static ID = MESSAGES_COPY_ID;
	public static LABEL = localize('copyMessages', 'Copy');

	constructor(
		id: string,
		label: string,
		@IClipboardService private clipboardService: IClipboardService
	) {
		super(id, label);
	}

	public run(selectedRange: Selection): TPromise<boolean> {
		this.clipboardService.writeText(selectedRange.toString());
		return TPromise.as(true);
	}
}
