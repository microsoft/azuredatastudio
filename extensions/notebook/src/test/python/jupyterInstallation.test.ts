/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';

describe('Jupyter Server Installation', function () {
	const outputChannelStub = TypeMoq.Mock.ofType<vscode.OutputChannel>();
	outputChannelStub.setup(c => c.show(TypeMoq.It.isAny()));
	outputChannelStub.setup(c => c.appendLine(TypeMoq.It.isAnyString()));

	let installation: JupyterServerInstallation;

	beforeEach(function (): void {
		installation = new JupyterServerInstallation('', outputChannelStub.object);
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Get pip packages', async function() {

	});

	it('Install pip package', async function() {

	});

	it('Get conda packages', async function() {

	});

	it('Install conda package', async function() {
		should(true);
	});
});
