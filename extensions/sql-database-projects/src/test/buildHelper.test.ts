/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as os from 'os';
import * as vscode from 'vscode';
import * as path from 'path';
import { BuildHelper } from '../tools/buildHelper';

describe('BuildHelper: Build Helper tests', function (): void {

	it('Should get correct build arguments', function (): void {
		// update settings and validate
		const buildHelper = new BuildHelper();
		const resultArg = buildHelper.constructBuildArguments('dummy\\project path\\more space in path', 'dummy\\dll path');

		if (os.platform() === 'win32') {
			should(resultArg).equal(' build "dummy\\\\project path\\\\more space in path" /p:NetCoreBuild=true /p:NETCoreTargetsPath="dummy\\\\dll path"');
		}
		else {
			should(resultArg).equal(' build "dummy/project path/more space in path" /p:NetCoreBuild=true /p:NETCoreTargetsPath="dummy/dll path"');
		}
	});

	it('Should get correct build folder', async function (): Promise<void> {
		const buildHelper = new BuildHelper();
		await buildHelper.createBuildDirFolder();

		// get expected path for build
		let expectedPath = vscode.extensions.getExtension('Microsoft.sql-database-projects')?.extensionPath ?? 'EmptyPath';
		expectedPath = path.join(expectedPath, 'BuildDirectory');
		should(buildHelper.extensionBuildDirPath).equal(expectedPath);
	});
});


