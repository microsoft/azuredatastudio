/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage, isPromiseCanceledError, canceled } from 'vs/base/common/errors';
import { StatisticType, IGalleryExtension, IExtensionGalleryService, IGalleryExtensionAsset, IQueryOptions, SortBy, SortOrder, IExtensionIdentifier, IReportedExtension, InstallOperation, ITranslation, IGalleryExtensionVersion, IGalleryExtensionAssets, isIExtensionIdentifier } from 'vs/platform/extensionManagement/common/extensionManagement';
import { getGalleryExtensionId, getGalleryExtensionTelemetryData, adoptToGalleryExtensionId } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { assign, getOrDefault } from 'vs/base/common/objects';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IPager } from 'vs/base/common/paging';
import { IRequestService, asJson, asText } from 'vs/platform/request/common/request';
import { IRequestOptions, IRequestContext, IHeaders } from 'vs/base/parts/request/common/request';
import { isEngineValid } from 'vs/platform/extensions/common/extensionValidator';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { generateUuid, isUUID } from 'vs/base/common/uuid';
import { values } from 'vs/base/common/map';
// {{SQL CARBON EDIT}}
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ExtensionsPolicy, ExtensionsPolicyKey } from 'vs/workbench/contrib/extensions/common/extensions';
// {{SQL CARBON EDIT}} - End
import { CancellationToken } from 'vs/base/common/cancellation';
import { ILogService } from 'vs/platform/log/common/log';
import { IExtensionManifest } from 'vs/platform/extensions/common/extensions';
import { IFileService } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';
import { joinPath } from 'vs/base/common/resources';
import { VSBuffer } from 'vs/base/common/buffer';
import { IProductService } from 'vs/platform/product/common/product';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { optional } from 'vs/platform/instantiation/common/instantiation';

interface IRawGalleryExtensionFile {
	assetType: string;
	source: string;
}

interface IRawGalleryExtensionProperty {
	key: string;
	value: string;
}

interface IRawGalleryExtensionVersion {
	version: string;
	lastUpdated: string;
	assetUri: string;
	fallbackAssetUri: string;
	files: IRawGalleryExtensionFile[];
	properties?: IRawGalleryExtensionProperty[];
}

interface IRawGalleryExtensionStatistics {
	statisticName: string;
	value: number;
}

interface IRawGalleryExtension {
	extensionId: string;
	extensionName: string;
	displayName: string;
	shortDescription: string;
	publisher: { displayName: string, publisherId: string, publisherName: string; };
	versions: IRawGalleryExtensionVersion[];
	statistics: IRawGalleryExtensionStatistics[];
	flags: string;
}

interface IRawGalleryQueryResult {
	results: {
		extensions: IRawGalleryExtension[];
		resultMetadata: {
			metadataType: string;
			metadataItems: {
				name: string;
				count: number;
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
	LocalizedLanguages: 'Microsoft.VisualStudio.Code.LocalizedLanguages'
};

interface ICriterium {
	filterType: FilterType;
	value?: string;
}

const DefaultPageSize = 10;

interface IQueryState {
	pageNumber: number;
	pageSize: number;
	sortBy: SortBy;
	sortOrder: SortOrder;
	flags: Flags;
	criteria: ICriterium[];
	assetTypes: string[];
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
		return new Query(assign({}, this.state, { pageNumber, pageSize }));
	}

	withFilter(filterType: FilterType, ...values: string[]): Query {
		const criteria = [
			...this.state.criteria,
			...values.map(value => ({ filterType, value }))
		];

		return new Query(assign({}, this.state, { criteria }));
	}

	withSortBy(sortBy: SortBy): Query {
		return new Query(assign({}, this.state, { sortBy }));
	}

	withSortOrder(sortOrder: SortOrder): Query {
		return new Query(assign({}, this.state, { sortOrder }));
	}

	withFlags(...flags: Flags[]): Query {
		return new Query(assign({}, this.state, { flags: flags.reduce((r, f) => r | f, 0) }));
	}

	withAssetTypes(...assetTypes: string[]): Query {
		return new Query(assign({}, this.state, { assetTypes }));
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
		const gitRegExp = new RegExp('((git|ssh|http(s)?)|(git@[\w\.]+))(:(//)?)([\w\.@\:/\-~]+)(\.git)(/)?');

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
	const uri = require.toUrl('./media/defaultIcon.png');
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
		date: version.lastUpdated,
		displayName: galleryExtension.displayName,
		publisherId: galleryExtension.publisher.publisherId,
		publisher: galleryExtension.publisher.publisherName,
		publisherDisplayName: galleryExtension.publisher.displayName,
		description: galleryExtension.shortDescription || '',
		installCount: getStatistic(galleryExtension.statistics, 'install') + getStatistic(galleryExtension.statistics, 'updateCount'),
		rating: getStatistic(galleryExtension.statistics, 'averagerating'),
		ratingCount: getStatistic(galleryExtension.statistics, 'ratingcount'),
		assets,
		properties: {
			dependencies: getExtensions(version, PropertyType.Dependency),
			extensionPack: getExtensions(version, PropertyType.ExtensionPack),
			engine: getEngine(version),
			// {{SQL CARBON EDIT}}
			azDataEngine: getAzureDataStudioEngine(version),
			localizedLanguages: getLocalizedLanguages(version)
		},
		/* __GDPR__FRAGMENT__
			"GalleryExtensionTelemetryData2" : {
				"index" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
				"searchText": { "classification": "CustomerContent", "purpose": "FeatureInsight" },
				"querySource": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
			}
		*/
		telemetryData: {
			index: ((query.pageNumber - 1) * query.pageSize) + index,
			searchText: query.searchText,
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

	_serviceBrand: undefined;

	private extensionsGalleryUrl: string | undefined;
	private extensionsControlUrl: string | undefined;

	private readonly commonHeadersPromise: Promise<{ [key: string]: string; }>;

	constructor(
		@IRequestService private readonly requestService: IRequestService,
		@ILogService private readonly logService: ILogService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		// {{SQL CARBON EDIT}}
		@IConfigurationService private configurationService: IConfigurationService,
		@IFileService private readonly fileService: IFileService,
		@IProductService private readonly productService: IProductService,
		@optional(IStorageService) private readonly storageService: IStorageService,
	) {
		const config = productService.extensionsGallery;
		this.extensionsGalleryUrl = config && config.serviceUrl;
		this.extensionsControlUrl = config && config.controlUrl;
		this.commonHeadersPromise = resolveMarketplaceHeaders(productService.version, this.environmentService, this.fileService, this.storageService);
	}

	private api(path = ''): string {
		// {{SQL CARBON EDIT}}
		return `${this.extensionsGalleryUrl}`;
	}

	isEnabled(): boolean {
		return !!this.extensionsGalleryUrl;
	}

	getCompatibleExtension(arg1: IExtensionIdentifier | IGalleryExtension, version?: string): Promise<IGalleryExtension | null> {
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
			.withFlags(Flags.IncludeAssetUri, Flags.IncludeStatistics, Flags.IncludeFiles, Flags.IncludeVersionProperties, Flags.ExcludeNonValidated)
			.withPage(1, 1)
			.withFilter(FilterType.Target, 'Microsoft.VisualStudio.Code')
			.withFilter(FilterType.ExcludeWithFlags, flagsToString(Flags.Unpublished));

		if (uuid) {
			query = query.withFilter(FilterType.ExtensionId, uuid);
		} else {
			query = query.withFilter(FilterType.ExtensionName, id);
		}

		return this.queryGallery(query, CancellationToken.None)
			.then(({ galleryExtensions }) => {
				const [rawExtension] = galleryExtensions;
				if (!rawExtension || !rawExtension.versions.length) {
					return null;
				}
				if (version) {
					const versionAsset = rawExtension.versions.filter(v => v.version === version)[0];
					if (versionAsset) {
						const extension = toExtension(rawExtension, versionAsset, 0, query);
						if (extension.properties.engine && isEngineValid(extension.properties.engine, this.productService.version)) {
							return extension;
						}
					}
					return null;
				}
				return this.getLastValidExtensionVersion(rawExtension, rawExtension.versions)
					.then(rawVersion => {
						if (rawVersion) {
							return toExtension(rawExtension, rawVersion, 0, query);
						}
						return null;
					});
			});
	}

	query(token: CancellationToken): Promise<IPager<IGalleryExtension>>;
	query(options: IQueryOptions, token: CancellationToken): Promise<IPager<IGalleryExtension>>;
	query(arg1: any, arg2?: any): Promise<IPager<IGalleryExtension>> {
		const options: IQueryOptions = CancellationToken.isCancellationToken(arg1) ? {} : arg1;
		const token: CancellationToken = CancellationToken.isCancellationToken(arg1) ? arg1 : arg2;

		if (!this.isEnabled()) {
			return Promise.reject(new Error('No extension gallery service configured.'));
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
			.withFlags(Flags.IncludeLatestVersionOnly, Flags.IncludeAssetUri, Flags.IncludeStatistics, Flags.IncludeFiles, Flags.IncludeVersionProperties)
			.withPage(1, pageSize)
			.withFilter(FilterType.Target, 'Microsoft.VisualStudio.Code')
			.withFilter(FilterType.ExcludeWithFlags, flagsToString(Flags.Unpublished));

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

		return this.queryGallery(query, token).then(({ galleryExtensions, total }) => {
			const extensions = galleryExtensions.map((e, index) => toExtension(e, e.versions[0], index, query, options.source));
			// {{SQL CARBON EDIT}}
			const pageSize = extensions.length;
			const getPage = (pageIndex: number, ct: CancellationToken) => {
				if (ct.isCancellationRequested) {
					return Promise.reject(canceled());
				}

				const nextPageQuery = query.withPage(pageIndex + 1);
				return this.queryGallery(nextPageQuery, ct)
					.then(({ galleryExtensions }) => galleryExtensions.map((e, index) => toExtension(e, e.versions[0], index, nextPageQuery, options.source)));
			};

			return { firstPage: extensions, total, pageSize, getPage } as IPager<IGalleryExtension>;
		});
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
				filteredExtensions = filteredExtensions.filter(e => e.extensionId && ids.includes(e.extensionId.toLocaleLowerCase()));
			}
			const names = query.criteria.filter(x => x.filterType === FilterType.ExtensionName).map(v => v.value ? v.value.toLocaleLowerCase() : undefined);
			if (names && names.length > 0) {
				filteredExtensions = filteredExtensions.filter(e => e.extensionName && e.publisher.publisherName && names.includes(`${e.publisher.publisherName.toLocaleLowerCase()}.${e.extensionName.toLocaleLowerCase()}`));
			}
			const categoryFilters = query.criteria.filter(x => x.filterType === FilterType.Category).map(v => v.value ? v.value.toLowerCase() : undefined);
			if (categoryFilters && categoryFilters.length > 0) {
				// Implement the @category: "language packs" filtering
				if (categoryFilters.includes('language packs')) {
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
			const searchTexts = query.criteria.filter(x => x.filterType === FilterType.SearchText).map(v => v.value ? v.value.toLocaleLowerCase() : undefined);
			if (searchTexts && searchTexts.length > 0) {
				searchTexts.forEach(searchText => {
					if (searchText !== '@allmarketplace') {
						filteredExtensions = filteredExtensions.filter(e => ExtensionGalleryService.isMatchingExtension(e, searchText));
					}
				});
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
			&& !!(extension.extensionName && extension.extensionName.toLocaleLowerCase().includes(text) ||
				extension.publisher && extension.publisher.publisherName && extension.publisher.publisherName.toLocaleLowerCase().includes(text) ||
				extension.publisher && extension.publisher.displayName && extension.publisher.displayName.toLocaleLowerCase().includes(text) ||
				extension.displayName && extension.displayName.toLocaleLowerCase().includes(text) ||
				extension.shortDescription && extension.shortDescription.toLocaleLowerCase().includes(text) ||
				extension.extensionId && extension.extensionId.toLocaleLowerCase().includes(text));
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

	private queryGallery(query: Query, token: CancellationToken): Promise<{ galleryExtensions: IRawGalleryExtension[], total: number; }> {
		if (!this.isEnabled()) {
			return Promise.reject(new Error('No extension gallery service configured.'));
		}
		return this.commonHeadersPromise.then(commonHeaders => {
			const data = JSON.stringify(query.raw);
			const headers = assign({}, commonHeaders, {
				'Content-Type': 'application/json',
				'Accept': 'application/json;api-version=3.0-preview.1',
				'Accept-Encoding': 'gzip',
				'Content-Length': data.length
			});

			return this.requestService.request({
				// {{SQL CARBON EDIT}}
				type: 'GET',
				url: this.api('/extensionquery'),
				data,
				headers
			}, token).then(context => {

				// {{SQL CARBON EDIT}}
				let extensionPolicy: string = this.configurationService.getValue<string>(ExtensionsPolicyKey);
				if (context.res.statusCode && context.res.statusCode >= 400 && context.res.statusCode < 500 || extensionPolicy === ExtensionsPolicy.allowNone) {
					return { galleryExtensions: [], total: 0 };
				}

				return asJson<IRawGalleryQueryResult>(context).then(result => {
					if (result) {
						const r = result.results[0];
						const galleryExtensions = r.extensions;
						const resultCount = r.resultMetadata && r.resultMetadata.filter(m => m.metadataType === 'ResultCount')[0];
						const total = resultCount && resultCount.metadataItems.filter(i => i.name === 'TotalCount')[0].count || 0;

						// {{SQL CARBON EDIT}}
						let filteredExtensionsResult = this.createQueryResult(query, galleryExtensions);

						return { galleryExtensions: filteredExtensionsResult.galleryExtensions, total: filteredExtensionsResult.total };
						// {{SQL CARBON EDIT}} - End
					}
					return { galleryExtensions: [], total: 0 };
				});
			});
		});
	}

	reportStatistic(publisher: string, name: string, version: string, type: StatisticType): Promise<void> {
		if (!this.isEnabled()) {
			return Promise.resolve(undefined);
		}

		return this.commonHeadersPromise.then(commonHeaders => {
			const headers = { ...commonHeaders, Accept: '*/*;api-version=4.0-preview.1' };

			return this.requestService.request({
				type: 'POST',
				url: this.api(`/publishers/${publisher}/extensions/${name}/${version}/stats?statType=${type}`),
				headers
			}, CancellationToken.None).then(undefined, () => undefined);
		});
	}

	download(extension: IGalleryExtension, location: URI, operation: InstallOperation): Promise<URI> {
		this.logService.trace('ExtensionGalleryService#download', extension.identifier.id);
		const zip = joinPath(location, generateUuid());
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
		const log = (duration: number) => this.telemetryService.publicLog('galleryService:downloadVSIX', assign(data, { duration }));

		// {{SQL Carbon Edit}} - Don't append install or update on to the URL
		// const operationParam = operation === InstallOperation.Install ? 'install' : operation === InstallOperation.Update ? 'update' : '';
		const operationParam = undefined;
		const downloadAsset = operationParam ? {
			uri: `${extension.assets.download.uri}&${operationParam}=true`,
			fallbackUri: `${extension.assets.download.fallbackUri}?${operationParam}=true`
		} : extension.assets.download;

		return this.getAsset(downloadAsset)
			.then(context => this.fileService.writeFile(zip, context.stream))
			.then(() => log(new Date().getTime() - startTime))
			.then(() => zip);
	}

	getReadme(extension: IGalleryExtension, token: CancellationToken): Promise<string> {
		if (extension.assets.readme) {
			return this.getAsset(extension.assets.readme, {}, token)
				.then(context => asText(context))
				.then(content => content || '');
		}
		return Promise.resolve('');
	}

	getManifest(extension: IGalleryExtension, token: CancellationToken): Promise<IExtensionManifest | null> {
		if (extension.assets.manifest) {
			return this.getAsset(extension.assets.manifest, {}, token)
				.then(asText)
				.then(JSON.parse);
		}
		return Promise.resolve(null);
	}

	getCoreTranslation(extension: IGalleryExtension, languageId: string): Promise<ITranslation | null> {
		const asset = extension.assets.coreTranslations.filter(t => t[0] === languageId.toUpperCase())[0];
		if (asset) {
			return this.getAsset(asset[1])
				.then(asText)
				.then(JSON.parse);
		}
		return Promise.resolve(null);
	}

	getChangelog(extension: IGalleryExtension, token: CancellationToken): Promise<string> {
		if (extension.assets.changelog) {
			return this.getAsset(extension.assets.changelog, {}, token)
				.then(context => asText(context))
				.then(content => content || '');
		}
		return Promise.resolve('');
	}

	getAllVersions(extension: IGalleryExtension, compatible: boolean): Promise<IGalleryExtensionVersion[]> {
		let query = new Query()
			.withFlags(Flags.IncludeVersions, Flags.IncludeFiles, Flags.IncludeVersionProperties, Flags.ExcludeNonValidated)
			.withPage(1, 1)
			.withFilter(FilterType.Target, 'Microsoft.VisualStudio.Code')
			.withFilter(FilterType.ExcludeWithFlags, flagsToString(Flags.Unpublished));

		if (extension.identifier.uuid) {
			query = query.withFilter(FilterType.ExtensionId, extension.identifier.uuid);
		} else {
			query = query.withFilter(FilterType.ExtensionName, extension.identifier.id);
		}

		return this.queryGallery(query, CancellationToken.None).then(({ galleryExtensions }) => {
			if (galleryExtensions.length) {
				if (compatible) {
					return Promise.all(galleryExtensions[0].versions.map(v => this.getEngine(v).then(engine => isEngineValid(engine, this.productService.version) ? v : null)))
						.then(versions => versions
							.filter(v => !!v)
							.map(v => ({ version: v!.version, date: v!.lastUpdated })));
				} else {
					return galleryExtensions[0].versions.map(v => ({ version: v.version, date: v.lastUpdated }));
				}
			}
			return [];
		});
	}

	private getAsset(asset: IGalleryExtensionAsset, options: IRequestOptions = {}, token: CancellationToken = CancellationToken.None): Promise<IRequestContext> {
		return this.commonHeadersPromise.then(commonHeaders => {
			const baseOptions = { type: 'GET' };
			const headers = assign({}, commonHeaders, options.headers || {});
			options = assign({}, options, baseOptions, { headers });

			const url = asset.uri;
			const fallbackUrl = asset.fallbackUri;
			const firstOptions = assign({}, options, { url });

			return this.requestService.request(firstOptions, token)
				.then(context => {
					if (context.res.statusCode === 200) {
						return Promise.resolve(context);
					}

					return asText(context)
						.then(message => Promise.reject(new Error(`Expected 200, got back ${context.res.statusCode} instead.\n\n${message}`)));
				})
				.then(undefined, err => {
					if (isPromiseCanceledError(err)) {
						return Promise.reject(err);
					}

					const message = getErrorMessage(err);
					type GalleryServiceRequestErrorClassification = {
						url: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
						cdn: { classification: 'SystemMetaData', purpose: 'FeatureInsight', isMeasurement: true };
						message: { classification: 'CallstackOrException', purpose: 'FeatureInsight' };
					};
					type GalleryServiceRequestErrorEvent = {
						url: string;
						cdn: boolean;
						message: string;
					};
					this.telemetryService.publicLog2<GalleryServiceRequestErrorEvent, GalleryServiceRequestErrorClassification>('galleryService:requestError', { url, cdn: true, message });
					type GalleryServiceCDNFallbackClassification = {
						url: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
						message: { classification: 'SystemMetaData', purpose: 'FeatureInsight' };
					};
					type GalleryServiceCDNFallbackEvent = {
						url: string;
						message: string;
					};
					this.telemetryService.publicLog2<GalleryServiceCDNFallbackEvent, GalleryServiceCDNFallbackClassification>('galleryService:cdnFallback', { url, message });

					const fallbackOptions = assign({}, options, { url: fallbackUrl });
					return this.requestService.request(fallbackOptions, token).then(undefined, err => {
						if (isPromiseCanceledError(err)) {
							return Promise.reject(err);
						}

						const message = getErrorMessage(err);
						this.telemetryService.publicLog2<GalleryServiceRequestErrorEvent, GalleryServiceRequestErrorClassification>('galleryService:requestError', { url: fallbackUrl, cdn: false, message });
						return Promise.reject(err);
					});
				});
		});
	}

	private getLastValidExtensionVersion(extension: IRawGalleryExtension, versions: IRawGalleryExtensionVersion[]): Promise<IRawGalleryExtensionVersion | null> {
		const version = this.getLastValidExtensionVersionFromProperties(extension, versions);
		if (version) {
			return version;
		}
		return this.getLastValidExtensionVersionRecursively(extension, versions);
	}

	private getLastValidExtensionVersionFromProperties(extension: IRawGalleryExtension, versions: IRawGalleryExtensionVersion[]): Promise<IRawGalleryExtensionVersion> | null {
		for (const version of versions) {
			const engine = getEngine(version);
			if (!engine) {
				return null;
			}
			if (isEngineValid(engine, this.productService.version)) {
				return Promise.resolve(version);
			}
		}
		return null;
	}

	private getEngine(version: IRawGalleryExtensionVersion): Promise<string> {
		const engine = getEngine(version);
		if (engine) {
			return Promise.resolve(engine);
		}

		const manifest = getVersionAsset(version, AssetType.Manifest);
		if (!manifest) {
			return Promise.reject('Manifest was not found');
		}

		const headers = { 'Accept-Encoding': 'gzip' };
		return this.getAsset(manifest, { headers })
			.then(context => asJson<IExtensionManifest>(context))
			.then(manifest => manifest ? manifest.engines.vscode : Promise.reject<string>('Error while reading manifest'));
	}

	private getLastValidExtensionVersionRecursively(extension: IRawGalleryExtension, versions: IRawGalleryExtensionVersion[]): Promise<IRawGalleryExtensionVersion | null> {
		if (!versions.length) {
			return Promise.resolve(null);
		}

		const version = versions[0];
		return this.getEngine(version)
			.then(engine => {
				if (!isEngineValid(engine, this.productService.version)) {
					return this.getLastValidExtensionVersionRecursively(extension, versions.slice(1));
				}

				version.properties = version.properties || [];
				version.properties.push({ key: PropertyType.Engine, value: engine });
				return version;
			});
	}

	getExtensionsReport(): Promise<IReportedExtension[]> {
		if (!this.isEnabled()) {
			return Promise.reject(new Error('No extension gallery service configured.'));
		}

		if (!this.extensionsControlUrl) {
			return Promise.resolve([]);
		}

		return this.requestService.request({ type: 'GET', url: this.extensionsControlUrl }, CancellationToken.None).then(context => {
			if (context.res.statusCode !== 200) {
				return Promise.reject(new Error('Could not get extensions report.'));
			}

			return asJson<IRawExtensionsReport>(context).then(result => {
				const map = new Map<string, IReportedExtension>();

				if (result) {
					for (const id of result.malicious) {
						const ext = map.get(id) || { id: { id }, malicious: true, slow: false };
						ext.malicious = true;
						map.set(id, ext);
					}
				}

				return Promise.resolve(values(map));
			});
		});
	}
}

export async function resolveMarketplaceHeaders(version: string, environmentService: IEnvironmentService, fileService: IFileService, storageService?: IStorageService): Promise<{ [key: string]: string; }> {
	const headers: IHeaders = {
		'X-Market-Client-Id': `VSCode ${version}`,
		'User-Agent': `VSCode ${version}`
	};
	let uuid: string | null = null;
	if (environmentService.galleryMachineIdResource) {
		try {
			const contents = await fileService.readFile(environmentService.galleryMachineIdResource);
			const value = contents.value.toString();
			uuid = isUUID(value) ? value : null;
		} catch (e) {
			uuid = null;
		}

		if (!uuid) {
			uuid = generateUuid();
			try {
				await fileService.writeFile(environmentService.galleryMachineIdResource, VSBuffer.fromString(uuid));
			} catch (error) {
				//noop
			}
		}
	}

	if (storageService) {
		uuid = storageService.get('marketplace.userid', StorageScope.GLOBAL) || null;
		if (!uuid) {
			uuid = generateUuid();
			storageService.store('marketplace.userid', uuid, StorageScope.GLOBAL);
		}
	}

	if (uuid) {
		headers['X-Market-User-Id'] = uuid;
	}

	return headers;

}
