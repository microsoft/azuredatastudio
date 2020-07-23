/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./webviewContent';

import { Component, forwardRef, Input, OnInit, Inject, ElementRef } from '@angular/core';

import { Event, Emitter } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { memoize } from 'vs/base/common/decorators';
import { DashboardServiceInterface } from 'sql/workbench/contrib/dashboard/browser/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { IDashboardWebview, IDashboardViewService } from 'sql/platform/dashboard/browser/dashboardViewService';
import { AngularDisposable } from 'sql/base/browser/lifecycle';

import * as azdata from 'azdata';
import { WebviewElement, IWebviewService } from 'vs/workbench/contrib/webview/browser/webview';

@Component({
	template: '',
	selector: 'webview-content'
})
export class WebviewContent extends AngularDisposable implements OnInit, IDashboardWebview {
	@Input() private webviewId: string;

	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;
	private _onMessage = new Emitter<string>();
	public readonly onMessage: Event<string> = this._onMessage.event;

	private _onMessageDisposable: IDisposable;
	private _webview: WebviewElement;
	private _html: string;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private readonly _dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ElementRef)) private readonly _el: ElementRef,
		@Inject(IDashboardViewService) private readonly dashboardViewService: IDashboardViewService,
		@Inject(IWebviewService) private readonly webviewService: IWebviewService
	) {
		super();
	}

	ngOnInit() {
		this.dashboardViewService.registerWebview(this);
		this._createWebview();
		this._register(addDisposableListener(window, EventType.RESIZE, e => {
			this.layout();
		}));
	}

	public layout(): void {
		// no op
	}

	public get id(): string {
		return this.webviewId;
	}

	@memoize
	public get connection(): azdata.connection.Connection {
		const currentConnection = this._dashboardService.connectionManagementService.connectionInfo.connectionProfile;
		const connection: azdata.connection.Connection = {
			providerName: currentConnection.providerName,
			connectionId: currentConnection.id,
			options: currentConnection.options
		};
		return connection;
	}

	@memoize
	public get serverInfo(): azdata.ServerInfo {
		return this._dashboardService.connectionManagementService.connectionInfo.serverInfo;
	}

	public setHtml(html: string): void {
		this._html = html;
		if (this._webview) {
			this._webview.html = html;
		}
	}

	public sendMessage(message: string): void {
		if (this._webview) {
			this._webview.postMessage(message);
		}
	}

	private _createWebview(): void {
		if (this._webview) {
			this._webview.dispose();
		}

		if (this._onMessageDisposable) {
			this._onMessageDisposable.dispose();
		}

		this._webview = this.webviewService.createWebviewElement(this.id,
			{},
			{
				allowScripts: true
			}, undefined);

		this._webview.mountTo(this._el.nativeElement);

		this._onMessageDisposable = this._webview.onMessage(e => {
			this._onMessage.fire(e);
		});
		if (this._html) {
			this._webview.html = this._html;
		}
	}
}
