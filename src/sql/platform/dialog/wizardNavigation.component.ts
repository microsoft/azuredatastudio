/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/wizardNavigation';
import { Component, Inject, forwardRef, ElementRef } from '@angular/core';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { Event, Emitter } from 'vs/base/common/event';

@Component({
	selector: 'wizard-navigation',
	providers: [],
	template: `
		<div class="wizardNavigation">
			Hello world!
		</div>
	`
})
export class WizardNavigation {
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	public modelViewId: string;
	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IBootstrapParams) private _params: any) {

	}
}
