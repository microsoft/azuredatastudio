/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';
import { Component, AfterContentInit, ViewChild, Input, Inject, forwardRef, ElementRef } from '@angular/core';
import { ModelViewContent } from 'sql/parts/modelComponents/modelViewContent.component';
import { BootstrapParams } from 'sql/services/bootstrap/bootstrapParams';
import { BOOTSTRAP_SERVICE_ID, IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import Event, { Emitter } from 'vs/base/common/event';
import { ComponentEventType } from '../../parts/modelComponents/interfaces';

export interface DialogComponentParams extends BootstrapParams {
	modelViewId: string;
	validityChangedCallback: (valid: boolean) => void;
}

@Component({
	selector: 'dialog-modelview-container',
	providers: [],
	template: `
		<modelview-content [modelViewId]="modelViewId">
		</modelview-content>
	`
})
export class DialogContainer implements AfterContentInit {
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;
	private _params: DialogComponentParams;

	public modelViewId: string;
	@ViewChild(ModelViewContent) private _modelViewContent: ModelViewContent;
	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(BOOTSTRAP_SERVICE_ID) bootstrapService: IBootstrapService) {
		this._params = bootstrapService.getBootstrapParams(_el.nativeElement.tagName) as DialogComponentParams;
		this.modelViewId = this._params.modelViewId;
	}

	ngAfterContentInit(): void {
		this._modelViewContent.onEvent(event => {
			if (event.eventType === ComponentEventType.validityChanged) {
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
