/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class SqlDatabaseProjectTasksProvider implements vscode.TaskProvider {

	public provideTasks(cancellationToken?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
		const execution = new vscode.ShellExecution('echo \"Hello World\"');
		const problemMatchers = ['$myProblemMatcher'];
		return [
			new vscode.Task({ type: 'sqlDatabaseProjects.taskProvider' }, vscode.TaskScope.Workspace,
				'Build', 'Database Projects', execution, problemMatchers)
		];
	}

	public resolveTask(task: vscode.Task, cancellationToken?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> {
		return task;
	}
}
