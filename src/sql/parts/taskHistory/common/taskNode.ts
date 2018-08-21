/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
'use strict';
import { StopWatch } from 'vs/base/common/stopwatch';
import { generateUuid } from 'vs/base/common/uuid';

export enum TaskStatus {
	NotStarted = 0,
	InProgress = 1,
	Succeeded = 2,
	SucceededWithWarning = 3,
	Failed = 4,
	Canceled = 5,
	Canceling = 6
}

export enum TaskExecutionMode {
	execute = 0,
	script = 1,
	executeAndScript = 2,
}

export class TaskNode {
	/**
	 * id for TaskNode
	 */
	public id: string;

	/**
	 * string defining the type of the task - for example Backup, Restore
	 */
	public taskName: string;

	/**
	 * sever name
	 */
	public serverName: string;

	/**
	 * Database Name
	 */
	public databaseName: string;

	/**
	 * Provider Name
	 */
	public providerName: string;


	/**
	 * The start time of the task
	 */
	public startTime: string;

	/**
	 * The end time of the task
	 */
	public endTime: string;

	/**
	 * The timer for the task
	 */
	public timer: StopWatch;

	/**
	 * Does this node have children
	 */
	public hasChildren: boolean;

	/**
 	 * Children of this node
 	 */
	public children: TaskNode[];

	/**
 	 * Task's message
 	 */
	public message: string;

	/**
	 * Status of the task
	 */
	public status: TaskStatus;

	/**
	 * Execution mode of task
	 */
	public taskExecutionMode: TaskExecutionMode;

	/**
	 * Indicates if the task can be canceled
	 */
	public isCancelable: boolean;

	/**
	 * Script of task operation
	 */
	public script: string;

	constructor(taskName: string, serverName: string, databaseName: string, taskId: string = undefined, taskExecutionMode: TaskExecutionMode = TaskExecutionMode.execute, isCancelable: boolean = true) {
		this.id = taskId || generateUuid();

		this.taskName = taskName;
		this.serverName = serverName;
		this.databaseName = databaseName;
		this.timer = StopWatch.create();
		this.startTime = new Date().toLocaleTimeString();
		this.status = TaskStatus.InProgress;
		this.hasChildren = false;
		this.taskExecutionMode = taskExecutionMode;
		this.isCancelable = isCancelable;
	}
}
