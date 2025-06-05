/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
		const resultArgs = buildHelper.constructBuildArguments('dummy\\dll path', ProjectType.LegacyStyle);

		// Check that it returns an array
		should(resultArgs).be.Array();
		should(resultArgs.length).equal(4); // 4 arguments for legacy projects

		// Check individual arguments
		should(resultArgs[0]).equal('/p:NetCoreBuild=true');

		if (os.platform() === 'win32') {
			should(resultArgs[1]).equal('/p:SystemDacpacsLocation="dummy\\\\dll path"');
			should(resultArgs[2]).equal('/p:NETCoreTargetsPath="dummy\\\\dll path"');
		} else {
			should(resultArgs[1]).equal('/p:SystemDacpacsLocation="dummy/dll path"');
			should(resultArgs[2]).equal('/p:NETCoreTargetsPath="dummy/dll path"');
		}

		should(resultArgs[3]).equal('-v:detailed');
	});

	it('Should get correct build arguments for SDK-style projects', function (): void {
		// update settings and validate
		const buildHelper = new BuildHelper();
		const resultArgs = buildHelper.constructBuildArguments('dummy\\dll path', ProjectType.SdkStyle);

		// Check that it returns an array
		should(resultArgs).be.Array();
		should(resultArgs.length).equal(3); // 3 arguments for SDK projects (no NETCoreTargetsPath)

		// Check individual arguments
		should(resultArgs[0]).equal('/p:NetCoreBuild=true');

		if (os.platform() === 'win32') {
			should(resultArgs[1]).equal('/p:SystemDacpacsLocation="dummy\\\\dll path"');
		} else {
			should(resultArgs[1]).equal('/p:SystemDacpacsLocation="dummy/dll path"');
		}

		should(resultArgs[2]).equal('-v:detailed');
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

