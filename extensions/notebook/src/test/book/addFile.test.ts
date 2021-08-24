/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import * as should from 'should';
import { AddFileDialog } from '../../dialog/addFileDialog';
import { IBookTocManager } from '../../book/bookTocManager';
import { BookTreeItem, BookTreeItemFormat } from '../../book/bookTreeItem';
import { FileExtension } from '../../common/utils';

describe('Add File Dialog', function () {
	let bookTocManager: IBookTocManager;
	let bookTreeItem: BookTreeItem;
	let fileExtension: FileExtension;
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

		mockTreeItem.setup(i => i.book).returns(() => mockItemFormat.object);
		bookTreeItem = mockTreeItem.object;
		bookItemFormat = mockItemFormat.object;

		let mockFileExtension = TypeMoq.Mock.ofType<FileExtension>();
		fileExtension = mockFileExtension.object;
	});

	it('Start dialog test', async () => {
		let dialog = new AddFileDialog(bookTocManager, bookTreeItem, fileExtension);
		await dialog.createDialog();
		azdata.window.closeDialog(dialog.dialog);
		await should(dialog.dialog.message).be.undefined();
	});

	it('Validate path test', async () => {
		let dialog = new AddFileDialog(bookTocManager, bookTreeItem, fileExtension);
		await dialog.validatePath(undefined, undefined);
		azdata.window.closeDialog(dialog.dialog);
	});
});
