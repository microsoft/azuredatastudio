/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!sql/parts/grid/views/query/chartViewer';

import {
	Component, Inject, forwardRef, OnInit, ComponentFactoryResolver, ViewChild,
	OnDestroy, Input, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { NgGridItemConfig } from 'angular2-grid';

import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { ComponentHostDirective } from 'sql/parts/dashboard/common/componentHost.directive';
import { IGridDataSet } from 'sql/parts/grid/common/interfaces';
import { IInsightData, IInsightsView, IInsightsConfig } from 'sql/parts/dashboard/widgets/insights/interfaces';
import { Extensions, IInsightRegistry } from 'sql/platform/dashboard/common/insightRegistry';
import { QueryEditor } from 'sql/parts/query/editor/queryEditor';
import { ILineConfig } from 'sql/parts/dashboard/widgets/insights/views/charts/types/lineChart.component';
import * as PathUtilities from 'sql/common/pathUtilities';
import { IChartViewActionContext, CopyAction, CreateInsightAction, SaveImageAction } from 'sql/parts/grid/views/query/chartViewerActions';
import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import * as Constants from 'sql/parts/query/common/constants';
import { SelectBox as AngularSelectBox } from 'sql/base/browser/ui/selectBox/selectBox.component';
import { IQueryModelService } from 'sql/parts/query/execution/queryModel';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { LegendPosition, DataDirection, DataType } from 'sql/parts/dashboard/widgets/insights/views/charts/interfaces';

/* Insights */
import {
	ChartInsight
} from 'sql/parts/dashboard/widgets/insights/views/charts/chartInsight.component';

import { IDisposable } from 'vs/base/common/lifecycle';
import Severity from 'vs/base/common/severity';
import { URI } from 'vs/base/common/uri';
import * as nls from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { mixin } from 'vs/base/common/objects';
import * as paths from 'vs/base/common/paths';
import * as pfs from 'vs/base/node/pfs';
import { ISelectData } from 'vs/base/browser/ui/selectBox/selectBox';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IWindowsService, IWindowService } from 'vs/platform/windows/common/windows';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

const insightRegistry = Registry.as<IInsightRegistry>(Extensions.InsightContribution);

const LocalizedStrings = {
	CHART_TYPE: nls.localize('chartTypeLabel', 'Chart Type'),
	DATA_DIRECTION: nls.localize('dataDirectionLabel', 'Data Direction'),
	VERTICAL: nls.localize('verticalLabel', 'Vertical'),
	HORIZONTAL: nls.localize('horizontalLabel', 'Horizontal'),
	DATA_TYPE: nls.localize('dataTypeLabel', 'Data Type'),
	NUMBER: nls.localize('numberLabel', 'Number'),
	POINT: nls.localize('pointLabel', 'Point'),
	LABEL_FIRST_COLUMN: nls.localize('labelFirstColumnLabel', 'Use first column as row label'),
	COLUMNS_AS_LABELS: nls.localize('columnsAsLabelsLabel', 'Use column names as labels'),
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
	private _executeResult: IInsightData;
	private _chartComponent: ChartInsight;

	protected localizedStrings = LocalizedStrings;
	protected insightRegistry = insightRegistry;

	@ViewChild(ComponentHostDirective) private componentHost: ComponentHostDirective;
	@ViewChild('taskbarContainer', { read: ElementRef }) private taskbarContainer;

	constructor(
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _componentFactoryResolver: ComponentFactoryResolver,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService,
		@Inject(IClipboardService) private clipboardService: IClipboardService,
		@Inject(IConfigurationService) private configurationService: IConfigurationService,
		@Inject(IWindowsService) private windowsService: IWindowsService,
		@Inject(IWorkspaceContextService) private workspaceContextService: IWorkspaceContextService,
		@Inject(IWindowService) private windowService: IWindowService,
		@Inject(IQueryModelService) private queryModelService: IQueryModelService,
		@Inject(IEditorService) private editorService: IEditorService
	) {
		this.setDefaultChartConfig();
	}

	ngOnInit() {
		this.legendOptions = Object.values(LegendPosition);
		this._initActionBar();
	}

	private setDefaultChartConfig() {
		let defaultChart = this.getDefaultChartType();
		if (defaultChart === 'timeSeries') {
			this._chartConfig = <ILineConfig>{
				dataDirection: 'vertical',
				dataType: 'point',
				legendPosition: 'none'
			};
		} else {
			this._chartConfig = <ILineConfig>{
				dataDirection: 'vertical',
				dataType: 'number',
				legendPosition: 'none'
			};
		}
	}

	protected getDefaultChartType(): string {
		let defaultChartType = Constants.chartTypeHorizontalBar;
		if (this.configurationService) {
			let chartSettings = WorkbenchUtils.getSqlConfigSection(this.configurationService, 'chart');
			// Only use the value if it's a known chart type. Ideally could query this dynamically but can't figure out how
			if (chartSettings && Constants.allChartTypes.indexOf(chartSettings[Constants.defaultChartType]) > -1) {
				defaultChartType = chartSettings[Constants.defaultChartType];
			}
		}
		return defaultChartType;
	}

	private _initActionBar() {
		this._createInsightAction = this.instantiationService.createInstance(CreateInsightAction);
		this._copyAction = this.instantiationService.createInstance(CopyAction);
		this._saveAction = this.instantiationService.createInstance(SaveImageAction);

		let taskbar = <HTMLElement>this.taskbarContainer.nativeElement;
		this._actionBar = new Taskbar(taskbar, this.contextMenuService);
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

	ngAfterViewInit() {
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

		this.clipboardService.writeImageDataUrl(data);
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
						this.windowsService.openExternal(fileUri.toString());
						this.notificationService.notify({
							severity: Severity.Error,
							message: nls.localize('chartSaved', 'Saved Chart to path: {0}', filePath)
						});
					}
				});
			}
		});
	}

	private promptForFilepath(): Thenable<string> {
		let filepathPlaceHolder = PathUtilities.resolveCurrentDirectory(this.getActiveUriString(), PathUtilities.getRootPath(this.workspaceContextService));
		filepathPlaceHolder = paths.join(filepathPlaceHolder, 'chart.png');
		return this.windowService.showSaveDialog({
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
		let dataService = this.queryModelService.getDataService(uriString);
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
		this.notificationService.notify({
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
		let editorService = this.editorService;
		let editor = editorService.activeControl;
		if (editor && editor instanceof QueryEditor) {
			let queryEditor: QueryEditor = editor;
			return queryEditor.uri;
		}
		return undefined;
	}

	protected get showDataDirection(): boolean {
		return ['pie', 'horizontalBar', 'bar', 'doughnut'].some(item => item === this.chartTypesSelectBox.value) || (this.chartTypesSelectBox.value === 'line' && this.dataType === 'number');
	}

	protected get showLabelFirstColumn(): boolean {
		return this.dataDirection === 'horizontal' && this.dataType !== 'point';
	}

	protected get showColumnsAsLabels(): boolean {
		return this.dataDirection === 'vertical' && this.dataType !== 'point';
	}

	public get dataDirection(): DataDirection {
		return this._chartConfig.dataDirection;
	}

	public get dataType(): DataType {
		return this._chartConfig.dataType;
	}

	@Input() set dataSet(dataSet: IGridDataSet) {
		// Setup the execute result
		this._executeResult = <IInsightData>{};

		// Remove first column and its value since this is the row number column
		this._executeResult.columns = dataSet.columnDefinitions.slice(1).map(def => def.name);
		this._executeResult.rows = dataSet.dataRows.getRange(0, dataSet.dataRows.getLength()).map(v => {
			return this._executeResult.columns.reduce((p, c) => {
				p.push(v[c]);
				return p;
			}, []);
		});
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
