/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import { promises as fs } from 'fs';
import * as uuid from 'uuid';
import * as os from 'os';
import * as path from 'path';
import * as utils from '../../common/utils';
import { MockOutputChannel } from './stubs';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { sleep } from './testUtils';

describe('Utils Tests', function () {

	it('getKnoxUrl', () => {
		const host = '127.0.0.1';
		const port = '8080';
		should(utils.getKnoxUrl(host, port)).endWith('/gateway');
	});

	it('getLivyUrl', () => {
		const host = '127.0.0.1';
		const port = '8080';
		should(utils.getLivyUrl(host, port)).endWith('/gateway/default/livy/v1/');
	});

	it('ensureDir', async () => {
		const dirPath = path.join(os.tmpdir(), uuid.v4());
		await should(fs.stat(dirPath)).be.rejected();
		await utils.ensureDir(dirPath, new MockOutputChannel());
		should.exist(await fs.stat(dirPath), `Folder ${dirPath} did not exist after creation`);
	});

	it('getErrorMessage Error', () => {
		const errMsg = 'Test Error';
		should(utils.getErrorMessage(new Error(errMsg))).equal(errMsg);
	});

	it('getErrorMessage string', () => {
		const errMsg = 'Test Error';
		should(utils.getErrorMessage(errMsg)).equal(errMsg);
	});

	it('getOSPlatformId', async () => {
		should(utils.getOSPlatformId()).not.throw();
	});

	describe('compareVersions', () => {
		const version1 = '1.0.0.0';
		const version1Revision = '1.0.0.1';
		const version2 = '2.0.0.0';
		const shortVersion1 = '1';

		it('same id', () => {
			should(utils.compareVersions(version1, version1)).equal(0);
		});

		it('first version lower', () => {
			should(utils.compareVersions(version1, version2)).equal(-1);
		});

		it('second version lower', () => {
			should(utils.compareVersions(version2, version1)).equal(1);
		});

		it('short first version is padded correctly', () => {
			should(utils.compareVersions(shortVersion1, version1)).equal(0);
		});

		it('short second version is padded correctly when', () => {
			should(utils.compareVersions(version1, shortVersion1)).equal(0);
		});

		it('correctly compares version with only minor version difference', () => {
			should(utils.compareVersions(version1Revision, version1)).equal(1);
		});

		it('equivalent versions with wildcard characters', () => {
			should(utils.compareVersions('1.*.3', '1.5.3')).equal(0);
		});

		it('lower version with wildcard characters', () => {
			should(utils.compareVersions('1.4.*', '1.5.3')).equal(-1);
		});

		it('higher version with wildcard characters', () => {
			should(utils.compareVersions('4.5.6', '3.*')).equal(1);
		});

		it('all wildcard strings should be equal', () => {
			should(utils.compareVersions('*.*', '*.*.*')).equal(0);
		});
	});

	describe('sortPackageVersions', () => {

		it('empty', () => {
			should(utils.sortPackageVersions([])).deepEqual([]);
		});

		it('single', () => {
			const single = ['1'];
			should(utils.sortPackageVersions(single)).deepEqual(single);
		});

		it('inorder', () => {
			const inorder = ['1', '2', '3'];
			should(utils.sortPackageVersions(inorder)).deepEqual(inorder);
		});

		it('inorder descending', () => {
			const inorder = ['1', '2', '3'];
			const inorderSortedDescending = ['3', '2', '1'];
			should(utils.sortPackageVersions(inorder, false)).deepEqual(inorderSortedDescending);
		});

		it('reverse order', () => {
			const reverseOrder = ['3', '2', '1'];
			const reverseOrderSorted = ['1', '2', '3'];
			should(utils.sortPackageVersions(reverseOrder)).deepEqual(reverseOrderSorted);
		});

		it('reverse order descending', () => {
			const reverseOrder = ['3', '2', '1'];
			const reverseOrderSortedDescending = ['3', '2', '1'];
			should(utils.sortPackageVersions(reverseOrder, false)).deepEqual(reverseOrderSortedDescending);
		});

		it('random', () => {
			const random = ['1', '42', '100', '0'];
			const randomSorted = ['0', '1', '42', '100'];
			should(utils.sortPackageVersions(random)).deepEqual(randomSorted);
		});

		it('random descending', () => {
			const random = ['1', '42', '100', '0'];
			const randomSortedDescending = ['100', '42', '1', '0'];
			should(utils.sortPackageVersions(random, false)).deepEqual(randomSortedDescending);
		});

		it('different lengths', () => {
			const random = ['1.0.0', '42', '100.0', '0.1', '1.0.1'];
			const randomSorted = ['0.1', '1.0.0', '1.0.1', '42', '100.0'];
			should(utils.sortPackageVersions(random)).deepEqual(randomSorted);
		});

		it('versions with non-numeric components', () => {
			const random = ['1.0.1h', '1.0.0', '42', '1.0.1b', '100.0', '0.1', '1.0.1'];
			const randomSorted = ['0.1', '1.0.0', '1.0.1', '1.0.1b', '1.0.1h', '42', '100.0'];
			should(utils.sortPackageVersions(random)).deepEqual(randomSorted);
		});
	});

	describe('isPackageSupported', () => {
		it('Constraints have no version specifier', async function (): Promise<void> {
			let pythonVersion = '3.6';
			let versionConstraints = ['3.6.*', '3.*'];
			let result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.true();

			versionConstraints = ['3.5.*', '3.5'];
			result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.false();
		});

		it('Package is valid for version constraints', async function (): Promise<void> {
			let pythonVersion = '3.6';
			let versionConstraints = ['>=3.5,!=3.2,!=3.4.*'];
			let result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.true();
		});

		it('Version constraints string has lots of spaces', async function (): Promise<void> {
			let pythonVersion = '3.6';
			let versionConstraints = ['>= 3.5, != 3.2, != 3.4.*'];
			let result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.true();
		});

		it('Strictly greater or less than comparisons', async function (): Promise<void> {
			let pythonVersion = '3.6';
			let versionConstraints = ['> 3.5, > 3.4.*', '< 3.8'];
			let result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.true();
		});

		it('Strict equality', async function (): Promise<void> {
			let pythonVersion = '3.6';
			let versionConstraints = ['== 3.6', '== 3.6.*'];
			let result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.true();
		});

		it('Package is valid for first set of constraints, but not the second', async function (): Promise<void> {
			let pythonVersion = '3.6';
			let versionConstraints = ['>=3.5, !=3.2, !=3.4.*', '!=3.6, >=3.5'];
			let result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.true();
		});

		it('Package is valid for second set of constraints, but not the first', async function (): Promise<void> {
			let pythonVersion = '3.6';
			let versionConstraints = ['!=3.6, >=3.5', '>=3.5, !=3.2, !=3.4.*'];
			let result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.true();
		});

		it('Package is not valid for constraints', async function (): Promise<void> {
			let pythonVersion = '3.6';
			let versionConstraints = ['>=3.4, !=3.6, >=3.5'];
			let result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.false();
		});

		it('Package is not valid for several sets of constraints', async function (): Promise<void> {
			let pythonVersion = '3.6';
			let versionConstraints = ['>=3.7', '!=3.6, >=3.5', '>=3.8'];
			let result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.false();
		});

		it('Constraints are all empty strings', async function (): Promise<void> {
			let pythonVersion = '3.6';
			let versionConstraints = ['', '', ''];
			let result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.true();
		});

		it('Constraints are all undefined', async function (): Promise<void> {
			let pythonVersion = '3.6';
			let versionConstraints: string[] = [undefined, undefined, undefined];
			let result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.true();
		});

		it('Constraints are a bunch of commas', async function (): Promise<void> {
			let pythonVersion = '3.6';
			let versionConstraints: string[] = [',,,', ',,,,', ', , , , , , ,'];
			let result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.true();
		});

		it('Installed python version is an empty string', async function (): Promise<void> {
			let pythonVersion = '';
			let versionConstraints = ['>=3.7', '!=3.6, >=3.5', '>=3.8'];
			let result = await utils.isPackageSupported(pythonVersion, versionConstraints);
			should(result).be.true();
		});
	});

	describe('executeBufferedCommand', () => {

		it('runs successfully', async () => {
			await utils.executeBufferedCommand('echo hello', {}, new MockOutputChannel());
		});

		it('errors correctly with invalid command', async () => {
			await should(utils.executeBufferedCommand('invalidcommand', {}, new MockOutputChannel())).be.rejected();
		});
	});

	describe('executeStreamedCommand', () => {

		it('runs successfully', async () => {
			await utils.executeStreamedCommand('echo hello', {}, new MockOutputChannel());
		});

		it('errors correctly with invalid command', async () => {
			await should(utils.executeStreamedCommand('invalidcommand', {}, new MockOutputChannel())).be.rejected();
		});
	});

	describe('isEditorTitleFree', () => {
		afterEach(async () => {
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		});

		it('title is free', () => {
			should(utils.isEditorTitleFree('MyTitle')).be.true();
		});

		it('title is not free with text document sharing name', async () => {
			const editorTitle = 'Untitled-1';
			should(utils.isEditorTitleFree(editorTitle)).be.true('Title should be free before opening text document');
			await vscode.workspace.openTextDocument();
			should(utils.isEditorTitleFree(editorTitle)).be.false('Title should not be free after opening text document');
		});

		it('title is not free with notebook document sharing name', async () => {
			const editorTitle = 'MyUntitledNotebook';
			should(utils.isEditorTitleFree(editorTitle)).be.true('Title should be free before opening notebook');
			await azdata.nb.showNotebookDocument(vscode.Uri.parse(`untitled:${editorTitle}`));
			should(utils.isEditorTitleFree('MyUntitledNotebook')).be.false('Title should not be free after opening notebook');
		});

		it('title is not free with notebook document sharing name created through command', async () => {
			const editorTitle = 'Notebook-0';
			should(utils.isEditorTitleFree(editorTitle)).be.true('Title should be free before opening notebook');
			await vscode.commands.executeCommand('_notebook.command.new');
			should(utils.isEditorTitleFree(editorTitle)).be.false('Title should not be free after opening notebook');
		});
	});

	describe('getClusterEndpoints', () => {
		const baseServerInfo: azdata.ServerInfo = {
			serverMajorVersion: -1,
			serverMinorVersion: -1,
			serverReleaseVersion: -1,
			engineEditionId: -1,
			serverVersion: '',
			serverLevel: '',
			serverEdition: '',
			isCloud: false,
			azureVersion: -1,
			osVersion: '',
			options: {},
			cpuCount: -1,
			physicalMemoryInMb: -1
		};
		it('empty endpoints does not error', () => {
			const serverInfo = Object.assign({}, baseServerInfo);
			serverInfo.options['clusterEndpoints'] = [];
			should(utils.getClusterEndpoints(serverInfo).length).equal(0);
		});

		it('endpoints without endpoint field are created successfully', () => {
			const serverInfo = Object.assign({}, baseServerInfo);
			const ipAddress = 'localhost';
			const port = '123';
			serverInfo.options['clusterEndpoints'] = [{ ipAddress: ipAddress, port: port }];
			const endpoints = utils.getClusterEndpoints(serverInfo);
			should(endpoints.length).equal(1);
			should(endpoints[0].endpoint).equal('https://localhost:123');
		});

		it('endpoints with endpoint field are created successfully', () => {
			const endpoint = 'https://myActualEndpoint:8080';
			const serverInfo = Object.assign({}, baseServerInfo);
			serverInfo.options['clusterEndpoints'] = [{ endpoint: endpoint, ipAddress: 'localhost', port: '123' }];
			const endpoints = utils.getClusterEndpoints(serverInfo);
			should(endpoints.length).equal(1);
			should(endpoints[0].endpoint).equal(endpoint);
		});
	});

	describe('getHostAndPortFromEndpoint', () => {
		it('valid endpoint is parsed correctly', () => {
			const host = 'localhost';
			const port = '123';
			const hostAndIp = utils.getHostAndPortFromEndpoint(`https://${host}:${port}`);
			should(hostAndIp).deepEqual({ host: host, port: port });
		});

		it('invalid endpoint is returned as is', () => {
			const host = 'localhost';
			const hostAndIp = utils.getHostAndPortFromEndpoint(`https://${host}`);
			should(hostAndIp).deepEqual({ host: host, port: undefined });
		});
	});

	describe('exists', () => {
		it('runs as expected', async () => {
			const filename = path.join(os.tmpdir(), `NotebookUtilsTest_${uuid.v4()}`);
			try {
				should(await utils.exists(filename)).be.false();
				await fs.writeFile(filename, '');
				should(await utils.exists(filename)).be.true();
			} finally {
				try {
					await fs.unlink(filename);
				} catch { /* no-op */ }
			}
		});
	});

	describe('getIgnoreSslVerificationConfigSetting', () => {
		it('runs as expected', async () => {
			should(utils.getIgnoreSslVerificationConfigSetting()).be.true();
		});
	});

	describe('debounce', () => {
		class DebounceTest {
			public fnCalled = 0;
			public getterCalled = 0;

			@utils.debounce(100)
			fn(): void {
				this.fnCalled++;
			}

			@utils.debounce(100)
			get getter(): number {
				this.getterCalled++;
				return -1;
			}
		}

		it('decorates function correctly', async () => {
			const debounceTestObj = new DebounceTest();
			debounceTestObj.fn();
			debounceTestObj.fn();
			await sleep(500);
			should(debounceTestObj.fnCalled).equal(1);
			debounceTestObj.fn();
			debounceTestObj.fn();
			await sleep(500);
			should(debounceTestObj.fnCalled).equal(2);
		});

		it('decorates getter correctly', async () => {
			const debounceTestObj = new DebounceTest();
			let getterValue = debounceTestObj.getter;
			getterValue = debounceTestObj.getter;
			await sleep(500);
			should(debounceTestObj.getterCalled).equal(1);
			getterValue = debounceTestObj.getter;
			getterValue = debounceTestObj.getter;
			await sleep(500);
			should(debounceTestObj.getterCalled).equal(2);
			should(getterValue).be.undefined();
		});

		it('decorating setter not supported', async () => {
			should(() => {
				class UnsupportedTest {
					@utils.debounce(100)
					set setter(value: number) { }
				}
				new UnsupportedTest();
			}).throw();
		});
	});

	describe('getRandomToken', function (): void {
		it('Should have default length and be hex only', async function (): Promise<void> {

			let token = await utils.getRandomToken();
			should(token).have.length(48);
			let validChars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
			for (let i = 0; i < token.length; i++) {
				let char = token.charAt(i);
				should(validChars.indexOf(char)).be.greaterThan(-1);
			}
		});
	});

	describe('isBookItemPinned', function (): void {
		it('Should NOT pin an unknown book within a workspace', async function (): Promise<void> {

			let notebookUri = path.join(path.sep, 'randomfolder', 'randomsubfolder', 'content', 'randomnotebook.ipynb');
			let isNotebookPinned = utils.isBookItemPinned(notebookUri);

			should(isNotebookPinned).be.false('Random notebooks should not be pinned');
		});
	});

	describe('getPinnedNotebooks', function (): void {
		it('Should NOT have any pinned notebooks', async function (): Promise<void> {
			let pinnedNotebooks: utils.IPinnedNotebook[] = utils.getPinnedNotebooks();

			should(pinnedNotebooks.length).equal(0, 'Should not have any pinned notebooks');
		});
	});
});
