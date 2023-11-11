/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as arrays from 'vs/base/common/arrays';
import * as collections from 'vs/base/common/collections';
import * as glob from 'vs/base/common/glob';
import { untildify } from 'vs/base/common/labels';
import { ResourceMap } from 'vs/base/common/map';
import { Schemas } from 'vs/base/common/network';
import * as path from 'vs/base/common/path';
import { isEqual, basename, relativePath, isAbsolutePath } from 'vs/base/common/resources';
import * as strings from 'vs/base/common/strings';
import { assertIsDefined, isDefined } from 'vs/base/common/types';
import { URI, URI as uri } from 'vs/base/common/uri';
import { isMultilineRegexSource } from 'vs/editor/common/model/textModelSearch';
import * as nls from 'vs/nls';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILogService } from 'vs/platform/log/common/log';
import { IWorkspaceContextService, IWorkspaceFolderData, toWorkspaceFolder, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IPathService } from 'vs/workbench/services/path/common/pathService';
import { getExcludes, ICommonQueryProps, IFileQuery, IFolderQuery, IPatternInfo, ISearchConfiguration, ITextQuery, ITextSearchPreviewOptions, pathIncludedInQuery, QueryType } from 'vs/workbench/services/search/common/search';

/**
 * One folder to search and a glob expression that should be applied.
 */
interface IOneSearchPathPattern {
	searchPath: uri;
	pattern?: string;
}

/**
 * One folder to search and a set of glob expressions that should be applied.
 */
export interface ISearchPathPattern {
	searchPath: uri;
	pattern?: glob.IExpression;
}

/**
 * A set of search paths and a set of glob expressions that should be applied.
 */
export interface ISearchPathsInfo {
	searchPaths?: ISearchPathPattern[];
	pattern?: glob.IExpression;
}

interface ICommonQueryBuilderOptions {
	_reason?: string;
	excludePattern?: string | string[];
	includePattern?: string | string[];
	extraFileResources?: uri[];

	/** Parse the special ./ syntax supported by the searchview, and expand foo to ** /foo */
	expandPatterns?: boolean;

	maxResults?: number;
	maxFileSize?: number;
	disregardIgnoreFiles?: boolean;
	disregardGlobalIgnoreFiles?: boolean;
	disregardParentIgnoreFiles?: boolean;
	disregardExcludeSettings?: boolean;
	disregardSearchExcludeSettings?: boolean;
	ignoreSymlinks?: boolean;
	onlyOpenEditors?: boolean;
}

export interface IFileQueryBuilderOptions extends ICommonQueryBuilderOptions {
	filePattern?: string;
	exists?: boolean;
	sortByScore?: boolean;
	cacheKey?: string;
}

export interface ITextQueryBuilderOptions extends ICommonQueryBuilderOptions {
	previewOptions?: ITextSearchPreviewOptions;
	fileEncoding?: string;
	beforeContext?: number;
	afterContext?: number;
	isSmartCase?: boolean;
	notebookSearchConfig?: {
		includeMarkupInput: boolean;
		includeMarkupPreview: boolean;
		includeCodeInput: boolean;
		includeOutput: boolean;
	};
}

export class QueryBuilder {

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@ILogService private readonly logService: ILogService,
		@IPathService private readonly pathService: IPathService
	) {
	}

	text(contentPattern: IPatternInfo, folderResources?: uri[], options: ITextQueryBuilderOptions = {}): ITextQuery {
		contentPattern = this.getContentPattern(contentPattern, options);
		const searchConfig = this.configurationService.getValue<ISearchConfiguration>();

		const fallbackToPCRE = folderResources && folderResources.some(folder => {
			const folderConfig = this.configurationService.getValue<ISearchConfiguration>({ resource: folder });
			return !folderConfig.search.useRipgrep;
		});

		const commonQuery = this.commonQuery(folderResources?.map(toWorkspaceFolder), options);
		return <ITextQuery>{
			...commonQuery,
			type: QueryType.Text,
			contentPattern,
			previewOptions: options.previewOptions,
			maxFileSize: options.maxFileSize,
			usePCRE2: searchConfig.search.usePCRE2 || fallbackToPCRE || false,
			beforeContext: options.beforeContext,
			afterContext: options.afterContext,
			userDisabledExcludesAndIgnoreFiles: options.disregardExcludeSettings && options.disregardIgnoreFiles,

		};
	}

	/**
	 * Adjusts input pattern for config
	 */
	private getContentPattern(inputPattern: IPatternInfo, options: ITextQueryBuilderOptions): IPatternInfo {
		const searchConfig = this.configurationService.getValue<ISearchConfiguration>();

		if (inputPattern.isRegExp) {
			inputPattern.pattern = inputPattern.pattern.replace(/\r?\n/g, '\\n');
		}

		const newPattern = {
			...inputPattern,
			wordSeparators: searchConfig.editor.wordSeparators
		};

		if (this.isCaseSensitive(inputPattern, options)) {
			newPattern.isCaseSensitive = true;
		}

		if (this.isMultiline(inputPattern)) {
			newPattern.isMultiline = true;
		}

		if (options.notebookSearchConfig?.includeMarkupInput) {
			if (!newPattern.notebookInfo) {
				newPattern.notebookInfo = {};
			}
			newPattern.notebookInfo.isInNotebookMarkdownInput = options.notebookSearchConfig.includeMarkupInput;
		}

		if (options.notebookSearchConfig?.includeMarkupPreview) {
			if (!newPattern.notebookInfo) {
				newPattern.notebookInfo = {};
			}
			newPattern.notebookInfo.isInNotebookMarkdownPreview = options.notebookSearchConfig.includeMarkupPreview;
		}

		if (options.notebookSearchConfig?.includeCodeInput) {
			if (!newPattern.notebookInfo) {
				newPattern.notebookInfo = {};
			}
			newPattern.notebookInfo.isInNotebookCellInput = options.notebookSearchConfig.includeCodeInput;
		}

		if (options.notebookSearchConfig?.includeOutput) {
			if (!newPattern.notebookInfo) {
				newPattern.notebookInfo = {};
			}
			newPattern.notebookInfo.isInNotebookCellOutput = options.notebookSearchConfig.includeOutput;
		}

		return newPattern;
	}

	file(folders: (IWorkspaceFolderData | URI)[], options: IFileQueryBuilderOptions = {}): IFileQuery {
		const commonQuery = this.commonQuery(folders, options);
		return <IFileQuery>{
			...commonQuery,
			type: QueryType.File,
			filePattern: options.filePattern
				? options.filePattern.trim()
				: options.filePattern,
			exists: options.exists,
			sortByScore: options.sortByScore,
			cacheKey: options.cacheKey,
		};
	}

	private handleIncludeExclude(pattern: string | string[] | undefined, expandPatterns: boolean | undefined): ISearchPathsInfo {
		if (!pattern) {
			return {};
		}

		pattern = Array.isArray(pattern) ? pattern.map(normalizeSlashes) : normalizeSlashes(pattern);
		return expandPatterns
			? this.parseSearchPaths(pattern)
			: { pattern: patternListToIExpression(...(Array.isArray(pattern) ? pattern : [pattern])) };
	}

	private commonQuery(folderResources: (IWorkspaceFolderData | URI)[] = [], options: ICommonQueryBuilderOptions = {}): ICommonQueryProps<uri> {
		const includeSearchPathsInfo: ISearchPathsInfo = this.handleIncludeExclude(options.includePattern, options.expandPatterns);
		const excludeSearchPathsInfo: ISearchPathsInfo = this.handleIncludeExclude(options.excludePattern, options.expandPatterns);

		// Build folderQueries from searchPaths, if given, otherwise folderResources
		const includeFolderName = folderResources.length > 1;
		const folderQueries = (includeSearchPathsInfo.searchPaths && includeSearchPathsInfo.searchPaths.length ?
			includeSearchPathsInfo.searchPaths.map(searchPath => this.getFolderQueryForSearchPath(searchPath, options, excludeSearchPathsInfo)) :
			folderResources.map(folder => this.getFolderQueryForRoot(folder, options, excludeSearchPathsInfo, includeFolderName)))
			.filter(query => !!query) as IFolderQuery[];

		const queryProps: ICommonQueryProps<uri> = {
			_reason: options._reason,
			folderQueries,
			usingSearchPaths: !!(includeSearchPathsInfo.searchPaths && includeSearchPathsInfo.searchPaths.length),
			extraFileResources: options.extraFileResources,

			excludePattern: excludeSearchPathsInfo.pattern,
			includePattern: includeSearchPathsInfo.pattern,
			onlyOpenEditors: options.onlyOpenEditors,
			maxResults: options.maxResults
		};

		if (options.onlyOpenEditors) {
			const openEditors = arrays.coalesce(arrays.flatten(this.editorGroupsService.groups.map(group => group.editors.map(editor => editor.resource))));
			this.logService.trace('QueryBuilder#commonQuery - openEditor URIs', JSON.stringify(openEditors));
			const openEditorsInQuery = openEditors.filter(editor => pathIncludedInQuery(queryProps, editor.fsPath));
			const openEditorsQueryProps = this.commonQueryFromFileList(openEditorsInQuery);
			this.logService.trace('QueryBuilder#commonQuery - openEditor Query', JSON.stringify(openEditorsQueryProps));
			return { ...queryProps, ...openEditorsQueryProps };
		}

		// Filter extraFileResources against global include/exclude patterns - they are already expected to not belong to a workspace
		const extraFileResources = options.extraFileResources && options.extraFileResources.filter(extraFile => pathIncludedInQuery(queryProps, extraFile.fsPath));
		queryProps.extraFileResources = extraFileResources && extraFileResources.length ? extraFileResources : undefined;

		return queryProps;
	}

	private commonQueryFromFileList(files: URI[]): ICommonQueryProps<URI> {
		const folderQueries: IFolderQuery[] = [];
		const foldersToSearch: ResourceMap<IFolderQuery> = new ResourceMap();
		const includePattern: glob.IExpression = {};
		let hasIncludedFile = false;
		files.forEach(file => {
			if (file.scheme === Schemas.walkThrough) { return; }

			const providerExists = isAbsolutePath(file);
			// Special case userdata as we don't have a search provider for it, but it can be searched.
			if (providerExists) {
				const searchRoot = this.workspaceContextService.getWorkspaceFolder(file)?.uri ?? file.with({ path: path.dirname(file.fsPath) });

				let folderQuery = foldersToSearch.get(searchRoot);
				if (!folderQuery) {
					hasIncludedFile = true;
					folderQuery = { folder: searchRoot, includePattern: {} };
					folderQueries.push(folderQuery);
					foldersToSearch.set(searchRoot, folderQuery);
				}

				const relPath = path.relative(searchRoot.fsPath, file.fsPath);
				assertIsDefined(folderQuery.includePattern)[relPath.replace(/\\/g, '/')] = true;
			} else {
				if (file.fsPath) {
					hasIncludedFile = true;
					includePattern[file.fsPath] = true;
				}
			}
		});

		return {
			folderQueries,
			includePattern,
			usingSearchPaths: true,
			excludePattern: hasIncludedFile ? undefined : { '**/*': true }
		};
	}

	/**
	 * Resolve isCaseSensitive flag based on the query and the isSmartCase flag, for search providers that don't support smart case natively.
	 */
	private isCaseSensitive(contentPattern: IPatternInfo, options: ITextQueryBuilderOptions): boolean {
		if (options.isSmartCase) {
			if (contentPattern.isRegExp) {
				// Consider it case sensitive if it contains an unescaped capital letter
				if (strings.containsUppercaseCharacter(contentPattern.pattern, true)) {
					return true;
				}
			} else if (strings.containsUppercaseCharacter(contentPattern.pattern)) {
				return true;
			}
		}

		return !!contentPattern.isCaseSensitive;
	}

	private isMultiline(contentPattern: IPatternInfo): boolean {
		if (contentPattern.isMultiline) {
			return true;
		}

		if (contentPattern.isRegExp && isMultilineRegexSource(contentPattern.pattern)) {
			return true;
		}

		if (contentPattern.pattern.indexOf('\n') >= 0) {
			return true;
		}

		return !!contentPattern.isMultiline;
	}

	/**
	 * Take the includePattern as seen in the search viewlet, and split into components that look like searchPaths, and
	 * glob patterns. Glob patterns are expanded from 'foo/bar' to '{foo/bar/**, **\/foo/bar}.
	 *
	 * Public for test.
	 */
	parseSearchPaths(pattern: string | string[]): ISearchPathsInfo {
		const isSearchPath = (segment: string) => {
			// A segment is a search path if it is an absolute path or starts with ./, ../, .\, or ..\
			return path.isAbsolute(segment) || /^\.\.?([\/\\]|$)/.test(segment);
		};

		const patterns = Array.isArray(pattern) ? pattern : splitGlobPattern(pattern);
		const segments = patterns
			.map(segment => {
				const userHome = this.pathService.resolvedUserHome;
				if (userHome) {
					return untildify(segment, userHome.scheme === Schemas.file ? userHome.fsPath : userHome.path);
				}

				return segment;
			});
		const groups = collections.groupBy(segments,
			segment => isSearchPath(segment) ? 'searchPaths' : 'exprSegments');

		const expandedExprSegments = (groups.exprSegments || [])
			.map(s => strings.rtrim(s, '/'))
			.map(s => strings.rtrim(s, '\\'))
			.map(p => {
				if (p[0] === '.') {
					p = '*' + p; // convert ".js" to "*.js"
				}

				return expandGlobalGlob(p);
			});

		const result: ISearchPathsInfo = {};
		const searchPaths = this.expandSearchPathPatterns(groups.searchPaths || []);
		if (searchPaths && searchPaths.length) {
			result.searchPaths = searchPaths;
		}

		const exprSegments = arrays.flatten(expandedExprSegments);
		const includePattern = patternListToIExpression(...exprSegments);
		if (includePattern) {
			result.pattern = includePattern;
		}

		return result;
	}

	private getExcludesForFolder(folderConfig: ISearchConfiguration, options: ICommonQueryBuilderOptions): glob.IExpression | undefined {
		return options.disregardExcludeSettings ?
			undefined :
			getExcludes(folderConfig, !options.disregardSearchExcludeSettings);
	}

	/**
	 * Split search paths (./ or ../ or absolute paths in the includePatterns) into absolute paths and globs applied to those paths
	 */
	private expandSearchPathPatterns(searchPaths: string[]): ISearchPathPattern[] {
		if (!searchPaths || !searchPaths.length) {
			// No workspace => ignore search paths
			return [];
		}

		const expandedSearchPaths = searchPaths.flatMap(searchPath => {
			// 1 open folder => just resolve the search paths to absolute paths
			let { pathPortion, globPortion } = splitGlobFromPath(searchPath);

			if (globPortion) {
				globPortion = normalizeGlobPattern(globPortion);
			}

			// One pathPortion to multiple expanded search paths (e.g. duplicate matching workspace folders)
			const oneExpanded = this.expandOneSearchPath(pathPortion);

			// Expanded search paths to multiple resolved patterns (with ** and without)
			return oneExpanded.flatMap(oneExpandedResult => this.resolveOneSearchPathPattern(oneExpandedResult, globPortion));
		});

		const searchPathPatternMap = new Map<string, ISearchPathPattern>();
		expandedSearchPaths.forEach(oneSearchPathPattern => {
			const key = oneSearchPathPattern.searchPath.toString();
			const existing = searchPathPatternMap.get(key);
			if (existing) {
				if (oneSearchPathPattern.pattern) {
					existing.pattern = existing.pattern || {};
					existing.pattern[oneSearchPathPattern.pattern] = true;
				}
			} else {
				searchPathPatternMap.set(key, {
					searchPath: oneSearchPathPattern.searchPath,
					pattern: oneSearchPathPattern.pattern ? patternListToIExpression(oneSearchPathPattern.pattern) : undefined
				});
			}
		});

		return Array.from(searchPathPatternMap.values());
	}

	/**
	 * Takes a searchPath like `./a/foo` or `../a/foo` and expands it to absolute paths for all the workspaces it matches.
	 */
	private expandOneSearchPath(searchPath: string): IOneSearchPathPattern[] {
		if (path.isAbsolute(searchPath)) {
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
			if (workspaceFolders[0] && workspaceFolders[0].uri.scheme !== Schemas.file) {
				return [{
					searchPath: workspaceFolders[0].uri.with({ path: searchPath })
				}];
			}

			// Currently only local resources can be searched for with absolute search paths.
			// TODO convert this to a workspace folder + pattern, so excludes will be resolved properly for an absolute path inside a workspace folder
			return [{
				searchPath: uri.file(path.normalize(searchPath))
			}];
		}

		if (this.workspaceContextService.getWorkbenchState() === WorkbenchState.FOLDER) {
			const workspaceUri = this.workspaceContextService.getWorkspace().folders[0].uri;

			searchPath = normalizeSlashes(searchPath);
			if (searchPath.startsWith('../') || searchPath === '..') {
				const resolvedPath = path.posix.resolve(workspaceUri.path, searchPath);
				return [{
					searchPath: workspaceUri.with({ path: resolvedPath })
				}];
			}

			const cleanedPattern = normalizeGlobPattern(searchPath);
			return [{
				searchPath: workspaceUri,
				pattern: cleanedPattern
			}];
		} else if (searchPath === './' || searchPath === '.\\') {
			return []; // ./ or ./**/foo makes sense for single-folder but not multi-folder workspaces
		} else {
			const searchPathWithoutDotSlash = searchPath.replace(/^\.[\/\\]/, '');
			const folders = this.workspaceContextService.getWorkspace().folders;
			const folderMatches = folders.map(folder => {
				const match = searchPathWithoutDotSlash.match(new RegExp(`^${strings.escapeRegExpCharacters(folder.name)}(?:/(.*)|$)`));
				return match ? {
					match,
					folder
				} : null;
			}).filter(isDefined);

			if (folderMatches.length) {
				return folderMatches.map(match => {
					const patternMatch = match.match[1];
					return {
						searchPath: match.folder.uri,
						pattern: patternMatch && normalizeGlobPattern(patternMatch)
					};
				});
			} else {
				const probableWorkspaceFolderNameMatch = searchPath.match(/\.[\/\\](.+)[\/\\]?/);
				const probableWorkspaceFolderName = probableWorkspaceFolderNameMatch ? probableWorkspaceFolderNameMatch[1] : searchPath;

				// No root folder with name
				const searchPathNotFoundError = nls.localize('search.noWorkspaceWithName', "Workspace folder does not exist: {0}", probableWorkspaceFolderName);
				throw new Error(searchPathNotFoundError);
			}
		}
	}

	private resolveOneSearchPathPattern(oneExpandedResult: IOneSearchPathPattern, globPortion?: string): IOneSearchPathPattern[] {
		const pattern = oneExpandedResult.pattern && globPortion ?
			`${oneExpandedResult.pattern}/${globPortion}` :
			oneExpandedResult.pattern || globPortion;

		const results = [
			{
				searchPath: oneExpandedResult.searchPath,
				pattern
			}];

		if (pattern && !pattern.endsWith('**')) {
			results.push({
				searchPath: oneExpandedResult.searchPath,
				pattern: pattern + '/**'
			});
		}

		return results;
	}

	private getFolderQueryForSearchPath(searchPath: ISearchPathPattern, options: ICommonQueryBuilderOptions, searchPathExcludes: ISearchPathsInfo): IFolderQuery | null {
		const rootConfig = this.getFolderQueryForRoot(toWorkspaceFolder(searchPath.searchPath), options, searchPathExcludes, false);
		if (!rootConfig) {
			return null;
		}

		return {
			...rootConfig,
			...{
				includePattern: searchPath.pattern
			}
		};
	}

	private getFolderQueryForRoot(folder: (IWorkspaceFolderData | URI), options: ICommonQueryBuilderOptions, searchPathExcludes: ISearchPathsInfo, includeFolderName: boolean): IFolderQuery | null {
		let thisFolderExcludeSearchPathPattern: glob.IExpression | undefined;
		const folderUri = URI.isUri(folder) ? folder : folder.uri;
		if (searchPathExcludes.searchPaths) {
			const thisFolderExcludeSearchPath = searchPathExcludes.searchPaths.filter(sp => isEqual(sp.searchPath, folderUri))[0];
			if (thisFolderExcludeSearchPath && !thisFolderExcludeSearchPath.pattern) {
				// entire folder is excluded
				return null;
			} else if (thisFolderExcludeSearchPath) {
				thisFolderExcludeSearchPathPattern = thisFolderExcludeSearchPath.pattern;
			}
		}

		const folderConfig = this.configurationService.getValue<ISearchConfiguration>({ resource: folderUri });
		const settingExcludes = this.getExcludesForFolder(folderConfig, options);
		const excludePattern: glob.IExpression = {
			...(settingExcludes || {}),
			...(thisFolderExcludeSearchPathPattern || {})
		};

		const folderName = URI.isUri(folder) ? basename(folder) : folder.name;
		return <IFolderQuery>{
			folder: folderUri,
			folderName: includeFolderName ? folderName : undefined,
			excludePattern: Object.keys(excludePattern).length > 0 ? excludePattern : undefined,
			fileEncoding: folderConfig.files && folderConfig.files.encoding,
			disregardIgnoreFiles: typeof options.disregardIgnoreFiles === 'boolean' ? options.disregardIgnoreFiles : !folderConfig.search.useIgnoreFiles,
			disregardGlobalIgnoreFiles: typeof options.disregardGlobalIgnoreFiles === 'boolean' ? options.disregardGlobalIgnoreFiles : !folderConfig.search.useGlobalIgnoreFiles,
			disregardParentIgnoreFiles: typeof options.disregardParentIgnoreFiles === 'boolean' ? options.disregardParentIgnoreFiles : !folderConfig.search.useParentIgnoreFiles,
			ignoreSymlinks: typeof options.ignoreSymlinks === 'boolean' ? options.ignoreSymlinks : !folderConfig.search.followSymlinks,
		};
	}
}

function splitGlobFromPath(searchPath: string): { pathPortion: string; globPortion?: string } {
	const globCharMatch = searchPath.match(/[\*\{\}\(\)\[\]\?]/);
	if (globCharMatch) {
		const globCharIdx = globCharMatch.index;
		const lastSlashMatch = searchPath.substr(0, globCharIdx).match(/[/|\\][^/\\]*$/);
		if (lastSlashMatch) {
			let pathPortion = searchPath.substr(0, lastSlashMatch.index);
			if (!pathPortion.match(/[/\\]/)) {
				// If the last slash was the only slash, then we now have '' or 'C:' or '.'. Append a slash.
				pathPortion += '/';
			}

			return {
				pathPortion,
				globPortion: searchPath.substr((lastSlashMatch.index || 0) + 1)
			};
		}
	}

	// No glob char, or malformed
	return {
		pathPortion: searchPath
	};
}

function patternListToIExpression(...patterns: string[]): glob.IExpression {
	return patterns.length ?
		patterns.reduce((glob, cur) => { glob[cur] = true; return glob; }, Object.create(null)) :
		undefined;
}

function splitGlobPattern(pattern: string): string[] {
	return glob.splitGlobAware(pattern, ',')
		.map(s => s.trim())
		.filter(s => !!s.length);
}

/**
 * Note - we used {} here previously but ripgrep can't handle nested {} patterns. See https://github.com/microsoft/vscode/issues/32761
 */
function expandGlobalGlob(pattern: string): string[] {
	const patterns = [
		`**/${pattern}/**`,
		`**/${pattern}`
	];

	return patterns.map(p => p.replace(/\*\*\/\*\*/g, '**'));
}

function normalizeSlashes(pattern: string): string {
	return pattern.replace(/\\/g, '/');
}

/**
 * Normalize slashes, remove `./` and trailing slashes
 */
function normalizeGlobPattern(pattern: string): string {
	return normalizeSlashes(pattern)
		.replace(/^\.\//, '')
		.replace(/\/+$/g, '');
}

/**
 * Escapes a path for use as a glob pattern that would match the input precisely.
 * Characters '?', '*', '[', and ']' are escaped into character range glob syntax
 * (for example, '?' becomes '[?]').
 * NOTE: This implementation makes no special cases for UNC paths. For example,
 * given the input "//?/C:/A?.txt", this would produce output '//[?]/C:/A[?].txt',
 * which may not be desirable in some cases. Use with caution if UNC paths could be expected.
 */
function escapeGlobPattern(path: string): string {
	return path.replace(/([?*[\]])/g, '[$1]');
}

/**
 * Construct an include pattern from a list of folders uris to search in.
 */
export function resolveResourcesForSearchIncludes(resources: URI[], contextService: IWorkspaceContextService): string[] {
	resources = arrays.distinct(resources, resource => resource.toString());

	const folderPaths: string[] = [];
	const workspace = contextService.getWorkspace();

	if (resources) {
		resources.forEach(resource => {
			let folderPath: string | undefined;
			if (contextService.getWorkbenchState() === WorkbenchState.FOLDER) {
				// Show relative path from the root for single-root mode
				folderPath = relativePath(workspace.folders[0].uri, resource); // always uses forward slashes
				if (folderPath && folderPath !== '.') {
					folderPath = './' + folderPath;
				}
			} else {
				const owningFolder = contextService.getWorkspaceFolder(resource);
				if (owningFolder) {
					const owningRootName = owningFolder.name;
					// If this root is the only one with its basename, use a relative ./ path. If there is another, use an absolute path
					const isUniqueFolder = workspace.folders.filter(folder => folder.name === owningRootName).length === 1;
					if (isUniqueFolder) {
						const relPath = relativePath(owningFolder.uri, resource); // always uses forward slashes
						if (relPath === '') {
							folderPath = `./${owningFolder.name}`;
						} else {
							folderPath = `./${owningFolder.name}/${relPath}`;
						}
					} else {
						folderPath = resource.fsPath; // TODO rob: handle non-file URIs
					}
				}
			}

			if (folderPath) {
				folderPaths.push(escapeGlobPattern(folderPath));
			}
		});
	}
	return folderPaths;
}
