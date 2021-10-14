/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as sinon from 'sinon';
import * as testUtils from './testUtils';
import * as utils from '../common/utils';
import * as path from 'path';
import { TestContext, createContext } from './testContext';
import { AutorestHelper } from '../tools/autorestHelper';
import { promises as fs } from 'fs';
import { window } from 'vscode';
import { runViaNpx } from '../common/constants';

let testContext: TestContext;

describe('Autorest tests', function (): void {
	beforeEach(function (): void {
		testContext = createContext();
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should detect autorest', async function (): Promise<void> {
		sinon.stub(window, 'showInformationMessage').returns(<any>Promise.resolve(runViaNpx)); // stub a selection in case test runner doesn't have autorest installed

		const autorestHelper = new AutorestHelper(testContext.outputChannel);
		const executable = await autorestHelper.detectInstallation();
		should(executable === 'autorest' || executable === 'npx autorest').equal(true, 'autorest command should be found in default path during unit tests');
	});

	it('Should run an autorest command successfully', async function (): Promise<void> {
		sinon.stub(window, 'showInformationMessage').returns(<any>Promise.resolve(runViaNpx)); // stub a selection in case test runner doesn't have autorest installed

		const autorestHelper = new AutorestHelper(testContext.outputChannel);
		const dummyFile = path.join(await testUtils.generateTestFolderPath(), 'testoutput.log');
		sinon.stub(autorestHelper, 'constructAutorestCommand').returns(`${await autorestHelper.detectInstallation()} --version > ${dummyFile}`);

		try {
			await autorestHelper.generateAutorestFiles('fakespec.yaml', 'fakePath');
			const text = (await fs.readFile(dummyFile)).toString().trim();
			const expected = 'AutoRest code generation utility';
			should(text.includes(expected)).equal(true, `Substring not found.  Expected "${expected}" in "${text}"`);
		} finally {
			if (await utils.exists(dummyFile)) {
				await fs.unlink(dummyFile);
			}
		}
	});

	it('Should construct a correct autorest command for project generation', async function (): Promise<void> {
		sinon.stub(window, 'showInformationMessage').returns(<any>Promise.resolve(runViaNpx)); // stub a selection in case test runner doesn't have autorest installed

		const expectedOutput = 'autorest --use:autorest-sql-testing@latest --input-file="/some/path/test.yaml" --output-folder="/some/output/path" --clear-output-folder --verbose';

		const autorestHelper = new AutorestHelper(testContext.outputChannel);
		const constructedCommand = autorestHelper.constructAutorestCommand((await autorestHelper.detectInstallation())!, '/some/path/test.yaml', '/some/output/path');

		// depending on whether the machine running the test has autorest installed or just node, the expected output may differ by just the prefix, hence matching against two options
		should(constructedCommand === expectedOutput || constructedCommand === `npx ${expectedOutput}`).equal(true, `Constructed autorest command not formatting as expected:\nActual:\n\t${constructedCommand}\nExpected:\n\t[npx ]${expectedOutput}`);
	});

	it('Should prompt user for action when autorest not found', async function (): Promise<void> {
		const promptStub = sinon.stub(window, 'showInformationMessage').returns(<any>Promise.resolve());
		const detectStub = sinon.stub(utils, 'detectCommandInstallation');
		detectStub.withArgs('autorest').returns(Promise.resolve(false));
		detectStub.withArgs('npx').returns(Promise.resolve(true));

		const autorestHelper = new AutorestHelper(testContext.outputChannel);
		await autorestHelper.detectInstallation();

		should(promptStub.calledOnce).be.true('User should have been prompted for how to run autorest because it wasn\'t found.');
	});
});
