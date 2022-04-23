/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button } from 'sql/base/browser/ui/button/button';
import { HideReason, Modal } from 'sql/workbench/browser/modal/modal';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Event, Emitter } from 'vs/base/common/event';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { IWebviewService, WebviewElement } from 'vs/workbench/contrib/webview/browser/webview';
import { generateUuid } from 'vs/base/common/uuid';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';

export class WebViewDialog extends Modal {

	private _body?: HTMLElement;
	private _okButton?: Button;
	private _okLabel: string;
	private _closeLabel: string;
	private _webview?: WebviewElement;
	private _html?: string;
	private _headerTitle?: string;

	private _onOk = new Emitter<void>();
	public onOk: Event<void> = this._onOk.event;
	private _onMessage = new Emitter<any>();

	private readonly id = generateUuid();

	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super('', TelemetryKeys.ModalDialogName.WebView, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { dialogStyle: 'normal', hasTitleIcon: true });
		this._okLabel = localize('webViewDialog.ok', "OK");
		this._closeLabel = localize('webViewDialog.close', "Close");
	}

	public setHtml(value: string) {
		this._html = value;
	}

	public get html(): string | undefined {
		return this._html;
	}

	public set okTitle(value: string) {
		this._okLabel = value;
	}

	public get okTitle(): string {
		return this._okLabel;
	}

	public set closeTitle(value: string) {
		this._closeLabel = value;
	}

	public get closeTitle(): string {
		return this._closeLabel;
	}

	public setHeaderTitle(value: string) {
		this._headerTitle = value;
	}

	public get headerTitle(): string | undefined {
		return this._headerTitle;
	}

	protected renderBody(container: HTMLElement) {
		this._body = DOM.append(container, DOM.$('div.webview-dialog'));

		this._webview = this.webviewService.createWebviewElement(this.id,
			{},
			{
				allowScripts: true
			}, undefined);

		this._webview.mountTo(this._body);

		this._register(this._webview.onMessage(message => this._onMessage.fire(message)));

		this._register(this._webview);
	}

	get onMessage(): Event<any> {
		return this._onMessage.event;
	}

	public override render() {
		super.render();
		this._register(attachModalDialogStyler(this, this._themeService));

		this._okButton = this.addFooterButton(this._okLabel, () => this.ok());
		this._register(attachButtonStyler(this._okButton, this._themeService));
	}

	protected layout(height?: number): void {
		// Nothing to re-layout
	}

	private updateDialogBody(): void {
		if (this.html) {
			this._webview!.html = this.html;
		}
	}

	/* espace key */
	protected override onClose() {
		this.ok();
	}

	/* enter key */
	protected override onAccept() {
		this.ok();
	}

	public ok(): void {
		this._onOk.fire();
		this.close('ok');
	}

	public close(hideReason: HideReason = 'close') {
		this.hide(hideReason);
	}

	public sendMessage(message: any): void {
		if (this._webview) {
			this._webview.postMessage(message);
		}
	}

	public open() {
		this.title = this.headerTitle ?? '';
		this.updateDialogBody();
		this.show();
		this._okButton!.focus();
	}
}
