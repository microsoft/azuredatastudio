/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as os from 'os';
import * as vscode from 'vscode';
import * as path from 'path';
import { BuildHelper } from '../tools/buildHelper';
import { TestContext, createContext } from './testContext';
import { ProjectType } from 'mssql';

describe('BuildHelper: Build Helper tests', function (): void {

	it('Should get correct build arguments for legacy-style projects', function (): void {
		// update settings and validate
		const buildHelper = new BuildHelper();
		const resultArg = buildHelper.constructBuildArguments('dummy\\project path\\more space in path', 'dummy\\dll path', ProjectType.LegacyStyle);

		if (os.platform() === 'win32') {
			should(resultArg).equal(' build "dummy\\\\project path\\\\more space in path" /p:NetCoreBuild=true /p:NETCoreTargetsPath="dummy\\\\dll path"');
		}
		else {
			should(resultArg).equal(' build "dummy/project path/more space in path" /p:NetCoreBuild=true /p:NETCoreTargetsPath="dummy/dll path"');
		}
	});

	it('Should get correct build arguments for SDK-style projects', function (): void {
		// update settings and validate
		const buildHelper = new BuildHelper();
		const resultArg = buildHelper.constructBuildArguments('dummy\\project path\\more space in path', 'dummy\\dll path', ProjectType.SdkStyle);

		if (os.platform() === 'win32') {
			should(resultArg).equal(' build "dummy\\\\project path\\\\more space in path" /p:NetCoreBuild=true /p:SystemDacpacsLocation="dummy\\\\dll path"');
		}
		else {
			should(resultArg).equal(' build "dummy/project path/more space in path" /p:NetCoreBuild=true /p:SystemDacpacsLocation="dummy/dll path"');
		}
	});

	it('Should get correct build folder', async function (): Promise<void> {
		const testContext: TestContext = createContext();
		const buildHelper = new BuildHelper();
		await buildHelper.createBuildDirFolder(testContext.outputChannel);

		// get expected path for build
		let expectedPath = vscode.extensions.getExtension('Microsoft.sql-database-projects')?.extensionPath ?? 'EmptyPath';
		expectedPath = path.join(expectedPath, 'BuildDirectory');
		should(buildHelper.extensionBuildDirPath).equal(expectedPath);
	});
});

