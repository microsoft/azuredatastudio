/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!sql/parts/grid/views/query/chartViewer';

import {
	Component, Inject, ViewContainerRef, forwardRef, OnInit,
	ComponentFactoryResolver, ViewChild, OnDestroy, Input, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { NgGridItemConfig } from 'angular2-grid';

import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { ComponentHostDirective } from 'sql/parts/dashboard/common/componentHost.directive';
import { IGridDataSet } from 'sql/parts/grid/common/interfaces';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IInsightData, IInsightsView, IInsightsConfig } from 'sql/parts/dashboard/widgets/insights/interfaces';
import { Extensions, IInsightRegistry } from 'sql/platform/dashboard/common/insightRegistry';
import { QueryEditor } from 'sql/parts/query/editor/queryEditor';
import { DataType, ILineConfig } from 'sql/parts/dashboard/widgets/insights/views/charts/types/lineChart.component';
import * as PathUtilities from 'sql/common/pathUtilities';
import { IChartViewActionContext, CopyAction, CreateInsightAction, SaveImageAction } from 'sql/parts/grid/views/query/chartViewerActions';
import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import * as Constants from 'sql/parts/query/common/constants';
import { SelectBox as AngularSelectBox } from 'sql/base/browser/ui/selectBox/selectBox.component';

/* Insights */
import {
	ChartInsight, DataDirection, LegendPosition
} from 'sql/parts/dashboard/widgets/insights/views/charts/chartInsight.component';

import { IDisposable } from 'vs/base/common/lifecycle';
import { attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import Severity from 'vs/base/common/severity';
import URI from 'vs/base/common/uri';
import * as nls from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { mixin } from 'vs/base/common/objects';
import * as paths from 'vs/base/common/paths';
import * as pfs from 'vs/base/node/pfs';
import { ISelectData } from 'vs/base/browser/ui/selectBox/selectBox';

const insightRegistry = Registry.as<IInsightRegistry>(Extensions.InsightContribution);

const LocalizedStrings = {
	CHART_TYPE: nls.localize('chartTypeLabel', 'Chart Type'),
	DATA_DIRECTION: nls.localize('dataDirectionLabel', 'Data Direction'),
	VERTICAL: nls.localize('verticalLabel', 'Vertical'),
	HORIZONTAL: nls.localize('horizontalLabel', 'Horizontal'),
	DATA_TYPE: nls.localize('dataTypeLabel', 'Data Type'),
	NUMBER: nls.localize('numberLabel', 'Number'),
	POINT: nls.localize('pointLabel', 'Point'),
	LABEL_FIRST_COLUMN: nls.localize('labelFirstColumnLabel', 'Use First Column as row label?'),
	COLUMNS_AS_LABELS: nls.localize('columnsAsLabelsLabel', 'Use Column names as labels?'),
	LEGEND: nls.localize('legendLabel', 'Legend Position'),
	CHART_NOT_FOUND: nls.localize('chartNotFound', 'Could not find chart to save'),
	X_AXIS_LABEL: nls.localize('xAxisLabel', 'X Axis Label'),
	X_AXIS_MIN_VAL: nls.localize('xAxisMinVal', 'X Axis Minimum Value'),
	X_AXIS_MAX_VAL: nls.localize('xAxisMaxVal', 'X Axis Maximum Value'),
	Y_AXIS_LABEL: nls.localize('yAxisLabel', 'Y Axis Label'),
	Y_AXIS_MIN_VAL: nls.localize('yAxisMinVal', 'Y Axis Minimum Value'),
	Y_AXIS_MAX_VAL: nls.localize('yAxisMaxVal', 'Y Axis Maximum Value')
};

@Component({
	selector: 'chart-viewer',
	templateUrl: decodeURI(require.toUrl('sql/parts/grid/views/query/chartViewer.component.html'))
})
export class ChartViewerComponent implements OnInit, OnDestroy, IChartViewActionContext {
	public legendOptions: string[];
	@ViewChild('chartTypeSelect') private chartTypesSelectBox: AngularSelectBox;

	/* UI */

	private _actionBar: Taskbar;
	private _createInsightAction: CreateInsightAction;
	private _copyAction: CopyAction;
	private _saveAction: SaveImageAction;
	private _chartConfig: ILineConfig;
	private _disposables: Array<IDisposable> = [];
	private _dataSet: IGridDataSet;
	private _executeResult: IInsightData;
	private _chartComponent: ChartInsight;

	private localizedStrings = LocalizedStrings;
	private insightRegistry = insightRegistry;

	@ViewChild(ComponentHostDirective) private componentHost: ComponentHostDirective;
	@ViewChild('taskbarContainer', { read: ElementRef }) private taskbarContainer;
	@ViewChild('chartTypesContainer', { read: ElementRef }) private chartTypesElement;
	@ViewChild('legendContainer', { read: ElementRef }) private legendElement;

	constructor(
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _componentFactoryResolver: ComponentFactoryResolver,
		@Inject(forwardRef(() => ViewContainerRef)) private _viewContainerRef: ViewContainerRef,
		@Inject(BOOTSTRAP_SERVICE_ID) private _bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef
	) {
	}

	ngOnInit() {
		this.setDefaultChartConfig();
		this.legendOptions = Object.values(LegendPosition);
		this.initializeUI();
	}

	private setDefaultChartConfig() {
		this._chartConfig = <ILineConfig>{
			dataDirection: 'vertical',
			dataType: 'number',
			legendPosition: 'none',
			labelFirstColumn: false
		};
	}

	private initializeUI() {
		// Initialize the taskbar
		this._initActionBar();
	}

	private getDefaultChartType(): string {
		let defaultChartType = Constants.chartTypeHorizontalBar;
		if (this._bootstrapService.configurationService) {
			let chartSettings = WorkbenchUtils.getSqlConfigSection(this._bootstrapService.configurationService, 'chart');
			// Only use the value if it's a known chart type. Ideally could query this dynamically but can't figure out how
			if (chartSettings && Constants.allChartTypes.indexOf(chartSettings[Constants.defaultChartType]) > -1) {
				defaultChartType = chartSettings[Constants.defaultChartType];
			}
		}
		return defaultChartType;
	}

	private _initActionBar() {
		this._createInsightAction = this._bootstrapService.instantiationService.createInstance(CreateInsightAction);
		this._copyAction = this._bootstrapService.instantiationService.createInstance(CopyAction);
		this._saveAction = this._bootstrapService.instantiationService.createInstance(SaveImageAction);

		let taskbar = <HTMLElement>this.taskbarContainer.nativeElement;
		this._actionBar = new Taskbar(taskbar, this._bootstrapService.contextMenuService);
		this._actionBar.context = this;
		this._actionBar.setContent([
			{ action: this._createInsightAction },
			{ action: this._copyAction },
			{ action: this._saveAction }
		]);
	}

	public onChartChanged(e: ISelectData): void {
		this.setDefaultChartConfig();
		if ([Constants.chartTypeScatter, Constants.chartTypeTimeSeries].some(item => item === e.selected)) {
			this.dataType = DataType.Point;
			this.dataDirection = DataDirection.Horizontal;
		}
		this.initChart();
	}

	setConfigValue(key: string, value: any, refresh = true): void {
		this._chartConfig[key] = value;
		if (refresh) {
			this.initChart();
		}
	}

	public set dataType(type: DataType) {
		this._chartConfig.dataType = type;
		// Requires full chart refresh
		this.initChart();
	}

	public set dataDirection(direction: DataDirection) {
		this._chartConfig.dataDirection = direction;
		// Requires full chart refresh
		this.initChart();
	}

	public copyChart(): void {
		let data = this._chartComponent.getCanvasData();
		if (!data) {
			this.showError(LocalizedStrings.CHART_NOT_FOUND);
			return;
		}

		this._bootstrapService.clipboardService.writeImageDataUrl(data);
	}

	public saveChart(): void {
		this.promptForFilepath().then(filePath => {
			let data = this._chartComponent.getCanvasData();
			if (!data) {
				this.showError(LocalizedStrings.CHART_NOT_FOUND);
				return;
			}
			if (filePath) {
				let buffer = this.decodeBase64Image(data);
				pfs.writeFile(filePath, buffer).then(undefined, (err) => {
					if (err) {
						this.showError(err.message);
					} else {
						let fileUri = URI.from({ scheme: PathUtilities.FILE_SCHEMA, path: filePath });
						this._bootstrapService.windowsService.openExternal(fileUri.toString());
						this._bootstrapService.notificationService.notify({
							severity: Severity.Error,
							message: nls.localize('chartSaved', 'Saved Chart to path: {0}', filePath)
						});
					}
				});
			}
		});
	}

	private promptForFilepath(): Thenable<string> {
		let filepathPlaceHolder = PathUtilities.resolveCurrentDirectory(this.getActiveUriString(), PathUtilities.getRootPath(this._bootstrapService.workspaceContextService));
		filepathPlaceHolder = paths.join(filepathPlaceHolder, 'chart.png');
		return this._bootstrapService.windowService.showSaveDialog({
			title: nls.localize('chartViewer.saveAsFileTitle', 'Choose Results File'),
			defaultPath: paths.normalize(filepathPlaceHolder, true)
		});
	}

	private decodeBase64Image(data: string): Buffer {
		let matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
		return new Buffer(matches[2], 'base64');
	}

	public createInsight(): void {
		let uriString: string = this.getActiveUriString();
		if (!uriString) {
			this.showError(nls.localize('createInsightNoEditor', 'Cannot create insight as the active editor is not a SQL Editor'));
			return;
		}

		let uri: URI = URI.parse(uriString);
		let dataService = this._bootstrapService.queryModelService.getDataService(uriString);
		if (!dataService) {
			this.showError(nls.localize('createInsightNoDataService', 'Cannot create insight, backing data model not found'));
			return;
		}
		let queryFile: string = uri.fsPath;
		let query: string = undefined;
		let type = {};
		type[this.chartTypesSelectBox.value] = this._chartConfig;
		// create JSON
		let config: IInsightsConfig = {
			type,
			query,
			queryFile
		};

		let widgetConfig = {
			name: nls.localize('myWidgetName', 'My-Widget'),
			gridItemConfig: this.getGridItemConfig(),
			widget: {
				'insights-widget': config
			}
		};

		// open in new window as untitled JSON file
		dataService.openLink(JSON.stringify(widgetConfig), 'Insight', 'json');
	}

	private showError(errorMsg: string) {
		this._bootstrapService.notificationService.notify({
			severity: Severity.Error,
			message: errorMsg
		});
	}

	private getGridItemConfig(): NgGridItemConfig {
		let config: NgGridItemConfig = {
			sizex: 2,
			sizey: 1
		};
		return config;
	}

	private getActiveUriString(): string {
		let editorService = this._bootstrapService.editorService;
		let editor = editorService.getActiveEditor();
		if (editor && editor instanceof QueryEditor) {
			let queryEditor: QueryEditor = editor;
			return queryEditor.uri;
		}
		return undefined;
	}

	private get showDataDirection(): boolean {
		return ['pie', 'horizontalBar', 'bar', 'doughnut'].some(item => item === this.chartTypesSelectBox.value) || (this.chartTypesSelectBox.value === 'line' && this.dataType === 'number');
	}

	private get showLabelFirstColumn(): boolean {
		return this.dataDirection === 'horizontal' && this.dataType !== 'point';
	}

	private get showColumnsAsLabels(): boolean {
		return this.dataDirection === 'vertical' && this.dataType !== 'point';
	}

	private get showDataType(): boolean {
		return this.chartTypesSelectBox.value === 'line';
	}

	public get dataDirection(): DataDirection {
		return this._chartConfig.dataDirection;
	}

	public get dataType(): DataType {
		return this._chartConfig.dataType;
	}

	@Input() set dataSet(dataSet: IGridDataSet) {
		// Setup the execute result
		this._dataSet = dataSet;
		this._executeResult = <IInsightData>{};
		this._executeResult.columns = dataSet.columnDefinitions.map(def => def.name);
		this._executeResult.rows = dataSet.dataRows.getRange(0, dataSet.dataRows.getLength()).map(gridRow => {
			return gridRow.values.map(cell => cell.displayValue);
		});
		this.initChart();
	}

	public initChart() {
		this._cd.detectChanges();
		if (this._executeResult) {
			// Reinitialize the chart component
			let componentFactory = this._componentFactoryResolver.resolveComponentFactory<IInsightsView>(insightRegistry.getCtorFromId(this.chartTypesSelectBox.value));
			this.componentHost.viewContainerRef.clear();
			let componentRef = this.componentHost.viewContainerRef.createComponent(componentFactory);
			this._chartComponent = <ChartInsight>componentRef.instance;
			if (this._chartComponent.setConfig) {
				this._chartComponent.setConfig(this._chartConfig);
			}
			this._chartComponent.data = this._executeResult;
			this._chartComponent.options = mixin(this._chartComponent.options, { animation: { duration: 0 } });
			if (this._chartComponent.init) {
				this._chartComponent.init();
			}
		}
	}

	ngOnDestroy() {
		this._disposables.forEach(i => i.dispose());
	}
}