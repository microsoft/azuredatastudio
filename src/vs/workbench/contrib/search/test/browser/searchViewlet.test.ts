/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { isWindows } from 'vs/base/common/platform';
import { URI, URI as uri } from 'vs/base/common/uri';
import { ILanguageConfigurationService } from 'vs/editor/common/languages/languageConfigurationRegistry';
import { IModelService } from 'vs/editor/common/services/model';
import { ModelService } from 'vs/editor/common/services/modelService';
import { TestLanguageConfigurationService } from 'vs/editor/test/common/modes/testLanguageConfigurationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { FileService } from 'vs/platform/files/common/fileService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ILabelService } from 'vs/platform/label/common/label';
import { NullLogService } from 'vs/platform/log/common/log';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { UriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentityService';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { TestWorkspace } from 'vs/platform/workspace/test/common/testWorkspace';
import { FileMatch, FolderMatch, Match, searchComparer, searchMatchComparer, SearchModel, SearchResult } from 'vs/workbench/contrib/search/common/searchModel';
import { MockLabelService } from 'vs/workbench/services/label/test/common/mockLabelService';
import { IFileMatch, ITextSearchMatch, OneLineRange, QueryType, SearchSortOrder } from 'vs/workbench/services/search/common/search';
import { TestContextService } from 'vs/workbench/test/common/workbenchTestServices';

suite('Search - Viewlet', () => {
	let instantiation: TestInstantiationService;

	setup(() => {
		instantiation = new TestInstantiationService();
		instantiation.stub(ILanguageConfigurationService, TestLanguageConfigurationService);
		instantiation.stub(IModelService, stubModelService(instantiation));
		instantiation.set(IWorkspaceContextService, new TestContextService(TestWorkspace));
		instantiation.stub(IUriIdentityService, new UriIdentityService(new FileService(new NullLogService())));
		instantiation.stub(ILabelService, new MockLabelService());
	});

	test('Data Source', function () {
		const result: SearchResult = instantiation.createInstance(SearchResult, null);
		result.query = {
			type: QueryType.Text,
			contentPattern: { pattern: 'foo' },
			folderQueries: [{
				folder: uri.parse('file://c:/')
			}]
		};

		result.add([{
			resource: uri.parse('file:///c:/foo'),
			results: [{
				preview: {
					text: 'bar',
					matches: {
						startLineNumber: 0,
						startColumn: 0,
						endLineNumber: 0,
						endColumn: 1
					}
				},
				ranges: {
					startLineNumber: 1,
					startColumn: 0,
					endLineNumber: 1,
					endColumn: 1
				}
			}]
		}]);

		const fileMatch = result.matches()[0];
		const lineMatch = fileMatch.matches()[0];

		assert.strictEqual(fileMatch.id(), 'file:///c%3A/foo');
		assert.strictEqual(lineMatch.id(), 'file:///c%3A/foo>[2,1 -> 2,2]b');
	});

	test('Comparer', () => {
		const fileMatch1 = aFileMatch(isWindows ? 'C:\\foo' : '/c/foo');
		const fileMatch2 = aFileMatch(isWindows ? 'C:\\with\\path' : '/c/with/path');
		const fileMatch3 = aFileMatch(isWindows ? 'C:\\with\\path\\foo' : '/c/with/path/foo');
		const lineMatch1 = new Match(fileMatch1, ['bar'], new OneLineRange(0, 1, 1), new OneLineRange(0, 1, 1));
		const lineMatch2 = new Match(fileMatch1, ['bar'], new OneLineRange(0, 1, 1), new OneLineRange(2, 1, 1));
		const lineMatch3 = new Match(fileMatch1, ['bar'], new OneLineRange(0, 1, 1), new OneLineRange(2, 1, 1));

		assert(searchMatchComparer(fileMatch1, fileMatch2) < 0);
		assert(searchMatchComparer(fileMatch2, fileMatch1) > 0);
		assert(searchMatchComparer(fileMatch1, fileMatch1) === 0);
		assert(searchMatchComparer(fileMatch2, fileMatch3) < 0);

		assert(searchMatchComparer(lineMatch1, lineMatch2) < 0);
		assert(searchMatchComparer(lineMatch2, lineMatch1) > 0);
		assert(searchMatchComparer(lineMatch2, lineMatch3) === 0);
	});

	test('Advanced Comparer', () => {
		const fileMatch1 = aFileMatch(isWindows ? 'C:\\with\\path\\foo10' : '/c/with/path/foo10');
		const fileMatch2 = aFileMatch(isWindows ? 'C:\\with\\path2\\foo1' : '/c/with/path2/foo1');
		const fileMatch3 = aFileMatch(isWindows ? 'C:\\with\\path2\\bar.a' : '/c/with/path2/bar.a');
		const fileMatch4 = aFileMatch(isWindows ? 'C:\\with\\path2\\bar.b' : '/c/with/path2/bar.b');

		// By default, path < path2
		assert(searchMatchComparer(fileMatch1, fileMatch2) < 0);
		// By filenames, foo10 > foo1
		assert(searchMatchComparer(fileMatch1, fileMatch2, SearchSortOrder.FileNames) > 0);
		// By type, bar.a < bar.b
		assert(searchMatchComparer(fileMatch3, fileMatch4, SearchSortOrder.Type) < 0);
	});

	test('Cross-type Comparer', () => {

		const searchResult = aSearchResult();
		const folderMatch1 = aFolderMatch(isWindows ? 'C:\\voo' : '/c/voo', 0, searchResult);
		const folderMatch2 = aFolderMatch(isWindows ? 'C:\\with' : '/c/with', 1, searchResult);

		const fileMatch1 = aFileMatch(isWindows ? 'C:\\voo\\foo.a' : '/c/voo/foo.a', folderMatch1);
		const fileMatch2 = aFileMatch(isWindows ? 'C:\\with\\path.c' : '/c/with/path.c', folderMatch2);
		const fileMatch3 = aFileMatch(isWindows ? 'C:\\with\\path\\bar.b' : '/c/with/path/bar.b', folderMatch2);

		const lineMatch1 = new Match(fileMatch1, ['bar'], new OneLineRange(0, 1, 1), new OneLineRange(0, 1, 1));
		const lineMatch2 = new Match(fileMatch1, ['bar'], new OneLineRange(0, 1, 1), new OneLineRange(2, 1, 1));

		const lineMatch3 = new Match(fileMatch2, ['barfoo'], new OneLineRange(0, 1, 1), new OneLineRange(0, 1, 1));
		const lineMatch4 = new Match(fileMatch2, ['fooooo'], new OneLineRange(0, 1, 1), new OneLineRange(2, 1, 1));

		const lineMatch5 = new Match(fileMatch3, ['foobar'], new OneLineRange(0, 1, 1), new OneLineRange(2, 1, 1));

		/***
		 * Structure would take the following form:
		 *
		 *	folderMatch1 (voo)
		 *		> fileMatch1 (/foo.a)
		 *			>> lineMatch1
		 *			>> lineMatch2
		 *	folderMatch2 (with)
		 *		> fileMatch2 (/path.c)
		 *			>> lineMatch4
		 *			>> lineMatch5
		 *		> fileMatch3 (/path/bar.b)
		 *			>> lineMatch3
		 *
		 */

		// for these, refer to diagram above
		assert(searchComparer(fileMatch1, fileMatch3) < 0);
		assert(searchComparer(fileMatch2, fileMatch3) < 0);
		assert(searchComparer(folderMatch2, fileMatch2) < 0);
		assert(searchComparer(lineMatch4, lineMatch5) < 0);
		assert(searchComparer(lineMatch1, lineMatch3) < 0);
		assert(searchComparer(lineMatch2, folderMatch2) < 0);

		// travel up hierarchy and order of folders take precedence. "voo < with" in indices
		assert(searchComparer(fileMatch1, fileMatch3, SearchSortOrder.FileNames) < 0);
		// bar.b < path.c
		assert(searchComparer(fileMatch3, fileMatch2, SearchSortOrder.FileNames) < 0);
		// lineMatch4's parent is fileMatch2, "bar.b < path.c"
		assert(searchComparer(fileMatch3, lineMatch4, SearchSortOrder.FileNames) < 0);

		// bar.b < path.c
		assert(searchComparer(fileMatch3, fileMatch2, SearchSortOrder.Type) < 0);
		// lineMatch4's parent is fileMatch2, "bar.b < path.c"
		assert(searchComparer(fileMatch3, lineMatch4, SearchSortOrder.Type) < 0);
	});

	function aFileMatch(path: string, parentFolder?: FolderMatch, ...lineMatches: ITextSearchMatch[]): FileMatch {
		const rawMatch: IFileMatch = {
			resource: uri.file(path),
			results: lineMatches
		};
		return instantiation.createInstance(FileMatch, null, null, null, parentFolder, rawMatch);
	}

	function aFolderMatch(path: string, index: number, parent?: SearchResult): FolderMatch {
		const searchModel = instantiation.createInstance(SearchModel);
		return instantiation.createInstance(FolderMatch, uri.file(path), path, index, null, parent, searchModel);
	}

	function aSearchResult(): SearchResult {
		const searchModel = instantiation.createInstance(SearchModel);
		searchModel.searchResult.query = { type: 1, folderQueries: [{ folder: URI.parse('file://c:/') }] };
		return searchModel.searchResult;
	}

	function stubModelService(instantiationService: TestInstantiationService): IModelService {
		instantiationService.stub(IConfigurationService, new TestConfigurationService());
		instantiationService.stub(IThemeService, new TestThemeService());
		return instantiationService.createInstance(ModelService);
	}
});
