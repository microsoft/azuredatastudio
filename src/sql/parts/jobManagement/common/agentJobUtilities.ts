/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

export class AgentJobUtilities {

	public static convertToStatusString(status: number): string {
		switch(status) {
			case(0): return 'Failed';
			case(1): return 'Succeeded';
			case(3): return 'Canceled';
			case(5): return 'Status Unknown';
			default: return 'Status Unknown';
		}
	}

	public static convertToExecutionStatusString(status: number): string {
		switch(status) {
			case(1): return 'Executing';
			case(2): return 'Waiting for Thread';
			case(3): return 'Between Retries';
			case(4): return 'Idle';
			case(5): return 'Suspended';
			case(6): return '[Obsolete]';
			case(7): return 'PerformingCompletionActions';
			default: return 'Status Unknown';
		}
	}

	public static convertToResponse(bool: boolean) {
		return bool ? 'Yes' : 'No';
	}

	public static convertToNextRun(date: string) {
		if (date.includes('1/1/0001')) {
			return 'Not Scheduled';
		}
	}
}