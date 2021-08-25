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
import { BookTreeItem, BookTreeItemFormat } from '../../book/bookTreeItem';
import * as utils from '../../common/utils';
import * as sinon from 'sinon';

describe('Add File Dialog', function () {
	let bookTocManager: IBookTocManager;
	let bookTreeItem: BookTreeItem;
	let fileExtension: utils.FileExtension;
	let bookItemFormat: BookTreeItemFormat;

	beforeEach(() => {
		let mockBookManager = TypeMoq.Mock.ofType<IBookTocManager>();
		mockBookManager.setup(m => m.addNewFile(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
		bookTocManager = mockBookManager.object;

		let mockTreeItem = TypeMoq.Mock.ofType<BookTreeItem>();
		mockTreeItem.setup(i => i.contextValue).returns(() => undefined);
		mockTreeItem.setup(i => i.rootContentPath).returns(() => undefined);

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
		let dialog = new AddFileDialog(bookTocManager, bookTreeItem, fileExtension);

		let tempDir = os.tmpdir();
		let testDir = path.join(tempDir, utils.generateGuid());
		let fileBasename = 'addFileDialogTest.txt';
		let testFilePath = path.join(testDir, fileBasename);

		// Folder doesn't exist
		await should(dialog.validatePath(testDir, fileBasename)).be.rejected();

		// Folder exists
		await fs.mkdir(testDir);
		await should(dialog.validatePath(testDir, fileBasename)).not.be.rejected();

		// File Exists, but don't choose to overwrite
		sinon.stub(utils, 'confirmMessageDialog').resolves(false);
		await fs.createFile(testFilePath);
		await should(dialog.validatePath(testDir, fileBasename)).be.rejected();
		sinon.restore();

		// File exists, choose to overwrite
		sinon.stub(utils, 'confirmMessageDialog').resolves(true);
		await should(dialog.validatePath(testDir, fileBasename)).not.be.rejected();
		sinon.restore();
	});
});
