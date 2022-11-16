/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IGridInfo } from 'sql/workbench/contrib/grid/browser/interfaces';
import { DataService } from 'sql/workbench/services/query/common/dataService';

import { localize } from 'vs/nls';
import { IAction, Action } from 'vs/base/common/actions';
import { SaveFormat } from 'sql/workbench/services/query/common/resultSerializer';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export const GRID_SAVECSV_ID = 'grid.saveAsCsv';
export const GRID_SAVEJSON_ID = 'grid.saveAsJson';
export const GRID_SAVEMARKDOWN_ID = 'grid.saveAsMarkdown';
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
export const GRID_VIEWASVISUALIZER_ID = 'grid.viewAsVisualizer';
export const GRID_GOTONEXTGRID_ID = 'grid.goToNextGrid';

export class GridActionProvider {

	constructor(
		protected _dataService: DataService,
		protected _selectAllCallback: (index: number) => void,
		@IInstantiationService protected _instantiationService: IInstantiationService,
		@IConfigurationService protected _configurationService: IConfigurationService,
	) {

	}

	/**
	 * Return actions given a click on a grid
	 */
	public getGridActions(): IAction[] {
		const actions: IAction[] = [];
		actions.push(this._instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVECSV_ID, SaveResultAction.SAVECSV_LABEL, SaveFormat.CSV, this._dataService));
		actions.push(this._instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEJSON_ID, SaveResultAction.SAVEJSON_LABEL, SaveFormat.JSON, this._dataService));
		actions.push(this._instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEMARKDOWN_ID, SaveResultAction.SAVEMARKDOWN_LABEL, SaveFormat.MARKDOWN, this._dataService));
		actions.push(this._instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEEXCEL_ID, SaveResultAction.SAVEEXCEL_LABEL, SaveFormat.EXCEL, this._dataService));
		actions.push(this._instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEXML_ID, SaveResultAction.SAVEXML_LABEL, SaveFormat.XML, this._dataService));
		actions.push(this._instantiationService.createInstance(SelectAllGridAction, SelectAllGridAction.ID, SelectAllGridAction.LABEL, this._selectAllCallback));
		actions.push(this._instantiationService.createInstance(CopyResultAction, CopyResultAction.COPY_ID, CopyResultAction.COPY_LABEL, false, this._dataService));
		actions.push(this._instantiationService.createInstance(CopyResultAction, CopyResultAction.COPYWITHHEADERS_ID, CopyResultAction.COPYWITHHEADERS_LABEL, true, this._dataService));

		return actions;
	}
}

class SaveResultAction extends Action {
	public static SAVECSV_ID = GRID_SAVECSV_ID;
	public static SAVECSV_LABEL = localize('saveAsCsv', "Save As CSV");

	public static SAVEJSON_ID = GRID_SAVEJSON_ID;
	public static SAVEJSON_LABEL = localize('saveAsJson', "Save As JSON");

	public static SAVEMARKDOWN_ID = GRID_SAVEMARKDOWN_ID;
	public static SAVEMARKDOWN_LABEL = localize('saveAsMarkdown', "Save As Markdown");

	public static SAVEEXCEL_ID = GRID_SAVEEXCEL_ID;
	public static SAVEEXCEL_LABEL = localize('saveAsExcel', "Save As Excel");

	public static SAVEXML_ID = GRID_SAVEXML_ID;
	public static SAVEXML_LABEL = localize('saveAsXml', "Save As XML");

	constructor(
		id: string,
		label: string,
		private format: SaveFormat,
		private dataService: DataService
	) {
		super(id, label);
	}

	public override async run(gridInfo: IGridInfo): Promise<void> {
		this.dataService.sendSaveRequest({
			batchIndex: gridInfo.batchIndex,
			resultSetNumber: gridInfo.resultSetNumber,
			selection: gridInfo.selection,
			format: this.format
		});
	}
}

class CopyResultAction extends Action {
	public static COPY_ID = GRID_COPY_ID;
	public static COPY_LABEL = localize('copySelection', "Copy");

	public static COPYWITHHEADERS_ID = GRID_COPYWITHHEADERS_ID;
	public static COPYWITHHEADERS_LABEL = localize('copyWithHeaders', "Copy With Headers");

	constructor(
		id: string,
		label: string,
		private copyHeader: boolean,
		private dataService: DataService,
		@IConfigurationService private configurationService: IConfigurationService
	) {
		super(id, label);
	}

	public override async run(gridInfo: IGridInfo): Promise<void> {
		const includeHeader = this.configurationService.getValue<boolean>('queryEditor.results.copyIncludeHeaders') || this.copyHeader;
		this.dataService.copyResults(gridInfo.selection, gridInfo.batchIndex, gridInfo.resultSetNumber, includeHeader);
	}
}

class SelectAllGridAction extends Action {
	public static ID = GRID_SELECTALL_ID;
	public static LABEL = localize('selectAll', "Select All");

	constructor(
		id: string,
		label: string,
		private selectAllCallback: (index: number) => void
	) {
		super(id, label);
	}

	public override async run(gridInfo: IGridInfo): Promise<void> {
		this.selectAllCallback(gridInfo.gridIndex);
	}
}
