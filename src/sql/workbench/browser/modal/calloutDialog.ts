/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/calloutDialog';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { attachCalloutDialogStyler } from 'sql/platform/theme/common/styler';
import { IDialogProperties, Modal, DialogWidth } from 'sql/workbench/browser/modal/modal';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';

export abstract class CalloutDialog<T> extends Modal {

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
		attachCalloutDialogStyler(this, this._themeService);
	}

	public abstract open(): Promise<T>;

	public cancel(): void {
		this.hide();
		this.dispose();
	}

	protected layout(height?: number): void {
	}

	/**
	 * Called by the theme registry on theme change to style the component
	 */
	// public style(styles: IModalDialogStyles): void {
	// 	this._dialogForeground = styles.dialogForeground ? styles.dialogForeground : this._themeService.getColorTheme().getColor(editorWidgetForeground);
	// 	this._dialogBorder = styles.dialogBorder ? styles.dialogBorder : this._themeService.getColorTheme().getColor(notebookToolbarLines);
	// 	if (this._modalOptions.dialogStyle === 'callout') {
	// 		this._dialogHeaderAndFooterBackground = styles.dialogBodyBackground ? styles.dialogBodyBackground : this._themeService.getColorTheme().getColor(SIDE_BAR_BACKGROUND);
	// 	} else {
	// 		this._dialogHeaderAndFooterBackground = styles.dialogHeaderAndFooterBackground ? styles.dialogHeaderAndFooterBackground : this._themeService.getColorTheme().getColor(SIDE_BAR_BACKGROUND);
	// 	}
	// 	this._dialogBodyBackground = styles.dialogBodyBackground ? styles.dialogBodyBackground : this._themeService.getColorTheme().getColor(editorBackground);
	// 	this._footerBorderTopColor = styles.footerBorderTopColor ? styles.footerBorderTopColor : this._themeService.getColorTheme().getColor(notebookToolbarLines);
	// 	this.applyStyles();
	// }

	// private applyStyles(): void {
	// 	const foreground = this._dialogForeground ? this._dialogForeground.toString() : '';
	// 	const border = this._dialogBorder ? this._dialogBorder.toString() : '';
	// 	const headerAndFooterBackground = this._dialogHeaderAndFooterBackground ? this._dialogHeaderAndFooterBackground.toString() : '';
	// 	const bodyBackground = this._dialogBodyBackground ? this._dialogBodyBackground.toString() : '';
	// 	const calloutStyle: CSSStyleDeclaration = this._modalDialog.style;
	// 	const footerTopBorderColor = this._footerBorderTopColor ? this._footerBorderTopColor.toString() : '';

	// 	const foregroundRgb: Color = Color.Format.CSS.parseHex(foreground);

	// 	if (this._closeButtonInHeader) {
	// 		this._closeButtonInHeader.style.color = foreground;
	// 	}
	// 	if (this._modalDialog) {
	// 		this._modalDialog.style.color = foreground;
	// 		this._modalDialog.style.borderWidth = border ? '1px' : '';
	// 		this._modalDialog.style.borderStyle = border ? 'solid' : '';
	// 		this._modalDialog.style.borderColor = border;

	// 		calloutStyle.setProperty('--border', `${border}`);
	// 		calloutStyle.setProperty('--bodybackground', `${bodyBackground}`);
	// 		if (foregroundRgb) {
	// 			calloutStyle.setProperty('--foreground', `
	// 			${foregroundRgb.rgba.r},
	// 			${foregroundRgb.rgba.g},
	// 			${foregroundRgb.rgba.b},
	// 			0.08
	// 		`);
	// 		}
	// 	}

	// 	if (this._modalHeaderSection) {
	// 		this._modalHeaderSection.style.backgroundColor = headerAndFooterBackground;
	// 		if (!(this._modalOptions.dialogStyle === 'callout')) {
	// 			this._modalHeaderSection.style.borderBottomWidth = border ? '1px' : '';
	// 			this._modalHeaderSection.style.borderBottomStyle = border ? 'solid' : '';
	// 		}
	// 		this._modalHeaderSection.style.borderBottomColor = border;
	// 	}

	// 	if (this._messageElement) {
	// 		this._messageElement.style.backgroundColor = headerAndFooterBackground;
	// 		this._messageElement.style.borderBottomWidth = border ? '1px' : '';
	// 		this._messageElement.style.borderBottomStyle = border ? 'solid' : '';
	// 		this._messageElement.style.borderBottomColor = border;
	// 	}

	// 	if (this._modalBodySection) {
	// 		this._modalBodySection.style.backgroundColor = bodyBackground;
	// 	}

	// 	if (this._modalFooterSection) {
	// 		this._modalFooterSection.style.backgroundColor = headerAndFooterBackground;
	// 		this._modalFooterSection.style.borderTopWidth = border ? '1px' : '';
	// 		this._modalFooterSection.style.borderTopStyle = border ? 'solid' : '';
	// 		this._modalFooterSection.style.borderTopColor = footerTopBorderColor;
	// 	}
	// }
}
