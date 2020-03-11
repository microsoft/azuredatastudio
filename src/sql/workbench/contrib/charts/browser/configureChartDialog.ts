/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IThemeService } from 'vs/platform/theme/common/themeService';
import { localize } from 'vs/nls';
import { ChartView } from 'sql/workbench/contrib/charts/browser/chartView';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';

export class ConfigureChartDialog extends Modal {
	constructor(
		title: string,
		name: string,
		private _chart: ChartView,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IThemeService themeService: IThemeService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(title, name, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, undefined);
	}

	public open() {
		this.show();
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		let closeButton = this.addFooterButton(localize('configureChartDialog.close', "Close"), () => this.close());
		attachButtonStyler(closeButton, this._themeService);
	}

	protected renderBody(container: HTMLElement) {
		container.appendChild(this._chart.optionsControl);
	}

	protected layout(height?: number): void {
	}

	public close() {
		this.hide();
	}
}
