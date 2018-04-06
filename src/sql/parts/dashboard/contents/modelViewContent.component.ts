/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./webviewContent';

import { Component, forwardRef, Input, OnInit, Inject, ChangeDetectorRef, ElementRef } from '@angular/core';

import Event, { Emitter } from 'vs/base/common/event';
import Webview from 'vs/workbench/parts/html/browser/webview';
import { Parts } from 'vs/workbench/services/part/common/partService';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { memoize } from 'vs/base/common/decorators';

import { DashboardTab } from 'sql/parts/dashboard/common/interfaces';
import { TabConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { IDashboardModelView } from 'sql/services/dashboard/common/dashboardViewService';
import { AngularDisposable } from 'sql/base/common/lifecycle';

import * as sqlops from 'sqlops';
import { ModelComponentTypes } from '../../../workbench/api/node/sqlExtHost.protocol';

@Component({
	template: '',
	selector: 'modelview-content'
})
export class ModelViewContent extends AngularDisposable implements OnInit, IDashboardModelView {
	@Input() private modelViewId: string;

	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;
	private _onMessage = new Emitter<string>();
	public readonly onMessage: Event<string> = this._onMessage.event;

	private _onMessageDisposable: IDisposable;
	private _webview: Webview;
	private _model: string;

	constructor(
		@Inject(forwardRef(() => DashboardServiceInterface)) private _dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef
	) {
		super();
	}

	ngOnInit() {
		this._dashboardService.dashboardViewService.registerModelView(this);
		this._createModelView();
		this._register(addDisposableListener(window, EventType.RESIZE, e => {
			this.layout();
		}));
	}

	public layout(): void {
		this._webview.layout();
	}

	public get id(): string {
		return this.modelViewId;
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

	/// IDashboardModelView implementation

	setModel(componentId: string): void {
		throw new Error("Method not implemented.");
	}
	createComponent(type: ModelComponentTypes, args: any): string {
		throw new Error("Method not implemented.");
	}
	clearContainer(componentId: string): void {
		throw new Error("Method not implemented.");
	}
	addToContainer(containerId: string, childComponentid: string, config: any): void {
		throw new Error("Method not implemented.");
	}
	setLayout(containerId: string, layout: any): void {
		throw new Error("Method not implemented.");
	}
	setProperties(containerId: string, properties: { [key: string]: any; }): void {
		throw new Error("Method not implemented.");
	}

	/// Private methods

	private _createModelView(): void {

	}
}
