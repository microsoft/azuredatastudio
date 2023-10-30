/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';

const ANGULAREVENTING_SERVICE_ID = 'angularEventingService';
export const IAngularEventingService = createDecorator<IAngularEventingService>(ANGULAREVENTING_SERVICE_ID);

export enum AngularEventType {
	NAV_DATABASE,
	NAV_SERVER,
	DELETE_WIDGET,
	PINUNPIN_TAB,
	NEW_TABS,
	CLOSE_TAB,
	COLLAPSE_WIDGET
}

export interface IDeleteWidgetPayload {
	id: string;
}

export interface IAngularEvent {
	event: AngularEventType;
	payload: any;
}

export interface IAngularEventingService {
	_serviceBrand: undefined;
	/**
	 * Adds a listener for the dashboard to send events, should only be called once for each dashboard by the dashboard itself
	 * @param uri Uri of the dashboard
	 */
	onAngularEvent(uri: string): Event<IAngularEvent>;

	/**
	 * Send an event to the dashboard; no op if the dashboard has not started listening yet
	 * @param uri Uri of the dashboard to send the event to
	 * @param event event to send
	 */
	sendAngularEvent(uri: string, event: AngularEventType, payload?: any): void;
}
