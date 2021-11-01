/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *  *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as os from 'os';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as constants from '../common/constants';
import * as azureFunctionUtils from '../common/azureFunctionsUtils';
import { PackageHelper } from '../tools/packageHelper';
import { createContext, TestContext } from './testContext';

let testContext: TestContext;
let packageHelper: PackageHelper;

describe('PackageHelper tests', function (): void {
	beforeEach(function (): void {
		testContext = createContext();
		packageHelper = new PackageHelper(testContext.outputChannel);
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should construct correct add Package Arguments', function (): void {
		const packageHelper = new PackageHelper( vscode.window.createOutputChannel('db project test'));
		const projectUri = vscode.Uri.file('dummy\\project\\path.csproj');
		const result = packageHelper.constructAddPackageArguments(projectUri, constants.sqlExtensionPackageName);

		if (os.platform() === 'win32') {
			should(result).equal(` add "\\\\dummy\\\\project\\\\path.csproj" package ${constants.sqlExtensionPackageName} --prerelease`);
		}
		else {
			should(result).equal(` add "/dummy/project/path.csproj" package ${constants.sqlExtensionPackageName} --prerelease`);
		}
	});

	it('Should construct correct add Package Arguments with version', function (): void {
		const packageHelper = new PackageHelper( vscode.window.createOutputChannel('db project test'));
		const projectUri = vscode.Uri.file('dummy\\project\\path.csproj');
		const result = packageHelper.constructAddPackageArguments(projectUri, constants.sqlExtensionPackageName, constants.VersionNumber);

		if (os.platform() === 'win32') {
			should(result).equal(` add "\\\\dummy\\\\project\\\\path.csproj" package ${constants.sqlExtensionPackageName} -v ${constants.VersionNumber}`);
		}
		else {
			should(result).equal(` add "/dummy/project/path.csproj" package ${constants.sqlExtensionPackageName} -v ${constants.VersionNumber}`);
		}
	});

	it('Should show info message to add sql bindings package if project is not found', async function (): Promise<void> {
		sinon.stub(azureFunctionUtils, 'getAFProjectContainingFile').resolves(undefined);
		const spy = sinon.spy(vscode.window, 'showInformationMessage');

		await packageHelper.addPackageToAFProjectContainingFile(vscode.Uri.file(''), constants.sqlExtensionPackageName);
		should(spy.calledOnce).be.true('showInformationMessage should have been called exactly once');
	});
});
