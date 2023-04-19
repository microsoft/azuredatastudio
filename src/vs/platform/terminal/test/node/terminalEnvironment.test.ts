/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual, ok, strictEqual } from 'assert';
import { NullLogService } from 'vs/platform/log/common/log';
import { ITerminalProcessOptions } from 'vs/platform/terminal/common/terminal';
import { getShellIntegrationInjection, IShellIntegrationConfigInjection } from 'vs/platform/terminal/node/terminalEnvironment';

const enabledProcessOptions: ITerminalProcessOptions['shellIntegration'] = { enabled: true, showWelcome: true };
const disabledProcessOptions: ITerminalProcessOptions['shellIntegration'] = { enabled: false, showWelcome: true };
const pwshExe = process.platform === 'win32' ? 'pwsh.exe' : 'pwsh';
const repoRoot = process.platform === 'win32' ? process.cwd()[0].toLowerCase() + process.cwd().substring(1) : process.cwd();
const logService = new NullLogService();

suite('platform - terminalEnvironment', () => {
	suite('getShellIntegrationInjection', () => {
		suite('should not enable', () => {
			test('when isFeatureTerminal or when no executable is provided', () => {
				ok(!getShellIntegrationInjection({ executable: pwshExe, args: ['-l', '-NoLogo'], isFeatureTerminal: true }, enabledProcessOptions, logService));
				ok(getShellIntegrationInjection({ executable: pwshExe, args: ['-l', '-NoLogo'], isFeatureTerminal: false }, enabledProcessOptions, logService));
			});
		});

		suite('pwsh', () => {
			const expectedPs1 = process.platform === 'win32'
				? `${repoRoot}\\out\\vs\\workbench\\contrib\\terminal\\browser\\media\\shellIntegration.ps1`
				: `${repoRoot}/out/vs/workbench/contrib/terminal/browser/media/shellIntegration.ps1`;
			suite('should override args', () => {
				const enabledExpectedResult = Object.freeze<IShellIntegrationConfigInjection>({
					newArgs: [
						'-noexit',
						'-command',
						`. "${expectedPs1}"`
					]
				});
				test('when undefined, []', () => {
					deepStrictEqual(getShellIntegrationInjection({ executable: pwshExe, args: [] }, enabledProcessOptions, logService), enabledExpectedResult);
					deepStrictEqual(getShellIntegrationInjection({ executable: pwshExe, args: undefined }, enabledProcessOptions, logService), enabledExpectedResult);
				});
				suite('when no logo', () => {
					test('array - case insensitive', () => {
						deepStrictEqual(getShellIntegrationInjection({ executable: pwshExe, args: ['-NoLogo'] }, enabledProcessOptions, logService), enabledExpectedResult);
						deepStrictEqual(getShellIntegrationInjection({ executable: pwshExe, args: ['-NOLOGO'] }, enabledProcessOptions, logService), enabledExpectedResult);
						deepStrictEqual(getShellIntegrationInjection({ executable: pwshExe, args: ['-nol'] }, enabledProcessOptions, logService), enabledExpectedResult);
						deepStrictEqual(getShellIntegrationInjection({ executable: pwshExe, args: ['-NOL'] }, enabledProcessOptions, logService), enabledExpectedResult);
					});
					test('string - case insensitive', () => {
						deepStrictEqual(getShellIntegrationInjection({ executable: pwshExe, args: '-NoLogo' }, enabledProcessOptions, logService), enabledExpectedResult);
						deepStrictEqual(getShellIntegrationInjection({ executable: pwshExe, args: '-NOLOGO' }, enabledProcessOptions, logService), enabledExpectedResult);
						deepStrictEqual(getShellIntegrationInjection({ executable: pwshExe, args: '-nol' }, enabledProcessOptions, logService), enabledExpectedResult);
						deepStrictEqual(getShellIntegrationInjection({ executable: pwshExe, args: '-NOL' }, enabledProcessOptions, logService), enabledExpectedResult);
					});
				});
			});
			suite('should incorporate login arg', () => {
				const enabledExpectedResult = Object.freeze<IShellIntegrationConfigInjection>({
					newArgs: [
						'-l',
						'-noexit',
						'-command',
						`. "${expectedPs1}"`
					]
				});
				test('when array contains no logo and login', () => {
					deepStrictEqual(getShellIntegrationInjection({ executable: pwshExe, args: ['-l', '-NoLogo'] }, enabledProcessOptions, logService), enabledExpectedResult);
				});
				test('when string', () => {
					deepStrictEqual(getShellIntegrationInjection({ executable: pwshExe, args: '-l' }, enabledProcessOptions, logService), enabledExpectedResult);
				});
			});
			suite('should not modify args', () => {
				test('when shell integration is disabled', () => {
					strictEqual(getShellIntegrationInjection({ executable: pwshExe, args: ['-l'] }, disabledProcessOptions, logService), undefined);
					strictEqual(getShellIntegrationInjection({ executable: pwshExe, args: '-l' }, disabledProcessOptions, logService), undefined);
					strictEqual(getShellIntegrationInjection({ executable: pwshExe, args: undefined }, disabledProcessOptions, logService), undefined);
				});
				test('when using unrecognized arg', () => {
					strictEqual(getShellIntegrationInjection({ executable: pwshExe, args: ['-l', '-NoLogo', '-i'] }, disabledProcessOptions, logService), undefined);
				});
				test('when using unrecognized arg (string)', () => {
					strictEqual(getShellIntegrationInjection({ executable: pwshExe, args: '-i' }, disabledProcessOptions, logService), undefined);
				});
			});
		});

		if (process.platform !== 'win32') {
			suite('zsh', () => {
				suite('should override args', () => {
					const expectedDir = /.+\/vscode-zsh/;
					const expectedDests = [/.+\/vscode-zsh\/.zshrc/, /.+\/vscode-zsh\/.zprofile/, /.+\/vscode-zsh\/.zshenv/];
					const expectedSources = [
						/.+\/out\/vs\/workbench\/contrib\/terminal\/browser\/media\/shellIntegration.zsh/,
						/.+\/out\/vs\/workbench\/contrib\/terminal\/browser\/media\/shellIntegration-profile.zsh/,
						/.+\/out\/vs\/workbench\/contrib\/terminal\/browser\/media\/shellIntegration-env.zsh/
					];
					function assertIsEnabled(result: IShellIntegrationConfigInjection) {
						strictEqual(Object.keys(result.envMixin!).length, 1);
						ok(result.envMixin!['ZDOTDIR']?.match(expectedDir));
						strictEqual(result.filesToCopy?.length, 3);
						ok(result.filesToCopy[0].dest.match(expectedDests[0]));
						ok(result.filesToCopy[1].dest.match(expectedDests[1]));
						ok(result.filesToCopy[2].dest.match(expectedDests[2]));
						ok(result.filesToCopy[0].source.match(expectedSources[0]));
						ok(result.filesToCopy[1].source.match(expectedSources[1]));
						ok(result.filesToCopy[2].source.match(expectedSources[2]));
					}
					test('when undefined, []', () => {
						const result1 = getShellIntegrationInjection({ executable: 'zsh', args: [] }, enabledProcessOptions, logService);
						deepStrictEqual(result1?.newArgs, ['-i']);
						assertIsEnabled(result1);
						const result2 = getShellIntegrationInjection({ executable: 'zsh', args: undefined }, enabledProcessOptions, logService);
						deepStrictEqual(result2?.newArgs, ['-i']);
						assertIsEnabled(result2);
					});
					suite('should incorporate login arg', () => {
						test('when array', () => {
							const result = getShellIntegrationInjection({ executable: 'zsh', args: ['-l'] }, enabledProcessOptions, logService);
							deepStrictEqual(result?.newArgs, ['-il']);
							assertIsEnabled(result);
						});
					});
					suite('should not modify args', () => {
						test('when shell integration is disabled', () => {
							strictEqual(getShellIntegrationInjection({ executable: 'zsh', args: ['-l'] }, disabledProcessOptions, logService), undefined);
							strictEqual(getShellIntegrationInjection({ executable: 'zsh', args: undefined }, disabledProcessOptions, logService), undefined);
						});
						test('when using unrecognized arg', () => {
							strictEqual(getShellIntegrationInjection({ executable: 'zsh', args: ['-l', '-fake'] }, disabledProcessOptions, logService), undefined);
						});
					});
				});
			});
			suite('bash', () => {
				suite('should override args', () => {
					test('when undefined, [], empty string', () => {
						const enabledExpectedResult = Object.freeze<IShellIntegrationConfigInjection>({
							newArgs: [
								'--init-file',
								`${repoRoot}/out/vs/workbench/contrib/terminal/browser/media/shellIntegration-bash.sh`
							],
							envMixin: {}
						});
						deepStrictEqual(getShellIntegrationInjection({ executable: 'bash', args: [] }, enabledProcessOptions, logService), enabledExpectedResult);
						deepStrictEqual(getShellIntegrationInjection({ executable: 'bash', args: '' }, enabledProcessOptions, logService), enabledExpectedResult);
						deepStrictEqual(getShellIntegrationInjection({ executable: 'bash', args: undefined }, enabledProcessOptions, logService), enabledExpectedResult);
					});
					suite('should set login env variable and not modify args', () => {
						const enabledExpectedResult = Object.freeze<IShellIntegrationConfigInjection>({
							newArgs: [
								'--init-file',
								`${repoRoot}/out/vs/workbench/contrib/terminal/browser/media/shellIntegration-bash.sh`
							],
							envMixin: {
								VSCODE_SHELL_LOGIN: '1'
							}
						});
						test('when array', () => {
							deepStrictEqual(getShellIntegrationInjection({ executable: 'bash', args: ['-l'] }, enabledProcessOptions, logService), enabledExpectedResult);
						});
					});
					suite('should not modify args', () => {
						test('when shell integration is disabled', () => {
							strictEqual(getShellIntegrationInjection({ executable: 'bash', args: ['-l'] }, disabledProcessOptions, logService), undefined);
							strictEqual(getShellIntegrationInjection({ executable: 'bash', args: undefined }, disabledProcessOptions, logService), undefined);
						});
						test('when custom array entry', () => {
							strictEqual(getShellIntegrationInjection({ executable: 'bash', args: ['-l', '-i'] }, disabledProcessOptions, logService), undefined);
						});
					});
				});
			});
		}
	});
});
