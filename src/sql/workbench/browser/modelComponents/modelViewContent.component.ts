/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, forwardRef, Input, OnInit, Inject, ChangeDetectorRef } from '@angular/core';

import { Event, Emitter } from 'vs/base/common/event';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { memoize } from 'vs/base/common/decorators';

import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { IModelView } from 'sql/platform/model/browser/modelViewService';
import { ViewBase } from 'sql/workbench/browser/modelComponents/viewBase';
import { IModelViewService } from 'sql/platform/modelComponents/browser/modelViewService';

import * as azdata from 'azdata';

@Component({
	selector: 'modelview-content',
	template: `
	<div *ngIf="rootDescriptor" style="width: 100%; height: 100%;">
			<model-component-wrapper style="display: block; height: 100%" [descriptor]="rootDescriptor" [modelStore]="modelStore">
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

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IModelViewService) private modelViewService: IModelViewService
	) {
		super(changeRef);
	}

	ngOnInit() {
		this.modelViewService.registerModelView(this);
		this._register(addDisposableListener(window, EventType.RESIZE, e => {
			this.layout();
		}));
	}

	ngOnDestroy() {
		this._onDestroy.fire();
		super.ngOnDestroy();
	}

	public layout(): void {
		this.changeRef.detectChanges();
	}

	public get id(): string {
		return this.modelViewId;
	}

	@memoize
	public get connection(): azdata.connection.Connection {
		if (!this._commonService.connectionManagementService || !this._commonService.connectionManagementService.connectionInfo) {
			return undefined;
		}

		let currentConnection = this._commonService.connectionManagementService.connectionInfo.connectionProfile;
		let connection: azdata.connection.Connection = {
			providerName: currentConnection.providerName,
			connectionId: currentConnection.id,
			options: currentConnection.options
		};
		return connection;
	}

	@memoize
	public get serverInfo(): azdata.ServerInfo {
		if (!this._commonService.connectionManagementService || !this._commonService.connectionManagementService.connectionInfo) {
			return undefined;
		}

		return this._commonService.connectionManagementService.connectionInfo.serverInfo;
	}
}
