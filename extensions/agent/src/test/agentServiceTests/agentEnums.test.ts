/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as should from 'should';
import { AgentSubSystem } from 'azdata';
import { JobStepDialog } from '../../dialogs/jobStepDialog';
import { JobStepData } from '../../data/jobStepData';

const subSytems: AgentSubSystem[] = [AgentSubSystem.TransactSql, AgentSubSystem.PowerShell,
	AgentSubSystem.CmdExec, AgentSubSystem.Distribution, AgentSubSystem.Merge,
	AgentSubSystem.QueueReader, AgentSubSystem.Snapshot, AgentSubSystem.LogReader, AgentSubSystem.AnalysisCommands,
	AgentSubSystem.AnalysisQuery, AgentSubSystem.Ssis];

const subSystemDisplayNames: string[] = [JobStepDialog.TSQLScript, JobStepDialog.Powershell,
	JobStepDialog.CmdExec, JobStepDialog.ReplicationDistributor, JobStepDialog.ReplicationMerge,
	JobStepDialog.ReplicationQueueReader, JobStepDialog.ReplicationSnapshot, JobStepDialog.ReplicationTransactionLogReader,
	JobStepDialog.AnalysisServicesCommand, JobStepDialog.AnalysisServicesQuery, JobStepDialog.ServicesPackage];

describe('Agent extension enum mapping sanity test', function (): void {
	it('SubSystem to Display Name Mapping test', () => {
		for (let i = 0; i < subSytems.length; i++) {
			let subSystem = subSytems[i];
			let convertedSubSystemName = JobStepData.convertToSubSystemDisplayName(subSystem);
			should.equal(convertedSubSystemName, subSystemDisplayNames[i]);
		}
	});

	it('SubSystem Display Name to SubSystem Mapping test', () => {
		for (let i = 0; i < subSystemDisplayNames.length; i++) {
			let subSystemDisplayName = subSystemDisplayNames[i];
			let convertedSubSystem = JobStepData.convertToAgentSubSystem(subSystemDisplayName);
			should.equal(convertedSubSystem, subSytems[i]);
		}
	});
});
