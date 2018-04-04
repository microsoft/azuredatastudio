/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import Event from 'vs/base/common/event';

import * as sqlops from 'sqlops';
import { ModelComponentTypes } from '../../../workbench/api/node/sqlExtHost.protocol';

export const SERVICE_ID = 'dashboardViewService';

export interface IView {
	readonly id: string;
	readonly connection: sqlops.connection.Connection;
	readonly serverInfo: sqlops.ServerInfo;
}
export interface IDashboardWebview extends IView {
	setHtml(html: string): void;
	onMessage: Event<string>;
	sendMessage(message: string);
}

export interface IDashboardModelView extends IView {
	setModel(componentId: string): void;
	createComponent(type: ModelComponentTypes, args: any): string;
	clearContainer(componentId: string): void;
	addToContainer(containerId: string, childComponentid: string, config: any): void;
	setLayout(containerId: string, layout: any): void;
	setProperties(containerId: string, properties: { [key: string]: any }): void;
}

export interface IDashboardViewService {
	_serviceBrand: any;
	onRegisteredWebview: Event<IDashboardWebview>;
	registerWebview(widget: IDashboardWebview);
	onRegisteredModelView: Event<IDashboardModelView>;
	registerModelView(widget: IDashboardModelView);
}

export const IDashboardViewService = createDecorator<IDashboardViewService>(SERVICE_ID);
