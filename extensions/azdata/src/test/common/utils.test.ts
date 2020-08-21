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
					// No mocks needed for win32 based discovery of latest version as it can be tested on all platforms
					if (testPlatform === 'darwin') {
						// if actual platform is not darwin then mock the system calls
						if (testPlatform !== actualPlatform) {
							// mock executeCommand to return a valid discovered version
							const brewInfo = [
								{
									"name": "azdata-cli",
									"full_name": "microsoft/azdata-cli-release/azdata-cli",
									"versions": {
										"stable": "20.0.1"
									}
								}
							];
							sinon.stub(childProcess, 'executeCommand').returns(Promise.resolve(
								{
									stdout: JSON.stringify(brewInfo),
									stderr: ''
								}));
						}
					} else if (testPlatform === 'linux') {
						// linux platforms require sudo so mock executeSudoCommand and executeCommand to return a valid discovered version
						sinon.stub(childProcess, 'executeSudoCommand').callsFake(async (_command: string) => {
							return { stdout: 'success', stderr: '' };
						});
						sinon.stub(childProcess, 'executeCommand').returns(Promise.resolve(
							{
								stdout: 'Listing...\nazdata-cli/bionic,bionic,bionic 9999.999.999-1~bionic all [upgradable from: 0.0.0-0~bionic]\nN: There are 7 additional versions. Please use the \'-a\' switch to see them.',
								stderr: ''
							}));
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
