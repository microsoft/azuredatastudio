/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class DashboardData {
	public status: Status;
	public target: string;
	public timeToCompleteAction: string;
	public startDate: string;

	constructor(_status: Status, _target: string, _startDate: string) {
		this.status = _status;
		this.target = _target;
		this.timeToCompleteAction = '';
		this.startDate = _startDate;
	}
}

export enum Status {
	success,
	failed,
	inProgress
}
