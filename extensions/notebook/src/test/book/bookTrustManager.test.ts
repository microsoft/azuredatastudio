/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import { IBookTrustManager, BookTrustManager } from '../../book/bookTrustManager';

describe('BookTrustManagerTests', function () {

	describe('TrustingInWorkspaces', () => {
		let bookTrustManager: IBookTrustManager;
		let trustedSubFolders: string[];
		let workspaceDetails: object;
		let books: any[];

		this.beforeEach(() => {
			trustedSubFolders = ['/SubFolder/'];

			workspaceDetails = {
				getConfiguration: () => {
					return {
						get: () => trustedSubFolders,
						update: () => { }
					};
				},
				workspaceFolders: [
					{
						uri: {
							fsPath: '/temp/'
						}
					},
					{
						uri: {
							fsPath: '/temp2/'
						}
					},
				]
			};

			books = [{
				bookItems: [
					{
						book: {
							root: '/temp/SubFolder/',
							tableOfContents: {
								sections: [
									{
										url: '\\sample\\notebook'
									},
									{
										url: '\\sample\\notebook2'
									}
								]
							}
						},
					},
					{
						book: {
							root: '/temp/SubFolder2/',
							tableOfContents: {
								sections: [
									{
										url: '\\sample\\notebook'
									}
								]
							}
						},
					},
				]
			},
			{
				bookItems: [
					{
						book: {
							root: '/temp2/SubFolder3/',
							tableOfContents: {
								sections: [
									{
										url: '\\sample\\notebook'
									}
								]
							}
						},
					}
				]
			}];
			// @ts-ignore
			bookTrustManager = new BookTrustManager(books, workspaceDetails);
		});

		it('should trust notebooks in a trusted book within a workspace', async () => {
			let notebookUri1 = '/temp/SubFolder/content/sample/notebook.ipynb';
			let notebookUri2 = '/temp/SubFolder/content/sample/notebook2.ipynb';

			let isNotebook1Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri1);
			let isNotebook2Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri2);

			should(isNotebook1Trusted).be.true("Notebook 1 should be trusted");
			should(isNotebook2Trusted).be.true("Notebook 2 should be trusted");

		});

		it('should NOT trust a notebook in an untrusted book within a workspace', async () => {
			let notebookUri = '/temp/SubFolder2/content/sample/notebook.ipynb';
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false("Notebook should be trusted");
		});

		it('should trust notebook after book has been trusted within a workspace', async () => {
			let notebookUri = '/temp/SubFolder2/content/sample/notebook.ipynb';
			let isNotebookTrustedBeforeChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedBeforeChange).be.false("Notebook should NOT be trusted");

			// add the notebook
			trustedSubFolders.push('/SubFolder2/');

			let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedAfterChange).be.true("Notebook should be trusted");
		});

		it('should NOT trust a notebook when untrusting a book within a workspace', async () => {
			let notebookUri = '/temp/SubFolder/content/sample/notebook.ipynb';
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.true("Notebook should be trusted");

			// remove trusted subfolders
			trustedSubFolders = [];

			let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedAfterChange).be.false("Notebook should not be trusted after book removal");
		});

		it('should NOT trust an unknown book within a workspace', async () => {
			let notebookUri = '/randomfolder/randomsubfolder/content/randomnotebook.ipynb';
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false("Random notebooks should not be trusted");
		});

		it('should NOT trust notebook inside trusted subfolder when absent in table of contents ', async() => {
			bookTrustManager.setBookAsTrusted('/temp/SubFolder/');

			let notebookUri = '/temp/SubFolder/content/sample/notInToc.ipynb';

			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false("Notebook should NOT be trusted");
		});
	});

	describe('TrustingInFolder', () => {

		let bookTrustManager: IBookTrustManager;
		let trustedFolders: string[];
		let workspaceDetails: object;
		let books: any[];

		this.beforeEach(() => {
			trustedFolders = ['/temp/SubFolder/'];

			workspaceDetails = {
				// @ts-ignore
				getConfiguration: () => {
					return {
						get: () => trustedFolders,
						update: () => { }
					};
				},
				workspaceFolders: []
			};

			books = [{
				bookItems: [
					{
						book: {
							root: '/temp/SubFolder/',
							tableOfContents: {
								sections: [
									{
										url: '\\sample\\notebook'
									},
									{
										url: '\\sample\\notebook2'
									}
								]
							}
						},
					}]
			}, {
				bookItems: [
					{
						book: {
							root: '/temp/SubFolder2/',
							tableOfContents: {
								sections: [
									{
										url: '\\sample\\notebook'
									},
									{
										url: '\\sample\\notebook2'
									}
								]
							}
						},
					},
				]
			}];
			// @ts-ignore
			bookTrustManager = new BookTrustManager(books, workspaceDetails);
		});

		it('should trust notebooks in a trusted book in a folder', async () => {
			bookTrustManager.setBookAsTrusted('/temp/SubFolder/');

			let notebookUri1 = '/temp/SubFolder/content/sample/notebook.ipynb';
			let notebookUri2 = '/temp/SubFolder/content/sample/notebook2.ipynb';

			let isNotebook1Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri1);
			let isNotebook2Trusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri2);

			should(isNotebook1Trusted).be.true("Notebook 1 should be trusted");
			should(isNotebook2Trusted).be.true("Notebook 2 should be trusted");

		});

		it('should NOT trust a notebook in an untrusted book in a folder', async () => {
			let notebookUri = '/temp/SubFolder2/content/sample/notebook.ipynb';
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false("Notebook should be trusted");
		});

		it('should trust notebook after book has been added to a folder', async () => {
			let notebookUri = '/temp/SubFolder2/content/sample/notebook.ipynb';
			let isNotebookTrustedBeforeChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedBeforeChange).be.false("Notebook should NOT be trusted");

			bookTrustManager.setBookAsTrusted('/temp/SubFolder2/');

			let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedAfterChange).be.true("Notebook should be trusted");
		});

		it('should NOT trust a notebook when untrusting a book in folder', async () => {
			bookTrustManager.setBookAsTrusted('/temp/SubFolder/');
			let notebookUri = '/temp/SubFolder/content/sample/notebook.ipynb';
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.true("Notebook should be trusted");

			bookTrustManager.setBookAsUntrusted('/temp/SubFolder/');

			let isNotebookTrustedAfterChange = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrustedAfterChange).be.false("Notebook should not be trusted after book removal");
		});

		it('should NOT trust an unknown book', async () => {
			let notebookUri = '/randomfolder/randomsubfolder/content/randomnotebook.ipynb';
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false("Random notebooks should not be trusted");
		});

		it('should NOT trust notebook inside trusted subfolder when absent in table of contents ', async() => {
			bookTrustManager.setBookAsTrusted('/temp/SubFolder/');

			let notebookUri = '/temp/SubFolder/content/sample/notInToc.ipynb';

			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false("Notebook should NOT be trusted");
		});

	});

	describe('TrustingFQN', () => {

		let bookTrustManager: IBookTrustManager;
		let trustedFolders: string[];
		let workspaceDetails: object;
		let books: any[];

		this.beforeEach(() => {
			trustedFolders = ['/temp/SubFolder/'];

			workspaceDetails = {
				// @ts-ignore
				getConfiguration: () => {
					return {
						get: () => trustedFolders,
						update: () => { }
					};
				},
				workspaceFolders: []
			};

			books = [{
				bookItems: [{
					book: {
						root: '/temp/SubFolder/',
						tableOfContents: {
							sections: [
								{
									url: 'temp\\SubFolder\\content\\sample\\notebook'
								},
								{
									url: 'temp\\SubFolder\\content\\sample\\notebook2'
								}
							]
						}
					}
				}]
			}];
			// @ts-ignore
			bookTrustManager = new BookTrustManager(books, workspaceDetails);
		});

		it('should trust notebooks that contain fqn in the uri', async () => {
			bookTrustManager.setBookAsTrusted('/temp/SubFolder/');

			let notebookUri = '/temp/SubFolder/content/sample/notebook.ipynb';
			let isNotebookTrusted = bookTrustManager.isNotebookTrustedByDefault(notebookUri);

			should(isNotebookTrusted).be.false("Notebook should be trusted");
		});
	});
});
