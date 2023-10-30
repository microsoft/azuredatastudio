/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from 'vs/base/common/event';
import { CancellationToken } from 'vs/base/common/cancellation';
import { URI } from 'vs/base/common/uri';
import { ILogService } from 'vs/platform/log/common/log';
import { MainContext, MainThreadTimelineShape, ExtHostTimelineShape, ExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { TimelineChangeEvent, TimelineOptions, TimelineProviderDescriptor, ITimelineService, Timeline } from 'vs/workbench/contrib/timeline/common/timeline';
import { revive } from 'vs/base/common/marshalling';

@extHostNamedCustomer(MainContext.MainThreadTimeline)
export class MainThreadTimeline implements MainThreadTimelineShape {
	private readonly _proxy: ExtHostTimelineShape;
	private readonly _providerEmitters = new Map<string, Emitter<TimelineChangeEvent>>();

	constructor(
		context: IExtHostContext,
		@ILogService private readonly logService: ILogService,
		@ITimelineService private readonly _timelineService: ITimelineService
	) {
		this._proxy = context.getProxy(ExtHostContext.ExtHostTimeline);
	}

	$registerTimelineProvider(provider: TimelineProviderDescriptor): void {
		this.logService.trace(`MainThreadTimeline#registerTimelineProvider: id=${provider.id}`);

		const proxy = this._proxy;

		const emitters = this._providerEmitters;
		let onDidChange = emitters.get(provider.id);
		if (onDidChange === undefined) {
			onDidChange = new Emitter<TimelineChangeEvent>();
			emitters.set(provider.id, onDidChange);
		}

		this._timelineService.registerTimelineProvider({
			...provider,
			onDidChange: onDidChange.event,
			async provideTimeline(uri: URI, options: TimelineOptions, token: CancellationToken) {
				return revive<Timeline>(await proxy.$getTimeline(provider.id, uri, options, token));
			},
			dispose() {
				emitters.delete(provider.id);
				onDidChange?.dispose();
			}
		});
	}

	$unregisterTimelineProvider(id: string): void {
		this.logService.trace(`MainThreadTimeline#unregisterTimelineProvider: id=${id}`);

		this._timelineService.unregisterTimelineProvider(id);
	}

	$emitTimelineChangeEvent(e: TimelineChangeEvent): void {
		this.logService.trace(`MainThreadTimeline#emitChangeEvent: id=${e.id}, uri=${e.uri?.toString(true)}`);

		const emitter = this._providerEmitters.get(e.id!);
		emitter?.fire(e);
	}

	dispose(): void {
		// noop
	}
}
