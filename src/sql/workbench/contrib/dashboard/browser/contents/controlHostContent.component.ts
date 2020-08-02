/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./controlHostContent';

import { Component, forwardRef, Input, Inject, ChangeDetectorRef, ViewChild } from '@angular/core';

import { Event, Emitter } from 'vs/base/common/event';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';

import * as azdata from 'azdata';
import { memoize } from 'vs/base/common/decorators';
import { AgentViewComponent } from 'sql/workbench/contrib/jobManagement/browser/agentView.component';

@Component({
	templateUrl: decodeURI(require.toUrl('./controlHostContent.component.html')),
	selector: 'controlhost-content'
})
export class ControlHostContent {
	@Input() private webviewId: string;

	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;
	private _onMessage = new Emitter<string>();
	public readonly onMessage: Event<string> = this._onMessage.event;

	private _type: string;

	/* Children components */
	@ViewChild('agent') private _agentViewComponent: AgentViewComponent;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _dashboardService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef
	) {
	}

	public layout(): void {
		this._agentViewComponent?.layout();
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

	public setControlType(type: string): void {
		this._type = type;
		this._changeRef.detectChanges();
	}

	public get controlType(): string {
		return this._type;
	}

	public refresh() {
		if (this._agentViewComponent !== undefined) {
			this._agentViewComponent.refresh = true;
		}
	}
}
