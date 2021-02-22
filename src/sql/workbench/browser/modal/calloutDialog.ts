/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IDialogProperties, Modal, DialogWidth } from 'sql/workbench/browser/modal/modal';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { localize } from 'vs/nls';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';

export interface ICalloutDialogOptions {
	insertTitle?: string,
	insertMarkup?: string,
	imagePath?: string,
	embedImage?: boolean
}
export class CalloutDialog extends Modal {

	private readonly insertButtonText = localize('callout.insertButton', "Insert");
	private readonly cancelButtonText = localize('callout.cancelButton', "Cancel");

	constructor(
		title: string,
		width: DialogWidth,
		dialogProperties: IDialogProperties,
		@IThemeService themeService: IThemeService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(
			title,
			TelemetryKeys.CalloutDialog,
			telemetryService,
			layoutService,
			clipboardService,
			themeService,
			logService,
			textResourcePropertiesService,
			contextKeyService,
			{
				dialogStyle: 'callout',
				dialogPosition: 'below',
				dialogProperties: dialogProperties,
				width: width
			});
	}

	/**
	 * Opens the dialog and returns a promise for what options the user chooses.
	 */
	public open(): void {
		this.show();
		//return this._selectionComplete.promise;
	}

	public render() {
		super.render();

		attachModalDialogStyler(this, this._themeService);

		this.addFooterButton(this.insertButtonText, () => this.insert());
		this.addFooterButton(this.cancelButtonText, () => this.cancel(), undefined, true);
	}

	protected renderBody(container: HTMLElement) {
	}

	protected layout(height?: number): void {
	}

	public insert(): void {
		this.hide();
		this.dispose();
	}

	public cancel(): void {
		this.hide();
		this.dispose();
	}
}
