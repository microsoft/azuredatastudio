/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../common/apiWrapper';
import { ConfigurePythonWizard } from '../dialog/configurePython/configurePythonWizard';
import { JupyterServerInstallation } from '../jupyter/jupyterServerInstallation';

describe('Configure Python Wizard', function () {
	let wizard: ConfigurePythonWizard;

	beforeEach(() => {
		let mockInstance = TypeMoq.Mock.ofType(JupyterServerInstallation);
		wizard = new ConfigurePythonWizard(new ApiWrapper(), mockInstance.object);
	});

	it('Start wizard test', async () => {
		let setupComplete = wizard.start();
		await wizard.close();
		await setupComplete;
	});
});
