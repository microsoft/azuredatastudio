/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class DashboardData {
	public projectFile: string;
	public status: Status;
	public target: string;
	public timeToCompleteAction: string;
	public startDate: string;

	constructor(projectFile: string, status: Status, target: string, startDate: string) {
		this.projectFile = projectFile;
		this.status = status;
		this.target = target;
		this.timeToCompleteAction = '';
		this.startDate = startDate;
	}
}

export class PublishData extends DashboardData {
	public targetServer: string;
	public targetDatabase: string;

	constructor(projectFile: string, status: Status, target: string, startDate: string, targetDatabase: string, targetServer: string) {
		super(projectFile, status, target, startDate);
		this.targetDatabase = targetDatabase;
		this.targetServer = targetServer;
	}
}

export enum Status {
	success,
	failed,
	inProgress
}
