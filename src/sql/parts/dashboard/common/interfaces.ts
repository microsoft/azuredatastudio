/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnDestroy } from '@angular/core';

import Event from 'vs/base/common/event';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';

import { AngularDisposable } from 'sql/base/common/lifecycle';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';

export enum Conditional {
	'equals',
	'notEquals',
	'greaterThanOrEquals',
	'greaterThan',
	'lessThanOrEquals',
	'lessThan',
	'always'
}

export abstract class DashboardTab extends TabChild implements OnDestroy {
	public abstract layout(): void;
	public abstract readonly id: string;
	public abstract readonly editable: boolean;
	public abstract refresh(): void;
	public abstract readonly onResize: Event<void>;
	public enableEdit(): void {
		// no op
	}

	private _toDispose: IDisposable[] = [];

	constructor() {
		super();
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	protected _register<T extends IDisposable>(t: T): T {
		this._toDispose.push(t);
		return t;
	}

	ngOnDestroy() {
		this.dispose();
	}
}
