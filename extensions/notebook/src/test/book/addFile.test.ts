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
	let fileExtension: utils.FileExtension;
	let bookItemFormat: BookTreeItemFormat;
	const rootContentPath = 'testRoot';

	beforeEach(() => {
		let mockBookManager = TypeMoq.Mock.ofType<IBookTocManager>();
		mockBookManager.setup(m => m.addNewFile(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
		bookTocManager = mockBookManager.object;

		let mockTreeItem = TypeMoq.Mock.ofType<BookTreeItem>();
		mockTreeItem.setup(i => i.contextValue).returns(() => BookTreeItemType.savedBook);
		mockTreeItem.setup(i => i.rootContentPath).returns(() => rootContentPath);

		let mockItemFormat = TypeMoq.Mock.ofType<BookTreeItemFormat>();
		mockItemFormat.setup(f => f.contentPath).returns(() => undefined);
		bookItemFormat = mockItemFormat.object;

		mockTreeItem.setup(i => i.book).returns(() => bookItemFormat);
		bookTreeItem = mockTreeItem.object;

		let mockFileExtension = TypeMoq.Mock.ofType<utils.FileExtension>();
		fileExtension = mockFileExtension.object;
	});

	it('Start dialog test', async () => {
		let fileDialog = new AddFileDialog(bookTocManager, bookTreeItem, fileExtension);
		await fileDialog.createDialog();
		should(fileDialog.dialog).not.be.undefined();
		should(fileDialog.dialog.message).be.undefined();
	});

	it('Validate path test', async () => {
		let fileDialog = new AddFileDialog(bookTocManager, bookTreeItem, fileExtension);
		await fileDialog.createDialog();

		let tempDir = os.tmpdir();
		let testDir = path.join(tempDir, utils.generateGuid());
		let fileBasename = 'addFileDialogTest.txt';
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

	it('Create File test', async () => {
		let fileDialog = new AddFileDialog(bookTocManager, bookTreeItem, fileExtension);
		await fileDialog.createDialog();

		// Error case
		sinon.stub(fileDialog, 'fileName').returns('');
		sinon.stub(fileDialog, 'validatePath').rejects(new Error('Expected test error'));

		await should(fileDialog.createFile()).be.resolvedWith(false);
		should(fileDialog.dialog?.message).not.be.undefined();

		sinon.restore();

		// Success case
		let testPathDetails: TocEntryPathHandler[] = [];
		let mockBookManager = TypeMoq.Mock.ofType<IBookTocManager>();
		mockBookManager.setup(m => m.addNewFile(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((path, item) => { testPathDetails.push(path); return Promise.resolve(); });

		fileDialog = new AddFileDialog(mockBookManager.object, bookTreeItem, fileExtension);
		await fileDialog.createDialog();

		let testFileName = 'testFile.txt';
		sinon.stub(fileDialog, 'fileName').returns(testFileName);
		let testTitle = 'Test Title';
		sinon.stub(fileDialog, 'titleName').returns(testTitle);
		sinon.stub(fileDialog, 'validatePath').resolves();

		await should(fileDialog.createFile()).be.resolvedWith(true);
		should(fileDialog.dialog.message).be.undefined();

		should(testPathDetails.length).be.eql(1);
		should(testPathDetails[0]).be.deepEqual(new TocEntryPathHandler(testFileName, rootContentPath, testTitle));

		sinon.restore();
	});
});
