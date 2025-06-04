/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';

/**
 * Extends to vscode.TaskDefinition to add task definition properties.
 * This is used to identify the task and provide the file display name, workspace folder and runcode analysis for the task.
 */
interface SqlprojTaskDefinition extends vscode.TaskDefinition {
	fileDisplayName: string;
	runCodeAnalysis?: boolean;
	workspaceFolder?: vscode.WorkspaceFolder;
}

/**
 * This class implements the vscode.TaskProvider interface to provide tasks for SQL database projects.
 * It creates tasks for building SQL database projects and running code analysis on them.
 */
export class SqlDatabaseProjectTaskProvider implements vscode.TaskProvider {
	private watchers: vscode.FileSystemWatcher[] = [];
	private sqlTasks: Thenable<vscode.Task[]> | undefined = undefined;

	/**
	 * Constructor for setting up file system watchers on .sqlproj files within the provided workspace folders.
	 * @param workspaceRoots - An array of workspace folders to watch. If undefined, no watchers are created.
	 * For each workspace folder, this sets up a file system watcher that listens for changes, creations,
	 * or deletions of `.sqlproj` files. When any of these events occur, the `sqlTasks` cache is invalidated.
	 */
	constructor(workspaceRoots: readonly vscode.WorkspaceFolder[] | undefined) {
		if (!workspaceRoots) {
			return;
		}

		for (const root of workspaceRoots) {
			const pattern = path.join(root.uri.fsPath, '**', '*.sqlproj');
			const watcher = vscode.workspace.createFileSystemWatcher(pattern);
			watcher.onDidChange(() => this.sqlTasks = undefined);
			watcher.onDidCreate(() => this.sqlTasks = undefined);
			watcher.onDidDelete(() => this.sqlTasks = undefined);
			this.watchers.push(watcher);
		}
	}

	/**
	 * This method is used to dispose of the file system watcher.
	 * It is called when the task provider is disposed.
	 */
	public dispose() {
		this.watchers?.forEach(watcher => watcher.dispose());
	}

	/**
	 * This method is called when the task provider is registered.
	 * It is used to provide the tasks for the provider.
	 * @returns The task type for this provider
	 */
	public provideTasks(): Thenable<vscode.Task[]> | undefined {
		if (!this.sqlTasks) {
			this.sqlTasks = this.createTasks();
		}
		return this.sqlTasks;
	}

	/*
	 * This method is called when the task is resolved.
	 * It is used to resolve the task and return the task object.
	 */
	public resolveTask(task: vscode.Task): vscode.Task | undefined {
		if (task.definition.type === constants.sqlProjTaskType) {
			const definition = task.definition as vscode.TaskDefinition;
			if (typeof (definition as any).fileDisplayName === 'string') {
				return this.getTask(definition as SqlprojTaskDefinition);
			}
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
		for (const workspaceFolder of workspaceFolders) {
			const folderPath = workspaceFolder.uri.fsPath;
			if (!folderPath) {
				continue;
			}
			const sqlProjPaths = await vscode.workspace.findFiles(new vscode.RelativePattern(folderPath, '**/*.sqlproj'));
			for (const uri of sqlProjPaths) {
				const taskDefinition: SqlprojTaskDefinition = {
					type: constants.sqlProjTaskType,
					fileDisplayName: path.basename(uri.fsPath),
					workspaceFolder: workspaceFolder
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
		// Set the runCodeAnalysis flag in the definition
		definition.runCodeAnalysis = runCodeAnalysis;

		// Construct the shell command
		const shellCommand = runCodeAnalysis
			? `${constants.dotnetBuild} ${constants.runCodeAnalysisParam}`
			: `${constants.dotnetBuild}`;

		// Construct the task name
		const taskName = runCodeAnalysis
			? `${definition.fileDisplayName} - ${constants.buildWithCodeAnalysisTaskName}`
			: `${definition.fileDisplayName} - ${constants.buildTaskName}`;

		// Create and return the task with the build group set in the constructor
		const task = new vscode.Task(
			definition,
			definition.workspaceFolder ?? vscode.TaskScope.Workspace,
			taskName,
			constants.sqlProjTaskType,
			new vscode.ShellExecution(shellCommand),
			constants.problemMatcher
		);
		task.group = vscode.TaskGroup.Build;
		return task;
	}
}
