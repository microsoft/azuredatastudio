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
	 * The assoiated database project for a task
	 */
	project: Project;
}

export class SqlDatabaseProjectQuickPickItem implements vscode.QuickPickItem {

	public label: string;
	public project: Project;

	constructor(
		label: string,
		project: Project
	) {
		this.label = label;
		this.project = project;
	}
}

export class SqlDatabaseProjectTasksProvider implements vscode.TaskProvider {

	projects: Project[];
	projectItems: SqlDatabaseProjectQuickPickItem[];

	constructor(
		private projectsController: ProjectsController
	) {
		this.projects = this.projectsController.projects;
		this.projectItems = this.projects.map(p =>
			new SqlDatabaseProjectQuickPickItem(p.projectFileName, p));
	}

	public provideTasks(cancellationToken?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
		vscode.window.showQuickPick(this.projectItems).then((projectItem) => {
			if (projectItem instanceof SqlDatabaseProjectQuickPickItem) {
				const type: SqlProjTaskDefinition = {
					type: 'sqlproj',
					task: 'Build',
					project: projectItem.project
				};
				const problemMatcher = ['$sqlproj'];
				const execution: vscode.ShellExecution = new vscode.ShellExecution(`echo '${projectItem.project.projectFileName}'`);
				return [
					new vscode.Task(type, vscode.TaskScope.Workspace,
						'Build', 'Database Projects', execution, problemMatcher)
				];
			} else {
				return undefined;
			}
		});
		return undefined;
	}

	public resolveTask(task: vscode.Task, cancellationToken?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> {
		const databaseProjectTask = task.definition.task;
		if (task) {
			const definition: SqlProjTaskDefinition = <any>task.definition;
			return new vscode.Task(definition, definition.task, 'sqlproj', new vscode.ShellExecution(`echo "test`));
		} else {
			return undefined;
		}
	}
}
