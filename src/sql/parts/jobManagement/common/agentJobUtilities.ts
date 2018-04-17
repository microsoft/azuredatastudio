/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vs/nls';

export class AgentJobUtilities {

	public static convertToStatusString(status: number): string {
		switch(status) {
			case(0): return nls.localize('agentUtilities.failed','Failed');
			case(1): return nls.localize('agentUtilities.succeeded', 'Succeeded');
			case(3): return nls.localize('agentUtilities.canceled', 'Canceled');
			case(5): return nls.localize('agentUtilities.statusUnknown', 'Status Unknown');
			default: return nls.localize('agentUtilities.statusUnknown', 'Status Unknown');
		}
	}

	public static convertToExecutionStatusString(status: number): string {
		switch(status) {
			case(1): return nls.localize('agentUtilities.executing', 'Executing');
			case(2): return nls.localize('agentUtilities.waitingForThread', 'Waiting for Thread');
			case(3): return nls.localize('agentUtilities.betweenRetries', 'Between Retries');
			case(4): return nls.localize('agentUtilities.idle', 'Idle');
			case(5): return nls.localize('agentUtilities.suspended', 'Suspended');
			case(6): return nls.localize('agentUtilities.obsolete', '[Obsolete]');
			case(7): return nls.localize('agentUtilities.performingCompletionActions', 'PerformingCompletionActions');
			default: return nls.localize('agentUtilities.statusUnknown', 'Status Unknown');
		}
	}

	public static convertToResponse(bool: boolean) {
		return bool ? nls.localize('agentUtilities.yes', 'Yes') : nls.localize('agentUtilities.no', 'No');
	}

	public static convertToNextRun(date: string) {
		if (date.includes('1/1/0001')) {
			return nls.localize('agentUtilities.notScheduled', 'Not Scheduled');
		} else {
			return date;
		}
	}

	public static convertToLastRun(date: string) {
		if (date.includes('1/1/0001')) {
			return nls.localize('agentUtilities.neverRun', 'Never Run');
		} else {
			return date;
		}
	}
}