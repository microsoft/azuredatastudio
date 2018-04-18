/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';
import { Component, AfterContentInit, ViewChild } from '@angular/core';
import Event, { Emitter } from 'vs/base/common/event';
import { ModelViewContent } from 'sql/parts/modelComponents/modelViewContent.component';

@Component({
	selector: 'dialog-modelview-container',
	providers: [],
	template: `
		<modelview-content [modelViewId]="id">
		</modelview-content>
	`
})
export class DialogContainer implements AfterContentInit {
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	@ViewChild(ModelViewContent) private _modelViewContent: ModelViewContent;
	constructor() {
	}

	ngAfterContentInit(): void {
	}

	public layout(): void {
		this._modelViewContent.layout();
	}

	public get id(): string {
		return 'sqlservices';
	}

	public get editable(): boolean {
		return false;
	}

	public refresh(): void {
		// no op
	}
}