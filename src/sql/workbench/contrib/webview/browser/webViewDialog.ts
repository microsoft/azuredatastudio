/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { attachButtonStyler } from 'sql/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Event, Emitter } from 'vs/base/common/event';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { toDisposable } from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { IWebviewService, WebviewElement } from 'vs/workbench/contrib/webview/browser/webview';
import { generateUuid } from 'vs/base/common/uuid';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';

export class WebViewDialog extends Modal {

	private _body: HTMLElement;
	private _okButton: Button;
	private _okLabel: string;
	private _closeLabel: string;
	private _webview: WebviewElement;
	private _html: string;
	private _headerTitle: string;

	private _onOk = new Emitter<void>();
	public onOk: Event<void> = this._onOk.event;
	private _onClosed = new Emitter<void>();
	public onClosed: Event<void> = this._onClosed.event;
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
		super('', TelemetryKeys.WebView, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { isFlyout: false, hasTitleIcon: true });
		this._okLabel = localize('webViewDialog.ok', "OK");
		this._closeLabel = localize('webViewDialog.close', "Close");
	}

	public set html(value: string) {
		this._html = value;
	}

	public get html(): string {
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

	public set headerTitle(value: string) {
		this._headerTitle = value;
	}

	public get headerTitle(): string {
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
		this._register(toDisposable(() => this._webview = null));
	}

	get onMessage(): Event<any> {
		return this._onMessage.event;
	}

	public render() {
		super.render();
		this._register(attachModalDialogStyler(this, this._themeService));

		this._okButton = this.addFooterButton(this._okLabel, () => this.ok());
		this._register(attachButtonStyler(this._okButton, this._themeService));
	}

	protected layout(height?: number): void {
		// Nothing to re-layout
	}

	private updateDialogBody(): void {
		this._webview.html = this.html;
	}

	/* espace key */
	protected onClose() {
		this.ok();
	}

	/* enter key */
	protected onAccept() {
		this.ok();
	}

	public ok(): void {
		this._onOk.fire();
		this.close();
	}

	public close() {
		this.hide();
		this._onClosed.fire();
	}

	public sendMessage(message: any): void {
		this._webview.postMessage(message);
	}

	public open() {
		this.title = this.headerTitle;
		this.updateDialogBody();
		this.show();
		this._okButton.focus();
	}
}
