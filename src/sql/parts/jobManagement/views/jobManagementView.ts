/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ElementRef, AfterContentChecked } from '@angular/core';
import { AgentViewComponent } from 'sql/parts/jobManagement/agent/agentView.component';

export abstract class JobManagementView implements AfterContentChecked {
	protected isVisible: boolean = false;
	protected isInitialized: boolean = false;
	protected isRefreshing: boolean = false;
	protected _showProgressWheel: boolean;
	protected _visibilityElement: ElementRef;
	protected _parentComponent: AgentViewComponent;

	ngAfterContentChecked() {
		if (this._visibilityElement && this._parentComponent) {
			if (this.isVisible === false && this._visibilityElement.nativeElement.offsetParent !== null) {
				this.isVisible = true;
				if (!this.isInitialized) {
					this._showProgressWheel = true;
					this.onFirstVisible();
					this.isInitialized = true;
				}
			} else if (this.isVisible === true && this._parentComponent.refresh === true) {
				this._showProgressWheel = true;
				this.onFirstVisible();
				this.isRefreshing = true;
				this._parentComponent.refresh = false;
			} else if (this.isVisible === true && this._visibilityElement.nativeElement.offsetParent === null) {
				this.isVisible = false;
			}
		}
	}

	abstract onFirstVisible();
}