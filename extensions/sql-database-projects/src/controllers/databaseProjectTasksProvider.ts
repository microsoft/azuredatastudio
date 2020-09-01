/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { ProjectsController } from './projectController';
import { dotnet } from '../tools/netcoreTool';
import { BuildHelper } from '../tools/buildHelper';

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

	public provideTasks(): vscode.ProviderResult<vscode.Task[]> {
		let tasks: vscode.Task[] = [];
		for (const project of this.projectsController.projects) {
			tasks.push(new SqlDatabaseProjectBuildTask(this.projectsController, project.projectFileName));
		}
		return tasks;
	}

	public resolveTask(task: vscode.Task): vscode.ProviderResult<vscode.Task> {
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
			SqlDatabaseProjectTasksProvider.SqlProjType);
		this.group = vscode.TaskGroup.Build;
		this.presentationOptions.reveal = vscode.TaskRevealKind.Always;

		this.projectsController = projectsController;
		let buildHelper: BuildHelper = this.projectsController.buildHelper;
		const project = this.projectsController.projectMap.get(projectFileName);
		if (project) {
			const argument: string = buildHelper.constructBuildArguments(project.projectFilePath,
				buildHelper.extensionBuildDirPath);
			this.execution = new vscode.ShellExecution(argument, {
				cwd: project.projectFolderPath,
				executable: dotnet
			});
		}
	}
}
