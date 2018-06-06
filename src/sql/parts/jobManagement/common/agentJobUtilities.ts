/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vs/nls';

export class AgentJobUtilities {

	public static startIconClass: string = 'action-label icon runJobIcon';
	public static stopIconClass: string = 'action-label icon stopJobIcon';
	public static jobMessageLength: number = 110;

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

	public static setRunnable(icon: HTMLElement, index: number) {
		if (icon.className.includes('non-runnable')) {
			icon.className = icon.className.slice(0, index);
		}
	}

	public static getActionIconClassName(startIcon: HTMLElement, stopIcon: HTMLElement, executionStatus: number) {
		this.setRunnable(startIcon, AgentJobUtilities.startIconClass.length);
		this.setRunnable(stopIcon, AgentJobUtilities.stopIconClass.length);
		switch (executionStatus) {
			case(1): // executing
				startIcon.className += ' non-runnable';
				return;
			case(2): // Waiting for thread
				startIcon.className += ' non-runnable';
				return;
			case(3): // Between retries
				startIcon.className += ' non-runnable';
				return;
			case(4): //Idle
				stopIcon.className += ' non-runnable';
				return;
			case(5): // Suspended
				stopIcon.className += ' non-runnable';
				return;
			case(6): //obsolete
				startIcon.className += ' non-runnable';
				stopIcon.className += ' non-runnable';
				return;
			case(7): //Performing Completion Actions
				startIcon.className += ' non-runnable';
				return;
			default:
				return;
		}
	}

	public static convertColFieldToName(colField: string) {
		switch(colField) {
			case('name'):
				return 'Name';
			case('lastRun'):
				return 'Last Run';
			case('nextRun'):
				return 'Next Run';
			case('enabled'):
				return 'Enabled';
			case('status'):
				return 'Status';
			case('category'):
				return 'Category';
			case('runnable'):
				return 'Runnable';
			case('schedule'):
				return 'Schedule';
			case('lastRunOutcome'):
				return 'Last Run Outcome';
		}
		return '';
	}

	public static convertColNameToField(columnName: string) {
		switch(columnName) {
			case('Name'):
				return 'name';
			case('Last Run'):
				return 'lastRun';
			case('Next Run'):
				return 'nextRun';
			case('Enabled'):
				return 'enabled';
			case('Status'):
				return 'status';
			case('Category'):
				return 'category';
			case('Runnable'):
				return 'runnable';
			case('Schedule'):
				return 'schedule';
			case('Last Run Outcome'):
				return 'lastRunOutcome';
		}
		return '';
	}
}