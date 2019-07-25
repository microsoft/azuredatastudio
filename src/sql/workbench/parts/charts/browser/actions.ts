/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInsight } from './interfaces';
import { Graph } from './graphInsight';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { resolveCurrentDirectory, getRootPath } from 'sql/platform/common/pathUtilities';

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { join, normalize } from 'vs/base/common/path';
import { writeFile } from 'vs/base/node/pfs';
import { IWindowsService, IWindowService } from 'vs/platform/windows/common/windows';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { URI } from 'vs/base/common/uri';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IUntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { QueryInput } from 'sql/workbench/parts/query/common/queryInput';
import { IInsightsConfig } from 'sql/platform/dashboard/browser/insightRegistry';
import { IInsightOptions } from 'sql/workbench/parts/charts/common/interfaces';

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
		@IUntitledEditorService private untitledEditorService: IUntitledEditorService
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
		let options = Object.assign({}, context.options);
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

		let input = this.untitledEditorService.createOrGet(undefined, 'json', JSON.stringify(widgetConfig));

		return this.editorService.openEditor(input, { pinned: true })
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
		if (editor instanceof QueryInput) {
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
		@IWindowsService private windowsService: IWindowsService,
		@IWindowService private windowService: IWindowService,
		@INotificationService private notificationService: INotificationService,
		@IEditorService private editorService: IEditorService,
		@IWorkspaceContextService private workspaceContextService: IWorkspaceContextService
	) {
		super(SaveImageAction.ID, SaveImageAction.LABEL, SaveImageAction.ICON);
	}

	public run(context: IChartActionContext): Promise<boolean> {
		if (context.insight instanceof Graph) {
			return this.promptForFilepath().then(filePath => {
				let data = (<Graph>context.insight).getCanvasData();
				if (!data) {
					this.showError(localize('chartNotFound', "Could not find chart to save"));
					return false;
				}
				if (filePath) {
					let buffer = this.decodeBase64Image(data);
					writeFile(filePath, buffer).then(undefined, (err) => {
						if (err) {
							this.showError(err.message);
						} else {
							let fileUri = URI.file(filePath);
							this.windowsService.openExternal(fileUri.toString());
							this.notificationService.notify({
								severity: Severity.Error,
								message: localize('chartSaved', 'Saved Chart to path: {0}', filePath)
							});
						}
					});
				}
				return true;
			});
		}
		return Promise.resolve(false);
	}

	private decodeBase64Image(data: string): Buffer {
		let matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
		return Buffer.from(matches[2], 'base64');
	}

	private promptForFilepath(): Promise<string> {
		let filepathPlaceHolder = resolveCurrentDirectory(this.getActiveUriString(), getRootPath(this.workspaceContextService));
		filepathPlaceHolder = join(filepathPlaceHolder, 'chart.png');
		return this.windowService.showSaveDialog({
			title: localize('chartViewer.saveAsFileTitle', "Choose Results File"),
			defaultPath: normalize(filepathPlaceHolder)
		});
	}

	private showError(errorMsg: string) {
		this.notificationService.notify({
			severity: Severity.Error,
			message: errorMsg
		});
	}

	private getActiveUriString(): string {
		let editor = this.editorService.activeEditor;
		if (editor instanceof QueryInput) {
			return editor.uri;
		}
		return undefined;
	}
}
