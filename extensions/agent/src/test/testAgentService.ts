/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as azdata from 'azdata';

export class TestAgentService implements azdata.AgentServicesProvider {
	handle?: number;
	readonly providerId: string = 'Test Provider';

	// Job management methods
	getJobs(ownerUri: string): Thenable<azdata.AgentJobsResult> {
		return undefined;
	}
	getJobHistory(ownerUri: string, jobId: string, jobName: string): Thenable<azdata.AgentJobHistoryResult> {
		return undefined;
	}
	jobAction(ownerUri: string, jobName: string, action: string): Thenable<azdata.ResultStatus> {
		return undefined;
	}
	createJob(ownerUri: string, jobInfo: azdata.AgentJobInfo): Thenable<azdata.CreateAgentJobResult> {
		return undefined;
	}
	updateJob(ownerUri: string, originalJobName: string, jobInfo: azdata.AgentJobInfo): Thenable<azdata.UpdateAgentJobResult> {
		return undefined;
	}
	deleteJob(ownerUri: string, jobInfo: azdata.AgentJobInfo): Thenable<azdata.ResultStatus> {
		return undefined;
	}
	getJobDefaults(ownerUri: string): Thenable<azdata.AgentJobDefaultsResult> {
		return undefined;
	}

	// Job Step management methods
	createJobStep(ownerUri: string, jobInfo: azdata.AgentJobStepInfo): Thenable<azdata.CreateAgentJobStepResult> {
		return undefined;
	}
	updateJobStep(ownerUri: string, originalJobStepName: string, jobInfo: azdata.AgentJobStepInfo): Thenable<azdata.UpdateAgentJobStepResult> {
		return undefined;
	}
	deleteJobStep(ownerUri: string, jobInfo: azdata.AgentJobStepInfo): Thenable<azdata.ResultStatus> {
		return undefined;
	}

	// Alert management methods
	getAlerts(ownerUri: string): Thenable<azdata.AgentAlertsResult> {
		return undefined;
	}
	createAlert(ownerUri: string, alertInfo: azdata.AgentAlertInfo): Thenable<azdata.CreateAgentAlertResult> {
		return undefined;
	}
	updateAlert(ownerUri: string, originalAlertName: string, alertInfo: azdata.AgentAlertInfo): Thenable<azdata.UpdateAgentAlertResult> {
		return undefined;
	}
	deleteAlert(ownerUri: string, alertInfo: azdata.AgentAlertInfo): Thenable<azdata.ResultStatus> {
		return undefined;
	}

	// Operator management methods
	getOperators(ownerUri: string): Thenable<azdata.AgentOperatorsResult> {
		return undefined;
	}
	createOperator(ownerUri: string, operatorInfo: azdata.AgentOperatorInfo): Thenable<azdata.CreateAgentOperatorResult> {
		return undefined;
	}
	updateOperator(ownerUri: string, originalOperatorName: string, operatorInfo: azdata.AgentOperatorInfo): Thenable<azdata.UpdateAgentOperatorResult> {
		return undefined;
	}
	deleteOperator(ownerUri: string, operatorInfo: azdata.AgentOperatorInfo): Thenable<azdata.ResultStatus> {
		return undefined;
	}

	// Proxy management methods
	getProxies(ownerUri: string): Thenable<azdata.AgentProxiesResult> {
		return undefined;
	}
	createProxy(ownerUri: string, proxyInfo: azdata.AgentProxyInfo): Thenable<azdata.CreateAgentOperatorResult> {
		return undefined;
	}
	updateProxy(ownerUri: string, originalProxyName: string, proxyInfo: azdata.AgentProxyInfo): Thenable<azdata.UpdateAgentOperatorResult> {
		return undefined;
	}
	deleteProxy(ownerUri: string, proxyInfo: azdata.AgentProxyInfo): Thenable<azdata.ResultStatus> {
		return undefined;
	}

	// Agent Credential method
	getCredentials(ownerUri: string): Thenable<azdata.GetCredentialsResult> {
		return undefined;
	}

	// Job Schedule management methods
	getJobSchedules(ownerUri: string): Thenable<azdata.AgentJobSchedulesResult> {
		return undefined;
	}
	createJobSchedule(ownerUri: string, scheduleInfo: azdata.AgentJobScheduleInfo): Thenable<azdata.CreateAgentJobScheduleResult> {
		return undefined;
	}
	updateJobSchedule(ownerUri: string, originalScheduleName: string, scheduleInfo: azdata.AgentJobScheduleInfo): Thenable<azdata.UpdateAgentJobScheduleResult> {
		return undefined;
	}
	deleteJobSchedule(ownerUri: string, scheduleInfo: azdata.AgentJobScheduleInfo): Thenable<azdata.ResultStatus> {
		return undefined;
	}

	registerOnUpdated(handler: () => any): void {
	}
}
