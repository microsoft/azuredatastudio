/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

interface SqlprojTaskDefinition extends vscode.TaskDefinition {
	filePath: string;
	fileDisplayName: string;
	runCodeAnalysis?: boolean;
}

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
	private async createTasks(): Promise<vscode.Task[]> {
		const tasks: vscode.Task[] = [];
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders === undefined) {
			return tasks; // No workspace folders
		}

		// Get all the .sqlproj files in the workspace folders
		let sqlprojFiles: string[] = []
		for (const workspaceFolder of workspaceFolders) {
			const folderString = workspaceFolder.uri.fsPath;
			if (!folderString) {
				continue;
			}
			const sqlProjFile = await vscode.workspace.findFiles(new vscode.RelativePattern(folderString, '**/*.sqlproj'));
			sqlProjFile.map(uri => sqlprojFiles.push(uri.fsPath));
		}

		if (sqlprojFiles.length === 0) {
			return tasks; // No .sqlproj files found
		}

		// Create tasks for each .sqlproj file
		// We create two tasks for each .sqlproj file, one for build and one for build with code analysis
		sqlprojFiles.forEach(sqlprojFile => {
			const taskDefinition: SqlprojTaskDefinition = {
				type: SqlDatabaseProjectsTaskProvider.SqlDatabaseProjectType,
				filePath: sqlprojFile,
				fileDisplayName: path.basename(sqlprojFile)
			};

			// Create a Build task
			const buildTask = this.getTask(taskDefinition);
			tasks.push(buildTask);

			// Create a Build with code analysis task
			const buildWithCodeAnalysisTask = this.getTask(taskDefinition, true);
			tasks.push(buildWithCodeAnalysisTask);
		});

		return tasks;
	}

	/**
	 * This method is used to create the task for the provider.
	 * Here we create a build task for the sqlproj file using the vscode.Task, alternatively we can get the same info from tasks.json file.
	 * @param definition The task definition
	 * @param runCodeAnalysis Whether to run code analysis or not
	 * @returns The task object
	 */
	private getTask(definition: SqlprojTaskDefinition, runCodeAnalysis: boolean = false): vscode.Task {
		// unless runCodeAnalysis is false, run code analysis with /p:RunSqlCodeAnalysis=true on end of the command
		definition.runCodeAnalysis = runCodeAnalysis;
		const shellExecutable = runCodeAnalysis ? `dotnet build ${definition.filePath} /p:RunSqlCodeAnalysis=true` : `dotnet build ${definition.filePath}`;
		const taskName = runCodeAnalysis ? `${definition.fileDisplayName} - Build with Code Analysis` : `${definition.fileDisplayName} - Build`;

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