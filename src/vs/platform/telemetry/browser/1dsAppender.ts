/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AppInsightsCore } from '@microsoft/1ds-core-js';
import { AbstractOneDataSystemAppender } from 'vs/platform/telemetry/common/1dsAppender';


export class OneDataSystemWebAppender extends AbstractOneDataSystemAppender {
	constructor(
		isInternalTelemetry: boolean,
		eventPrefix: string,
		defaultData: { [key: string]: any } | null,
		iKeyOrClientFactory: string | (() => AppInsightsCore), // allow factory function for testing
	) {
		super(isInternalTelemetry, eventPrefix, defaultData, iKeyOrClientFactory);

		// If we cannot fetch the endpoint it means it is down and we should not send any telemetry.
		// This is most likely due to ad blockers
		fetch(this.endPointUrl, { method: 'POST' }).catch(err => {
			this._aiCoreOrKey = undefined;
		});
	}
}
