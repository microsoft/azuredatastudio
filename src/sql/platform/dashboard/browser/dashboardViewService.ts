/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';

import { IView, IModelView } from 'sql/platform/model/browser/modelViewService';

export const SERVICE_ID = 'dashboardViewService';

export interface IDashboardWebview extends IView {
	setHtml(html: string): void;
	onMessage: Event<string>;
	sendMessage(message: string): void;
}

export interface IDashboardViewService {
	_serviceBrand: undefined;
	onRegisteredWebview: Event<IDashboardWebview>;
	registerWebview(widget: IDashboardWebview): void;
	onRegisteredModelView: Event<IModelView>;
	registerModelView(widget: IModelView): void;
}

export const IDashboardViewService = createDecorator<IDashboardViewService>(SERVICE_ID);
