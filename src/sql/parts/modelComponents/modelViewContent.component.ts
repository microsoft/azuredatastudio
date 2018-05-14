/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
// import 'vs/css!./modelViewContent';

import { Component, forwardRef, Input, OnInit, Inject, ChangeDetectorRef, ElementRef } from '@angular/core';

import Event, { Emitter } from 'vs/base/common/event';
import { Parts } from 'vs/workbench/services/part/common/partService';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { memoize } from 'vs/base/common/decorators';
import * as nls from 'vs/nls';

import { TabConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { IModelView } from 'sql/services/model/modelViewService';
import { AngularDisposable } from 'sql/base/common/lifecycle';

import * as sqlops from 'sqlops';
import { ViewBase } from 'sql/parts/modelComponents/viewBase';
import { ConnectionManagementService } from '../connection/common/connectionManagementService';

@Component({
	selector: 'modelview-content',
	template: `
		<div *ngIf="rootDescriptor">
			<model-component-wrapper [descriptor]="rootDescriptor" [modelStore]="modelStore">
			</model-component-wrapper>
		</div>
	`
})
export class ModelViewContent extends ViewBase implements OnInit, IModelView {
	@Input() private modelViewId: string;

	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;
	private _onMessage = new Emitter<string>();
	public readonly onMessage: Event<string> = this._onMessage.event;

	private _onMessageDisposable: IDisposable;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef
	) {
		super(changeRef);
	}

	ngOnInit() {
		this._commonService.modelViewService.registerModelView(this);
		this._register(addDisposableListener(window, EventType.RESIZE, e => {
			this.layout();
		}));
	}

	public layout(): void {
	}

	public get id(): string {
		return this.modelViewId;
	}

	@memoize
	public get connection(): sqlops.connection.Connection {
		if (!this._commonService.connectionManagementService) {
			return undefined;
		}

		let currentConnection = this._commonService.connectionManagementService.connectionInfo.connectionProfile;
		let connection: sqlops.connection.Connection = {
			providerName: currentConnection.providerName,
			connectionId: currentConnection.id,
			options: currentConnection.options
		};
		return connection;
	}

	@memoize
	public get serverInfo(): sqlops.ServerInfo {
		if (!this._commonService.connectionManagementService) {
			return undefined;
		}

		return this._commonService.connectionManagementService.connectionInfo.serverInfo;
	}
}
