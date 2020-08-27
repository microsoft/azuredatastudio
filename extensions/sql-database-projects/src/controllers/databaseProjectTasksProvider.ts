/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as vscode from 'vscode';
import { ProjectsController } from './projectController';
import * as utils from '../common/utils';
import { DotNetCommandOptions, dotnet } from '../tools/netcoreTool';

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
			tasks.push(new SqlDatabaseProjectBuildTask(this.projectsController, project.projectFileName));
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
		this.group = vscode.TaskGroup.Build;

		this.projectsController = projectsController;
		let buildHelper = this.projectsController.buildHelper;
		let netCoreTool = this.projectsController.netCoreTool;
		const project = this.projectsController.projectMap.get(projectFileName);
		if (project) {
			const options: DotNetCommandOptions = {
				commandTitle: 'Build',
				workingDirectory: project.projectFolderPath,
				argument: buildHelper.constructBuildArguments(project.projectFilePath,
					buildHelper.extensionBuildDirPath)
			};
			const dotnetPath = utils.getQuotedPath(path.join(netCoreTool.netcoreInstallLocation, dotnet));
			const command = path.join(netCoreTool.netcoreInstallLocation, dotnet) + ' ' + options.argument;
			this.execution = new vscode.ShellExecution(command);
		}
	}
}
