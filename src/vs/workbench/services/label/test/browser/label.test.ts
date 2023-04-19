/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as resources from 'vs/base/common/resources';
import * as assert from 'assert';
import { TestEnvironmentService, TestPathService, TestRemoteAgentService } from 'vs/workbench/test/browser/workbenchTestServices';
import { URI } from 'vs/base/common/uri';
import { LabelService } from 'vs/workbench/services/label/common/labelService';
import { TestContextService } from 'vs/workbench/test/common/workbenchTestServices';
import { WorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { Workspace } from 'vs/platform/workspace/test/common/testWorkspace';
import { isWindows } from 'vs/base/common/platform';

suite('URI Label', () => {
	let labelService: LabelService;

	setup(() => {
		labelService = new LabelService(TestEnvironmentService, new TestContextService(), new TestPathService(), new TestRemoteAgentService());
	});

	test('custom scheme', function () {
		labelService.registerFormatter({
			scheme: 'vscode',
			formatting: {
				label: 'LABEL/${path}/${authority}/END',
				separator: '/',
				tildify: true,
				normalizeDriveLetter: true
			}
		});

		const uri1 = URI.parse('vscode://microsoft.com/1/2/3/4/5');
		assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABEL//1/2/3/4/5/microsoft.com/END');
		assert.strictEqual(labelService.getUriBasenameLabel(uri1), 'END');
	});

	test('separator', function () {
		labelService.registerFormatter({
			scheme: 'vscode',
			formatting: {
				label: 'LABEL\\${path}\\${authority}\\END',
				separator: '\\',
				tildify: true,
				normalizeDriveLetter: true
			}
		});

		const uri1 = URI.parse('vscode://microsoft.com/1/2/3/4/5');
		assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABEL\\\\1\\2\\3\\4\\5\\microsoft.com\\END');
		assert.strictEqual(labelService.getUriBasenameLabel(uri1), 'END');
	});

	test('custom authority', function () {
		labelService.registerFormatter({
			scheme: 'vscode',
			authority: 'micro*',
			formatting: {
				label: 'LABEL/${path}/${authority}/END',
				separator: '/'
			}
		});

		const uri1 = URI.parse('vscode://microsoft.com/1/2/3/4/5');
		assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABEL//1/2/3/4/5/microsoft.com/END');
		assert.strictEqual(labelService.getUriBasenameLabel(uri1), 'END');
	});

	test('mulitple authority', function () {
		labelService.registerFormatter({
			scheme: 'vscode',
			authority: 'not_matching_but_long',
			formatting: {
				label: 'first',
				separator: '/'
			}
		});
		labelService.registerFormatter({
			scheme: 'vscode',
			authority: 'microsof*',
			formatting: {
				label: 'second',
				separator: '/'
			}
		});
		labelService.registerFormatter({
			scheme: 'vscode',
			authority: 'mi*',
			formatting: {
				label: 'third',
				separator: '/'
			}
		});

		// Make sure the most specific authority is picked
		const uri1 = URI.parse('vscode://microsoft.com/1/2/3/4/5');
		assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'second');
		assert.strictEqual(labelService.getUriBasenameLabel(uri1), 'second');
	});

	test('custom query', function () {
		labelService.registerFormatter({
			scheme: 'vscode',
			formatting: {
				label: 'LABEL${query.prefix}: ${query.path}/END',
				separator: '/',
				tildify: true,
				normalizeDriveLetter: true
			}
		});

		const uri1 = URI.parse(`vscode://microsoft.com/1/2/3/4/5?${encodeURIComponent(JSON.stringify({ prefix: 'prefix', path: 'path' }))}`);
		assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABELprefix: path/END');
	});

	test('custom query without value', function () {
		labelService.registerFormatter({
			scheme: 'vscode',
			formatting: {
				label: 'LABEL${query.prefix}: ${query.path}/END',
				separator: '/',
				tildify: true,
				normalizeDriveLetter: true
			}
		});

		const uri1 = URI.parse(`vscode://microsoft.com/1/2/3/4/5?${encodeURIComponent(JSON.stringify({ path: 'path' }))}`);
		assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABEL: path/END');
	});

	test('custom query without query json', function () {
		labelService.registerFormatter({
			scheme: 'vscode',
			formatting: {
				label: 'LABEL${query.prefix}: ${query.path}/END',
				separator: '/',
				tildify: true,
				normalizeDriveLetter: true
			}
		});

		const uri1 = URI.parse('vscode://microsoft.com/1/2/3/4/5?path=foo');
		assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABEL: /END');
	});

	test('custom query without query', function () {
		labelService.registerFormatter({
			scheme: 'vscode',
			formatting: {
				label: 'LABEL${query.prefix}: ${query.path}/END',
				separator: '/',
				tildify: true,
				normalizeDriveLetter: true
			}
		});

		const uri1 = URI.parse('vscode://microsoft.com/1/2/3/4/5');
		assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABEL: /END');
	});
});


suite('multi-root workspace', () => {
	let labelService: LabelService;

	setup(() => {
		const sources = URI.file('folder1/src');
		const tests = URI.file('folder1/test');
		const other = URI.file('folder2');

		labelService = new LabelService(
			TestEnvironmentService,
			new TestContextService(
				new Workspace('test-workspace', [
					new WorkspaceFolder({ uri: sources, index: 0, name: 'Sources' }),
					new WorkspaceFolder({ uri: tests, index: 1, name: 'Tests' }),
					new WorkspaceFolder({ uri: other, index: 2, name: resources.basename(other) }),
				])),
			new TestPathService(),
			new TestRemoteAgentService()
		);
	});

	test('labels of files in multiroot workspaces are the foldername followed by offset from the folder', () => {
		labelService.registerFormatter({
			scheme: 'file',
			formatting: {
				label: '${authority}${path}',
				separator: '/',
				tildify: false,
				normalizeDriveLetter: false,
				authorityPrefix: '//',
				workspaceSuffix: ''
			}
		});

		const tests = {
			'folder1/src/file': 'Sources • file',
			'folder1/src/folder/file': 'Sources • folder/file',
			'folder1/src': 'Sources',
			'folder1/other': '/folder1/other',
			'folder2/other': 'folder2 • other',
		};

		Object.entries(tests).forEach(([path, label]) => {
			const generated = labelService.getUriLabel(URI.file(path), { relative: true });
			assert.strictEqual(generated, label);
		});
	});

	test('labels with context after path', () => {
		labelService.registerFormatter({
			scheme: 'file',
			formatting: {
				label: '${path} (${scheme})',
				separator: '/',
			}
		});

		const tests = {
			'folder1/src/file': 'Sources • file (file)',
			'folder1/src/folder/file': 'Sources • folder/file (file)',
			'folder1/src': 'Sources',
			'folder1/other': '/folder1/other (file)',
			'folder2/other': 'folder2 • other (file)',
		};

		Object.entries(tests).forEach(([path, label]) => {
			const generated = labelService.getUriLabel(URI.file(path), { relative: true });
			assert.strictEqual(generated, label, path);
		});
	});

	test('stripPathStartingSeparator', () => {
		labelService.registerFormatter({
			scheme: 'file',
			formatting: {
				label: '${path}',
				separator: '/',
				stripPathStartingSeparator: true
			}
		});

		const tests = {
			'folder1/src/file': 'Sources • file',
			'other/blah': 'other/blah',
		};

		Object.entries(tests).forEach(([path, label]) => {
			const generated = labelService.getUriLabel(URI.file(path), { relative: true });
			assert.strictEqual(generated, label, path);
		});
	});

	test('relative label without formatter', () => {
		const rootFolder = URI.parse('myscheme://myauthority/');

		labelService = new LabelService(
			TestEnvironmentService,
			new TestContextService(
				new Workspace('test-workspace', [
					new WorkspaceFolder({ uri: rootFolder, index: 0, name: 'FSProotFolder' }),
				])),
			new TestPathService(undefined, rootFolder.scheme),
			new TestRemoteAgentService()
		);

		const generated = labelService.getUriLabel(URI.parse('myscheme://myauthority/some/folder/test.txt'), { relative: true });
		if (isWindows) {
			assert.strictEqual(generated, 'some\\folder\\test.txt');
		} else {
			assert.strictEqual(generated, 'some/folder/test.txt');
		}
	});
});

suite('workspace at FSP root', () => {
	let labelService: LabelService;

	setup(() => {
		const rootFolder = URI.parse('myscheme://myauthority/');

		labelService = new LabelService(
			TestEnvironmentService,
			new TestContextService(
				new Workspace('test-workspace', [
					new WorkspaceFolder({ uri: rootFolder, index: 0, name: 'FSProotFolder' }),
				])),
			new TestPathService(),
			new TestRemoteAgentService()
		);
		labelService.registerFormatter({
			scheme: 'myscheme',
			formatting: {
				label: '${scheme}://${authority}${path}',
				separator: '/',
				tildify: false,
				normalizeDriveLetter: false,
				workspaceSuffix: '',
				authorityPrefix: '',
				stripPathStartingSeparator: false
			}
		});
	});

	test('non-relative label', () => {

		const tests = {
			'myscheme://myauthority/myFile1.txt': 'myscheme://myauthority/myFile1.txt',
			'myscheme://myauthority/folder/myFile2.txt': 'myscheme://myauthority/folder/myFile2.txt',
		};

		Object.entries(tests).forEach(([uriString, label]) => {
			const generated = labelService.getUriLabel(URI.parse(uriString), { relative: false });
			assert.strictEqual(generated, label);
		});
	});

	test('relative label', () => {

		const tests = {
			'myscheme://myauthority/myFile1.txt': 'myFile1.txt',
			'myscheme://myauthority/folder/myFile2.txt': 'folder/myFile2.txt',
		};

		Object.entries(tests).forEach(([uriString, label]) => {
			const generated = labelService.getUriLabel(URI.parse(uriString), { relative: true });
			assert.strictEqual(generated, label);
		});
	});

	test('relative label with explicit path separator', () => {
		let generated = labelService.getUriLabel(URI.parse('myscheme://myauthority/some/folder/test.txt'), { relative: true, separator: '/' });
		assert.strictEqual(generated, 'some/folder/test.txt');

		generated = labelService.getUriLabel(URI.parse('myscheme://myauthority/some/folder/test.txt'), { relative: true, separator: '\\' });
		assert.strictEqual(generated, 'some\\folder\\test.txt');
	});
});
