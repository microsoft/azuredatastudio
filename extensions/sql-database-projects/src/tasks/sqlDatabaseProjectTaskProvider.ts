/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import { Project } from '../models/project';
import { ProjectType } from '../common/typeHelper';
import { BuildHelper } from '../tools/buildHelper';


/**
 * Extends to vscode.TaskDefinition to add task definition properties.
 * This is used to identify the task and provide the fileDisplayName, filePath, workspaceFolder and runCodeAnalysis for the task.
 */
interface SqlprojTaskDefinition extends vscode.TaskDefinition {
	fileDisplayName: string;
	filePath: string;
	projectStyle: ProjectType;
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
	private _onDidChangeTasks = new vscode.EventEmitter<void>();
	private workspaceFoldersListener: vscode.Disposable | undefined;
	private buildHelper: BuildHelper;

	/**
	 * Event that fires when the tasks change (e.g., when .sqlproj files are created, modified, or deleted)
	 */
	public readonly onDidChangeTasks: vscode.Event<void> = this._onDidChangeTasks.event;

	/**
	 * Constructor for setting up file system watchers on .sqlproj files within the workspace folders.
	 * For each workspace folder, this sets up a file system watcher that listens for changes, creations,
	 * or deletions of `.sqlproj` files. When any of these events occur, the `sqlTasks` cache is invalidated.
	 */
	constructor() {
		this.buildHelper = new BuildHelper();
		// Watch for workspace folder changes
		this.workspaceFoldersListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
			this.invalidateTasks();
			this.setupWatchers();
		});

		this.setupWatchers();
	}

	/**
	 * Sets up file system watchers for all `.sqlproj` files in the workspace folders.
	 * @returns An event that fires when the tasks change.
	 */
	private setupWatchers() {
		// Dispose existing watchers
		this.watchers.forEach(watcher => watcher.dispose());
		this.watchers = [];

		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			return;
		}

		for (const root of workspaceFolders) {
			const pattern = path.join(root.uri.fsPath, '**', '*.sqlproj');
			const watcher = vscode.workspace.createFileSystemWatcher(pattern);
			watcher.onDidChange(() => this.invalidateTasks());
			watcher.onDidCreate(() => this.invalidateTasks());
			watcher.onDidDelete(() => this.invalidateTasks());
			this.watchers.push(watcher);
		}
	}

	/**
	 * Invalidates the tasks cache, ensuring tasks are rebuilt when needed.
	 */
	private invalidateTasks() {
		this.sqlTasks = undefined;
		this._onDidChangeTasks.fire();
	}

	/**
	 * This method is used to dispose of the file system watcher.
	 * It is called when the task provider is disposed.
	 */
	public dispose() {
		this.watchers?.forEach(watcher => watcher.dispose());
		this.workspaceFoldersListener?.dispose();
		this._onDidChangeTasks.dispose();
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
	 * What we do here is to find all the .sqlproj files in the workspace folders and create a task for each of them.
	 * For each .sqlproj file, we create two tasks: one for building the project and another for building with code analysis.
	 * This way, we can run the build and code analysis tasks directly from the command palette or the task runner.
	 * If there are no workspace folders, it returns an empty array.
	 * This method also ensures that we do not create duplicate tasks for the same .sqlproj file.
	 * @returns A promise that resolves to an array of tasks
	 */
	public async createTasks(): Promise<vscode.Task[]> {
		const tasks: vscode.Task[] = [];
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders === undefined) {
			return tasks; // No workspace folders
		}

		// Keep track of already processed .sqlproj files to avoid duplicates
		const processedFiles = new Set<string>();

		// Get all the .sqlproj files in the workspace folders
		for (const workspaceFolder of workspaceFolders) {
			const folderPath = workspaceFolder.uri.fsPath;
			if (!folderPath) {
				continue;
			}
			const sqlProjPaths = await vscode.workspace.findFiles(new vscode.RelativePattern(folderPath, '**/*.sqlproj'));
			for (const uri of sqlProjPaths) {
				// Skip if we've already processed this file
				if (processedFiles.has(uri.fsPath)) {
					continue;
				}

				// Add the file to the processed set to avoid duplicates
				processedFiles.add(uri.fsPath);

				// Determine project style once
				const project = await Project.openProject(uri.fsPath);

				// Create a task definition for the .sqlproj file
				const taskDefinition: SqlprojTaskDefinition = {
					type: constants.sqlProjTaskType,
					filePath: utils.getNonQuotedPath(uri.fsPath),
					fileDisplayName: path.basename(uri.fsPath),
					workspaceFolder: workspaceFolder,
					projectStyle: project.sqlProjStyle
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

		// Get the build arguments for the task
		const buildArgs: string[] = this.buildHelper.constructBuildArguments(this.buildHelper.extensionBuildDirPath, definition.projectStyle);

		// Construct the task name
		const taskName = runCodeAnalysis
			? `${definition.fileDisplayName} - ${constants.buildWithCodeAnalysisTaskName}`
			: `${definition.fileDisplayName} - ${constants.buildTaskName}`;

		// Build the argument list instead of a single shell command string
		const args: string[] = [
			constants.build,
			definition.filePath, // vscode shell execution handles the quotes around the file path
			...buildArgs
		];

		if (runCodeAnalysis) {
			args.push(constants.runCodeAnalysisParam);
		}

		// Create the ShellExecution with command and args
		const shellExec = new vscode.ShellExecution(constants.dotnet, args, {
			cwd: definition.workspaceFolder?.uri.fsPath
		});

		// Create and return the task
		const task = new vscode.Task(
			definition,
			definition.workspaceFolder ?? vscode.TaskScope.Workspace,
			taskName,
			constants.sqlProjTaskType,
			shellExec,
			constants.problemMatcher
		);
		task.group = vscode.TaskGroup.Build;
		return task;
	}
}
