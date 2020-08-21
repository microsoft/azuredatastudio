/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import * as childProcess from '../../common/childProcess';
import { discoverLatestAvailableAzdataVersion, searchForCmd as searchForExe } from '../../common/utils';

describe('utils', function () {
	afterEach(function (): void {
		sinon.restore();
	});
	describe('searchForExe', function (): void {
		it('finds exe successfully', async function (): Promise<void> {
			await searchForExe('node');
		});
		it('throws for non-existent exe', async function (): Promise<void> {
			await should(searchForExe('someFakeExe')).be.rejected();
		});
	});

	describe('discoverLatestAvailableAzdataVersion', function (): void {
		this.timeout(20000);
		for (const testPlatform of ['win32', 'darwin', 'linux']) {
			it(`finds latest version successfully on '${testPlatform}'`, async function (): Promise<void> {
				const outputChannelMock = TypeMoq.Mock.ofType<vscode.OutputChannel>();
				if (process.env.SendOutputChannelToConsole) {
					outputChannelMock.setup(x => x.appendLine(TypeMoq.It.isAnyString())).callback((x => {
						console.log(`Output Channel:${x}`);
					}));
				}
				const actualPlatform = process.platform;
				try {
					Object.defineProperty(process, 'platform', { value: testPlatform });
					// If our test is running on a foreign platform then we need to mock the calls intended for that platform
					if (testPlatform !== actualPlatform) {
						// No mocks needed for win32 and linux based discovery of latest version as it can be tested on all platforms
						if (testPlatform === 'darwin') {
							// mock executeCommand to return a valid discovered version
							const brewInfo = [
								{
									'versions': {
										'stable': '9999.999.999'
									}
								}
							];
							sinon.stub(childProcess, 'executeCommand').returns(Promise.resolve(
								{
									stdout: JSON.stringify(brewInfo),
									stderr: ''
								}));
						}
					}
					// if the latest version is not discovered then the following call throws failing the test
					await discoverLatestAvailableAzdataVersion(outputChannelMock.object);
				} finally {
					Object.defineProperty(process, 'platform', { value: actualPlatform });
				}
			});
		}
	});
});
