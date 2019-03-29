/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';
import { Component, ViewChild, Inject, forwardRef, ElementRef, AfterViewInit } from '@angular/core';
import { ModelViewContent } from 'sql/parts/modelComponents/modelViewContent.component';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { DialogPane } from 'sql/platform/dialog/dialogPane';
import { ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { Event, Emitter } from 'vs/base/common/event';

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
	selector: 'querytab-modelview-container',
	providers: [],
	template: `
		<modelview-content [modelViewId]="modelViewId">
		</modelview-content>
	`
})
export class QueryModelViewTabContainer implements AfterViewInit {
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;
	private _dialogPane: DialogPane;

	public modelViewId: string;
	@ViewChild(ModelViewContent) private _modelViewContent: ModelViewContent;
	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IBootstrapParams) private _params: DialogComponentParams) {
		this.modelViewId = this._params.modelViewId;
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
