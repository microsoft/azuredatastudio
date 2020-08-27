/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ProjectsController } from './projectController';
import { Project } from '../models/project';

interface SqlProjTaskDefinition extends vscode.TaskDefinition {
	/**
	 * The task name
	 */
	task: string;

	/**
	 * The project file name
	 */
	projectFileName: string;
}

export class SqlDatabaseProjectTasksProvider implements vscode.TaskProvider {

	static SqlProjType: string = 'sqlproj';

	constructor(
		private projectsController: ProjectsController
	) {

	}

	public provideTasks(cancellationToken?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
		let tasks: vscode.Task[] = [];
		for (const project of this.projectsController.projects) {
			const type: SqlProjTaskDefinition = {
				type: SqlDatabaseProjectTasksProvider.SqlProjType,
				task: 'Build',
				projectFileName: project.projectFileName
			};

			const execution: vscode.ShellExecution = new vscode.ShellExecution(`echo ${project.projectFileName}`);
			const task = new vscode.Task(type, vscode.TaskScope.Workspace,
				`Build ${project.projectFileName}`, 'SQL Database Projects', execution);
			task.group = vscode.TaskGroup.Build;
			tasks.push(task);
		}
		return tasks;
	}

	public resolveTask(task: vscode.Task, cancellationToken?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> {
		// const databaseProjectTask = task.definition.task;
		// if (task) {
		// 	const definition: SqlProjTaskDefinition = <any>task.definition;
		// 	return new vscode.Task(definition, definition.task, 'sqlproj', new vscode.ShellExecution(`echo 'test'`));
		// } else {
		// 	return undefined;
		// }
		return task;
	}
}

class SqlDatabaseProjectBuildTask extends vscode.Task {

	static readonly taskType: string = 'Build';
	private projectsController: ProjectsController;

	constructor(
		projectsController: ProjectsController,
		projectFileName: string
	) {
		const type: SqlProjTaskDefinition = {
			type: SqlDatabaseProjectTasksProvider.SqlProjType,
			task: SqlDatabaseProjectBuildTask.taskType,
			projectFileName: projectFileName
		};
		super(type, vscode.TaskScope.Workspace, `${SqlDatabaseProjectBuildTask.taskType}: ${projectFileName}`,
			'SQL Database Projects');
		this.projectsController = projectsController;
		this.group = vscode.TaskGroup.Build;
		const project = this.projectsController.projectMap.get(projectFileName);
	}
}
