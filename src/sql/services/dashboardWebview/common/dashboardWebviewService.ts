/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

import Event from 'vs/base/common/event';

export const SERVICE_ID = 'dashboardWebviewService';

export interface IDashboardWebview {
	readonly id: string;
	setHtml(html: string): void;
	onMessage: Event<string>;
	sendMessage(message: string);
}

export interface IDashboardWebviewService {
	_serviceBrand: any;
	onRegisteredWebview: Event<IDashboardWebview>;
	registerWebview(widget: IDashboardWebview);
}

export const IDashboardWebviewService = createDecorator<IDashboardWebviewService>(SERVICE_ID);
