/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { localize } from 'vs/nls';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { Table } from 'sql/base/browser/ui/table/table';
import { QueryEditor } from './queryEditor';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import { IGridDataProvider } from 'sql/workbench/services/query/common/gridDataProvider';
import { INotificationService, Severity, NeverShowAgainScope } from 'vs/platform/notification/common/notification';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { GridTableState } from 'sql/workbench/common/editor/query/gridTableState';
import * as Constants from 'sql/workbench/contrib/extensions/common/constants';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { getErrorMessage } from 'vs/base/common/errors';
import { SaveFormat } from 'sql/workbench/services/query/common/resultSerializer';
import { IExtensionRecommendationsService } from 'vs/workbench/services/extensionRecommendations/common/extensionRecommendations';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { getChartMaxRowCount, notifyMaxRowCountExceeded } from 'sql/workbench/contrib/charts/browser/utils';
import { IEncodingSupport } from 'vs/workbench/services/textfile/common/textfiles';

export interface IGridActionContext {
	gridDataProvider: IGridDataProvider;
	table: Table<any>;
	tableState: GridTableState;
	cell?: { row: number; cell: number; };
	selection?: Slick.Range[];
	selectionModel?: CellSelectionModel<any>;
	batchId: number;
	resultId: number;
}

function mapForNumberColumn(ranges: Slick.Range[]): Slick.Range[] {
	if (ranges) {
		return ranges.map(e => new Slick.Range(e.fromRow, e.fromCell - 1, e.toRow, e.toCell ? e.toCell - 1 : undefined));
	} else {
		return undefined;
	}
}

export class SaveResultAction extends Action {
	public static SAVECSV_ID = 'grid.saveAsCsv';
	public static SAVECSV_LABEL = localize('saveAsCsv', "Save As CSV");
	public static SAVECSV_ICON = 'saveCsv';

	public static SAVEJSON_ID = 'grid.saveAsJson';
	public static SAVEJSON_LABEL = localize('saveAsJson', "Save As JSON");
	public static SAVEJSON_ICON = 'saveJson';

	public static SAVEEXCEL_ID = 'grid.saveAsExcel';
	public static SAVEEXCEL_LABEL = localize('saveAsExcel', "Save As Excel");
	public static SAVEEXCEL_ICON = 'saveExcel';

	public static SAVEXML_ID = 'grid.saveAsXml';
	public static SAVEXML_LABEL = localize('saveAsXml', "Save As XML");
	public static SAVEXML_ICON = 'saveXml';

	constructor(
		id: string,
		label: string,
		icon: string,
		private format: SaveFormat,
		@INotificationService private notificationService: INotificationService,
		@IEditorService private editorService: IEditorService,
	) {
		super(id, label, icon);
	}

	public override async run(context: IGridActionContext): Promise<void> {

		const activeEditor = this.editorService.activeEditorPane as unknown as IEncodingSupport;
		if (typeof activeEditor.getEncoding === 'function' && activeEditor.getEncoding() !== 'utf8') {
			this.notificationService.notify({
				severity: Severity.Info,
				message: localize('jsonEncoding', "Results encoding will not be saved when exporting to JSON, remember to save with desired encoding once file is created."),
				neverShowAgain: { id: 'ignoreJsonEncoding', scope: NeverShowAgainScope.GLOBAL }
			});
		}

		if (!context.gridDataProvider.canSerialize) {
			this.notificationService.warn(localize('saveToFileNotSupported', "Save to file is not supported by the backing data source"));
			return;
		}
		try {
			await context.gridDataProvider.serializeResults(this.format, mapForNumberColumn(context.selection));
		} catch (error) {
			this.notificationService.error(getErrorMessage(error));
			return;
		}
	}
}

export class CopyResultAction extends Action {
	public static COPY_ID = 'grid.copySelection';
	public static COPY_LABEL = localize('copySelection', "Copy");

	public static COPYWITHHEADERS_ID = 'grid.copyWithHeaders';
	public static COPYWITHHEADERS_LABEL = localize('copyWithHeaders', "Copy With Headers");

	constructor(
		id: string,
		label: string,
		private configurationService: IConfigurationService,
		private copyHeader: boolean,
		private accountForNumberColumn = true
	) {
		super(id, label);
	}

	public override async run(context: IGridActionContext): Promise<void> {
		const selection = this.accountForNumberColumn ? mapForNumberColumn(context.selection) : context.selection;
		const includeHeader = this.configurationService.getValue<boolean>('queryEditor.results.copyIncludeHeaders') || this.copyHeader;
		await context.gridDataProvider.copyResults(selection, includeHeader, context.table.getData());
	}
}

export class SelectAllGridAction extends Action {
	public static ID = 'grid.selectAll';
	public static LABEL = localize('selectAll', "Select All");

	constructor() {
		super(SelectAllGridAction.ID, SelectAllGridAction.LABEL);
	}

	public override async run(context: IGridActionContext): Promise<void> {
		context.selectionModel.setSelectedRanges([new Slick.Range(0, 0, context.table.getData().getLength() - 1, context.table.columns.length - 1)]);
	}
}

export class MaximizeTableAction extends Action {
	public static ID = 'grid.maximize';
	public static LABEL = localize('maximize', "Maximize");
	public static ICON = 'extendFullScreen';

	constructor() {
		super(MaximizeTableAction.ID, MaximizeTableAction.LABEL, MaximizeTableAction.ICON);
	}

	public override async run(context: IGridActionContext): Promise<void> {
		context.tableState.maximized = true;
	}
}

export class RestoreTableAction extends Action {
	public static ID = 'grid.restore';
	public static LABEL = localize('restore', "Restore");
	public static ICON = 'exitFullScreen';

	constructor() {
		super(RestoreTableAction.ID, RestoreTableAction.LABEL, RestoreTableAction.ICON);
	}

	public override async run(context: IGridActionContext): Promise<void> {
		context.tableState.maximized = false;
	}
}

export class ChartDataAction extends Action {
	public static ID = 'grid.chart';
	public static LABEL = localize('chart', "Chart");
	public static ICON = 'viewChart';

	constructor(
		@IEditorService private editorService: IEditorService,
		@IExtensionRecommendationsService private readonly extensionTipsService: IExtensionRecommendationsService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IStorageService private readonly storageService: IStorageService,
		@INotificationService private readonly notificationService: INotificationService,
		@IAdsTelemetryService private readonly adsTelemetryService: IAdsTelemetryService
	) {
		super(ChartDataAction.ID, ChartDataAction.LABEL, ChartDataAction.ICON);
	}

	public override async run(context: IGridActionContext): Promise<void> {
		// show the visualizer extension recommendation notification
		this.extensionTipsService.promptRecommendedExtensionsByScenario(Constants.visualizerExtensions);
		const maxRowCount = getChartMaxRowCount(this.configurationService);
		const rowCount = context.table.getData().getLength();
		const maxRowCountExceeded = rowCount > maxRowCount;
		if (maxRowCountExceeded) {
			notifyMaxRowCountExceeded(this.storageService, this.notificationService, this.configurationService);
		}
		this.adsTelemetryService.createActionEvent(TelemetryKeys.TelemetryView.ResultsPanel, TelemetryKeys.TelemetryAction.ShowChart)
			.withAdditionalProperties(
				{
					[TelemetryKeys.TelemetryPropertyName.ChartMaxRowCountExceeded]: maxRowCountExceeded
				})
			.send();
		const activeEditor = this.editorService.activeEditorPane as QueryEditor;
		activeEditor.chart({ batchId: context.batchId, resultId: context.resultId });
	}
}

export class VisualizerDataAction extends Action {
	public static ID = 'grid.visualizer';
	public static LABEL = localize("visualizer", "Visualizer");
	public static ICON = 'viewVisualizer';

	constructor(
		private runner: QueryRunner,
		@IAdsTelemetryService private adsTelemetryService: IAdsTelemetryService
	) {
		super(VisualizerDataAction.ID, VisualizerDataAction.LABEL, VisualizerDataAction.ICON);
	}

	public override async run(context: IGridActionContext): Promise<void> {
		this.adsTelemetryService.sendActionEvent(
			TelemetryKeys.TelemetryView.ResultsPanel,
			TelemetryKeys.TelemetryAction.Click,
			'VisualizerButton',
			'VisualizerDataAction'
		);
		this.runner.notifyVisualizeRequested(context.batchId, context.resultId);
	}
}
