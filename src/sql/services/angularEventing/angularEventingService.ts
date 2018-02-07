/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Subscription } from 'rxjs/Subscription';
import { Subject } from 'rxjs/Subject';
import { warn } from 'sql/base/common/log';

const ANGULAREVENTING_SERVICE_ID = 'angularEventingService';
export const IAngularEventingService = createDecorator<IAngularEventingService>(ANGULAREVENTING_SERVICE_ID);

export enum AngularEventType {
	NAV_DATABASE,
	NAV_SERVER,
	DELETE_WIDGET,
	PINUNPIN_TAB,
	NEW_TABS,
	CLOSE_TAB
}

export interface IDeleteWidgetPayload {
	id: string;
}

export interface IAngularEvent {
	event: AngularEventType;
	payload: any;
}

export interface IAngularEventingService {
	_serviceBrand: any;
	/**
	 * Adds a listener for the dashboard to send events, should only be called once for each dashboard by the dashboard itself
	 * @param uri Uri of the dashboard
	 * @param cb Listening function
	 * @returns
	 */
	onAngularEvent(uri: string, cb: (event: IAngularEvent) => void): Subscription;

	/**
	 * Send an event to the dashboard; no op if the dashboard has not started listening yet
	 * @param uri Uri of the dashboard to send the event to
	 * @param event event to send
	 */
	sendAngularEvent(uri: string, event: AngularEventType, payload?: any): void;
}

export class AngularEventingService implements IAngularEventingService {
	public _serviceBrand: any;
	private _angularMap = new Map<string, Subject<IAngularEvent>>();

	public onAngularEvent(uri: string, cb: (event: IAngularEvent) => void): Subscription {
		let subject: Subject<IAngularEvent>;
		if (!this._angularMap.has(uri)) {
			subject = new Subject<IAngularEvent>();
			this._angularMap.set(uri, subject);
		} else {
			subject = this._angularMap.get(uri);
		}
		let sub = subject.subscribe(cb);
		return sub;
	}

	public sendAngularEvent(uri: string, event: AngularEventType, payload?: any): void {
		if (!this._angularMap.has(uri)) {
			warn('Got request to send an event to a dashboard that has not started listening');
		} else {
			this._angularMap.get(uri).next({ event, payload });
		}
	}
}
