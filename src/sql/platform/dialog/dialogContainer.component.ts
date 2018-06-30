/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';
import { Component, AfterContentInit, ViewChild, Input, Inject, forwardRef, ElementRef } from '@angular/core';
import { ModelViewContent } from 'sql/parts/modelComponents/modelViewContent.component';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { DialogPane } from 'sql/platform/dialog/dialogPane';
import { ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { Event, Emitter } from 'vs/base/common/event';

export interface DialogComponentParams extends IBootstrapParams {
	modelViewId: string;
	validityChangedCallback: (valid: boolean) => void;
	onLayoutRequested: Event<string>;
	dialogPane: DialogPane;
}

@Component({
	selector: 'dialog-modelview-container',
	providers: [],
	template: `
		<div class="dialogContainer" *ngIf="_dialogPane && _dialogPane.displayPageTitle">
			<div class="dialogModal-wizardHeader">
				<div *ngIf="_dialogPane.pageNumber" class="wizardPageNumber">Step {{_dialogPane.pageNumber}}</div>
				<h1 class="wizardPageTitle">{{_dialogPane.title}}</h1>
				<div *ngIf="_dialogPane.description">{{_dialogPane.description}}</div>
			</div>
			<modelview-content [modelViewId]="modelViewId">
			</modelview-content>
		</div>
		<modelview-content *ngIf="!_dialogPane || !_dialogPane.displayPageTitle" [modelViewId]="modelViewId">
		</modelview-content>
	`
})
export class DialogContainer implements AfterContentInit {
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;
	private _dialogPane: DialogPane;

	public modelViewId: string;
	@ViewChild(ModelViewContent) private _modelViewContent: ModelViewContent;
	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IBootstrapParams) private _params: DialogComponentParams) {
		this.modelViewId = this._params.modelViewId;
		this._params.onLayoutRequested(e => {
			if (this.modelViewId === e) {
				this.layout();
			}
		});
		this._dialogPane = this._params.dialogPane;
	}

	ngAfterContentInit(): void {
		this._modelViewContent.onEvent(event => {
			if (event.isRootComponent && event.eventType === ComponentEventType.validityChanged) {
				this._params.validityChangedCallback(event.args);
			}
		});
		let element = <HTMLElement>this._el.nativeElement;
		element.style.height = '100%';
		element.style.width = '100%';
	}

	public layout(): void {
		this._modelViewContent.layout();
	}
}
