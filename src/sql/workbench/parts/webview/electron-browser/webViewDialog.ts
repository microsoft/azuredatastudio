/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/media/icons/common-icons';
import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { attachButtonStyler, attachModalDialogStyler } from 'sql/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Event, Emitter } from 'vs/base/common/event';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ElectronWebviewBasedWebview } from 'vs/workbench/contrib/webview/electron-browser/webviewElement';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';

export class WebViewDialog extends Modal {

	private _body: HTMLElement;
	private _okButton: Button;
	private _okLabel: string;
	private _closeLabel: string;
	private _webview: ElectronWebviewBasedWebview;
	private _html: string;
	private _headerTitle: string;

	private _onOk = new Emitter<void>();
	public onOk: Event<void> = this._onOk.event;
	private _onClosed = new Emitter<void>();
	public onClosed: Event<void> = this._onClosed.event;
	private contentDisposables: IDisposable[] = [];
	private _onMessage = new Emitter<any>();

	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super('', TelemetryKeys.WebView, telemetryService, layoutService, clipboardService, themeService, logService, contextKeyService, { isFlyout: false, hasTitleIcon: true });
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

		this._webview = this._instantiationService.createInstance(ElectronWebviewBasedWebview,
			{},
			{
				allowScripts: true
			});

		this._webview.mountTo(this._body);

		this._webview.onMessage(message => {
			this._onMessage.fire(message);
		}, null, this.contentDisposables);

		this.contentDisposables.push(this._webview);
		this.contentDisposables.push(toDisposable(() => this._webview = null));
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
		this._webview.sendMessage(message);
	}

	public open() {
		this.title = this.headerTitle;
		this.updateDialogBody();
		this.show();
		this._okButton.focus();
	}

	public dispose(): void {
		this.contentDisposables.forEach(element => {
			element.dispose();
		});
	}
}
