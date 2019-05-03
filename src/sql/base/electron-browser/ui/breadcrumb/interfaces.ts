/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InjectionToken, EventEmitter } from '@angular/core';
import { Subject } from 'rxjs/Subject';

export const IBreadcrumbService = new InjectionToken<IBreadcrumbService>('breadcrumbService');

export interface IBreadcrumbService {
	breadcrumbItem: Subject<MenuItem[]>;
	setBreadcrumbs(page: any): void;
}

export interface MenuItem {
	label?: string;
	icon?: string;
	command?: (event?: any) => void;
	url?: string;
	routerLink?: any[];
	eventEmitter?: EventEmitter<any>;
	items?: MenuItem[];
	expanded?: boolean;
	disabled?: boolean;
	visible?: boolean;
	target?: string;
	routerLinkActiveOptions?: any;
}
