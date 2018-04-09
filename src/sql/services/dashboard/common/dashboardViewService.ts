/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import Event from 'vs/base/common/event';

import * as sqlops from 'sqlops';
import { IComponentConfigurationShape, IItemConfig } from 'sql/parts/dashboard/contents/mvvm/interfaces';

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
	initializeModel(rootComponent: IComponentConfigurationShape): void;
	clearContainer(componentId: string): void;
	addToContainer(containerId: string, item: IItemConfig): void;
	setLayout(componentId: string, layout: any): void;
	setProperties(componentId: string, properties: { [key: string]: any }): void;
}

export interface IDashboardViewService {
	_serviceBrand: any;
	onRegisteredWebview: Event<IDashboardWebview>;
	registerWebview(widget: IDashboardWebview);
	onRegisteredModelView: Event<IDashboardModelView>;
	registerModelView(widget: IDashboardModelView);
}

export const IDashboardViewService = createDecorator<IDashboardViewService>(SERVICE_ID);
