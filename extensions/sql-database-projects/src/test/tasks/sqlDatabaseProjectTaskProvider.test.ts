/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as should from 'should';
import * as path from 'path';
import { SqlDatabaseProjectTaskProvider } from '../../tasks/sqlDatabaseProjectTaskProvider';

describe('Sql Database Projects Task Provider', function (): void {
	let sandbox: sinon.SinonSandbox;
	let taskProvider: SqlDatabaseProjectTaskProvider;

	// Define a mock workspace folder for testing
	const workspaceFolder: vscode.WorkspaceFolder = {
		uri: vscode.Uri.file('/SqlProjFolder'),
		name: 'SqlProjFolder',
		index: 0
	};

	// Define mock .sqlproj file URIs for testing
	const sqlProjUris = [
		vscode.Uri.file('/SqlProjFolder/ProjectA/ProjectA.sqlproj'),
		vscode.Uri.file('/SqlProjFolder/ProjectB/ProjectB.sqlproj'),
		vscode.Uri.file('/SqlProjFolder/ProjectC/ProjectC.sqlproj')
	];

	// Helper to stub VS Code workspace APIs for consistent test environment
	function stubWorkspaceAndFiles(sqlProjUri: vscode.Uri[]) {
		sandbox.stub(vscode.workspace, 'workspaceFolders').value([workspaceFolder]);
		sandbox.stub(vscode.workspace, 'findFiles').resolves(sqlProjUri);
	}

	beforeEach(() => {
		// Create a new Sinon sandbox before each test
		sandbox = sinon.createSandbox();
		// Instantiate the task provider with the mock workspace folder
		taskProvider = new SqlDatabaseProjectTaskProvider([workspaceFolder]);
	});

	afterEach(() => {
		// Restore the Sinon sandbox and any stubs after each test
		sandbox.restore();
	});

	it('Should create build and buildWithCodeAnalysis tasks for .sqlproj file with correct properties', async function (): Promise<void> {
		// Define mock .sqlproj file URIs for testing
		stubWorkspaceAndFiles([sqlProjUris[0]]);

		// Act: create tasks using the provider
		const tasks = await taskProvider.createTasks();

		// Assert: tasks should be defined and have the expected length
		should(tasks).not.be.undefined();
		should(tasks).be.Array().and.have.length(2);

		// Find the build and buildWithCodeAnalysis tasks by name
		const buildTask = tasks.find(t => t.name === 'ProjectA.sqlproj - Build');
		const buildWithCodeAnalysisTask = tasks.find(t => t.name === 'ProjectA.sqlproj - Build with Code Analysis');

		// Assert: both tasks should exist
		should(buildTask).not.be.undefined();
		should(buildWithCodeAnalysisTask).not.be.undefined();

		// Assert: task names should contain expected substrings
		should(buildTask?.name).containEql('Build');
		should(buildWithCodeAnalysisTask?.name).containEql('Build with Code Analysis');

		// Assert: task definitions should have the correct type
		should(buildTask?.definition.type).equal('sqlproj-build');
		should(buildWithCodeAnalysisTask?.definition.type).equal('sqlproj-build');

		// Assert: problemMatchers should be arrays and contain the expected matcher
		should(buildTask?.problemMatchers).be.Array();
		should(buildWithCodeAnalysisTask?.problemMatchers).be.Array();
		should(buildTask?.problemMatchers).containEql('$sqlproj-problem-matcher');
		should(buildWithCodeAnalysisTask?.problemMatchers).containEql('$sqlproj-problem-matcher');

		// Assert: build task should have a group with label 'Build'
		should(buildTask?.group).not.be.undefined();
		should(buildTask?.group).have.property('label', 'Build');

		// Assert: build task execution should be defined and use 'dotnet build'
		should(buildTask?.execution).not.be.undefined();
		if (buildTask?.execution instanceof vscode.ShellExecution) {
			should(buildTask.execution.commandLine).containEql('dotnet build');
		}
	});

	it('Should not create any tasks when no .sqlproj files are present in the workspace', async function (): Promise<void> {
		// Define mock .sqlproj file URIs for testing
		stubWorkspaceAndFiles([]);

		// Act: Attempt to create tasks using the provider
		const tasks = await taskProvider.createTasks();

		// Assert: tasks should be defined but empty
		should(tasks).not.be.undefined();
		should(tasks).be.Array().and.have.length(0);
	});

	it('Should create build and buildWithCodeAnalysis tasks for multiple .sqlproj files with correct properties', async function (): Promise<void> {
		// Define mock .sqlproj file URIs for testing
		stubWorkspaceAndFiles(sqlProjUris);

		// Act: create tasks using the provider
		const tasks = await taskProvider.createTasks();

		// Assert: tasks should be defined and have the expected length (2 per project)
		should(tasks).not.be.undefined();
		should(tasks).be.Array().and.have.length(sqlProjUris.length * 2);

		for (const uri of sqlProjUris) {
			const projectName = path.basename(uri.fsPath);
			const buildTask = tasks.find(t => t.name === `${projectName} - Build`);
			const buildWithCodeAnalysisTask = tasks.find(t => t.name === `${projectName} - Build with Code Analysis`);

			// Assert: both tasks should exist
			should(buildTask).not.be.undefined();
			should(buildWithCodeAnalysisTask).not.be.undefined();

			// Assert: task names should contain expected substrings
			should(buildTask?.name).containEql('Build');
			should(buildWithCodeAnalysisTask?.name).containEql('Build with Code Analysis');

			// Assert: task definitions should have the correct type
			should(buildTask?.definition.type).equal('sqlproj-build');
			should(buildWithCodeAnalysisTask?.definition.type).equal('sqlproj-build');

			// Assert: problemMatchers should be arrays and contain the expected matcher
			should(buildTask?.problemMatchers).be.Array();
			should(buildWithCodeAnalysisTask?.problemMatchers).be.Array();
			should(buildTask?.problemMatchers).containEql('$sqlproj-problem-matcher');
			should(buildWithCodeAnalysisTask?.problemMatchers).containEql('$sqlproj-problem-matcher');

			// Assert: build task should have a group with label 'Build'
			should(buildTask?.group).not.be.undefined();
			should(buildTask?.group).have.property('label', 'Build');

			// Assert: build task execution should be defined and use 'dotnet build'
			should(buildTask?.execution).not.be.undefined();
			if (buildTask?.execution instanceof vscode.ShellExecution) {
				should(buildTask.execution.commandLine).containEql('dotnet build');
			}
		}
	});


});
