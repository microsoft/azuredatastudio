/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import * as should from 'should';
import * as TypeMoq from 'typemoq';
import { BookTreeViewProvider } from '../../book/bookTreeView';
import { BookTreeItem, BookTreeItemType } from '../../book/bookTreeItem';
// import { IContextKeyService } from '../../../../../src/vs/platform/contextkey/common/contextkey';
// import { MockContextKeyService } from '../../../../../src/vs/platform/keybinding/test/common/mockKeybindingService';

// const mockTableOfContents = [
// 	{
// 		title: '1_Notebook',
// 		url: '/path/to/notebook'
// 	},
// 	{
// 		title: '2_Markdown',
// 		url: '/path/to/markdown'
// 	},
// 	{
// 		title: '3_External_Link',
// 		url: '/path/to/external_link'
// 	}
// ];

// const mockConfig = {
// 	title: 'Title of Book'
// }

const mockBookTreeItem = new BookTreeItem({
	title: 'mock_title',
	root: 'mock/root/path',
	tableOfContents: [''],
	page: [''],
	type: BookTreeItemType.Book
},
	{
		light: 'path/to/book.svg',
		dark: 'path/to/book_inverse.svg'
	}
);

const mockNotebookTreeItem = new BookTreeItem({
	title: 'mock_title',
	root: 'mock/root/path',
	tableOfContents: [''],
	page: [''],
	type: BookTreeItemType.Notebook
},
	{
		light: 'path/to/notebook.svg',
		dark: 'path/to/notebook_inverse.svg'
	}
);

const mockMarkdownTreeItem = new BookTreeItem({
	title: 'mock_title',
	root: 'mock/root/path',
	tableOfContents: [''],
	page: [''],
	type: BookTreeItemType.Markdown
},
	{
		light: 'path/to/markdown.svg',
		dark: 'path/to/markdown_inverse.svg'
	}
);

const mockExternalLinkTreeItem = new BookTreeItem({
	title: 'mock_title',
	root: 'mock/root/path',
	tableOfContents: [''],
	page: [''],
	type: BookTreeItemType.ExternalLink
},
	{
		light: 'path/to/link.svg',
		dark: 'path/to/link_inverse.svg'
	}
);

describe('BookTreeViewProvider', function (): void {
	let mockBookTreeViewProvider: TypeMoq.IMock<BookTreeViewProvider>;
	// let mockIContextKeyService: TypeMoq.IMock<IContextKeyService>;

	this.beforeEach(() => {
		mockBookTreeViewProvider = TypeMoq.Mock.ofType<BookTreeViewProvider>();
		// mockIContextKeyService = TypeMoq.Mock.ofType<IContextKeyService>();
	});

	it('bookOpened should be false if there are no toc.yml files in folder', async function (): Promise<void> {
		mockBookTreeViewProvider.setup(x => x.getTocFiles('')).returns(() => []);
		// should.equal(mockIContextKeyService.object.getContextKeyValue('bookOpened'), false);
	});

	it('bookOpened should be true if there are toc.yml files in folder', async function (): Promise<void> {
		mockBookTreeViewProvider.setup(x => x.getTocFiles('')).returns(() => ['path/to/toc.yml']);
		// should.equal(mockIContextKeyService.object.getContextKeyValue('bookOpened'), false);
	});

});

describe('BookTreeViewProvider.getChildren', function (): void {
	// let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
	let mockBookTreeViewProvider: TypeMoq.IMock<BookTreeViewProvider>;

	this.beforeEach(() => {
		// mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockBookTreeViewProvider = TypeMoq.Mock.ofType<BookTreeViewProvider>();
		mockBookTreeViewProvider.setup(x => x.getBooks()).returns(() => [mockBookTreeItem]);
		mockBookTreeViewProvider.setup(x => x.getChildren(mockBookTreeItem)).returns(() => Promise.resolve([mockNotebookTreeItem, mockMarkdownTreeItem, mockExternalLinkTreeItem]));
	});

	it('should get all pages in book', async function (): Promise<void> {

	});


});
