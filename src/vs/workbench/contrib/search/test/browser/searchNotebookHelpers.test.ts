/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Range } from 'vs/editor/common/core/range';
import { FindMatch, IReadonlyTextBuffer } from 'vs/editor/common/model';
import { IFileMatch, ISearchRange, ITextSearchMatch, QueryType } from 'vs/workbench/services/search/common/search';
import { ICellViewModel } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import { CellKind } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { contentMatchesToTextSearchMatches, webviewMatchesToTextSearchMatches } from 'vs/workbench/contrib/search/browser/searchNotebookHelpers';
import { CellFindMatchModel } from 'vs/workbench/contrib/notebook/browser/contrib/find/findModel';
import { CellMatch, FileMatch, FolderMatch, SearchModel, textSearchMatchesToNotebookMatches } from 'vs/workbench/contrib/search/browser/searchModel';
import { URI } from 'vs/base/common/uri';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { createFileUriFromPathFromRoot, stubModelService, stubNotebookEditorService } from 'vs/workbench/contrib/search/test/browser/searchTestCommon';
import { IModelService } from 'vs/editor/common/services/model';
import { INotebookEditorService } from 'vs/workbench/contrib/notebook/browser/services/notebookEditorService';

suite('searchNotebookHelpers', () => {
	let instantiationService: TestInstantiationService;
	let mdCellFindMatch: CellFindMatchModel;
	let codeCellFindMatch: CellFindMatchModel;
	let mdInputCell: ICellViewModel;
	let codeCell: ICellViewModel;

	let markdownContentResults: ITextSearchMatch[];
	let codeContentResults: ITextSearchMatch[];
	let codeWebviewResults: ITextSearchMatch[];
	let counter: number = 0;
	setup(() => {

		instantiationService = new TestInstantiationService();
		instantiationService.stub(IModelService, stubModelService(instantiationService));
		instantiationService.stub(INotebookEditorService, stubNotebookEditorService(instantiationService));
		mdInputCell = {
			cellKind: CellKind.Markup, textBuffer: <IReadonlyTextBuffer>{
				getLineContent(lineNumber: number): string {
					if (lineNumber === 1) {
						return '# Hello World Test';
					} else {
						return '';
					}
				}
			}
		} as ICellViewModel;

		const findMatchMds = [new FindMatch(new Range(1, 15, 1, 19), ['Test'])];
		codeCell = {
			cellKind: CellKind.Code, textBuffer: <IReadonlyTextBuffer>{
				getLineContent(lineNumber: number): string {
					if (lineNumber === 1) {
						return 'print("test! testing!!")';
					} else if (lineNumber === 2) {
						return 'print("this is a Test")';
					} else {
						return '';
					}
				}
			}
		} as ICellViewModel;
		const findMatchCodeCells =
			[new FindMatch(new Range(1, 8, 1, 12), ['test']),
			new FindMatch(new Range(1, 14, 1, 18), ['test']),
			new FindMatch(new Range(2, 18, 2, 22), ['Test'])
			];

		const webviewMatches = [{
			index: 0,
			searchPreviewInfo: {
				line: 'test! testing!!',
				range: {
					start: 1,
					end: 5
				}
			}
		},
		{
			index: 1,
			searchPreviewInfo: {
				line: 'test! testing!!',
				range: {
					start: 7,
					end: 11
				}
			}
		},
		{
			index: 3,
			searchPreviewInfo: {
				line: 'this is a Test',
				range: {
					start: 11,
					end: 15
				}
			}
		}

		];


		mdCellFindMatch = new CellFindMatchModel(
			mdInputCell,
			0,
			findMatchMds,
			[],
		);

		codeCellFindMatch = new CellFindMatchModel(
			codeCell,
			5,
			findMatchCodeCells,
			webviewMatches
		);

	});

	teardown(() => {
		instantiationService.dispose();
	});

	suite('notebookEditorMatchesToTextSearchResults', () => {

		function assertRangesEqual(actual: ISearchRange | ISearchRange[], expected: ISearchRange[]) {
			if (!Array.isArray(actual)) {
				actual = [actual];
			}

			assert.strictEqual(actual.length, expected.length);
			actual.forEach((r, i) => {
				const expectedRange = expected[i];
				assert.deepStrictEqual(
					{ startLineNumber: r.startLineNumber, startColumn: r.startColumn, endLineNumber: r.endLineNumber, endColumn: r.endColumn },
					{ startLineNumber: expectedRange.startLineNumber, startColumn: expectedRange.startColumn, endLineNumber: expectedRange.endLineNumber, endColumn: expectedRange.endColumn });
			});
		}

		test('convert CellFindMatchModel to ITextSearchMatch and check results', () => {
			markdownContentResults = contentMatchesToTextSearchMatches(mdCellFindMatch.contentMatches, mdInputCell);
			codeContentResults = contentMatchesToTextSearchMatches(codeCellFindMatch.contentMatches, codeCell);
			codeWebviewResults = webviewMatchesToTextSearchMatches(codeCellFindMatch.webviewMatches);

			assert.strictEqual(markdownContentResults.length, 1);
			assert.strictEqual(markdownContentResults[0].preview.text, '# Hello World Test\n');
			assertRangesEqual(markdownContentResults[0].preview.matches, [new Range(0, 14, 0, 18)]);
			assertRangesEqual(markdownContentResults[0].ranges, [new Range(0, 14, 0, 18)]);


			assert.strictEqual(codeContentResults.length, 2);
			assert.strictEqual(codeContentResults[0].preview.text, 'print("test! testing!!")\n');
			assert.strictEqual(codeContentResults[1].preview.text, 'print("this is a Test")\n');
			assertRangesEqual(codeContentResults[0].preview.matches, [new Range(0, 7, 0, 11), new Range(0, 13, 0, 17)]);
			assertRangesEqual(codeContentResults[0].ranges, [new Range(0, 7, 0, 11), new Range(0, 13, 0, 17)]);

			assert.strictEqual(codeWebviewResults.length, 3);
			assert.strictEqual(codeWebviewResults[0].preview.text, 'test! testing!!');
			assert.strictEqual(codeWebviewResults[1].preview.text, 'test! testing!!');
			assert.strictEqual(codeWebviewResults[2].preview.text, 'this is a Test');

			assertRangesEqual(codeWebviewResults[0].preview.matches, [new Range(0, 1, 0, 5)]);
			assertRangesEqual(codeWebviewResults[1].preview.matches, [new Range(0, 7, 0, 11)]);
			assertRangesEqual(codeWebviewResults[2].preview.matches, [new Range(0, 11, 0, 15)]);
			assertRangesEqual(codeWebviewResults[0].ranges, [new Range(0, 1, 0, 5)]);
			assertRangesEqual(codeWebviewResults[1].ranges, [new Range(0, 7, 0, 11)]);
			assertRangesEqual(codeWebviewResults[2].ranges, [new Range(0, 11, 0, 15)]);
		});

		test('convert ITextSearchMatch to MatchInNotebook', () => {
			const mdCellMatch = new CellMatch(aFileMatch(), mdInputCell, 0);
			const markdownCellContentMatchObjs = textSearchMatchesToNotebookMatches(markdownContentResults, mdCellMatch);

			const codeCellMatch = new CellMatch(aFileMatch(), codeCell, 0);
			const codeCellContentMatchObjs = textSearchMatchesToNotebookMatches(codeContentResults, codeCellMatch);
			const codeWebviewContentMatchObjs = textSearchMatchesToNotebookMatches(codeWebviewResults, codeCellMatch);


			assert.strictEqual(markdownCellContentMatchObjs[0].cell.id, mdCellMatch.id);
			assertRangesEqual(markdownCellContentMatchObjs[0].range(), [new Range(1, 15, 1, 19)]);

			assert.strictEqual(codeCellContentMatchObjs[0].cell.id, codeCellMatch.id);
			assert.strictEqual(codeCellContentMatchObjs[1].cell.id, codeCellMatch.id);
			assertRangesEqual(codeCellContentMatchObjs[0].range(), [new Range(1, 8, 1, 12)]);
			assertRangesEqual(codeCellContentMatchObjs[1].range(), [new Range(1, 14, 1, 18)]);
			assertRangesEqual(codeCellContentMatchObjs[2].range(), [new Range(2, 18, 2, 22)]);

			assert.strictEqual(codeWebviewContentMatchObjs[0].cell.id, codeCellMatch.id);
			assert.strictEqual(codeWebviewContentMatchObjs[1].cell.id, codeCellMatch.id);
			assert.strictEqual(codeWebviewContentMatchObjs[2].cell.id, codeCellMatch.id);
			assertRangesEqual(codeWebviewContentMatchObjs[0].range(), [new Range(1, 2, 1, 6)]);
			assertRangesEqual(codeWebviewContentMatchObjs[1].range(), [new Range(1, 8, 1, 12)]);
			assertRangesEqual(codeWebviewContentMatchObjs[2].range(), [new Range(1, 12, 1, 16)]);

		});


		function aFileMatch(): FileMatch {
			const rawMatch: IFileMatch = {
				resource: URI.file('somepath' + ++counter),
				results: []
			};

			const searchModel = instantiationService.createInstance(SearchModel);
			const folderMatch = instantiationService.createInstance(FolderMatch, URI.file('somepath'), '', 0, {
				type: QueryType.Text, folderQueries: [{ folder: createFileUriFromPathFromRoot() }], contentPattern: {
					pattern: ''
				}
			}, searchModel.searchResult, searchModel.searchResult, null);
			return instantiationService.createInstance(FileMatch, {
				pattern: ''
			}, undefined, undefined, folderMatch, rawMatch, null, '');
		}
	});
});
