/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { IThemeService, ITheme } from 'vs/platform/theme/common/themeService';
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
	private _optionsControl: HTMLElement;

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

		this._optionsControl = DOM.$('div.options-container');
		this._optionsControl.style.padding = '20px';

		let generalControls = DOM.$('div.general-controls');
		let typeControls = DOM.$('div.type-controls');
		this._optionsControl.appendChild(generalControls);
		this._optionsControl.appendChild(typeControls);

		this._chart.onChartOptionsChange(() => {
			this._chart.updateChartOptionControls(generalControls, typeControls);
		});
	}

	public open() {
		this.show();
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		let closeButton = this.addFooterButton(localize('optionsDialog.close', "Close"), () => this.cancel());

		attachButtonStyler(closeButton, this._themeService);
		this._register(this._themeService.onThemeChange(e => this.updateTheme(e)));
		this.updateTheme(this._themeService.getTheme());
	}

	protected renderBody(container: HTMLElement) {
		container.appendChild(this._optionsControl);
	}

	protected layout(height?: number): void {
	}

	private updateTheme(theme: ITheme): void {
	}

	public cancel() {
		this.close();
	}

	public close() {
		this.dispose();
		this.hide();
	}
}
