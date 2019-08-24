/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { promisify } from 'util';
import { AgentUtils } from '../agentUtils';
import { IAgentDialogData, AgentDialogMode } from '../interfaces';

const localize = nls.loadMessageBundle();

export class NotebookData implements IAgentDialogData {

	private readonly NotebookCompletionActionCondition_Always: string = localize('notebookData.whenJobCompletes', 'When the notebook completes');
	private readonly NotebookCompletionActionCondition_OnFailure: string = localize('notebookData.whenJobFails', 'When the notebook fails');
	private readonly NotebookCompletionActionCondition_OnSuccess: string = localize('notebookData.whenJobSucceeds', 'When the notebook succeeds');

	// Error Messages
	private readonly CreateNotebookErrorMessage_NameIsEmpty = localize('notebookData.jobNameRequired', 'Notebook name must be provided');

	private _ownerUri: string;
	private _jobCategories: string[];
	private _operators: string[];
	private _defaultOwner: string;
	private _jobCompletionActionConditions: azdata.CategoryValue[];
	private _jobCategoryIdsMap: azdata.AgentJobCategory[];

	public dialogMode: AgentDialogMode = AgentDialogMode.CREATE;
	public name: string;
	public originalName: string;
	public enabled: boolean = true;
	public description: string;
	public category: string;
	public categoryId: number;
	public owner: string;
	public emailLevel: azdata.JobCompletionActionCondition = azdata.JobCompletionActionCondition.OnFailure;
	public pageLevel: azdata.JobCompletionActionCondition = azdata.JobCompletionActionCondition.OnFailure;
	public eventLogLevel: azdata.JobCompletionActionCondition = azdata.JobCompletionActionCondition.OnFailure;
	public deleteLevel: azdata.JobCompletionActionCondition = azdata.JobCompletionActionCondition.OnSuccess;
	public operatorToEmail: string;
	public operatorToPage: string;
	public jobSteps: azdata.AgentJobStepInfo[];
	public jobSchedules: azdata.AgentJobScheduleInfo[];
	public alerts: azdata.AgentAlertInfo[];
	public jobId: string;
	public startStepId: number;
	public categoryType: number;
	public targetDatabase: string;
	public executeDatabase: string;
	public templateId: number;
	public templatePath: string;
	public static jobLists: azdata.AgentJobInfo[];

	constructor(
		ownerUri: string,
		notebookInfo: azdata.AgentNotebookInfo = undefined,
		private _agentService: azdata.AgentServicesProvider = undefined) {

		this._ownerUri = ownerUri;
		this.enabled = true;
		if (notebookInfo) {
			this.dialogMode = AgentDialogMode.EDIT;
			this.name = notebookInfo.name;
			this.originalName = notebookInfo.name;
			this.owner = notebookInfo.owner;
			this.category = notebookInfo.category;
			this.description = notebookInfo.description;
			this.enabled = notebookInfo.enabled;
			this.jobSteps = notebookInfo.jobSteps;
			this.jobSchedules = notebookInfo.jobSchedules;
			this.alerts = notebookInfo.alerts;
			this.jobId = notebookInfo.jobId;
			this.startStepId = notebookInfo.startStepId;
			this.categoryId = notebookInfo.categoryId;
			this.categoryType = notebookInfo.categoryType;
			this.targetDatabase = notebookInfo.targetDatabase;
			this.executeDatabase = notebookInfo.executeDatabase;
		}
	}

	public get jobCategories(): string[] {
		return this._jobCategories;
	}

	public get jobCategoryIdsMap(): azdata.AgentJobCategory[] {
		return this._jobCategoryIdsMap;
	}

	public get operators(): string[] {
		return this._operators;
	}

	public get ownerUri(): string {
		return this._ownerUri;
	}

	public get defaultOwner(): string {
		return this._defaultOwner;
	}

	public get JobCompletionActionConditions(): azdata.CategoryValue[] {
		return this._jobCompletionActionConditions;
	}

	public async initialize() {
		this._agentService = await AgentUtils.getAgentService();
		let jobDefaults = await this._agentService.getJobDefaults(this.ownerUri);
		if (jobDefaults && jobDefaults.success) {
			this._jobCategories = jobDefaults.categories.map((cat) => {
				return cat.name;
			});
			this._jobCategoryIdsMap = jobDefaults.categories;
			this._defaultOwner = jobDefaults.owner;

			this._operators = ['', this._defaultOwner];
			this.owner = this.owner ? this.owner : this._defaultOwner;
		}

		this._jobCompletionActionConditions = [{
			displayName: this.NotebookCompletionActionCondition_OnSuccess,
			name: azdata.JobCompletionActionCondition.OnSuccess.toString()
		}, {
			displayName: this.NotebookCompletionActionCondition_OnFailure,
			name: azdata.JobCompletionActionCondition.OnFailure.toString()
		}, {
			displayName: this.NotebookCompletionActionCondition_Always,
			name: azdata.JobCompletionActionCondition.Always.toString()
		}];

		this._agentService.getJobs(this.ownerUri).then((value) => {
			NotebookData.jobLists = value.jobs;
		});
	}

	public async save() {
		let notebookInfo: azdata.AgentNotebookInfo = this.toAgentJobInfo();
		let result = this.dialogMode === AgentDialogMode.CREATE
			? await this._agentService.createNotebook(this.ownerUri, notebookInfo, this.templatePath)
			: await this._agentService.updateNotebook(this.ownerUri, this.originalName, notebookInfo, this.templatePath);
		if (!result || !result.success) {
			if (this.dialogMode === AgentDialogMode.EDIT) {
				vscode.window.showErrorMessage(
					localize('notebookData.saveErrorMessage', "Notebook update failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
			} else {
				vscode.window.showErrorMessage(
					localize('notebookData.newJobErrorMessage', "Notebook creation failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
			}
		} else {
			if (this.dialogMode === AgentDialogMode.EDIT) {
				vscode.window.showInformationMessage(
					localize('notebookData.saveSucessMessage', "Notebook '{0}' updated successfully", notebookInfo.name));
			} else {
				vscode.window.showInformationMessage(
					localize('notebookData.newJobSuccessMessage', "Notebook '{0}' created successfully", notebookInfo.name));
			}

		}
	}

	public validate(): { valid: boolean, errorMessages: string[] } {
		let validationErrors: string[] = [];
		if (!(this.name && this.name.trim())) {
			validationErrors.push(this.CreateNotebookErrorMessage_NameIsEmpty);
		}
		if (!(this.templatePath && this.name.trim())) {

			validationErrors.push('Template path cannot be blank');
		}
		if (!fs.existsSync(this.templatePath)) {
			validationErrors.push('Invalid template path');
		}
		if (this.targetDatabase === 'Select Database') {
			validationErrors.push('Select storage database');
		}
		if (this.executeDatabase === 'Select Database') {
			validationErrors.push('Select execution database');
		}
		if (NotebookData.jobLists) {
			for (let i = 0; i < NotebookData.jobLists.length; i++) {
				if (this.name === NotebookData.jobLists[i].name) {
					validationErrors.push('Job with similar name already exists');
					break;
				}
			}
		}
		return {
			valid: validationErrors.length === 0,
			errorMessages: validationErrors
		};
	}

	public toAgentJobInfo(): azdata.AgentNotebookInfo {
		return {
			name: this.name,
			owner: this.owner ? this.owner : this.defaultOwner,
			description: this.description,
			emailLevel: this.emailLevel,
			pageLevel: this.pageLevel,
			eventLogLevel: this.eventLogLevel,
			deleteLevel: this.deleteLevel,
			operatorToEmail: this.operatorToEmail,
			operatorToPage: this.operatorToPage,
			enabled: this.enabled,
			category: this.category,
			alerts: this.alerts,
			jobSchedules: this.jobSchedules,
			jobSteps: this.jobSteps,
			targetDatabase: this.targetDatabase,
			executeDatabase: this.executeDatabase,
			// The properties below are not collected from UI
			// We could consider using a seperate class for create job request
			//
			templateId: this.templateId,
			currentExecutionStatus: 0,
			lastRunOutcome: 0,
			currentExecutionStep: '',
			hasTarget: true,
			hasSchedule: false,
			hasStep: false,
			runnable: true,
			categoryId: this.categoryId,
			categoryType: this.categoryType,
			lastRun: '',
			nextRun: '',
			jobId: this.jobId,
			startStepId: this.startStepId,
			lastRunNotebookError: '',

		};
	}
}
