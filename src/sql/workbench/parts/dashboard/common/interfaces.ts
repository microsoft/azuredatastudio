/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnDestroy } from '@angular/core';

import { Event } from 'vs/base/common/event';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';

import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { SingleConnectionManagementService } from 'sql/services/common/commonServiceInterface.service';

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
	constructor() {
		super();
	}

	ngOnDestroy() {
		this.dispose();
	}
}

export interface IConfigModifierCollection {
	connectionManagementService: SingleConnectionManagementService;
	contextKeyService: IContextKeyService;
}
