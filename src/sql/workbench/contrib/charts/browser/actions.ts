/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInsight } from 'sql/workbench/contrib/charts/browser/interfaces';
import { Graph } from 'sql/workbench/contrib/charts/browser/graphInsight';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { URI } from 'vs/base/common/uri';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IInsightsConfig } from 'sql/platform/dashboard/browser/insightRegistry';
import { IInsightOptions } from 'sql/workbench/contrib/charts/common/interfaces';
import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { IFileService } from 'vs/platform/files/common/files';
import { IFileDialogService, FileFilter } from 'vs/platform/dialogs/common/dialogs';
import { VSBuffer } from 'vs/base/common/buffer';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { assign } from 'vs/base/common/objects';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { ChartView } from 'sql/workbench/contrib/charts/browser/chartView';
import { ConfigureChartDialog } from 'sql/workbench/contrib/charts/browser/configureChartDialog';

export interface IChartActionContext {
	options: IInsightOptions;
	insight: IInsight;
}

export class CreateInsightAction extends Action {
	public static ID = 'chartview.createInsight';
	public static LABEL = localize('createInsightLabel', "Create Insight");
	public static ICON = 'createInsight';

	constructor(
		@IEditorService private editorService: IEditorService,
		@INotificationService private notificationService: INotificationService,
		@IUntitledTextEditorService private untitledEditorService: IUntitledTextEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(CreateInsightAction.ID, CreateInsightAction.LABEL, CreateInsightAction.ICON);
	}

	public run(context: IChartActionContext): Promise<boolean> {
		let uriString: string = this.getActiveUriString();
		if (!uriString) {
			this.showError(localize('createInsightNoEditor', "Cannot create insight as the active editor is not a SQL Editor"));
			return Promise.resolve(false);
		}

		let uri: URI = URI.parse(uriString);
		let queryFile: string = uri.fsPath;
		let query: string = undefined;
		let type = {};
		let options = assign({}, context.options);
		delete options.type;
		type[context.options.type] = options;
		// create JSON
		let config: IInsightsConfig = {
			type,
			query,
			queryFile
		};

		let widgetConfig = {
			name: localize('myWidgetName', "My-Widget"),
			gridItemConfig: {
				sizex: 2,
				sizey: 1
			},
			widget: {
				'insights-widget': config
			}
		};

		let input = this.untitledEditorService.create({ mode: 'json', initialValue: JSON.stringify(widgetConfig) });

		return this.editorService.openEditor(this.instantiationService.createInstance(UntitledTextEditorInput, input), { pinned: true })
			.then(
				() => true,
				error => {
					this.notificationService.notify({
						severity: Severity.Error,
						message: error
					});
					return false;
				}
			);
	}

	private getActiveUriString(): string {
		let editor = this.editorService.activeEditor;
		if (editor instanceof QueryEditorInput) {
			return editor.uri;
		}
		return undefined;
	}

	private showError(errorMsg: string) {
		this.notificationService.notify({
			severity: Severity.Error,
			message: errorMsg
		});
	}
}

export class ConfigureChartAction extends Action {
	public static ID = 'chartview.configureChart';
	public static LABEL = localize('configureChartLabel', "Configure Chart");
	public static ICON = 'settings';

	private dialog: ConfigureChartDialog;

	constructor(private _chart: ChartView,
		@IInstantiationService private readonly instantiationService: IInstantiationService) {
		super(ConfigureChartAction.ID, ConfigureChartAction.LABEL, ConfigureChartAction.ICON);
	}

	public run(context: IChartActionContext): Promise<boolean> {
		if (!this.dialog) {
			this.dialog = this.instantiationService.createInstance(ConfigureChartDialog, ConfigureChartAction.LABEL, ConfigureChartAction.ID, this._chart);
			this.dialog.render();
		}
		this.dialog.open();
		return Promise.resolve(true);
	}
}

export class CopyAction extends Action {
	public static ID = 'chartview.copy';
	public static LABEL = localize('copyChartLabel', "Copy as image");
	public static ICON = 'copyImage';

	constructor(
		@IClipboardService private clipboardService: IClipboardService,
		@INotificationService private notificationService: INotificationService
	) {
		super(CopyAction.ID, CopyAction.LABEL, CopyAction.ICON);
	}

	public run(context: IChartActionContext): Promise<boolean> {
		if (context.insight instanceof Graph) {
			let data = context.insight.getCanvasData();
			if (!data) {
				this.showError(localize('chartNotFound', "Could not find chart to save"));
				return Promise.resolve(false);
			}

			this.clipboardService.writeImageDataUrl(data);
			return Promise.resolve(true);
		}
		return Promise.resolve(false);
	}

	private showError(errorMsg: string) {
		this.notificationService.notify({
			severity: Severity.Error,
			message: errorMsg
		});
	}
}

export class SaveImageAction extends Action {
	public static ID = 'chartview.saveImage';
	public static LABEL = localize('saveImageLabel', "Save as image");
	public static ICON = 'saveAsImage';

	constructor(
		@INotificationService private readonly notificationService: INotificationService,
		@IFileService private readonly fileService: IFileService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IOpenerService private readonly openerService: IOpenerService
	) {
		super(SaveImageAction.ID, SaveImageAction.LABEL, SaveImageAction.ICON);
	}

	public async run(context: IChartActionContext): Promise<boolean> {
		if (context.insight instanceof Graph) {
			let fileFilters = new Array<FileFilter>({ extensions: ['png'], name: localize('resultsSerializer.saveAsFileExtensionPNGTitle', "PNG") });

			const filePath = await this.fileDialogService.showSaveDialog({ filters: fileFilters });
			const data = (<Graph>context.insight).getCanvasData();
			if (!data) {
				this.notificationService.error(localize('chartNotFound', "Could not find chart to save"));
				return false;
			}
			if (filePath) {
				let buffer = this.decodeBase64Image(data);
				try {
					await this.fileService.writeFile(filePath, buffer);
				} catch (err) {
					if (err) {
						this.notificationService.error(err.message);
					} else {
						this.openerService.open(filePath, { openExternal: true });
						this.notificationService.notify({
							severity: Severity.Error,
							message: localize('chartSaved', "Saved Chart to path: {0}", filePath.toString())
						});
					}
				}
			}
			return true;
		}
		return Promise.resolve(false);
	}

	private decodeBase64Image(data: string): VSBuffer {
		const marker = ';base64,';
		const raw = atob(data.substring(data.indexOf(marker) + marker.length));
		const n = raw.length;
		const a = new Uint8Array(new ArrayBuffer(n));
		for (let i = 0; i < n; i++) {
			a[i] = raw.charCodeAt(i);
		}
		return VSBuffer.wrap(a);
	}

}
