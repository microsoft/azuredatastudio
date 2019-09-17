/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';

import { IAngularEventingService, IAngularEvent, AngularEventType } from 'sql/platform/angularEventing/common/angularEventingService';
import { ILogService } from 'vs/platform/log/common/log';

export class AngularEventingService implements IAngularEventingService {
	public _serviceBrand: undefined;
	private _angularMap = new Map<string, Subject<IAngularEvent>>();

	constructor(
		@ILogService private readonly logService: ILogService
	) { }

	public onAngularEvent(uri: string, cb: (event: IAngularEvent) => void): Subscription {
		let subject = this._angularMap.get(uri);
		if (!subject) {
			subject = new Subject<IAngularEvent>();
			this._angularMap.set(uri, subject);
		}
		let sub = subject.subscribe(cb);
		return sub;
	}

	public sendAngularEvent(uri: string, event: AngularEventType, payload?: any): void {
		const subject = this._angularMap.get(uri);
		if (!subject) {
			this.logService.warn('Got request to send an event to a dashboard that has not started listening');
		} else {
			subject.next({ event, payload });
		}
	}
}
