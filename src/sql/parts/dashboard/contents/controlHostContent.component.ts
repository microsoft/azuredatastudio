/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./controlHostContent';

import { Component, forwardRef, Input, OnInit, Inject, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';

import Event, { Emitter } from 'vs/base/common/event';
import { Parts } from 'vs/workbench/services/part/common/partService';
import { IDisposable } from 'vs/base/common/lifecycle';

import { TabConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';

import * as sqlops from 'sqlops';
import { memoize } from 'vs/base/common/decorators';
import { AgentViewComponent } from '../../jobManagement/agent/agentView.component';
import { AvailabilityGroupDashboardComponent } from '../../availabilitygroup/dashboard/availabilityGroupDashboard.component';

@Component({
	templateUrl: decodeURI(require.toUrl('sql/parts/dashboard/contents/controlHostContent.component.html')),
	selector: 'controlhost-content'
})
export class ControlHostContent {
	@Input() private webviewId: string;

	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;
	private _onMessage = new Emitter<string>();
	public readonly onMessage: Event<string> = this._onMessage.event;

	private _onMessageDisposable: IDisposable;
	private _type: string;

	/* Children components */
	@ViewChild('agent') private _agentViewComponent: AgentViewComponent;
	@ViewChild('availabilitygroup') private _availabilitygroupViewComponent: AvailabilityGroupDashboardComponent;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _dashboardService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef
	) {
	}

	public layout(): void {
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

	public setControlType(type: string): void {
		this._type = type;
		this._changeRef.detectChanges();
	}

	public get controlType(): string {
		return this._type;
	}

	public refresh() {
		if(this._type === 'agent')
		{
			this._agentViewComponent.refresh = true;
		}
		else if(this._type === 'availabilitygroup')
		{
			this._availabilitygroupViewComponent.refresh = true;
		}
	}
}
