/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as should from 'should';
import { SqlDatabaseProjectTaskProvider } from '../../tasks/SqlDatabaseProjectTaskProvider';
import * as path from 'path';

describe('Sql Database Projects Task Provider', function (): void {
	let sandbox: sinon.SinonSandbox;
	let taskProvider: SqlDatabaseProjectTaskProvider;
	const workspaceFolder: vscode.WorkspaceFolder = {
		uri: vscode.Uri.file('/SqlProjFolder'),
		name: 'SqlProjFolder',
		index: 0
	};
	const sqlProjUri = vscode.Uri.file('/SqlProjFolder/MyProject/MyProject.sqlproj');

	// Helper to stub workspace and findFiles
	function stubWorkspaceAndFiles() {
		sandbox.stub(vscode.workspace, 'workspaceFolders').value([workspaceFolder]);
		sandbox.stub(vscode.workspace, 'findFiles').resolves([sqlProjUri]);
	}

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		taskProvider = new SqlDatabaseProjectTaskProvider([workspaceFolder]);
	});

	afterEach(() => {
		sandbox.restore();
		sinon.restore();
	});

	it('Should create build and buildWithCodeAnalysis tasks for .sqlproj files with correct properties', async function (): Promise<void> {
		stubWorkspaceAndFiles();

		const tasks = await taskProvider.createTasks();

		should(tasks).be.Array().and.have.length(2);

		const buildTask = tasks.find(t => t.name === 'Build');
		const buildWithCodeAnalysisTask = tasks.find(t => t.name === 'Build with Code Analysis');

		// Existence
		should(buildTask).not.be.undefined();
		should(buildWithCodeAnalysisTask).not.be.undefined();

		// File path (normalized, case-insensitive)
		should(path.normalize(buildTask?.definition.filePath).toLowerCase()).equal(path.normalize(sqlProjUri.fsPath).toLowerCase());
		should(path.normalize(buildWithCodeAnalysisTask?.definition.filePath).toLowerCase()).equal(path.normalize(sqlProjUri.fsPath).toLowerCase());

		// Name
		should(buildTask?.name).equal('Build');
		should(buildWithCodeAnalysisTask?.name).equal('Build with Code Analysis');

		// Task type
		should(buildTask?.definition.type).equal('sqlproj-build');
		should(buildWithCodeAnalysisTask?.definition.type).equal('sqlproj-build');

		// Problem matcher
		should(buildTask?.problemMatchers).be.Array();
		should(buildWithCodeAnalysisTask?.problemMatchers).be.Array();
		should(buildTask?.problemMatchers).containEql('$sqlproj-problem-matcher');
		should(buildWithCodeAnalysisTask?.problemMatchers).containEql('$sqlproj-problem-matcher');

		// Group
		should(buildTask?.group).not.be.undefined();
		should(buildTask?.group).have.property('kind', 'build');
		// Optionally check isDefault if your template sets it
		// should(buildTask?.group).have.property('isDefault', true);

		// Command
		should(buildTask?.execution).not.be.undefined();
		if (buildTask?.execution && (buildTask.execution as vscode.ShellExecution).commandLine) {
			should((buildTask.execution as vscode.ShellExecution).commandLine).containEql('dotnet build');
		}

		// Detail property
		should(buildTask?.detail).be.a.String();
		should(buildTask?.detail).containEql('Builds the SQL project');
	});

	it('Should not set a problemMatcher if none is specified', async function (): Promise<void> {
		stubWorkspaceAndFiles();

		// Simulate a provider that does not set a problemMatcher
		const customTaskProvider = new SqlDatabaseProjectTaskProvider([workspaceFolder]);
		sandbox.stub(customTaskProvider as any, 'getProblemMatcher').returns(undefined);

		const tasks = await customTaskProvider.createTasks();

		// All tasks should have an empty problemMatchers array
		for (const task of tasks) {
			should(task.problemMatchers).be.Array();
			should(task.problemMatchers.length).equal(0);
		}
	});
});
