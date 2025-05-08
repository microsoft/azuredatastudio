/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';

/**
 * Extends to vscode.TaskDefinition to add the filePath and fileDisplayName properties.
 * This is used to identify the task and provide the file path and display name for the task.
 */
interface SqlprojTaskDefinition extends vscode.TaskDefinition {
	filePath: string;
	fileDisplayName: string;
	runCodeAnalysis?: boolean;
}

/**
 * This class implements the vscode.TaskProvider interface to provide tasks for SQL database projects.
 * It creates tasks for building SQL database projects and running code analysis on them.
 */
export class SqlDatabaseProjectsTaskProvider implements vscode.TaskProvider {
	static SqlDatabaseProjectType = 'sqlproj-build';
	private sqlTasks: Thenable<vscode.Task[]> | undefined = undefined;
	static SqlprojProblemMatcher: string = "$sqlproj-problem-matcher";

	/**
	 * This method is called when the task provider is registered.
	 * It is used to create the tasks for the provider.
	 * @returns The task type for this provider
	 */
	public provideTasks(): Thenable<vscode.Task[]> | undefined {
		this.sqlTasks = this.createTasks();
		return this.sqlTasks;
	}

	/*
	 * This method is called when the task is resolved.
	 * It is used to resolve the task and return the task object.
	 */
	public resolveTask(task: vscode.Task): vscode.Task | undefined {
		if (task.definition.type === SqlDatabaseProjectsTaskProvider.SqlDatabaseProjectType) {
			const definition: SqlprojTaskDefinition = <any>task.definition
			if (!definition.filePath || !definition.fileDisplayName) {
				return undefined;
			}
			return this.getTask(definition);
		}
		return undefined;
	}

	/**
	 * This method is used to create the tasks for the provider.
	 * @returns A promise that resolves to an array of tasks
	 */
	public async createTasks(): Promise<vscode.Task[]> {
		const tasks: vscode.Task[] = [];
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders === undefined) {
			return tasks; // No workspace folders
		}

		// Get all the .sqlproj files in the workspace folders
		let sqlProjUris: vscode.Uri[] = [];
		for (const workspaceFolder of workspaceFolders) {
			const folderPath = workspaceFolder.uri.fsPath;
			if (!folderPath) {
				continue;
			}
			const sqlProjPaths = await vscode.workspace.findFiles(new vscode.RelativePattern(folderPath, '**/*.sqlproj'));
			sqlProjPaths.map(uri => sqlProjUris.push(uri));
		}

		if (sqlProjUris.length !== 0) {
			for (const sqlProjUri of sqlProjUris) {
				const taskDefinition: SqlprojTaskDefinition = {
					type: SqlDatabaseProjectsTaskProvider.SqlDatabaseProjectType,
					filePath: sqlProjUri.fsPath,
					fileDisplayName: path.basename(sqlProjUri.fsPath),
				};

				// Create a Build task
				let task = this.getTask(taskDefinition);
				tasks.push(task);

				// Create a Build with Code Analysis task
				task = this.getTask(taskDefinition, true);
				tasks.push(task);
			}
		}
		return tasks;
	}

	/**
	 * This method is used to create the task for the provider. Here we create a build task for the sqlproj file using the vscode.Task.
	 * Alternatively we can get the same info from tasks.json file, but the existing projects might not have the tasks.json file.
	 * @param definition The task definition
	 * @param runCodeAnalysis Whether to run code analysis or not
	 * @returns The task object
	 */
	public getTask(definition: SqlprojTaskDefinition, runCodeAnalysis: boolean = false): vscode.Task {
		// unless runCodeAnalysis is false, run code analysis with /p:RunSqlCodeAnalysis=true on end of the command
		definition.runCodeAnalysis = runCodeAnalysis;
		const shellExecutable = runCodeAnalysis ? `${constants.dotnetBuild} ${definition.filePath} ${constants.runCodeAnalysisParam}` : `${constants.dotnetBuild} ${definition.filePath}`;
		const taskName = runCodeAnalysis ? `${definition.fileDisplayName} - ${constants.buildWithCodeAnalysisTaskName}`
			: `${definition.fileDisplayName}  - ${constants.BuildTaskName}`;

		// Create a new task with the definition and shell executable
		const task = new vscode.Task(
			definition,
			vscode.TaskScope.Workspace,
			taskName,
			SqlDatabaseProjectsTaskProvider.SqlDatabaseProjectType,
			new vscode.ShellExecution(shellExecutable),
			SqlDatabaseProjectsTaskProvider.SqlprojProblemMatcher
		);
		task.group = vscode.TaskGroup.Build;
		return task;
	}
}