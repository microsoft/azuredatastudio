/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dialogModal';
import { Component, ViewChild, Inject, forwardRef, ElementRef, AfterViewInit } from '@angular/core';
import { ModelViewContent } from 'sql/workbench/browser/modelComponents/modelViewContent.component';
import { DialogPane } from 'sql/platform/dialog/browser/dialogPane';
import { ComponentEventType } from 'sql/workbench/browser/modelComponents/interfaces';
import { Event, Emitter } from 'vs/base/common/event';
import { IBootstrapParams } from 'sql/platform/bootstrap/common/bootstrapParams';

export interface LayoutRequestParams {
	modelViewId?: string;
	alwaysRefresh?: boolean;
}
export interface DialogComponentParams extends IBootstrapParams {
	modelViewId: string;
	validityChangedCallback: (valid: boolean) => void;
	onLayoutRequested: Event<LayoutRequestParams>;
	dialogPane: DialogPane;
}

@Component({
	selector: 'dialog-modelview-container',
	providers: [],
	template: `
		<div class="dialogContainer" *ngIf="_dialogPane && _dialogPane.displayPageTitle">
			<div class="dialogModal-wizardHeader" *ngIf="_dialogPane && _dialogPane.displayPageTitle">
				<div *ngIf="_dialogPane.pageNumber" class="wizardPageNumber">Step {{_dialogPane.pageNumber}}</div>
				<h1 class="wizardPageTitle" role="alert">{{_dialogPane.title}}</h1>
				<div *ngIf="_dialogPane.description">{{_dialogPane.description}}</div>
			</div>
			<div style="flex: 1 1 auto; position: relative;">
				<modelview-content [modelViewId]="modelViewId" style="width: 100%; height: 100%; position: absolute;">
				</modelview-content>
			</div>
		</div>
		<modelview-content [modelViewId]="modelViewId" *ngIf="!_dialogPane || !_dialogPane.displayPageTitle">
		</modelview-content>
	`
})
export class DialogContainer implements AfterViewInit {
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;
	private _dialogPane: DialogPane;

	public modelViewId: string;
	@ViewChild(ModelViewContent) private _modelViewContent: ModelViewContent;
	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IBootstrapParams) private _params: DialogComponentParams) {
		this.modelViewId = this._params.modelViewId;
		this._params.onLayoutRequested(layoutParams => {
			if (layoutParams && (layoutParams.alwaysRefresh || layoutParams.modelViewId === this.modelViewId)) {
				this.layout();
			}
		});
		this._dialogPane = this._params.dialogPane;
	}

	ngAfterViewInit(): void {
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
