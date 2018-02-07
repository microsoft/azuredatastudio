/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import Event from 'vs/base/common/event';

export enum Conditional {
	'equals',
	'notEquals',
	'greaterThanOrEquals',
	'greaterThan',
	'lessThanOrEquals',
	'lessThan',
	'always'
}

export abstract class DashboardTab extends Disposable {
	public abstract layout(): void;
	public abstract readonly id: string;
	public abstract readonly editable: boolean;
	public abstract refresh(): void;
	public abstract readonly onResize: Event<void>;
	public enableEdit(): void {
		// no op
	}
}
