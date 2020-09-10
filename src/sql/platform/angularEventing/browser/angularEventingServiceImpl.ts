/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAngularEventingService, IAngularEvent, AngularEventType } from 'sql/platform/angularEventing/browser/angularEventingService';
import { ILogService } from 'vs/platform/log/common/log';
import { Event, Emitter } from 'vs/base/common/event';

export class AngularEventingService implements IAngularEventingService {
	public _serviceBrand: undefined;
	private _angularMap = new Map<string, Emitter<IAngularEvent>>();

	constructor(
		@ILogService private readonly logService: ILogService
	) { }

	public onAngularEvent(uri: string): Event<IAngularEvent> {
		let emitter = this._angularMap.get(uri);
		if (!emitter) {
			emitter = new Emitter<IAngularEvent>();
			this._angularMap.set(uri, emitter);
		}
		return emitter.event;
	}

	public sendAngularEvent(uri: string, event: AngularEventType, payload?: any): void {
		const emitter = this._angularMap.get(uri);
		if (!emitter) {
			this.logService.warn('Got request to send an event to a dashboard that has not started listening');
		} else {
			emitter.fire({ event, payload });
		}
	}
}
