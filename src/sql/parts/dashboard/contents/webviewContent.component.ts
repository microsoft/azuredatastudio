/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./webviewContent';

import { Component, forwardRef, Input, OnInit, Inject, ChangeDetectorRef, ElementRef } from '@angular/core';

import Event, { Emitter } from 'vs/base/common/event';
import { Webview } from 'vs/workbench/parts/html/browser/webview';
import { Parts } from 'vs/workbench/services/part/common/partService';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { memoize } from 'vs/base/common/decorators';

import { DashboardTab } from 'sql/parts/dashboard/common/interfaces';
import { TabConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { IDashboardWebview } from 'sql/services/dashboard/common/dashboardViewService';
import { AngularDisposable } from 'sql/base/common/lifecycle';

import * as sqlops from 'sqlops';

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
	private _webview: Webview;
	private _html: string;
	private _dashboardService: DashboardServiceInterface;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef
	) {
		super();
		this._dashboardService = commonService as DashboardServiceInterface;
	}

	ngOnInit() {
		this._dashboardService.dashboardViewService.registerWebview(this);
		this._createWebview();
		this._register(addDisposableListener(window, EventType.RESIZE, e => {
			this.layout();
		}));
	}

	public layout(): void {
		this._webview.layout();
	}

	public get id(): string {
		return this.webviewId;
	}

	@memoize
	public get connection(): sqlops.connection.Connection {
		let currentConnection = this._dashboardService.connectionManagementService.connectionInfo.connectionProfile;
		let connection: sqlops.connection.Connection = {
			providerName: currentConnection.providerName,
			connectionId: currentConnection.id,
			options: currentConnection.options
		};
		return connection;
	}

	@memoize
	public get serverInfo(): sqlops.ServerInfo {
		return this._dashboardService.connectionManagementService.connectionInfo.serverInfo;
	}

	public setHtml(html: string): void {
		this._html = html;
		if (this._webview) {
			this._webview.contents = html;
			this._webview.layout();
		}
	}

	public sendMessage(message: string): void {
		if (this._webview) {
			this._webview.sendMessage(message);
		}
	}

	private _createWebview(): void {
		if (this._webview) {
			this._webview.dispose();
		}

		if (this._onMessageDisposable) {
			this._onMessageDisposable.dispose();
		}

		this._webview = new Webview(this._el.nativeElement,
			this._dashboardService.partService.getContainer(Parts.EDITOR_PART),
			this._dashboardService.themeService,
			this._dashboardService.environmentService,
			this._dashboardService.contextViewService,
			undefined,
			undefined,
			{
				allowScripts: true,
				enableWrappedPostMessage: true
			}
		);


		this._onMessageDisposable = this._webview.onMessage(e => {
			this._onMessage.fire(e);
		});
		this._webview.style(this._dashboardService.themeService.getTheme());
		if (this._html) {
			this._webview.contents = this._html;
		}
		this._webview.layout();
	}
}
