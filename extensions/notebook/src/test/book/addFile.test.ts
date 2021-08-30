/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as should from 'should';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { AddFileDialog } from '../../dialog/addFileDialog';
import { IBookTocManager } from '../../book/bookTocManager';
import { BookTreeItem, BookTreeItemFormat, BookTreeItemType } from '../../book/bookTreeItem';
import * as utils from '../../common/utils';
import * as sinon from 'sinon';
import { TocEntryPathHandler } from '../../book/tocEntryPathHandler';

describe('Add File Dialog', function () {
	let bookTocManager: IBookTocManager;
	let bookTreeItem: BookTreeItem;
	const fileExtension = utils.FileExtension.Notebook;
	let bookItemFormat: BookTreeItemFormat;

	beforeEach(() => {
		let mockBookManager = TypeMoq.Mock.ofType<IBookTocManager>();
		mockBookManager.setup(m => m.addNewFile(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
		bookTocManager = mockBookManager.object;

		let mockTreeItem = TypeMoq.Mock.ofType<BookTreeItem>();
		mockTreeItem.setup(i => i.contextValue).returns(() => BookTreeItemType.savedBook);
		mockTreeItem.setup(i => i.rootContentPath).returns(() => '');

		let mockItemFormat = TypeMoq.Mock.ofType<BookTreeItemFormat>();
		mockItemFormat.setup(f => f.contentPath).returns(() => '');
		bookItemFormat = mockItemFormat.object;

		mockTreeItem.setup(i => i.book).returns(() => bookItemFormat);
		bookTreeItem = mockTreeItem.object;
	});

	it('Create dialog', async () => {
		let fileDialog = new AddFileDialog(bookTocManager, bookTreeItem, fileExtension);
		await fileDialog.createDialog();
		should(fileDialog.dialog).not.be.undefined();
		should(fileDialog.dialog.message).be.undefined();
	});

	it('Validate path', async () => {
		let fileDialog = new AddFileDialog(bookTocManager, bookTreeItem, fileExtension);
		await fileDialog.createDialog();

		let tempDir = os.tmpdir();
		let testDir = path.join(tempDir, utils.generateGuid());
		let fileBasename = 'addFileDialogTest.ipynb';
		let testFilePath = path.join(testDir, fileBasename);

		// Folder doesn't exist
		await should(fileDialog.validatePath(testDir, fileBasename)).be.rejected();

		// Folder exists
		await fs.mkdir(testDir);
		await should(fileDialog.validatePath(testDir, fileBasename)).not.be.rejected();

		// File Exists, but don't choose to overwrite
		sinon.stub(utils, 'confirmMessageDialog').resolves(false);
		await fs.createFile(testFilePath);
		await should(fileDialog.validatePath(testDir, fileBasename)).be.rejected();
		sinon.restore();

		// File exists, choose to overwrite
		sinon.stub(utils, 'confirmMessageDialog').resolves(true);
		await should(fileDialog.validatePath(testDir, fileBasename)).not.be.rejected();
		sinon.restore();
	});

	it('Create file', async () => {
		let tempDir = os.tmpdir();
		let testDir = path.join(tempDir, utils.generateGuid());
		let testFileName = 'addFileDialogTest';
		let posixFilePath = path.posix.join(testDir, testFileName).concat(fileExtension);
		let testTitle = 'Test Title';

		await fs.mkdir(testDir);

		// Error case
		let mockBookManager = TypeMoq.Mock.ofType<IBookTocManager>();
		mockBookManager.setup(m => m.addNewFile(TypeMoq.It.isAny(), TypeMoq.It.isAny())).throws(new Error('Expected test error.'));

		let fileDialog = new AddFileDialog(mockBookManager.object, bookTreeItem, fileExtension);
		await fileDialog.createDialog();

		await should(fileDialog.createFile(testFileName, testTitle)).be.resolvedWith(false);
		should(fileDialog.dialog?.message).not.be.undefined();

		sinon.restore();

		// Success case
		let testPathDetails: TocEntryPathHandler[] = [];
		mockBookManager = TypeMoq.Mock.ofType<IBookTocManager>();
		mockBookManager.setup(m => m.addNewFile(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((path, item) => { testPathDetails.push(path); return Promise.resolve(); });

		let mockTreeItem = TypeMoq.Mock.ofType<BookTreeItem>();
		mockTreeItem.setup(i => i.contextValue).returns(() => BookTreeItemType.savedBook);
		mockTreeItem.setup(i => i.rootContentPath).returns(() => testDir);

		fileDialog = new AddFileDialog(mockBookManager.object, mockTreeItem.object, fileExtension);
		await fileDialog.createDialog();

		let createFileResult = await fileDialog.createFile(testFileName, testTitle);
		should(fileDialog.dialog.message).be.undefined();
		should(createFileResult).be.true('createFile call should succeed.');

		should(testPathDetails.length).eql(1, 'Should only create one TocEntryPathHandler on success.');
		should(testPathDetails[0]).be.deepEqual(new TocEntryPathHandler(posixFilePath, testDir, testTitle), 'Should get the expected TocEntryPathHandler info on success.');

		sinon.restore();
	});
});
