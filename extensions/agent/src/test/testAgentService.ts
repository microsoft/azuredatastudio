/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as sqlops from 'sqlops';

export class TestAgentService implements sqlops.AgentServicesProvider {
	handle?: number;
	readonly providerId: string = 'Test Provider';

	// Job management methods
	getJobs(ownerUri: string): Thenable<sqlops.AgentJobsResult> {
		return undefined;
	}
	getJobHistory(ownerUri: string, jobId: string, jobName: string): Thenable<sqlops.AgentJobHistoryResult> {
		return undefined;
	}
	jobAction(ownerUri: string, jobName: string, action: string): Thenable<sqlops.ResultStatus> {
		return undefined;
	}
	createJob(ownerUri: string, jobInfo: sqlops.AgentJobInfo): Thenable<sqlops.CreateAgentJobResult> {
		return undefined;
	}
	updateJob(ownerUri: string, originalJobName: string, jobInfo: sqlops.AgentJobInfo): Thenable<sqlops.UpdateAgentJobResult> {
		return undefined;
	}
	deleteJob(ownerUri: string, jobInfo: sqlops.AgentJobInfo): Thenable<sqlops.ResultStatus> {
		return undefined;
	}
	getJobDefaults(ownerUri: string): Thenable<sqlops.AgentJobDefaultsResult> {
		return undefined;
	}

	// Job Step management methods
	createJobStep(ownerUri: string, jobInfo: sqlops.AgentJobStepInfo): Thenable<sqlops.CreateAgentJobStepResult> {
		return undefined;
	}
	updateJobStep(ownerUri: string, originalJobStepName: string, jobInfo: sqlops.AgentJobStepInfo): Thenable<sqlops.UpdateAgentJobStepResult> {
		return undefined;
	}
	deleteJobStep(ownerUri: string, jobInfo: sqlops.AgentJobStepInfo): Thenable<sqlops.ResultStatus> {
		return undefined;
	}

	// Alert management methods
	getAlerts(ownerUri: string): Thenable<sqlops.AgentAlertsResult> {
		return undefined;
	}
	createAlert(ownerUri: string, alertInfo: sqlops.AgentAlertInfo): Thenable<sqlops.CreateAgentAlertResult> {
		return undefined;
	}
	updateAlert(ownerUri: string, originalAlertName: string, alertInfo: sqlops.AgentAlertInfo): Thenable<sqlops.UpdateAgentAlertResult> {
		return undefined;
	}
	deleteAlert(ownerUri: string, alertInfo: sqlops.AgentAlertInfo): Thenable<sqlops.ResultStatus> {
		return undefined;
	}

	// Operator management methods
	getOperators(ownerUri: string): Thenable<sqlops.AgentOperatorsResult> {
		return undefined;
	}
	createOperator(ownerUri: string, operatorInfo: sqlops.AgentOperatorInfo): Thenable<sqlops.CreateAgentOperatorResult> {
		return undefined;
	}
	updateOperator(ownerUri: string, originalOperatorName: string, operatorInfo: sqlops.AgentOperatorInfo): Thenable<sqlops.UpdateAgentOperatorResult> {
		return undefined;
	}
	deleteOperator(ownerUri: string, operatorInfo: sqlops.AgentOperatorInfo): Thenable<sqlops.ResultStatus> {
		return undefined;
	}

	// Proxy management methods
	getProxies(ownerUri: string): Thenable<sqlops.AgentProxiesResult> {
		return undefined;
	}
	createProxy(ownerUri: string, proxyInfo: sqlops.AgentProxyInfo): Thenable<sqlops.CreateAgentOperatorResult> {
		return undefined;
	}
	updateProxy(ownerUri: string, originalProxyName: string, proxyInfo: sqlops.AgentProxyInfo): Thenable<sqlops.UpdateAgentOperatorResult> {
		return undefined;
	}
	deleteProxy(ownerUri: string, proxyInfo: sqlops.AgentProxyInfo): Thenable<sqlops.ResultStatus> {
		return undefined;
	}

	// Agent Credential method
	getCredentials(ownerUri: string): Thenable<sqlops.GetCredentialsResult> {
		return undefined;
	}

	// Job Schedule management methods
	getJobSchedules(ownerUri: string): Thenable<sqlops.AgentJobSchedulesResult> {
		return undefined;
	}
	createJobSchedule(ownerUri: string, scheduleInfo: sqlops.AgentJobScheduleInfo): Thenable<sqlops.CreateAgentJobScheduleResult> {
		return undefined;
	}
	updateJobSchedule(ownerUri: string, originalScheduleName: string, scheduleInfo: sqlops.AgentJobScheduleInfo): Thenable<sqlops.UpdateAgentJobScheduleResult> {
		return undefined;
	}
	deleteJobSchedule(ownerUri: string, scheduleInfo: sqlops.AgentJobScheduleInfo): Thenable<sqlops.ResultStatus> {
		return undefined;
	}

	registerOnUpdated(handler: () => any): void {
	}
}
