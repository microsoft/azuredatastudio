/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/calloutDialog';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import * as DOM from 'vs/base/browser/dom';
import { Color } from 'vs/base/common/color';
import { IDialogProperties, Modal, DialogWidth, IModalDialogStyles } from 'sql/workbench/browser/modal/modal';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { attachCalloutDialogStyler } from 'sql/workbench/common/styler';

export abstract class CalloutDialog<T> extends Modal {
	private _styleElement: HTMLStyleElement;

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

	protected abstract renderBody(container: HTMLElement): void;

	public render(): void {
		super.render();
		this._styleElement = DOM.createStyleSheet(this._bodyContainer);
		attachCalloutDialogStyler(this, this._themeService);
	}

	public abstract open(): Promise<T>;

	public cancel(): void {
		this.hide();
		this._styleElement.remove();
		this.dispose();
	}

	protected layout(height?: number): void {
	}

	public style(styles: IModalDialogStyles): void {
		super.style(styles);
		const content: string[] = [];
		const foreground = styles.dialogForeground ? styles.dialogForeground.toString() : '';
		const foregroundRgb: Color = Color.Format.CSS.parseHex(foreground);

		if (styles.dialogForeground && styles.dialogBodyBackground && styles.dialogBorder) {
			content.push(`
			.modal-dialog {
				box-shadow: 0px 3px 8px rgba(${foregroundRgb.rgba.r},${foregroundRgb.rgba.g},${foregroundRgb.rgba.b},0.08);
			}

			.modal .modal-footer {
				border-top-color: ${styles.footerBorderTopColor};
			}

			.callout-arrow:before {
				border-color: transparent transparent ${styles.dialogBodyBackground} ${styles.dialogBodyBackground};
				box-shadow: -3px 3px 3px 0 rgba(${foregroundRgb.rgba.r},${foregroundRgb.rgba.g},${foregroundRgb.rgba.b},0.08);
			}

			.callout-arrow.from-left:before {
				background-color: ${styles.dialogBodyBackground};
			}

			.hc-black .callout-arrow:before {
				background-color: ${styles.dialogBodyBackground};
				border-color: transparent transparent ${styles.dialogBorder} ${styles.dialogBorder};
			}`);
		}

		const newStyles = content.join('\n');
		if (newStyles !== this._styleElement.innerHTML) {
			this._styleElement.innerHTML = newStyles;
		}
	}
}
