/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as should from 'should';
import { SqlDatabaseProjectsTaskProvider } from '../../tasks/SqlDatabaseProjectsTaskProvider';

describe('Sql Database Projects Task Provider', function (): void {
	let sandbox: sinon.SinonSandbox;
	let taskProvider: SqlDatabaseProjectsTaskProvider;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		taskProvider = new SqlDatabaseProjectsTaskProvider();
	});

	afterEach(() => {
		sandbox.restore();
		sinon.restore();
	});

	it('Should create build and buildWithCodeAnalysis tasks for .sqlproj files', async function (): Promise<void> {
		const workspaceFolder: vscode.WorkspaceFolder = {
			uri: vscode.Uri.file('/SqlProjfolder'),
			name: 'SqlProjfolder',
			index: 0
		};

		const sqlProjUri = vscode.Uri.file('/SqlProjfolder/MyProject/MyProject.sqlproj');

		sandbox.stub(vscode.workspace, 'workspaceFolders').value([workspaceFolder]);
		sandbox.stub(vscode.workspace, 'findFiles').resolves([sqlProjUri]);

		const tasks = await taskProvider.createTasks();

		should(tasks).be.Array().and.have.length(2);

		const buildTask = tasks.find(t => t.name.includes('Build') && !t.name.includes('Code Analysis'));
		const buildWithCodeAnalysisTask = tasks.find(t => t.name.includes('Build with Code Analysis'));

		should(buildTask).not.be.undefined();
		should(buildWithCodeAnalysisTask).not.be.undefined();

		should(buildTask?.definition.filePath).equal(sqlProjUri.fsPath);
		should(buildWithCodeAnalysisTask?.definition.filePath).equal(sqlProjUri.fsPath);

		should(buildTask?.name).containEql('Build');
		should(buildWithCodeAnalysisTask?.name).containEql('Build with Code Analysis');
	});
});
