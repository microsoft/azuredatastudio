/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as should from 'should';
import { DataWorkspaceExtension } from '../dataWorkspaceExtension';
import { createProjectProvider } from './projectProviderRegistry.test';
import { ProjectProviderRegistry } from '../common/projectProviderRegistry';

suite('DataWorkspaceExtension Tests', function (): void {
	test('register and unregister project provider through the extension api', async () => {
		const extension = new DataWorkspaceExtension();
		const provider = createProjectProvider([
			{
				projectFileExtension: 'testproj',
				icon: '',
				displayName: 'test project'
			}
		]);
		const disposable = extension.registerProjectProvider(provider);
		should.strictEqual(ProjectProviderRegistry.providers.length, 1, 'project provider should have been registered');
		disposable.dispose();
		should.strictEqual(ProjectProviderRegistry.providers.length, 0, 'there should be nothing in the ProjectProviderRegistry');
	});
});
