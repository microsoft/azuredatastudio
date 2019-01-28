/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';

import { warn } from 'sql/base/common/log';
import { IAngularEventingService, IAngularEvent, AngularEventType } from 'sql/platform/angularEventing/common/angularEventingService';

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
