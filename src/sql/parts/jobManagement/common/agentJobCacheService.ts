/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Injectable } from '@angular/core';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { IAgentJobCacheService } from './interfaces';

@Injectable()
export class AgentJobCacheService implements IAgentJobCacheService {
	_serviceBrand: any;
	private _jobs: sqlops.AgentJobInfo[];
	private _jobHistories: { [jobId: string]: sqlops.AgentJobHistoryInfo[]; } = {};
	private _prevJobID: string;

		/* Getters */
		public get jobs(): sqlops.AgentJobInfo[] {
			return this._jobs;
		}

		public get jobHistories(): { [jobId: string]: sqlops.AgentJobHistoryInfo[] } {
			return this._jobHistories;
		}

		public get prevJobID(): string {
			return this._prevJobID;
		}

		public getJobHistory(jobID: string): sqlops.AgentJobHistoryInfo[] {
			return this._jobHistories[jobID];
		}

		/* Setters */
		public set jobs(value: sqlops.AgentJobInfo[]) {
			this._jobs = value;
		}

		public set jobHistories(value: { [jobId: string]: sqlops.AgentJobHistoryInfo[]; }) {
			this._jobHistories = value;
		}

		public set prevJobID(value: string) {
			this._prevJobID = value;
		}

		public setJobHistory(jobID:string, value: sqlops.AgentJobHistoryInfo[]) {
			this._jobHistories[jobID] = value;
		}

}
