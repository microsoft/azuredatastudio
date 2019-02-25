/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./webviewContent';

import { Component, forwardRef, Input, OnInit, Inject, ElementRef } from '@angular/core';

import { Event, Emitter } from 'vs/base/common/event';
import { Parts, IPartService } from 'vs/workbench/services/part/common/partService';
import { IDisposable } from 'vs/base/common/lifecycle';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { memoize } from 'vs/base/common/decorators';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { WebviewElement } from 'vs/workbench/parts/webview/electron-browser/webviewElement';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { IDashboardWebview, IDashboardViewService } from 'sql/platform/dashboard/common/dashboardViewService';
import { AngularDisposable } from 'sql/base/node/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import * as sqlops from 'sqlops';
import { IContextKey } from 'vs/platform/contextkey/common/contextkey';

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
		@Inject(forwardRef(() => CommonServiceInterface)) private _dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IDashboardViewService) private dashboardViewService: IDashboardViewService,
		@Inject(IPartService) private partService: IPartService,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService
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

		this._webview = this.instantiationService.createInstance(WebviewElement,
			this.partService.getContainer(Parts.EDITOR_PART),
			{
				enableWrappedPostMessage: true,
				allowScripts: true
			});

		this._webview.mountTo(this._el.nativeElement);

		this._onMessageDisposable = this._webview.onMessage(e => {
			this._onMessage.fire(e);
		});
		this._webview.style(this.themeService.getTheme());
		if (this._html) {
			this._webview.contents = this._html;
		}
		this._webview.layout();
	}
}
