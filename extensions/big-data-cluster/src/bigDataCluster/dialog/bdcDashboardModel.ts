/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IBdcStatus, IStatus, IServiceStatus } from '../controller/clusterControllerApi';

export class BdcDashboardModel {

	private _clusterStatus: IBdcStatus;

	constructor(public clusterName: string, url: string, username: string, password: string) {

	}

	public get clusterStatus(): IStatus {
		return { healthStatus: 'Warning detected', state: 'ready' };
	}

	public get serviceStatus(): IServiceStatus[] {
		return [
			{ serviceName: 'SQL Server', status: { state: 'Ready', healthStatus: 'Warning' }, resources: undefined },
			{ serviceName: 'HDFS', status: { state: 'Ready', healthStatus: 'Healthy' }, resources: undefined },
			{ serviceName: 'Spark', status: { state: 'Ready', healthStatus: 'Healthy' }, resources: undefined },
			{ serviceName: 'Control', status: { state: 'Ready', healthStatus: 'Healthy' }, resources: undefined },
			{ serviceName: 'Gateway', status: { state: 'Ready', healthStatus: 'Healthy' }, resources: undefined },
			{ serviceName: 'App', status: { state: 'Ready', healthStatus: 'Healthy' }, resources: undefined }
		];
	}

	public get serviceEndpoints(): { serviceName: string, hyperlink?: string, isHyperlink: boolean, ipAddress?: string, port?: string }[] {
		return [
			{ serviceName: 'SQL Server Master Instance', ipAddress: '10.91.134.112', port: '31433', isHyperlink: false },
			{ serviceName: 'Controller', ipAddress: '10.91.134.112', port: '31433', isHyperlink: false },
			{ serviceName: 'HDFS/Spark Gateway', ipAddress: '10.91.134.112', port: '31433', isHyperlink: false },
			{ serviceName: 'Spark Job Management', hyperlink: 'https://10.91.134.112:30443/gateway/default/yarn', isHyperlink: true },
			{ serviceName: 'Grafana Dashboard', hyperlink: 'https://10.91.134.112/grafana/d/wZx3OUdmz', isHyperlink: true },
			{ serviceName: 'Kibana Dashboard', hyperlink: 'https://10.91.134.112/kibana/app/kibana#/discover', isHyperlink: true },
		];
	}

	public refresh(): void {

	}
}
