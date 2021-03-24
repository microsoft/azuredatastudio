/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class BuildInfo {
	public status: Status;
	public target: string;
	public timeToBuild: string;
	public buildDate: string;

	constructor(_status: Status, _target: string, _buildDate: string) {
		this.status = _status;
		this.target = _target;
		this.timeToBuild = '';
		this.buildDate = _buildDate;
	}
}

export enum Status {
	success = 'Success',
	failed = 'Failed',
	inProgress = 'In progress'
}

export class DeployInfo {
	public status: Status;
	public target: string;
	public timeToBuild: string;
	public deployDate: string;

	constructor(_status: Status, _target: string, _deployDate: string) {
		this.status = _status;
		this.target = _target;
		this.timeToBuild = '';
		this.deployDate = _deployDate;
	}
}
