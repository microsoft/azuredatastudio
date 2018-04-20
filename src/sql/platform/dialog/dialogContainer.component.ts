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

export interface DialogComponentParams extends BootstrapParams {
	modelViewId: string;
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

	public modelViewId: string;
	@ViewChild(ModelViewContent) private _modelViewContent: ModelViewContent;
	constructor(
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(BOOTSTRAP_SERVICE_ID) bootstrapService: IBootstrapService) {
		this.modelViewId = (bootstrapService.getBootstrapParams(el.nativeElement.tagName) as DialogComponentParams).modelViewId;
	}

	ngAfterContentInit(): void {
	}

	public layout(): void {
		this._modelViewContent.layout();
	}
}
