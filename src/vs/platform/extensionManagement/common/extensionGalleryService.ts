/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { canceled, getErrorMessage, isPromiseCanceledError } from 'vs/base/common/errors';
import { getOrDefault } from 'vs/base/common/objects';
import { IPager } from 'vs/base/common/paging';
import { isWeb } from 'vs/base/common/platform';
import { URI } from 'vs/base/common/uri';
import { IHeaders, IRequestContext, IRequestOptions } from 'vs/base/parts/request/common/request';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration'; // {{SQL CARBON EDIT}} Add import
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { DefaultIconPath, IExtensionGalleryService, IExtensionIdentifier, IGalleryExtension, IGalleryExtensionAsset, IGalleryExtensionAssets, IGalleryExtensionVersion, InstallOperation, IQueryOptions, IReportedExtension, isIExtensionIdentifier, ITranslation, SortBy, SortOrder, StatisticType, WEB_EXTENSION_TAG } from 'vs/platform/extensionManagement/common/extensionManagement';
import { adoptToGalleryExtensionId, getGalleryExtensionId, getGalleryExtensionTelemetryData } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { ExtensionsPolicy, ExtensionsPolicyKey, IExtensionManifest } from 'vs/platform/extensions/common/extensions'; // {{SQL CARBON EDIT}} Add ExtensionsPolicy and ExtensionsPolicyKey
import { isEngineValid } from 'vs/platform/extensions/common/extensionValidator';
import { IFileService } from 'vs/platform/files/common/files';
import { optional } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { IProductService } from 'vs/platform/product/common/productService';
import { asJson, asText, IRequestService } from 'vs/platform/request/common/request'; // {{SQL CARBON EDIT}} Remove unused
import { getServiceMachineId } from 'vs/platform/serviceMachineId/common/serviceMachineId';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';

interface IRawGalleryExtensionFile {
	readonly assetType: string;
	readonly source: string;
}

interface IRawGalleryExtensionProperty {
	readonly key: string;
	readonly value: string;
}

interface IRawGalleryExtensionVersion {
	readonly version: string;
	readonly lastUpdated: string;
	readonly assetUri: string;
	readonly fallbackAssetUri: string;
	readonly files: IRawGalleryExtensionFile[];
	readonly properties?: IRawGalleryExtensionProperty[];
}

interface IRawGalleryExtensionStatistics {
	readonly statisticName: string;
	readonly value: number;
}

interface IRawGalleryExtension {
	readonly extensionId: string;
	readonly extensionName: string;
	readonly displayName: string;
	readonly shortDescription: string;
	readonly publisher: { displayName: string, publisherId: string, publisherName: string; };
	readonly versions: IRawGalleryExtensionVersion[];
	readonly statistics: IRawGalleryExtensionStatistics[];
	readonly tags: string[] | undefined;
	readonly releaseDate: string;
	readonly publishedDate: string;
	readonly lastUpdated: string;
	readonly categories: string[] | undefined;
	readonly flags: string;
}

interface IRawGalleryQueryResult {
	readonly results: {
		readonly extensions: IRawGalleryExtension[];
		readonly resultMetadata: {
			readonly metadataType: string;
			readonly metadataItems: {
				readonly name: string;
				readonly count: number;
			}[];
		}[]
	}[];
}

enum Flags {
	None = 0x0,
	IncludeVersions = 0x1,
	IncludeFiles = 0x2,
	IncludeCategoryAndTags = 0x4,
	IncludeSharedAccounts = 0x8,
	IncludeVersionProperties = 0x10,
	ExcludeNonValidated = 0x20,
	IncludeInstallationTargets = 0x40,
	IncludeAssetUri = 0x80,
	IncludeStatistics = 0x100,
	IncludeLatestVersionOnly = 0x200,
	Unpublished = 0x1000
}

function flagsToString(...flags: Flags[]): string {
	return String(flags.reduce((r, f) => r | f, 0));
}

enum FilterType {
	Tag = 1,
	ExtensionId = 4,
	Category = 5,
	ExtensionName = 7,
	Target = 8,
	Featured = 9,
	SearchText = 10,
	ExcludeWithFlags = 12
}

const AssetType = {
	Icon: 'Microsoft.VisualStudio.Services.Icons.Default',
	Details: 'Microsoft.VisualStudio.Services.Content.Details',
	Changelog: 'Microsoft.VisualStudio.Services.Content.Changelog',
	Manifest: 'Microsoft.VisualStudio.Code.Manifest',
	VSIX: 'Microsoft.VisualStudio.Services.VSIXPackage',
	License: 'Microsoft.VisualStudio.Services.Content.License',
	Repository: 'Microsoft.VisualStudio.Services.Links.Source',
	// {{SQL CARBON EDIT}}
	DownloadPage: 'Microsoft.SQLOps.DownloadPage'
};

const PropertyType = {
	Dependency: 'Microsoft.VisualStudio.Code.ExtensionDependencies',
	ExtensionPack: 'Microsoft.VisualStudio.Code.ExtensionPack',
	Engine: 'Microsoft.VisualStudio.Code.Engine',
	// {{SQL CARBON EDIT}}
	AzDataEngine: 'Microsoft.AzDataEngine',
	LocalizedLanguages: 'Microsoft.VisualStudio.Code.LocalizedLanguages',
	WebExtension: 'Microsoft.VisualStudio.Code.WebExtension'
};

interface ICriterium {
	readonly filterType: FilterType;
	readonly value?: string;
}

const DefaultPageSize = 10;

interface IQueryState {
	readonly pageNumber: number;
	readonly pageSize: number;
	readonly sortBy: SortBy;
	readonly sortOrder: SortOrder;
	readonly flags: Flags;
	readonly criteria: ICriterium[];
	readonly assetTypes: string[];
}

const DefaultQueryState: IQueryState = {
	pageNumber: 1,
	pageSize: DefaultPageSize,
	sortBy: SortBy.NoneOrRelevance,
	sortOrder: SortOrder.Default,
	flags: Flags.None,
	criteria: [],
	assetTypes: []
};

/* {{SQL CARBON EDIT}} Remove unused
type GalleryServiceQueryClassification = {
	readonly filterTypes: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
	readonly sortBy: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
	readonly sortOrder: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
	readonly duration: { classification: 'SystemMetaData', purpose: 'PerformanceAndHealth', 'isMeasurement': true };
	readonly success: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
	readonly requestBodySize: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
	readonly responseBodySize?: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
	readonly statusCode?: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
	readonly errorCode?: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
	readonly count?: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
};
*/

type QueryTelemetryData = {
	readonly filterTypes: string[];
	readonly sortBy: string;
	readonly sortOrder: string;
};

/* {{SQL CARBON EDIT}} Remove unused
type GalleryServiceQueryEvent = QueryTelemetryData & {
	readonly duration: number;
	readonly success: boolean;
	readonly requestBodySize: string;
	readonly responseBodySize?: string;
	readonly statusCode?: string;
	readonly errorCode?: string;
	readonly count?: string;
};
*/

class Query {

	constructor(private state = DefaultQueryState) { }

	get pageNumber(): number { return this.state.pageNumber; }
	get pageSize(): number { return this.state.pageSize; }
	get sortBy(): number { return this.state.sortBy; }
	get sortOrder(): number { return this.state.sortOrder; }
	get flags(): number { return this.state.flags; }
	// {{SQL CARBON EDIT}}
	get criteria(): ICriterium[] { return this.state.criteria ? this.state.criteria : []; }

	withPage(pageNumber: number, pageSize: number = this.state.pageSize): Query {
		return new Query({ ...this.state, pageNumber, pageSize });
	}

	withFilter(filterType: FilterType, ...values: string[]): Query {
		const criteria = [
			...this.state.criteria,
			...values.length ? values.map(value => ({ filterType, value })) : [{ filterType }]
		];

		return new Query({ ...this.state, criteria });
	}

	withSortBy(sortBy: SortBy): Query {
		return new Query({ ...this.state, sortBy });
	}

	withSortOrder(sortOrder: SortOrder): Query {
		return new Query({ ...this.state, sortOrder });
	}

	withFlags(...flags: Flags[]): Query {
		return new Query({ ...this.state, flags: flags.reduce<number>((r, f) => r | f, 0) });
	}

	withAssetTypes(...assetTypes: string[]): Query {
		return new Query({ ...this.state, assetTypes });
	}

	get raw(): any {
		const { criteria, pageNumber, pageSize, sortBy, sortOrder, flags, assetTypes } = this.state;
		const filters = [{ criteria, pageNumber, pageSize, sortBy, sortOrder }];
		return { filters, assetTypes, flags };
	}

	get searchText(): string {
		const criterium = this.state.criteria.filter(criterium => criterium.filterType === FilterType.SearchText)[0];
		return criterium && criterium.value ? criterium.value : '';
	}

	get telemetryData(): QueryTelemetryData {
		return {
			filterTypes: this.state.criteria.map(criterium => String(criterium.filterType)),
			sortBy: String(this.sortBy),
			sortOrder: String(this.sortOrder)
		};
	}
}

function getStatistic(statistics: IRawGalleryExtensionStatistics[], name: string): number {
	const result = (statistics || []).filter(s => s.statisticName === name)[0];
	return result ? result.value : 0;
}

function getCoreTranslationAssets(version: IRawGalleryExtensionVersion): [string, IGalleryExtensionAsset][] {
	const coreTranslationAssetPrefix = 'Microsoft.VisualStudio.Code.Translation.';
	const result = version.files.filter(f => f.assetType.indexOf(coreTranslationAssetPrefix) === 0);
	return result.reduce<[string, IGalleryExtensionAsset][]>((result, file) => {
		const asset = getVersionAsset(version, file.assetType);
		if (asset) {
			result.push([file.assetType.substring(coreTranslationAssetPrefix.length), asset]);
		}
		return result;
	}, []);
}

function getRepositoryAsset(version: IRawGalleryExtensionVersion): IGalleryExtensionAsset | null {
	if (version.properties) {
		const results = version.properties.filter(p => p.key === AssetType.Repository);
		const gitRegExp = new RegExp('((git|ssh|http(s)?)|(git@[\\w.]+))(:(//)?)([\\w.@\:/\\-~]+)(.git)(/)?');

		const uri = results.filter(r => gitRegExp.test(r.value))[0];
		return uri ? { uri: uri.value, fallbackUri: uri.value } : null;
	}
	return getVersionAsset(version, AssetType.Repository);
}

function getDownloadAsset(version: IRawGalleryExtensionVersion): IGalleryExtensionAsset {
	// {{SQL CARBON EDIT}} - Use the extension VSIX download URL if present
	const asset = getVersionAsset(version, AssetType.VSIX);
	if (asset) {
		return asset;
	}
	// {{SQL CARBON EDIT}} - End

	return {
		uri: `${version.fallbackAssetUri}/${AssetType.VSIX}?redirect=true`,
		fallbackUri: `${version.fallbackAssetUri}/${AssetType.VSIX}`
	};
}

function getIconAsset(version: IRawGalleryExtensionVersion): IGalleryExtensionAsset {
	const asset = getVersionAsset(version, AssetType.Icon);
	if (asset) {
		return asset;
	}
	const uri = DefaultIconPath;
	return { uri, fallbackUri: uri };
}

function getVersionAsset(version: IRawGalleryExtensionVersion, type: string): IGalleryExtensionAsset | null {
	const result = version.files.filter(f => f.assetType === type)[0];

	// {{SQL CARBON EDIT}}
	let uriFromSource: string | undefined;
	if (result) {
		uriFromSource = result.source;
	}
	if (type === AssetType.VSIX) {
		return {
			uri: uriFromSource || `${version.fallbackAssetUri}/${type}?redirect=true`,
			fallbackUri: `${version.fallbackAssetUri}/${type}`
		};
	}
	if (version.assetUri) {
		return {
			uri: `${version.assetUri}/${type}`,
			fallbackUri: `${version.fallbackAssetUri}/${type}`
		};
	} else {
		return result ? { uri: uriFromSource!, fallbackUri: `${version.fallbackAssetUri}/${type}` } : null;
	}
	// return result ? { uri: `${version.assetUri}/${type}`, fallbackUri: `${version.fallbackAssetUri}/${type}` } : null;
	// {{SQL CARBON EDIT}} - End
}

function getExtensions(version: IRawGalleryExtensionVersion, property: string): string[] {
	const values = version.properties ? version.properties.filter(p => p.key === property) : [];
	const value = values.length > 0 && values[0].value;
	return value ? value.split(',').map(v => adoptToGalleryExtensionId(v)) : [];
}

function getEngine(version: IRawGalleryExtensionVersion): string {
	const values = version.properties ? version.properties.filter(p => p.key === PropertyType.Engine) : [];
	return (values.length > 0 && values[0].value) || '';
}

// {{SQL CARBON EDIT}}
function getAzureDataStudioEngine(version: IRawGalleryExtensionVersion): string {
	const values = version.properties ? version.properties.filter(p => p.key === PropertyType.AzDataEngine) : [];
	return (values.length > 0 && values[0].value) || '';
}

function getLocalizedLanguages(version: IRawGalleryExtensionVersion): string[] {
	const values = version.properties ? version.properties.filter(p => p.key === PropertyType.LocalizedLanguages) : [];
	const value = (values.length > 0 && values[0].value) || '';
	return value ? value.split(',') : [];
}

function getIsPreview(flags: string): boolean {
	return flags.indexOf('preview') !== -1;
}

function toExtension(galleryExtension: IRawGalleryExtension, version: IRawGalleryExtensionVersion, index: number, query: Query, querySource?: string): IGalleryExtension {
	const assets = <IGalleryExtensionAssets>{
		manifest: getVersionAsset(version, AssetType.Manifest),
		readme: getVersionAsset(version, AssetType.Details),
		changelog: getVersionAsset(version, AssetType.Changelog),
		license: getVersionAsset(version, AssetType.License),
		repository: getRepositoryAsset(version),
		download: getDownloadAsset(version),
		// {{SQL CARBON EDIT}} - Add downloadPage
		downloadPage: getVersionAsset(version, AssetType.DownloadPage),
		icon: getIconAsset(version),
		coreTranslations: getCoreTranslationAssets(version)
	};

	return {
		identifier: {
			id: getGalleryExtensionId(galleryExtension.publisher.publisherName, galleryExtension.extensionName),
			uuid: galleryExtension.extensionId
		},
		name: galleryExtension.extensionName,
		version: version.version,
		displayName: galleryExtension.displayName,
		publisherId: galleryExtension.publisher.publisherId,
		publisher: galleryExtension.publisher.publisherName,
		publisherDisplayName: galleryExtension.publisher.displayName,
		description: galleryExtension.shortDescription || '',
		installCount: getStatistic(galleryExtension.statistics, 'install'),
		rating: getStatistic(galleryExtension.statistics, 'averagerating'),
		ratingCount: getStatistic(galleryExtension.statistics, 'ratingcount'),
		categories: galleryExtension.categories || [],
		tags: galleryExtension.tags || [],
		releaseDate: Date.parse(galleryExtension.releaseDate),
		lastUpdated: Date.parse(version.lastUpdated), // {{SQL CARBON EDIT}} We don't have the lastUpdated at the top level currently
		webExtension: !!galleryExtension.tags?.includes(WEB_EXTENSION_TAG),
		assets,
		properties: {
			dependencies: getExtensions(version, PropertyType.Dependency),
			extensionPack: getExtensions(version, PropertyType.ExtensionPack),
			engine: getEngine(version),
			// {{SQL CARBON EDIT}}
			azDataEngine: getAzureDataStudioEngine(version),
			localizedLanguages: getLocalizedLanguages(version),
		},
		/* __GDPR__FRAGMENT__
			"GalleryExtensionTelemetryData2" : {
				"index" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
				"querySource": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
			}
		*/
		telemetryData: {
			index: ((query.pageNumber - 1) * query.pageSize) + index,
			querySource
		},
		preview: getIsPreview(galleryExtension.flags)
	};
}

interface IRawExtensionsReport {
	malicious: string[];
	slow: string[];
}

export class ExtensionGalleryService implements IExtensionGalleryService {

	declare readonly _serviceBrand: undefined;

	private extensionsGalleryUrl: string | undefined;
	private extensionsControlUrl: string | undefined;

	private readonly commonHeadersPromise: Promise<{ [key: string]: string; }>;

	constructor(
		@IRequestService private readonly requestService: IRequestService,
		@ILogService private readonly logService: ILogService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IConfigurationService private configurationService: IConfigurationService, // {{SQL CARBON EDIT}}
		@IFileService private readonly fileService: IFileService,
		@IProductService private readonly productService: IProductService,
		@optional(IStorageService) storageService: IStorageService,
	) {
		const config = productService.extensionsGallery;
		this.extensionsGalleryUrl = config && config.serviceUrl;
		this.extensionsControlUrl = config && config.controlUrl;
		this.commonHeadersPromise = resolveMarketplaceHeaders(productService.version, this.environmentService, this.fileService, storageService);
	}

	private api(path = ''): string {
		// {{SQL CARBON EDIT}}
		return `${this.extensionsGalleryUrl}`;
	}

	isEnabled(): boolean {
		return !!this.extensionsGalleryUrl;
	}

	async getExtensions(names: string[], token: CancellationToken): Promise<IGalleryExtension[]> {
		const result: IGalleryExtension[] = [];
		let { total, firstPage: pageResult, getPage } = await this.query({ names, pageSize: names.length }, token);
		result.push(...pageResult);
		for (let pageIndex = 1; result.length < total; pageIndex++) {
			pageResult = await getPage(pageIndex, token);
			if (pageResult.length) {
				result.push(...pageResult);
			} else {
				break;
			}
		}
		return result;
	}

	async getCompatibleExtension(arg1: IExtensionIdentifier | IGalleryExtension, version?: string): Promise<IGalleryExtension | null> {
		return this.getCompatibleExtensionByEngine(arg1, version);
	}

	private async getCompatibleExtensionByEngine(arg1: IExtensionIdentifier | IGalleryExtension, version?: string): Promise<IGalleryExtension | null> {
		const extension: IGalleryExtension | null = isIExtensionIdentifier(arg1) ? null : arg1;
		// {{SQL CARBON EDIT}}
		// Change to original version: removed the extension version validation
		// Reason: This method is used to find the matching gallery extension for the locally installed extension,
		//         since we only have one entry for each extension (not in-scope to enable mutiple version support for now),
		//         if the new version of extension is not compatible, the extension won't be displayed properly.
		if (extension) {
			return Promise.resolve(extension);
		}
		const { id, uuid } = <IExtensionIdentifier>arg1; // {{SQL CARBON EDIT}} @anthonydresser remove extension ? extension.identifier
		let query = new Query()
			.withFlags(Flags.IncludeAssetUri, Flags.IncludeStatistics, Flags.IncludeCategoryAndTags, Flags.IncludeFiles, Flags.IncludeVersionProperties)
			.withPage(1, 1)
			.withFilter(FilterType.Target, 'Microsoft.VisualStudio.Code');

		if (uuid) {
			query = query.withFilter(FilterType.ExtensionId, uuid);
		} else {
			query = query.withFilter(FilterType.ExtensionName, id);
		}

		const { galleryExtensions } = await this.queryGallery(query, CancellationToken.None);
		const [rawExtension] = galleryExtensions;
		if (!rawExtension || !rawExtension.versions.length) {
			return null;
		}

		if (version) {
			const versionAsset = rawExtension.versions.filter(v => v.version === version)[0];
			if (versionAsset) {
				const extension = toExtension(rawExtension, versionAsset, 0, query);
				if (extension.properties.engine && isEngineValid(extension.properties.engine, this.productService.version, this.productService.date)) {
					return extension;
				}
			}
			return null;
		}

		const rawVersion = await this.getLastValidExtensionVersion(rawExtension, rawExtension.versions);
		if (rawVersion) {
			return toExtension(rawExtension, rawVersion, 0, query);
		}
		return null;
	}

	query(token: CancellationToken): Promise<IPager<IGalleryExtension>>;
	query(options: IQueryOptions, token: CancellationToken): Promise<IPager<IGalleryExtension>>;
	async query(arg1: any, arg2?: any): Promise<IPager<IGalleryExtension>> {
		const options: IQueryOptions = CancellationToken.isCancellationToken(arg1) ? {} : arg1;
		const token: CancellationToken = CancellationToken.isCancellationToken(arg1) ? arg1 : arg2;

		if (!this.isEnabled()) {
			throw new Error('No extension gallery service configured.');
		}

		const type = options.names ? 'ids' : (options.text ? 'text' : 'all');
		let text = options.text || '';
		const pageSize = getOrDefault(options, o => o.pageSize, 50);

		type GalleryServiceQueryClassification = {
			type: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
			text: { classification: 'CustomerContent', purpose: 'FeatureInsight' };
		};
		type GalleryServiceQueryEvent = {
			type: string;
			text: string;
		};
		this.telemetryService.publicLog2<GalleryServiceQueryEvent, GalleryServiceQueryClassification>('galleryService:query', { type, text });

		let query = new Query()
			.withFlags(Flags.IncludeLatestVersionOnly, Flags.IncludeAssetUri, Flags.IncludeStatistics, Flags.IncludeCategoryAndTags, Flags.IncludeFiles, Flags.IncludeVersionProperties)
			.withPage(1, pageSize)
			.withFilter(FilterType.Target, 'Microsoft.VisualStudio.Code');

		if (options.excludeFlags) {
			query = query.withFilter(FilterType.ExcludeWithFlags, options.excludeFlags); // {{SQL CARBON EDIT}} exclude extensions matching excludeFlags options
		}

		if (text) {
			// Use category filter instead of "category:themes"
			text = text.replace(/\bcategory:("([^"]*)"|([^"]\S*))(\s+|\b|$)/g, (_, quotedCategory, category) => {
				query = query.withFilter(FilterType.Category, category || quotedCategory);
				return '';
			});

			// Use tag filter instead of "tag:debuggers"
			text = text.replace(/\btag:("([^"]*)"|([^"]\S*))(\s+|\b|$)/g, (_, quotedTag, tag) => {
				query = query.withFilter(FilterType.Tag, tag || quotedTag);
				return '';
			});

			// Use featured filter
			text = text.replace(/\bfeatured(\s+|\b|$)/g, () => {
				query = query.withFilter(FilterType.Featured);
				return '';
			});

			text = text.trim();

			if (text) {
				text = text.length < 200 ? text : text.substring(0, 200);
				query = query.withFilter(FilterType.SearchText, text);
			}

			query = query.withSortBy(SortBy.NoneOrRelevance);
		} else if (options.ids) {
			query = query.withFilter(FilterType.ExtensionId, ...options.ids);
		} else if (options.names) {
			query = query.withFilter(FilterType.ExtensionName, ...options.names);
		} else {
			query = query.withSortBy(SortBy.InstallCount);
		}

		if (typeof options.sortBy === 'number') {
			query = query.withSortBy(options.sortBy);
		}

		if (typeof options.sortOrder === 'number') {
			query = query.withSortOrder(options.sortOrder);
		}

		const { galleryExtensions, total } = await this.queryGallery(query, token);
		const extensions = galleryExtensions.map((e, index) => toExtension(e, e.versions[0], index, query, options.source));
		const getPage = async (pageIndex: number, ct: CancellationToken) => {
			if (ct.isCancellationRequested) {
				throw canceled();
			}
			const nextPageQuery = query.withPage(pageIndex + 1);
			const { galleryExtensions } = await this.queryGallery(nextPageQuery, ct);
			return galleryExtensions.map((e, index) => toExtension(e, e.versions[0], index, nextPageQuery, options.source));
		};

		// {{SQL CARBON EDIT}}
		return { firstPage: extensions, total, pageSize: extensions.length, getPage } as IPager<IGalleryExtension>;
	}

	// {{SQL CARBON EDIT}}
	/**
	 * The result of querying the gallery returns all the extensions because it's only reading a static file.
	 * So this method should apply all the filters and return the actual result
	 */
	private createQueryResult(query: Query, galleryExtensions: IRawGalleryExtension[]): { galleryExtensions: IRawGalleryExtension[], total: number; } {

		// Filtering
		let filteredExtensions = galleryExtensions;
		if (query.criteria) {
			const ids = query.criteria.filter(x => x.filterType === FilterType.ExtensionId).map(v => v.value ? v.value.toLocaleLowerCase() : undefined);
			if (ids && ids.length > 0) {
				filteredExtensions = filteredExtensions.filter(e => e.extensionId && ids.find(x => x === e.extensionId.toLocaleLowerCase()));
			}
			const names = query.criteria.filter(x => x.filterType === FilterType.ExtensionName).map(v => v.value ? v.value.toLocaleLowerCase() : undefined);
			if (names && names.length > 0) {
				filteredExtensions = filteredExtensions.filter(e => e.extensionName && e.publisher.publisherName && names.find(x => x === `${e.publisher.publisherName.toLocaleLowerCase()}.${e.extensionName.toLocaleLowerCase()}`));
			}
			const categoryFilters = query.criteria.filter(x => x.filterType === FilterType.Category).map(v => v.value ? v.value.toLowerCase() : undefined);
			if (categoryFilters && categoryFilters.length > 0) {
				// Implement the @category: "language packs" filtering
				if (categoryFilters.find(x => x === 'language packs')) {
					filteredExtensions = filteredExtensions.filter(e => {
						// we only have 1 version for our extensions in the gallery file, so this should always be the case
						if (e.versions.length === 1) {
							const extension = toExtension(e, e.versions[0], 0, query);
							return extension.properties.localizedLanguages && extension.properties.localizedLanguages.length > 0;
						}
						return false;
					});
				}
			}
			// ADS doesn't support extension tags, we need to return empty array to avoid breaking some scenarios. e.g. file extension based recommendations.
			const tagFilters = query.criteria.filter(x => x.filterType === FilterType.Tag);
			if (tagFilters?.length > 0) {
				filteredExtensions = [];
			}
			const searchTexts = query.criteria.filter(x => x.filterType === FilterType.SearchText).map(v => v.value ? v.value.toLocaleLowerCase() : undefined);
			if (searchTexts && searchTexts.length > 0) {
				searchTexts.forEach(searchText => {
					if (searchText !== '@allmarketplace') {
						filteredExtensions = filteredExtensions.filter(e => ExtensionGalleryService.isMatchingExtension(e, searchText));
					}
				});
			}

			// {{SQL CARBON EDIT}} - filter out extensions that match the excludeFlags options
			const flags = query.criteria.filter(x => x.filterType === FilterType.ExcludeWithFlags).map(v => v.value ? v.value.toLocaleLowerCase() : undefined);
			if (flags && flags.length > 0) {
				filteredExtensions = filteredExtensions.filter(e => !e.flags || flags.find(x => x === e.flags.toLocaleLowerCase()) === undefined);
			}
		}

		// Sorting
		switch (query.sortBy) {
			case SortBy.PublisherName:
				filteredExtensions.sort((a, b) => ExtensionGalleryService.compareByField(a.publisher, b.publisher, 'publisherName'));
				break;
			case SortBy.Title:
			default:
				filteredExtensions.sort((a, b) => ExtensionGalleryService.compareByField(a, b, 'displayName'));
				break;
		}

		let actualTotal = filteredExtensions.length;

		// {{SQL CARBON EDIT}}
		let extensionPolicy = this.configurationService.getValue<string>(ExtensionsPolicyKey);
		if (extensionPolicy === ExtensionsPolicy.allowMicrosoft) {
			filteredExtensions = filteredExtensions.filter(ext => ext.publisher && ext.publisher.displayName === 'Microsoft');
		}
		return { galleryExtensions: filteredExtensions, total: actualTotal };
	}

	// {{SQL CARBON EDIT}}
	/*
	 * Checks whether the extension matches the search text
	 */
	public static isMatchingExtension(extension?: IRawGalleryExtension, searchText?: string): boolean {
		if (!searchText) {
			return true;
		}
		let text = searchText.toLocaleLowerCase();
		return !!extension
			&& !!(extension.extensionName && extension.extensionName.toLocaleLowerCase().indexOf(text) > -1 ||
				extension.publisher && extension.publisher.publisherName && extension.publisher.publisherName.toLocaleLowerCase().indexOf(text) > -1 ||
				extension.publisher && extension.publisher.displayName && extension.publisher.displayName.toLocaleLowerCase().indexOf(text) > -1 ||
				extension.displayName && extension.displayName.toLocaleLowerCase().indexOf(text) > -1 ||
				extension.shortDescription && extension.shortDescription.toLocaleLowerCase().indexOf(text) > -1 ||
				extension.extensionId && extension.extensionId.toLocaleLowerCase().indexOf(text) > -1);
	}

	public static compareByField(a: any, b: any, fieldName: string): number {
		if (a && !b) {
			return 1;
		}
		if (b && !a) {
			return -1;
		}
		if (a && a[fieldName] && (!b || !b[fieldName])) {
			return 1;
		}
		if (b && b[fieldName] && (!a || !a[fieldName])) {
			return -1;
		}
		if (!b || !b[fieldName] && (!a || !a[fieldName])) {
			return 0;
		}
		if (a[fieldName] === b[fieldName]) {
			return 0;
		}
		return a[fieldName] < b[fieldName] ? -1 : 1;
	}

	private async queryGallery(query: Query, token: CancellationToken): Promise<{ galleryExtensions: IRawGalleryExtension[], total: number; }> {
		if (!this.isEnabled()) {
			throw new Error('No extension gallery service configured.');
		}
		// Always exclude non validated and unpublished extensions
		query = query
			.withFlags(query.flags, Flags.ExcludeNonValidated)
			.withFilter(FilterType.ExcludeWithFlags, flagsToString(Flags.Unpublished));

		const commonHeaders = await this.commonHeadersPromise;
		const data = JSON.stringify(query.raw);
		const headers = {
			...commonHeaders,
			'Content-Type': 'application/json',
			'Accept': 'application/json;api-version=3.0-preview.1',
			'Accept-Encoding': 'gzip',
			'Content-Length': String(data.length)
		};

		const context = await this.requestService.request({
			// {{SQL CARBON EDIT}}
			type: 'GET',
			url: this.api('/extensionquery'),
			data,
			headers
		}, token);

		// {{SQL CARBON EDIT}}
		let extensionPolicy: string = this.configurationService.getValue<string>(ExtensionsPolicyKey);
		if (context.res.statusCode && context.res.statusCode >= 400 && context.res.statusCode < 500 || extensionPolicy === ExtensionsPolicy.allowNone) {
			return { galleryExtensions: [], total: 0 };
		}

		const result = await asJson<IRawGalleryQueryResult>(context);
		if (result) {
			const r = result.results[0];
			const galleryExtensions = r.extensions;
			// const resultCount = r.resultMetadata && r.resultMetadata.filter(m => m.metadataType === 'ResultCount')[0]; {{SQL CARBON EDIT}} comment out for no unused
			// const total = resultCount && resultCount.metadataItems.filter(i => i.name === 'TotalCount')[0].count || 0; {{SQL CARBON EDIT}} comment out for no unused

			// {{SQL CARBON EDIT}}
			let filteredExtensionsResult = this.createQueryResult(query, galleryExtensions);

			return { galleryExtensions: filteredExtensionsResult.galleryExtensions, total: filteredExtensionsResult.total };
			// {{SQL CARBON EDIT}} - End
		}
		return { galleryExtensions: [], total: 0 };
	}

	async reportStatistic(publisher: string, name: string, version: string, type: StatisticType): Promise<void> {
		if (!this.isEnabled()) {
			return undefined;
		}

		const url = isWeb ? this.api(`/itemName/${publisher}.${name}/version/${version}/statType/${type === StatisticType.Install ? '1' : '3'}/vscodewebextension`) : this.api(`/publishers/${publisher}/extensions/${name}/${version}/stats?statType=${type}`);
		const Accept = isWeb ? 'api-version=6.1-preview.1' : '*/*;api-version=4.0-preview.1';

		const commonHeaders = await this.commonHeadersPromise;
		const headers = { ...commonHeaders, Accept };
		try {
			await this.requestService.request({
				type: 'POST',
				url,
				headers
			}, CancellationToken.None);
		} catch (error) { /* Ignore */ }
	}

	async download(extension: IGalleryExtension, location: URI, operation: InstallOperation): Promise<void> {
		this.logService.trace('ExtensionGalleryService#download', extension.identifier.id);
		const data = getGalleryExtensionTelemetryData(extension);
		const startTime = new Date().getTime();
		/* __GDPR__
			"galleryService:downloadVSIX" : {
				"duration": { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
				"${include}": [
					"${GalleryExtensionTelemetryData}"
				]
			}
		*/
		const log = (duration: number) => this.telemetryService.publicLog('galleryService:downloadVSIX', { ...data, duration });

		// {{SQL CARBON EDIT}} - Don't append install or update on to the URL
		// const operationParam = operation === InstallOperation.Install ? 'install' : operation === InstallOperation.Update ? 'update' : '';
		const operationParam = undefined;
		const downloadAsset = operationParam ? {
			uri: `${extension.assets.download.uri}&${operationParam}=true`,
			fallbackUri: `${extension.assets.download.fallbackUri}?${operationParam}=true`
		} : extension.assets.download;

		const context = await this.getAsset(downloadAsset);
		await this.fileService.writeFile(location, context.stream);
		log(new Date().getTime() - startTime);
	}

	async getReadme(extension: IGalleryExtension, token: CancellationToken): Promise<string> {
		if (extension.assets.readme) {
			const context = await this.getAsset(extension.assets.readme, {}, token);
			const content = await asText(context);
			return content || '';
		}
		return '';
	}

	async getManifest(extension: IGalleryExtension, token: CancellationToken): Promise<IExtensionManifest | null> {
		if (extension.assets.manifest) {
			const context = await this.getAsset(extension.assets.manifest, {}, token);
			const text = await asText(context);
			return text ? JSON.parse(text) : null;
		}
		return null;
	}

	async getCoreTranslation(extension: IGalleryExtension, languageId: string): Promise<ITranslation | null> {
		const asset = extension.assets.coreTranslations.filter(t => t[0] === languageId.toUpperCase())[0];
		if (asset) {
			const context = await this.getAsset(asset[1]);
			const text = await asText(context);
			return text ? JSON.parse(text) : null;
		}
		return null;
	}

	async getChangelog(extension: IGalleryExtension, token: CancellationToken): Promise<string> {
		if (extension.assets.changelog) {
			const context = await this.getAsset(extension.assets.changelog, {}, token);
			const content = await asText(context);
			return content || '';
		}
		return '';
	}

	async getAllVersions(extension: IGalleryExtension, compatible: boolean): Promise<IGalleryExtensionVersion[]> {
		let query = new Query()
			.withFlags(Flags.IncludeVersions, Flags.IncludeCategoryAndTags, Flags.IncludeFiles, Flags.IncludeVersionProperties)
			.withPage(1, 1)
			.withFilter(FilterType.Target, 'Microsoft.VisualStudio.Code');

		if (extension.identifier.uuid) {
			query = query.withFilter(FilterType.ExtensionId, extension.identifier.uuid);
		} else {
			query = query.withFilter(FilterType.ExtensionName, extension.identifier.id);
		}

		const result: IGalleryExtensionVersion[] = [];
		const { galleryExtensions } = await this.queryGallery(query, CancellationToken.None);
		if (galleryExtensions.length) {
			if (compatible) {
				await Promise.all(galleryExtensions[0].versions.map(async v => {
					let engine: string | undefined;
					try {
						engine = await this.getEngine(v);
					} catch (error) { /* Ignore error and skip version */ }
					if (engine && isEngineValid(engine, this.productService.version, this.productService.date)) {
						result.push({ version: v!.version, date: v!.lastUpdated });
					}
				}));
			} else {
				result.push(...galleryExtensions[0].versions.map(v => ({ version: v.version, date: v.lastUpdated })));
			}
		}
		return result;
	}

	private async getAsset(asset: IGalleryExtensionAsset, options: IRequestOptions = {}, token: CancellationToken = CancellationToken.None): Promise<IRequestContext> {
		const commonHeaders = {}; // await this.commonHeadersPromise; {{SQL CARBON EDIT}} Because we query other sources such as github don't insert the custom VS headers - otherwise Electron will make a CORS preflight request which not all endpoints support.
		const baseOptions = { type: 'GET' };
		const headers = { ...commonHeaders, ...(options.headers || {}) };
		options = { ...options, ...baseOptions, headers };

		const url = asset.uri;
		const fallbackUrl = asset.fallbackUri;
		const firstOptions = { ...options, url };

		try {
			const context = await this.requestService.request(firstOptions, token);
			if (context.res.statusCode === 200) {
				return context;
			}
			const message = await asText(context);
			throw new Error(`Expected 200, got back ${context.res.statusCode} instead.\n\n${message}`);
		} catch (err) {
			if (isPromiseCanceledError(err)) {
				throw err;
			}

			const message = getErrorMessage(err);
			type GalleryServiceCDNFallbackClassification = {
				url: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
				message: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
			};
			type GalleryServiceCDNFallbackEvent = {
				url: string;
				message: string;
			};
			this.telemetryService.publicLog2<GalleryServiceCDNFallbackEvent, GalleryServiceCDNFallbackClassification>('galleryService:cdnFallback', { url, message });

			const fallbackOptions = { ...options, url: fallbackUrl };
			return this.requestService.request(fallbackOptions, token);
		}
	}

	private async getLastValidExtensionVersion(extension: IRawGalleryExtension, versions: IRawGalleryExtensionVersion[]): Promise<IRawGalleryExtensionVersion | null> {
		const version = this.getLastValidExtensionVersionFromProperties(extension, versions);
		if (version) {
			return version;
		}
		return this.getLastValidExtensionVersionRecursively(extension, versions);
	}

	private getLastValidExtensionVersionFromProperties(extension: IRawGalleryExtension, versions: IRawGalleryExtensionVersion[]): IRawGalleryExtensionVersion | null {
		for (const version of versions) {
			// {{SQL CARBON EDIT}}
			const vsCodeEngine = getEngine(version);
			const azDataEngine = getAzureDataStudioEngine(version);
			// Require at least one engine version
			if (!vsCodeEngine && !azDataEngine) {
				return null;
			}
			const vsCodeEngineValid = !vsCodeEngine || (vsCodeEngine && isEngineValid(vsCodeEngine, this.productService.vscodeVersion, this.productService.date));
			const azDataEngineValid = !azDataEngine || (azDataEngine && isEngineValid(azDataEngine, this.productService.version, this.productService.date));
			if (vsCodeEngineValid && azDataEngineValid) {
				return version;
			}
		}
		return null;
	}

	private async getEngine(version: IRawGalleryExtensionVersion): Promise<string> {
		const engine = getEngine(version);
		if (engine) {
			return engine;
		}

		const manifestAsset = getVersionAsset(version, AssetType.Manifest);
		if (!manifestAsset) {
			throw new Error('Manifest was not found');
		}

		const headers = { 'Accept-Encoding': 'gzip' };
		const context = await this.getAsset(manifestAsset, { headers });
		const manifest = await asJson<IExtensionManifest>(context);
		if (manifest) {
			return manifest.engines.vscode;
		}

		throw new Error('Error while reading manifest');
	}

	private async getLastValidExtensionVersionRecursively(extension: IRawGalleryExtension, versions: IRawGalleryExtensionVersion[]): Promise<IRawGalleryExtensionVersion | null> {
		if (!versions.length) {
			return null;
		}

		const version = versions[0];
		const engine = await this.getEngine(version);
		if (!isEngineValid(engine, this.productService.version, this.productService.date)) {
			return this.getLastValidExtensionVersionRecursively(extension, versions.slice(1));
		}

		return {
			...version,
			properties: [...(version.properties || []), { key: PropertyType.Engine, value: engine }]
		};
	}

	async getExtensionsReport(): Promise<IReportedExtension[]> {
		if (!this.isEnabled()) {
			throw new Error('No extension gallery service configured.');
		}

		if (!this.extensionsControlUrl) {
			return [];
		}

		const context = await this.requestService.request({ type: 'GET', url: this.extensionsControlUrl }, CancellationToken.None);
		if (context.res.statusCode !== 200) {
			throw new Error('Could not get extensions report.');
		}

		const result = await asJson<IRawExtensionsReport>(context);
		const map = new Map<string, IReportedExtension>();

		if (result) {
			for (const id of result.malicious) {
				const ext = map.get(id) || { id: { id }, malicious: true, slow: false };
				ext.malicious = true;
				map.set(id, ext);
			}
		}

		return [...map.values()];
	}
}

export async function resolveMarketplaceHeaders(version: string, environmentService: IEnvironmentService, fileService: IFileService, storageService: {
	get: (key: string, scope: StorageScope) => string | undefined,
	store: (key: string, value: string, scope: StorageScope, target: StorageTarget) => void
} | undefined): Promise<{ [key: string]: string; }> {
	const headers: IHeaders = {
		'X-Market-Client-Id': `VSCode ${version}`,
		'User-Agent': `VSCode ${version}`
	};
	const uuid = await getServiceMachineId(environmentService, fileService, storageService);
	headers['X-Market-User-Id'] = uuid;
	return headers;
}
