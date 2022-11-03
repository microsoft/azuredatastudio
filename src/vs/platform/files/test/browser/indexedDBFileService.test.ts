/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IndexedDB } from 'vs/base/browser/indexedDB';
import { bufferToReadable, bufferToStream, VSBuffer, VSBufferReadable, VSBufferReadableStream } from 'vs/base/common/buffer';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { basename, joinPath } from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { flakySuite } from 'vs/base/test/common/testUtils';
import { IndexedDBFileSystemProvider } from 'vs/platform/files/browser/indexedDBFileSystemProvider';
import { FileOperation, FileOperationError, FileOperationEvent, FileOperationResult, FileSystemProviderError, FileSystemProviderErrorCode, FileType, IFileStatWithMetadata } from 'vs/platform/files/common/files';
import { FileService } from 'vs/platform/files/common/fileService';
import { NullLogService } from 'vs/platform/log/common/log';

flakySuite('IndexedDBFileSystemProvider', function () {

	const logSchema = 'logs';

	let service: FileService;
	let logFileProvider: IndexedDBFileSystemProvider;
	let userdataFileProvider: IndexedDBFileSystemProvider;
	const testDir = '/';

	const logfileURIFromPaths = (paths: string[]) => joinPath(URI.from({ scheme: logSchema, path: testDir }), ...paths);
	const userdataURIFromPaths = (paths: readonly string[]) => joinPath(URI.from({ scheme: Schemas.vscodeUserData, path: testDir }), ...paths);

	const disposables = new DisposableStore();

	const initFixtures = async () => {
		await Promise.all(
			[['fixtures', 'resolver', 'examples'],
			['fixtures', 'resolver', 'other', 'deep'],
			['fixtures', 'service', 'deep'],
			['batched']]
				.map(path => userdataURIFromPaths(path))
				.map(uri => service.createFolder(uri)));
		await Promise.all(
			([
				[['fixtures', 'resolver', 'examples', 'company.js'], 'class company {}'],
				[['fixtures', 'resolver', 'examples', 'conway.js'], 'export function conway() {}'],
				[['fixtures', 'resolver', 'examples', 'employee.js'], 'export const employee = "jax"'],
				[['fixtures', 'resolver', 'examples', 'small.js'], ''],
				[['fixtures', 'resolver', 'other', 'deep', 'company.js'], 'class company {}'],
				[['fixtures', 'resolver', 'other', 'deep', 'conway.js'], 'export function conway() {}'],
				[['fixtures', 'resolver', 'other', 'deep', 'employee.js'], 'export const employee = "jax"'],
				[['fixtures', 'resolver', 'other', 'deep', 'small.js'], ''],
				[['fixtures', 'resolver', 'index.html'], '<p>p</p>'],
				[['fixtures', 'resolver', 'site.css'], '.p {color: red;}'],
				[['fixtures', 'service', 'deep', 'company.js'], 'class company {}'],
				[['fixtures', 'service', 'deep', 'conway.js'], 'export function conway() {}'],
				[['fixtures', 'service', 'deep', 'employee.js'], 'export const employee = "jax"'],
				[['fixtures', 'service', 'deep', 'small.js'], ''],
				[['fixtures', 'service', 'binary.txt'], '<p>p</p>'],
			] as const)
				.map(([path, contents]) => [userdataURIFromPaths(path), contents] as const)
				.map(([uri, contents]) => service.createFile(uri, VSBuffer.fromString(contents)))
		);
	};

	const reload = async () => {
		const logService = new NullLogService();

		service = new FileService(logService);
		disposables.add(service);

		const indexedDB = await IndexedDB.create('vscode-web-db-test', 1, ['vscode-userdata-store', 'vscode-logs-store']);

		logFileProvider = new IndexedDBFileSystemProvider(logSchema, indexedDB, 'vscode-logs-store', false);
		disposables.add(service.registerProvider(logSchema, logFileProvider));
		disposables.add(logFileProvider);

		userdataFileProvider = new IndexedDBFileSystemProvider(Schemas.vscodeUserData, indexedDB, 'vscode-userdata-store', true);
		disposables.add(service.registerProvider(Schemas.vscodeUserData, userdataFileProvider));
		disposables.add(userdataFileProvider);
	};

	setup(async function () {
		this.timeout(15000);
		await reload();
	});

	teardown(async () => {
		await logFileProvider.delete(logfileURIFromPaths([]), { recursive: true, useTrash: false });
		await userdataFileProvider.delete(userdataURIFromPaths([]), { recursive: true, useTrash: false });
		disposables.clear();
	});

	test('root is always present', async () => {
		assert.strictEqual((await userdataFileProvider.stat(userdataURIFromPaths([]))).type, FileType.Directory);
		await userdataFileProvider.delete(userdataURIFromPaths([]), { recursive: true, useTrash: false });
		assert.strictEqual((await userdataFileProvider.stat(userdataURIFromPaths([]))).type, FileType.Directory);
	});

	test('createFolder', async () => {
		let event: FileOperationEvent | undefined;
		disposables.add(service.onDidRunOperation(e => event = e));

		const parent = await service.resolve(userdataURIFromPaths([]));
		const newFolderResource = joinPath(parent.resource, 'newFolder');

		assert.strictEqual((await userdataFileProvider.readdir(parent.resource)).length, 0);
		const newFolder = await service.createFolder(newFolderResource);
		assert.strictEqual(newFolder.name, 'newFolder');
		assert.strictEqual((await userdataFileProvider.readdir(parent.resource)).length, 1);
		assert.strictEqual((await userdataFileProvider.stat(newFolderResource)).type, FileType.Directory);

		assert.ok(event);
		assert.strictEqual(event!.resource.path, newFolderResource.path);
		assert.strictEqual(event!.operation, FileOperation.CREATE);
		assert.strictEqual(event!.target!.resource.path, newFolderResource.path);
		assert.strictEqual(event!.target!.isDirectory, true);
	});

	test('createFolder: creating multiple folders at once', async () => {
		let event: FileOperationEvent;
		disposables.add(service.onDidRunOperation(e => event = e));

		const multiFolderPaths = ['a', 'couple', 'of', 'folders'];
		const parent = await service.resolve(userdataURIFromPaths([]));
		const newFolderResource = joinPath(parent.resource, ...multiFolderPaths);

		const newFolder = await service.createFolder(newFolderResource);

		const lastFolderName = multiFolderPaths[multiFolderPaths.length - 1];
		assert.strictEqual(newFolder.name, lastFolderName);
		assert.strictEqual((await userdataFileProvider.stat(newFolderResource)).type, FileType.Directory);

		assert.ok(event!);
		assert.strictEqual(event!.resource.path, newFolderResource.path);
		assert.strictEqual(event!.operation, FileOperation.CREATE);
		assert.strictEqual(event!.target!.resource.path, newFolderResource.path);
		assert.strictEqual(event!.target!.isDirectory, true);
	});

	test('exists', async () => {
		let exists = await service.exists(userdataURIFromPaths([]));
		assert.strictEqual(exists, true);

		exists = await service.exists(userdataURIFromPaths(['hello']));
		assert.strictEqual(exists, false);
	});

	test('resolve - file', async () => {
		await initFixtures();

		const resource = userdataURIFromPaths(['fixtures', 'resolver', 'index.html']);
		const resolved = await service.resolve(resource);

		assert.strictEqual(resolved.name, 'index.html');
		assert.strictEqual(resolved.isFile, true);
		assert.strictEqual(resolved.isDirectory, false);
		assert.strictEqual(resolved.isSymbolicLink, false);
		assert.strictEqual(resolved.resource.toString(), resource.toString());
		assert.strictEqual(resolved.children, undefined);
		assert.ok(resolved.size! > 0);
	});

	test('resolve - directory', async () => {
		await initFixtures();

		const testsElements = ['examples', 'other', 'index.html', 'site.css'];

		const resource = userdataURIFromPaths(['fixtures', 'resolver']);
		const result = await service.resolve(resource);

		assert.ok(result);
		assert.strictEqual(result.resource.toString(), resource.toString());
		assert.strictEqual(result.name, 'resolver');
		assert.ok(result.children);
		assert.ok(result.children!.length > 0);
		assert.ok(result!.isDirectory);
		assert.strictEqual(result.children!.length, testsElements.length);

		assert.ok(result.children!.every(entry => {
			return testsElements.some(name => {
				return basename(entry.resource) === name;
			});
		}));

		result.children!.forEach(value => {
			assert.ok(basename(value.resource));
			if (['examples', 'other'].indexOf(basename(value.resource)) >= 0) {
				assert.ok(value.isDirectory);
				assert.strictEqual(value.mtime, undefined);
				assert.strictEqual(value.ctime, undefined);
			} else if (basename(value.resource) === 'index.html') {
				assert.ok(!value.isDirectory);
				assert.ok(!value.children);
				assert.strictEqual(value.mtime, undefined);
				assert.strictEqual(value.ctime, undefined);
			} else if (basename(value.resource) === 'site.css') {
				assert.ok(!value.isDirectory);
				assert.ok(!value.children);
				assert.strictEqual(value.mtime, undefined);
				assert.strictEqual(value.ctime, undefined);
			} else {
				assert.ok(!'Unexpected value ' + basename(value.resource));
			}
		});
	});

	test('createFile', async () => {
		return assertCreateFile(contents => VSBuffer.fromString(contents));
	});

	test('createFile (readable)', async () => {
		return assertCreateFile(contents => bufferToReadable(VSBuffer.fromString(contents)));
	});

	test('createFile (stream)', async () => {
		return assertCreateFile(contents => bufferToStream(VSBuffer.fromString(contents)));
	});

	async function assertCreateFile(converter: (content: string) => VSBuffer | VSBufferReadable | VSBufferReadableStream): Promise<void> {
		let event: FileOperationEvent;
		disposables.add(service.onDidRunOperation(e => event = e));

		const contents = 'Hello World';
		const resource = userdataURIFromPaths(['test.txt']);

		assert.strictEqual(await service.canCreateFile(resource), true);
		const fileStat = await service.createFile(resource, converter(contents));
		assert.strictEqual(fileStat.name, 'test.txt');
		assert.strictEqual((await userdataFileProvider.stat(fileStat.resource)).type, FileType.File);
		assert.strictEqual(new TextDecoder().decode(await userdataFileProvider.readFile(fileStat.resource)), contents);

		assert.ok(event!);
		assert.strictEqual(event!.resource.path, resource.path);
		assert.strictEqual(event!.operation, FileOperation.CREATE);
		assert.strictEqual(event!.target!.resource.path, resource.path);
	}

	const makeBatchTester = (size: number, name: string) => {
		const batch = Array.from({ length: size }).map((_, i) => ({ contents: `Hello${i}`, resource: userdataURIFromPaths(['batched', name, `Hello${i}.txt`]) }));
		let stats: Promise<IFileStatWithMetadata[]> | undefined = undefined;
		return {
			async create() {
				return stats = Promise.all(batch.map(entry => service.createFile(entry.resource, VSBuffer.fromString(entry.contents))));
			},
			async assertContentsCorrect() {
				await Promise.all(batch.map(async (entry, i) => {
					if (!stats) { throw Error('read called before create'); }
					const stat = (await stats!)[i];
					assert.strictEqual(stat.name, `Hello${i}.txt`);
					assert.strictEqual((await userdataFileProvider.stat(stat.resource)).type, FileType.File);
					assert.strictEqual(new TextDecoder().decode(await userdataFileProvider.readFile(stat.resource)), entry.contents);
				}));
			},
			async delete() {
				await service.del(userdataURIFromPaths(['batched', name]), { recursive: true, useTrash: false });
			},
			async assertContentsEmpty() {
				if (!stats) { throw Error('assertContentsEmpty called before create'); }
				await Promise.all((await stats).map(async stat => {
					const newStat = await userdataFileProvider.stat(stat.resource).catch(e => e.code);
					assert.strictEqual(newStat, FileSystemProviderErrorCode.FileNotFound);
				}));
			}
		};
	};

	test('createFile (small batch)', async () => {
		const tester = makeBatchTester(50, 'smallBatch');
		await tester.create();
		await tester.assertContentsCorrect();
		await tester.delete();
		await tester.assertContentsEmpty();
	});

	test('createFile (mixed parallel/sequential)', async () => {
		const single1 = makeBatchTester(1, 'single1');
		const single2 = makeBatchTester(1, 'single2');

		const batch1 = makeBatchTester(20, 'batch1');
		const batch2 = makeBatchTester(20, 'batch2');

		single1.create();
		batch1.create();
		await Promise.all([single1.assertContentsCorrect(), batch1.assertContentsCorrect()]);
		single2.create();
		batch2.create();
		await Promise.all([single2.assertContentsCorrect(), batch2.assertContentsCorrect()]);
		await Promise.all([single1.assertContentsCorrect(), batch1.assertContentsCorrect()]);

		await (Promise.all([single1.delete(), single2.delete(), batch1.delete(), batch2.delete()]));
		await (Promise.all([single1.assertContentsEmpty(), single2.assertContentsEmpty(), batch1.assertContentsEmpty(), batch2.assertContentsEmpty()]));
	});

	test('rename not existing resource', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));
		const sourceFile = joinPath(parent.resource, 'sourceFile');
		const targetFile = joinPath(parent.resource, 'targetFile');

		try {
			await service.move(sourceFile, targetFile, false);
		} catch (error) {
			assert.deepStrictEqual((<FileSystemProviderError>error).code, FileSystemProviderErrorCode.FileNotFound);
			return;
		}

		assert.fail('This should fail with error');
	});

	test('rename to an existing file without overwrite', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));
		const sourceFile = joinPath(parent.resource, 'sourceFile');
		await service.writeFile(sourceFile, VSBuffer.fromString('This is source file'));

		const targetFile = joinPath(parent.resource, 'targetFile');
		await service.writeFile(targetFile, VSBuffer.fromString('This is target file'));

		try {
			await service.move(sourceFile, targetFile, false);
		} catch (error) {
			assert.deepStrictEqual((<FileOperationError>error).fileOperationResult, FileOperationResult.FILE_MOVE_CONFLICT);
			return;
		}

		assert.fail('This should fail with error');
	});

	test('rename folder to an existing folder without overwrite', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));
		const sourceFolder = joinPath(parent.resource, 'sourceFolder');
		await service.createFolder(sourceFolder);
		const targetFolder = joinPath(parent.resource, 'targetFolder');
		await service.createFolder(targetFolder);

		try {
			await service.move(sourceFolder, targetFolder, false);
		} catch (error) {
			assert.deepStrictEqual((<FileOperationError>error).fileOperationResult, FileOperationResult.FILE_MOVE_CONFLICT);
			return;
		}

		assert.fail('This should fail with cannot overwrite error');
	});

	test('rename file to a folder', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));
		const sourceFile = joinPath(parent.resource, 'sourceFile');
		await service.writeFile(sourceFile, VSBuffer.fromString('This is source file'));

		const targetFolder = joinPath(parent.resource, 'targetFolder');
		await service.createFolder(targetFolder);

		try {
			await service.move(sourceFile, targetFolder, false);
		} catch (error) {
			assert.deepStrictEqual((<FileOperationError>error).fileOperationResult, FileOperationResult.FILE_MOVE_CONFLICT);
			return;
		}

		assert.fail('This should fail with error');
	});

	test('rename folder to a file', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));
		const sourceFolder = joinPath(parent.resource, 'sourceFile');
		await service.createFolder(sourceFolder);

		const targetFile = joinPath(parent.resource, 'targetFile');
		await service.writeFile(targetFile, VSBuffer.fromString('This is target file'));

		try {
			await service.move(sourceFolder, targetFile, false);
		} catch (error) {
			assert.deepStrictEqual((<FileOperationError>error).fileOperationResult, FileOperationResult.FILE_MOVE_CONFLICT);
			return;
		}

		assert.fail('This should fail with error');
	});

	test('rename file', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));
		const sourceFile = joinPath(parent.resource, 'sourceFile');
		await service.writeFile(sourceFile, VSBuffer.fromString('This is source file'));

		const targetFile = joinPath(parent.resource, 'targetFile');
		await service.move(sourceFile, targetFile, false);

		const content = await service.readFile(targetFile);
		assert.strictEqual(await service.exists(sourceFile), false);
		assert.strictEqual(content.value.toString(), 'This is source file');
	});

	test('rename to an existing file with overwrite', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));
		const sourceFile = joinPath(parent.resource, 'sourceFile');
		await service.writeFile(sourceFile, VSBuffer.fromString('This is source file'));

		const targetFile = joinPath(parent.resource, 'targetFile');
		await service.writeFile(targetFile, VSBuffer.fromString('This is target file'));

		await service.move(sourceFile, targetFile, true);

		const content = await service.readFile(targetFile);
		assert.strictEqual(await service.exists(sourceFile), false);
		assert.strictEqual(content.value.toString(), 'This is source file');
	});

	test('rename folder to a new folder', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));
		const sourceFolder = joinPath(parent.resource, 'sourceFolder');
		await service.createFolder(sourceFolder);

		const targetFolder = joinPath(parent.resource, 'targetFolder');
		await service.move(sourceFolder, targetFolder, false);

		assert.deepStrictEqual(await service.exists(sourceFolder), false);
		assert.deepStrictEqual(await service.exists(targetFolder), true);
	});

	test('rename folder to an existing folder', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));
		const sourceFolder = joinPath(parent.resource, 'sourceFolder');
		await service.createFolder(sourceFolder);
		const targetFolder = joinPath(parent.resource, 'targetFolder');
		await service.createFolder(targetFolder);

		await service.move(sourceFolder, targetFolder, true);

		assert.deepStrictEqual(await service.exists(sourceFolder), false);
		assert.deepStrictEqual(await service.exists(targetFolder), true);
	});

	test('rename a folder that has multiple files and folders', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));

		const sourceFolder = joinPath(parent.resource, 'sourceFolder');
		const sourceFile1 = joinPath(sourceFolder, 'folder1', 'file1');
		await service.writeFile(sourceFile1, VSBuffer.fromString('Source File 1'));
		const sourceFile2 = joinPath(sourceFolder, 'folder2', 'file1');
		await service.writeFile(sourceFile2, VSBuffer.fromString('Source File 2'));
		const sourceEmptyFolder = joinPath(sourceFolder, 'folder3');
		await service.createFolder(sourceEmptyFolder);

		const targetFolder = joinPath(parent.resource, 'targetFolder');
		const targetFile1 = joinPath(targetFolder, 'folder1', 'file1');
		const targetFile2 = joinPath(targetFolder, 'folder2', 'file1');
		const targetEmptyFolder = joinPath(targetFolder, 'folder3');

		await service.move(sourceFolder, targetFolder, false);

		assert.deepStrictEqual(await service.exists(sourceFolder), false);
		assert.deepStrictEqual(await service.exists(targetFolder), true);
		assert.strictEqual((await service.readFile(targetFile1)).value.toString(), 'Source File 1');
		assert.strictEqual((await service.readFile(targetFile2)).value.toString(), 'Source File 2');
		assert.deepStrictEqual(await service.exists(targetEmptyFolder), true);
	});

	test('rename a folder to another folder that has some files', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));

		const sourceFolder = joinPath(parent.resource, 'sourceFolder');
		const sourceFile1 = joinPath(sourceFolder, 'folder1', 'file1');
		await service.writeFile(sourceFile1, VSBuffer.fromString('Source File 1'));

		const targetFolder = joinPath(parent.resource, 'targetFolder');
		const targetFile1 = joinPath(targetFolder, 'folder1', 'file1');
		const targetFile2 = joinPath(targetFolder, 'folder1', 'file2');
		await service.writeFile(targetFile2, VSBuffer.fromString('Target File 2'));
		const targetFile3 = joinPath(targetFolder, 'folder2', 'file1');
		await service.writeFile(targetFile3, VSBuffer.fromString('Target File 3'));

		await service.move(sourceFolder, targetFolder, true);

		assert.deepStrictEqual(await service.exists(sourceFolder), false);
		assert.deepStrictEqual(await service.exists(targetFolder), true);
		assert.strictEqual((await service.readFile(targetFile1)).value.toString(), 'Source File 1');
		assert.strictEqual(await service.exists(targetFile2), false);
		assert.strictEqual(await service.exists(targetFile3), false);
	});

	test('deleteFile', async () => {
		await initFixtures();

		let event: FileOperationEvent;
		disposables.add(service.onDidRunOperation(e => event = e));

		const anotherResource = userdataURIFromPaths(['fixtures', 'service', 'deep', 'company.js']);
		const resource = userdataURIFromPaths(['fixtures', 'service', 'deep', 'conway.js']);
		const source = await service.resolve(resource);

		assert.strictEqual(await service.canDelete(source.resource, { useTrash: false }), true);
		await service.del(source.resource, { useTrash: false });

		assert.strictEqual(await service.exists(source.resource), false);
		assert.strictEqual(await service.exists(anotherResource), true);

		assert.ok(event!);
		assert.strictEqual(event!.resource.path, resource.path);
		assert.strictEqual(event!.operation, FileOperation.DELETE);

		{
			let error: Error | undefined = undefined;
			try {
				await service.del(source.resource, { useTrash: false });
			} catch (e) {
				error = e;
			}

			assert.ok(error);
			assert.strictEqual((<FileOperationError>error).fileOperationResult, FileOperationResult.FILE_NOT_FOUND);
		}
		await reload();
		{
			let error: Error | undefined = undefined;
			try {
				await service.del(source.resource, { useTrash: false });
			} catch (e) {
				error = e;
			}

			assert.ok(error);
			assert.strictEqual((<FileOperationError>error).fileOperationResult, FileOperationResult.FILE_NOT_FOUND);
		}
	});

	test('deleteFolder (recursive)', async () => {
		await initFixtures();
		let event: FileOperationEvent;
		disposables.add(service.onDidRunOperation(e => event = e));

		const resource = userdataURIFromPaths(['fixtures', 'service', 'deep']);
		const subResource1 = userdataURIFromPaths(['fixtures', 'service', 'deep', 'company.js']);
		const subResource2 = userdataURIFromPaths(['fixtures', 'service', 'deep', 'conway.js']);
		assert.strictEqual(await service.exists(subResource1), true);
		assert.strictEqual(await service.exists(subResource2), true);

		const source = await service.resolve(resource);

		assert.strictEqual(await service.canDelete(source.resource, { recursive: true, useTrash: false }), true);
		await service.del(source.resource, { recursive: true, useTrash: false });

		assert.strictEqual(await service.exists(source.resource), false);
		assert.strictEqual(await service.exists(subResource1), false);
		assert.strictEqual(await service.exists(subResource2), false);
		assert.ok(event!);
		assert.strictEqual(event!.resource.fsPath, resource.fsPath);
		assert.strictEqual(event!.operation, FileOperation.DELETE);
	});

	test('deleteFolder (non recursive)', async () => {
		await initFixtures();
		const resource = userdataURIFromPaths(['fixtures', 'service', 'deep']);
		const source = await service.resolve(resource);

		assert.ok((await service.canDelete(source.resource)) instanceof Error);

		let error;
		try {
			await service.del(source.resource);
		} catch (e) {
			error = e;
		}
		assert.ok(error);
	});

	test('delete empty folder', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));
		const folder = joinPath(parent.resource, 'folder');
		await service.createFolder(folder);

		await service.del(folder);

		assert.deepStrictEqual(await service.exists(folder), false);
	});

	test('delete empty folder with reccursive', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));
		const folder = joinPath(parent.resource, 'folder');
		await service.createFolder(folder);

		await service.del(folder, { recursive: true });

		assert.deepStrictEqual(await service.exists(folder), false);
	});

	test('deleteFolder with folders and files (recursive)', async () => {
		const parent = await service.resolve(userdataURIFromPaths([]));

		const targetFolder = joinPath(parent.resource, 'targetFolder');
		const file1 = joinPath(targetFolder, 'folder1', 'file1');
		await service.createFile(file1);
		const file2 = joinPath(targetFolder, 'folder2', 'file1');
		await service.createFile(file2);
		const emptyFolder = joinPath(targetFolder, 'folder3');
		await service.createFolder(emptyFolder);

		await service.del(targetFolder, { recursive: true });

		assert.deepStrictEqual(await service.exists(targetFolder), false);
		assert.deepStrictEqual(await service.exists(joinPath(targetFolder, 'folder1')), false);
		assert.deepStrictEqual(await service.exists(joinPath(targetFolder, 'folder2')), false);
		assert.deepStrictEqual(await service.exists(file1), false);
		assert.deepStrictEqual(await service.exists(file2), false);
		assert.deepStrictEqual(await service.exists(emptyFolder), false);
	});
});
