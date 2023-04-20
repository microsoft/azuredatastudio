/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { distinct } from 'vs/base/common/arrays';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStringDictionary } from 'vs/base/common/collections';
import { CancellationError, getErrorMessage, isCancellationError } from 'vs/base/common/errors';
import { IPager } from 'vs/base/common/paging';
import { isWeb, platform } from 'vs/base/common/platform';
import { arch } from 'vs/base/common/process';
import { isBoolean } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { IRequestContext, IRequestOptions } from 'vs/base/parts/request/common/request';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { getFallbackTargetPlarforms, getTargetPlatform, IExtensionGalleryService, IExtensionIdentifier, IExtensionInfo, IGalleryExtension, IGalleryExtensionAsset, IGalleryExtensionAssets, IGalleryExtensionVersion, InstallOperation, IQueryOptions, IExtensionsControlManifest, isNotWebExtensionInWebTargetPlatform, isTargetPlatformCompatible, ITranslation, SortBy, SortOrder, StatisticType, toTargetPlatform, WEB_EXTENSION_TAG, IExtensionQueryOptions, IDeprecationInfo } from 'vs/platform/extensionManagement/common/extensionManagement';
import { adoptToGalleryExtensionId, areSameExtensions, getGalleryExtensionId, getGalleryExtensionTelemetryData } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { ExtensionsPolicy, ExtensionsPolicyKey, IExtensionManifest, TargetPlatform } from 'vs/platform/extensions/common/extensions';
import { isEngineValid } from 'vs/platform/extensions/common/extensionValidator';
import { IFileService } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { IProductService } from 'vs/platform/product/common/productService';
import { asJson, asTextOrError, IRequestService } from 'vs/platform/request/common/request'; // {{SQL CARBON EDIT}} - remove unused
import { resolveMarketplaceHeaders } from 'vs/platform/externalServices/common/marketplace';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';

const CURRENT_TARGET_PLATFORM = isWeb ? TargetPlatform.WEB : getTargetPlatform(platform, arch);

interface IRawGalleryExtensionFile {
	readonly assetType: string;
	readonly source: string;
}

interface IRawGalleryExtensionProperty {
	readonly key: string;
	readonly value: string;
}

export interface IRawGalleryExtensionVersion {
	readonly version: string;
	readonly lastUpdated: string;
	readonly assetUri: string;
	readonly fallbackAssetUri: string;
	readonly files: IRawGalleryExtensionFile[];
	readonly properties?: IRawGalleryExtensionProperty[];
	readonly targetPlatform?: string;
}

interface IRawGalleryExtensionStatistics {
	readonly statisticName: string;
	readonly value: number;
}

interface IRawGalleryExtensionPublisher {
	readonly displayName: string;
	readonly publisherId: string;
	readonly publisherName: string;
	readonly domain?: string | null;
	readonly isDomainVerified?: boolean;
}

interface IRawGalleryExtension {
	readonly extensionId: string;
	readonly extensionName: string;
	readonly displayName: string;
	readonly shortDescription: string;
	readonly publisher: IRawGalleryExtensionPublisher;
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
		}[];
	}[];
}

enum Flags {

	/**
	 * None is used to retrieve only the basic extension details.
	 */
	None = 0x0,

	/**
	 * IncludeVersions will return version information for extensions returned
	 */
	IncludeVersions = 0x1,

	/**
	 * IncludeFiles will return information about which files were found
	 * within the extension that were stored independent of the manifest.
	 * When asking for files, versions will be included as well since files
	 * are returned as a property of the versions.
	 * These files can be retrieved using the path to the file without
	 * requiring the entire manifest be downloaded.
	 */
	IncludeFiles = 0x2,

	/**
	 * Include the Categories and Tags that were added to the extension definition.
	 */
	IncludeCategoryAndTags = 0x4,

	/**
	 * Include the details about which accounts the extension has been shared
	 * with if the extension is a private extension.
	 */
	IncludeSharedAccounts = 0x8,

	/**
	 * Include properties associated with versions of the extension
	 */
	IncludeVersionProperties = 0x10,

	/**
	 * Excluding non-validated extensions will remove any extension versions that
	 * either are in the process of being validated or have failed validation.
	 */
	ExcludeNonValidated = 0x20,

	/**
	 * Include the set of installation targets the extension has requested.
	 */
	IncludeInstallationTargets = 0x40,

	/**
	 * Include the base uri for assets of this extension
	 */
	IncludeAssetUri = 0x80,

	/**
	 * Include the statistics associated with this extension
	 */
	IncludeStatistics = 0x100,

	/**
	 * When retrieving versions from a query, only include the latest
	 * version of the extensions that matched. This is useful when the
	 * caller doesn't need all the published versions. It will save a
	 * significant size in the returned payload.
	 */
	IncludeLatestVersionOnly = 0x200,

	/**
	 * This flag switches the asset uri to use GetAssetByName instead of CDN
	 * When this is used, values of base asset uri and base asset uri fallback are switched
	 * When this is used, source of asset files are pointed to Gallery service always even if CDN is available
	 */
	Unpublished = 0x1000,

	/**
	 * Include the details if an extension is in conflict list or not
	 */
	IncludeNameConflictInfo = 0x8000,
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
	PreRelease: 'Microsoft.VisualStudio.Code.PreRelease',
	// {{SQL CARBON EDIT}}
	AzDataEngine: 'Microsoft.AzDataEngine',
	LocalizedLanguages: 'Microsoft.VisualStudio.Code.LocalizedLanguages',
	WebExtension: 'Microsoft.VisualStudio.Code.WebExtension',
	SponsorLink: 'Microsoft.VisualStudio.Code.SponsorLink'
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
	readonly source?: string;
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
	owner: 'sandy081';
	comment: 'Information about Marketplace query and its response';
	readonly filterTypes: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Filter types used in the query.' };
	readonly flags: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Flags passed in the query.' };
	readonly sortBy: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'sorted by option passed in the query' };
	readonly sortOrder: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'sort order option passed in the query' };
	readonly pageNumber: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'requested page number in the query' };
	readonly duration: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; 'isMeasurement': true; comment: 'amount of time taken by the query request' };
	readonly success: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'whether the query reques is success or not' };
	readonly requestBodySize: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'size of the request body' };
	readonly responseBodySize?: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'size of the response body' };
	readonly statusCode?: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'status code of the response' };
	readonly errorCode?: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'error code of the response' };
	readonly count?: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'total number of extensions matching the query' };
	readonly source?: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'source that requested this query, eg., recommendations, viewlet' };
	readonly searchTextLength?: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'length of the search text in the query' };
};
*/

type QueryTelemetryData = {
	readonly flags: number;
	readonly filterTypes: string[];
	readonly sortBy: string;
	readonly sortOrder: string;
	readonly pageNumber: string;
	readonly source?: string;
	readonly searchTextLength?: number;
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

type GalleryServiceAdditionalQueryClassification = {
	owner: 'sandy081';
	comment: 'Response information about the additional query to the Marketplace for fetching all versions to get release version';
	readonly duration: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; 'isMeasurement': true; comment: 'Amount of time taken by the additional query' };
	readonly count: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Total number of extensions returned by this additional query' };
};

type GalleryServiceAdditionalQueryEvent = {
	readonly duration: number;
	readonly count: number;
};
*/
interface IExtensionCriteria {
	readonly targetPlatform: TargetPlatform;
	readonly compatible: boolean;
	readonly includePreRelease: boolean | (IExtensionIdentifier & { includePreRelease: boolean })[];
	readonly versions?: (IExtensionIdentifier & { version: string })[];
}

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

	withSource(source: string): Query {
		return new Query({ ...this.state, source });
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
			flags: this.state.flags,
			sortBy: String(this.sortBy),
			sortOrder: String(this.sortOrder),
			pageNumber: String(this.pageNumber),
			source: this.state.source,
			searchTextLength: this.searchText.length
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
		const gitRegExp = new RegExp('((git|ssh|http(s)?)|(git@[\\w.]+))(:(//)?)([\\w.@:/\\-~]+)(.git)(/)?');

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
		uri: `${version.fallbackAssetUri}/${AssetType.VSIX}?redirect=true${version.targetPlatform ? `&targetPlatform=${version.targetPlatform}` : ''}`,
		fallbackUri: `${version.fallbackAssetUri}/${AssetType.VSIX}${version.targetPlatform ? `?targetPlatform=${version.targetPlatform}` : ''}`
	};
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

function isPreReleaseVersion(version: IRawGalleryExtensionVersion): boolean {
	const values = version.properties ? version.properties.filter(p => p.key === PropertyType.PreRelease) : [];
	return values.length > 0 && values[0].value === 'true';
}

function getLocalizedLanguages(version: IRawGalleryExtensionVersion): string[] {
	const values = version.properties ? version.properties.filter(p => p.key === PropertyType.LocalizedLanguages) : [];
	const value = (values.length > 0 && values[0].value) || '';
	return value ? value.split(',') : [];
}

function getSponsorLink(version: IRawGalleryExtensionVersion): string | undefined {
	return version.properties?.find(p => p.key === PropertyType.SponsorLink)?.value;
}

function getIsPreview(flags: string): boolean {
	return flags.indexOf('preview') !== -1;
}

function getTargetPlatformForExtensionVersion(version: IRawGalleryExtensionVersion): TargetPlatform {
	return version.targetPlatform ? toTargetPlatform(version.targetPlatform) : TargetPlatform.UNDEFINED;
}

function getAllTargetPlatforms(rawGalleryExtension: IRawGalleryExtension): TargetPlatform[] {
	const allTargetPlatforms = distinct(rawGalleryExtension.versions.map(getTargetPlatformForExtensionVersion));

	// Is a web extension only if it has WEB_EXTENSION_TAG
	const isWebExtension = !!rawGalleryExtension.tags?.includes(WEB_EXTENSION_TAG);

	// Include Web Target Platform only if it is a web extension
	const webTargetPlatformIndex = allTargetPlatforms.indexOf(TargetPlatform.WEB);
	if (isWebExtension) {
		if (webTargetPlatformIndex === -1) {
			// Web extension but does not has web target platform -> add it
			allTargetPlatforms.push(TargetPlatform.WEB);
		}
	} else {
		if (webTargetPlatformIndex !== -1) {
			// Not a web extension but has web target platform -> remove it
			allTargetPlatforms.splice(webTargetPlatformIndex, 1);
		}
	}

	return allTargetPlatforms;
}

export function sortExtensionVersions(versions: IRawGalleryExtensionVersion[], preferredTargetPlatform: TargetPlatform): IRawGalleryExtensionVersion[] {
	/* It is expected that versions from Marketplace are sorted by version. So we are just sorting by preferred targetPlatform */
	const fallbackTargetPlatforms = getFallbackTargetPlarforms(preferredTargetPlatform);
	for (let index = 0; index < versions.length; index++) {
		const version = versions[index];
		if (version.version === versions[index - 1]?.version) {
			let insertionIndex = index;
			const versionTargetPlatform = getTargetPlatformForExtensionVersion(version);
			/* put it at the beginning */
			if (versionTargetPlatform === preferredTargetPlatform) {
				while (insertionIndex > 0 && versions[insertionIndex - 1].version === version.version) { insertionIndex--; }
			}
			/* put it after version with preferred targetPlatform or at the beginning */
			else if (fallbackTargetPlatforms.includes(versionTargetPlatform)) {
				while (insertionIndex > 0 && versions[insertionIndex - 1].version === version.version && getTargetPlatformForExtensionVersion(versions[insertionIndex - 1]) !== preferredTargetPlatform) { insertionIndex--; }
			}
			if (insertionIndex !== index) {
				versions.splice(index, 1);
				versions.splice(insertionIndex, 0, version);
			}
		}
	}
	return versions;
}

function setTelemetry(extension: IGalleryExtension, index: number, querySource?: string): void {
	/* __GDPR__FRAGMENT__
	"GalleryExtensionTelemetryData2" : {
		"index" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
		"querySource": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
	}
	*/
	extension.telemetryData = { index, querySource };
}

function toExtension(galleryExtension: IRawGalleryExtension, version: IRawGalleryExtensionVersion, allTargetPlatforms: TargetPlatform[]): IGalleryExtension {
	const latestVersion = galleryExtension.versions[0];
	const assets = <IGalleryExtensionAssets>{
		manifest: getVersionAsset(version, AssetType.Manifest),
		readme: getVersionAsset(version, AssetType.Details),
		changelog: getVersionAsset(version, AssetType.Changelog),
		license: getVersionAsset(version, AssetType.License),
		repository: getRepositoryAsset(version),
		download: getDownloadAsset(version),
		// {{SQL CARBON EDIT}} - Add downloadPage
		downloadPage: getVersionAsset(version, AssetType.DownloadPage),
		icon: getVersionAsset(version, AssetType.Icon),
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
		publisherDomain: galleryExtension.publisher.domain ? { link: galleryExtension.publisher.domain, verified: !!galleryExtension.publisher.isDomainVerified } : undefined,
		publisherSponsorLink: getSponsorLink(latestVersion),
		description: galleryExtension.shortDescription || '',
		installCount: getStatistic(galleryExtension.statistics, 'install'),
		rating: getStatistic(galleryExtension.statistics, 'averagerating'),
		ratingCount: getStatistic(galleryExtension.statistics, 'ratingcount'),
		categories: galleryExtension.categories || [],
		tags: galleryExtension.tags || [],
		releaseDate: Date.parse(galleryExtension.releaseDate),
		lastUpdated: Date.parse(version.lastUpdated), // {{SQL CARBON EDIT}} We don't have the lastUpdated at the top level currently
		allTargetPlatforms,
		assets,
		properties: {
			dependencies: getExtensions(version, PropertyType.Dependency),
			extensionPack: getExtensions(version, PropertyType.ExtensionPack),
			engine: getEngine(version),
			// {{SQL CARBON EDIT}}
			azDataEngine: getAzureDataStudioEngine(version),
			localizedLanguages: getLocalizedLanguages(version),
			targetPlatform: getTargetPlatformForExtensionVersion(version),
			isPreReleaseVersion: isPreReleaseVersion(version)
		},
		hasPreReleaseVersion: isPreReleaseVersion(latestVersion),
		hasReleaseVersion: true,
		preview: getIsPreview(galleryExtension.flags),
	};
}

interface IRawExtensionsControlManifest {
	malicious: string[];
	migrateToPreRelease?: IStringDictionary<{
		id: string;
		displayName: string;
		migrateStorage?: boolean;
		engine?: string;
	}>;
	deprecated?: IStringDictionary<boolean | {
		disallowInstall?: boolean;
		extension?: {
			id: string;
			displayName: string;
		};
		settings?: string[];
	}>;
}

abstract class AbstractExtensionGalleryService implements IExtensionGalleryService {

	declare readonly _serviceBrand: undefined;

	private extensionsGalleryUrl: string | undefined;
	private extensionsControlUrl: string | undefined;

	private readonly commonHeadersPromise: Promise<{ [key: string]: string }>;

	constructor(
		storageService: IStorageService | undefined,
		@IRequestService private readonly requestService: IRequestService,
		@ILogService private readonly logService: ILogService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IFileService private readonly fileService: IFileService,
		@IProductService private readonly productService: IProductService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		const config = productService.extensionsGallery;
		this.extensionsGalleryUrl = config && config.serviceUrl;
		this.extensionsControlUrl = config && config.controlUrl;
		this.commonHeadersPromise = resolveMarketplaceHeaders(
			productService.version,
			productService,
			this.environmentService,
			this.configurationService,
			this.fileService,
			storageService,
			this.telemetryService);
	}

	private api(path = ''): string {
		// {{SQL CARBON EDIT}}
		return `${this.extensionsGalleryUrl}`;
	}

	isEnabled(): boolean {
		return !!this.extensionsGalleryUrl;
	}

	getExtensions(extensionInfos: ReadonlyArray<IExtensionInfo>, token: CancellationToken): Promise<IGalleryExtension[]>;
	getExtensions(extensionInfos: ReadonlyArray<IExtensionInfo>, options: IExtensionQueryOptions, token: CancellationToken): Promise<IGalleryExtension[]>;
	async getExtensions(extensionInfos: ReadonlyArray<IExtensionInfo>, arg1: any, arg2?: any): Promise<IGalleryExtension[]> {
		const options = CancellationToken.isCancellationToken(arg1) ? {} : arg1 as IExtensionQueryOptions;
		const token = CancellationToken.isCancellationToken(arg1) ? arg1 : arg2 as CancellationToken;
		const names: string[] = []; const ids: string[] = [], includePreReleases: (IExtensionIdentifier & { includePreRelease: boolean })[] = [], versions: (IExtensionIdentifier & { version: string })[] = [];
		let isQueryForReleaseVersionFromPreReleaseVersion = true;
		for (const extensionInfo of extensionInfos) {
			if (extensionInfo.uuid) {
				ids.push(extensionInfo.uuid);
			} else {
				names.push(extensionInfo.id);
			}
			// Set includePreRelease to true if version is set, because the version can be a pre-release version
			const includePreRelease = !!(extensionInfo.version || extensionInfo.preRelease);
			includePreReleases.push({ id: extensionInfo.id, uuid: extensionInfo.uuid, includePreRelease });
			if (extensionInfo.version) {
				versions.push({ id: extensionInfo.id, uuid: extensionInfo.uuid, version: extensionInfo.version });
			}
			isQueryForReleaseVersionFromPreReleaseVersion = isQueryForReleaseVersionFromPreReleaseVersion && (!!extensionInfo.hasPreRelease && !includePreRelease);
		}

		if (!ids.length && !names.length) {
			return [];
		}

		let query = new Query().withPage(1, extensionInfos.length);
		if (ids.length) {
			query = query.withFilter(FilterType.ExtensionId, ...ids);
		}
		if (names.length) {
			query = query.withFilter(FilterType.ExtensionName, ...names);
		}
		if (options.queryAllVersions || isQueryForReleaseVersionFromPreReleaseVersion /* Inlcude all versions if every requested extension is for release version and has pre-release version  */) {
			query = query.withFlags(query.flags, Flags.IncludeVersions);
		}
		if (options.source) {
			query = query.withSource(options.source);
		}

		const { extensions } = await this.queryGalleryExtensions(query, { targetPlatform: options.targetPlatform ?? CURRENT_TARGET_PLATFORM, includePreRelease: includePreReleases, versions, compatible: !!options.compatible }, token);
		if (options.source) {
			extensions.forEach((e, index) => setTelemetry(e, index, options.source));
		}
		return extensions;
	}

	async getCompatibleExtension(extension: IGalleryExtension, includePreRelease: boolean, targetPlatform: TargetPlatform): Promise<IGalleryExtension | null> {
		// {{SQL CARBON EDIT}}
		// Change to original version: removed the extension version validation
		// Reason: This method is used to find the matching gallery extension for the locally installed extension,
		//         since we only have one entry for each extension (not in-scope to enable mutiple version support for now),
		//         if the new version of extension is not compatible, the extension won't be displayed properly.
		if (extension) {
			return Promise.resolve(extension);
		}
		return null;
	}

	async isExtensionCompatible(extension: IGalleryExtension, includePreRelease: boolean, targetPlatform: TargetPlatform): Promise<boolean> {
		if (!isTargetPlatformCompatible(extension.properties.targetPlatform, extension.allTargetPlatforms, targetPlatform)) {
			return false;
		}

		if (!includePreRelease && extension.properties.isPreReleaseVersion) {
			// Pre-releases are not allowed when include pre-release flag is not set
			return false;
		}

		let engine = extension.properties.engine;
		if (!engine) {
			const manifest = await this.getManifest(extension, CancellationToken.None);
			if (!manifest) {
				throw new Error('Manifest was not found');
			}
			engine = manifest.engines.vscode;
		}
		return isEngineValid(engine, this.productService.version, this.productService.date);
	}

	private async isValidVersion(rawGalleryExtensionVersion: IRawGalleryExtensionVersion, versionType: 'release' | 'prerelease' | 'any', compatible: boolean, allTargetPlatforms: TargetPlatform[], targetPlatform: TargetPlatform): Promise<boolean> {
		if (!isTargetPlatformCompatible(getTargetPlatformForExtensionVersion(rawGalleryExtensionVersion), allTargetPlatforms, targetPlatform)) {
			return false;
		}

		if (versionType !== 'any' && isPreReleaseVersion(rawGalleryExtensionVersion) !== (versionType === 'prerelease')) {
			return false;
		}

		if (compatible) {
			try {
				const engine = await this.getEngine(rawGalleryExtensionVersion);
				if (!isEngineValid(engine, this.productService.version, this.productService.date)) {
					return false;
				}
			} catch (error) {
				this.logService.error(`Error while getting the engine for the version ${rawGalleryExtensionVersion.version}.`, getErrorMessage(error));
				return false;
			}
		}

		return true;
	}

	async query(options: IQueryOptions, token: CancellationToken): Promise<IPager<IGalleryExtension>> {
		if (!this.isEnabled()) {
			throw new Error('No extension gallery service configured.');
		}

		let text = options.text || '';
		const pageSize = options.pageSize ?? 50;

		let query = new Query()
			.withPage(1, pageSize);

		// {{SQL CARBON EDIT}} exclude extensions matching excludeFlags options
		if (options.excludeFlags) {
			query = query.withFilter(FilterType.ExcludeWithFlags, options.excludeFlags);
		}
		// {{SQL CARBON EDIT}}} - END

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

		if (options.source) {
			query = query.withSource(options.source);
		}

		const runQuery = async (query: Query, token: CancellationToken) => {
			const { extensions, total } = await this.queryGalleryExtensions(query, { targetPlatform: CURRENT_TARGET_PLATFORM, compatible: false, includePreRelease: !!options.includePreRelease }, token);
			extensions.forEach((e, index) => setTelemetry(e, ((query.pageNumber - 1) * query.pageSize) + index, options.source));
			return { extensions, total };
		};
		const { extensions, total } = await runQuery(query, token);
		const getPage = async (pageIndex: number, ct: CancellationToken) => {
			if (ct.isCancellationRequested) {
				throw new CancellationError();
			}
			const { extensions } = await runQuery(query.withPage(pageIndex + 1), ct);
			return extensions;
		};

		// {{SQL CARBON EDIT}}
		return { firstPage: extensions, total, pageSize: extensions.length, getPage } as IPager<IGalleryExtension>;
	}

	private async queryGalleryExtensions(query: Query, criteria: IExtensionCriteria, token: CancellationToken): Promise<{ extensions: IGalleryExtension[]; total: number }> {
		const flags = query.flags;

		/**
		 * If both version flags (IncludeLatestVersionOnly and IncludeVersions) are included, then only include latest versions (IncludeLatestVersionOnly) flag.
		 */
		if (!!(query.flags & Flags.IncludeLatestVersionOnly) && !!(query.flags & Flags.IncludeVersions)) {
			query = query.withFlags(query.flags & ~Flags.IncludeVersions, Flags.IncludeLatestVersionOnly);
		}

		/**
		 * If version flags (IncludeLatestVersionOnly and IncludeVersions) are not included, default is to query for latest versions (IncludeLatestVersionOnly).
		 */
		if (!(query.flags & Flags.IncludeLatestVersionOnly) && !(query.flags & Flags.IncludeVersions)) {
			query = query.withFlags(query.flags, Flags.IncludeLatestVersionOnly);
		}

		/**
		 * If versions criteria exist, then remove IncludeLatestVersionOnly flag and add IncludeVersions flag.
		 */
		if (criteria.versions?.length) {
			query = query.withFlags(query.flags & ~Flags.IncludeLatestVersionOnly, Flags.IncludeVersions);
		}

		/**
		 * Add necessary extension flags
		 */
		query = query.withFlags(query.flags, Flags.IncludeAssetUri, Flags.IncludeCategoryAndTags, Flags.IncludeFiles, Flags.IncludeStatistics, Flags.IncludeVersionProperties);
		const { galleryExtensions: rawGalleryExtensions, total } = await this.queryRawGalleryExtensions(query, token);

		const hasAllVersions: boolean = !(query.flags & Flags.IncludeLatestVersionOnly);
		if (hasAllVersions) {
			const extensions: IGalleryExtension[] = [];
			for (const rawGalleryExtension of rawGalleryExtensions) {
				const extension = await this.toGalleryExtensionWithCriteria(rawGalleryExtension, criteria);
				if (extension) {
					extensions.push(extension);
				}
			}
			return { extensions, total };
		}

		const result: [number, IGalleryExtension][] = [];
		const needAllVersions = new Map<string, number>();
		for (let index = 0; index < rawGalleryExtensions.length; index++) {
			const rawGalleryExtension = rawGalleryExtensions[index];
			const extensionIdentifier = { id: getGalleryExtensionId(rawGalleryExtension.publisher.publisherName, rawGalleryExtension.extensionName), uuid: rawGalleryExtension.extensionId };
			const includePreRelease = isBoolean(criteria.includePreRelease) ? criteria.includePreRelease : !!criteria.includePreRelease.find(extensionIdentifierWithPreRelease => areSameExtensions(extensionIdentifierWithPreRelease, extensionIdentifier))?.includePreRelease;
			if (criteria.compatible && isNotWebExtensionInWebTargetPlatform(getAllTargetPlatforms(rawGalleryExtension), criteria.targetPlatform)) {
				/** Skip if requested for a web-compatible extension and it is not a web extension.
				 * All versions are not needed in this case
				*/
				continue;
			}
			const extension = await this.toGalleryExtensionWithCriteria(rawGalleryExtension, criteria);
			if (!extension
				/** Need all versions if the extension is a pre-release version but
				 * 		- the query is to look for a release version or
				 * 		- the extension has no release version
				 * Get all versions to get or check the release version
				*/
				|| (extension.properties.isPreReleaseVersion && (!includePreRelease || !extension.hasReleaseVersion))
				/**
				 * Need all versions if the extension is a release version with a different target platform than requested and also has a pre-release version
				 * Because, this is a platform specific extension and can have a newer release version supporting this platform.
				 * See https://github.com/microsoft/vscode/issues/139628
				*/
				|| (!extension.properties.isPreReleaseVersion && extension.properties.targetPlatform !== criteria.targetPlatform && extension.hasPreReleaseVersion)
			) {
				needAllVersions.set(rawGalleryExtension.extensionId, index);
			} else {
				result.push([index, extension]);
			}
		}

		if (needAllVersions.size) {
			const query = new Query()
				.withFlags(flags & ~Flags.IncludeLatestVersionOnly, Flags.IncludeVersions)
				.withPage(1, needAllVersions.size)
				.withFilter(FilterType.ExtensionId, ...needAllVersions.keys());
			const { extensions } = await this.queryGalleryExtensions(query, criteria, token);
			for (const extension of extensions) {
				const index = needAllVersions.get(extension.identifier.uuid)!;
				result.push([index, extension]);
			}
		}

		return { extensions: result.sort((a, b) => a[0] - b[0]).map(([, extension]) => extension), total };
	}

	private async toGalleryExtensionWithCriteria(rawGalleryExtension: IRawGalleryExtension, criteria: IExtensionCriteria): Promise<IGalleryExtension | null> {

		const extensionIdentifier = { id: getGalleryExtensionId(rawGalleryExtension.publisher.publisherName, rawGalleryExtension.extensionName), uuid: rawGalleryExtension.extensionId };
		const version = criteria.versions?.find(extensionIdentifierWithVersion => areSameExtensions(extensionIdentifierWithVersion, extensionIdentifier))?.version;
		const includePreRelease = isBoolean(criteria.includePreRelease) ? criteria.includePreRelease : !!criteria.includePreRelease.find(extensionIdentifierWithPreRelease => areSameExtensions(extensionIdentifierWithPreRelease, extensionIdentifier))?.includePreRelease;
		const allTargetPlatforms = getAllTargetPlatforms(rawGalleryExtension);
		const rawGalleryExtensionVersions = sortExtensionVersions(rawGalleryExtension.versions, criteria.targetPlatform);

		if (criteria.compatible && isNotWebExtensionInWebTargetPlatform(allTargetPlatforms, criteria.targetPlatform)) {
			return null;
		}

		for (let index = 0; index < rawGalleryExtensionVersions.length; index++) {
			const rawGalleryExtensionVersion = rawGalleryExtensionVersions[index];
			if (version && rawGalleryExtensionVersion.version !== version) {
				continue;
			}
			// Allow any version if includePreRelease flag is set otherwise only release versions are allowed
			if (await this.isValidVersion(rawGalleryExtensionVersion, includePreRelease ? 'any' : 'release', criteria.compatible, allTargetPlatforms, criteria.targetPlatform)) {
				return toExtension(rawGalleryExtension, rawGalleryExtensionVersion, allTargetPlatforms);
			}
			if (version && rawGalleryExtensionVersion.version === version) {
				return null;
			}
		}

		if (version || criteria.compatible) {
			return null;
		}

		/**
		 * Fallback: Return the latest version
		 * This can happen when the extension does not have a release version or does not have a version compatible with the given target platform.
		 */
		return toExtension(rawGalleryExtension, rawGalleryExtension.versions[0], allTargetPlatforms);
	}

	// {{SQL CARBON EDIT}}
	/**
	 * The result of querying the gallery returns all the extensions because it's only reading a static file.
	 * So this method should apply all the filters and return the actual result
	 */
	private createQueryResult(query: Query, galleryExtensions: IRawGalleryExtension[]): { galleryExtensions: IRawGalleryExtension[]; total: number } {

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
							const allTargetPlatforms = getAllTargetPlatforms(e);
							const extension = toExtension(e, e.versions[0], allTargetPlatforms);
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

	private async queryRawGalleryExtensions(query: Query, token: CancellationToken): Promise<{ galleryExtensions: IRawGalleryExtension[]; total: number }> {
		if (!this.isEnabled()) {
			throw new Error('No extension gallery service configured.');
		}
		query = query
			/* Always exclude non validated extensions */
			.withFlags(query.flags, Flags.ExcludeNonValidated)
			.withFilter(FilterType.Target, 'Microsoft.VisualStudio.Code')
			/* Always exclude unpublished extensions */
			.withFilter(FilterType.ExcludeWithFlags, flagsToString(Flags.Unpublished));

		const commonHeaders = await this.commonHeadersPromise;
		const data = JSON.stringify(query.raw);
		const headers = {
			...commonHeaders,
			'Content-Type': 'application/json',
			'Accept': 'application/json;api-version=3.0-preview.1',
			'Accept-Encoding': 'gzip',
			'Content-Length': String(data.length),
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
			// {{SQL CARBON TODO}}
			galleryExtensions.forEach(e => sortExtensionVersions(e.versions, TargetPlatform.UNIVERSAL));
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
				"owner": "sandy081",
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
			uri: `${extension.assets.download.uri}${URI.parse(extension.assets.download.uri).query ? '&' : '?'}${operationParam}=true`,
			fallbackUri: `${extension.assets.download.fallbackUri}${URI.parse(extension.assets.download.fallbackUri).query ? '&' : '?'}${operationParam}=true`
		} : extension.assets.download;

		const context = await this.getAsset(downloadAsset);
		await this.fileService.writeFile(location, context.stream);
		log(new Date().getTime() - startTime);
	}

	async getReadme(extension: IGalleryExtension, token: CancellationToken): Promise<string> {
		if (extension.assets.readme) {
			const context = await this.getAsset(extension.assets.readme, {}, token);
			const content = await asTextOrError(context);
			return content || '';
		}
		return '';
	}

	async getManifest(extension: IGalleryExtension, token: CancellationToken): Promise<IExtensionManifest | null> {
		if (extension.assets.manifest) {
			const context = await this.getAsset(extension.assets.manifest, {}, token);
			const text = await asTextOrError(context);
			return text ? JSON.parse(text) : null;
		}
		return null;
	}

	private async getManifestFromRawExtensionVersion(rawExtensionVersion: IRawGalleryExtensionVersion, token: CancellationToken): Promise<IExtensionManifest | null> {
		const manifestAsset = getVersionAsset(rawExtensionVersion, AssetType.Manifest);
		if (!manifestAsset) {
			throw new Error('Manifest was not found');
		}
		const headers = { 'Accept-Encoding': 'gzip' };
		const context = await this.getAsset(manifestAsset, { headers });
		return await asJson<IExtensionManifest>(context);
	}

	async getCoreTranslation(extension: IGalleryExtension, languageId: string): Promise<ITranslation | null> {
		const asset = extension.assets.coreTranslations.filter(t => t[0] === languageId.toUpperCase())[0];
		if (asset) {
			const context = await this.getAsset(asset[1]);
			const text = await asTextOrError(context);
			return text ? JSON.parse(text) : null;
		}
		return null;
	}

	async getChangelog(extension: IGalleryExtension, token: CancellationToken): Promise<string> {
		if (extension.assets.changelog) {
			const context = await this.getAsset(extension.assets.changelog, {}, token);
			const content = await asTextOrError(context);
			return content || '';
		}
		return '';
	}

	async getAllCompatibleVersions(extension: IGalleryExtension, includePreRelease: boolean, targetPlatform: TargetPlatform): Promise<IGalleryExtensionVersion[]> {
		let query = new Query()
			.withFlags(Flags.IncludeVersions, Flags.IncludeCategoryAndTags, Flags.IncludeFiles, Flags.IncludeVersionProperties)
			.withPage(1, 1);

		if (extension.identifier.uuid) {
			query = query.withFilter(FilterType.ExtensionId, extension.identifier.uuid);
		} else {
			query = query.withFilter(FilterType.ExtensionName, extension.identifier.id);
		}

		const { galleryExtensions } = await this.queryRawGalleryExtensions(query, CancellationToken.None);
		if (!galleryExtensions.length) {
			return [];
		}

		const allTargetPlatforms = getAllTargetPlatforms(galleryExtensions[0]);
		if (isNotWebExtensionInWebTargetPlatform(allTargetPlatforms, targetPlatform)) {
			return [];
		}

		const validVersions: IRawGalleryExtensionVersion[] = [];
		await Promise.all(galleryExtensions[0].versions.map(async (version) => {
			try {
				if (await this.isValidVersion(version, includePreRelease ? 'any' : 'release', true, allTargetPlatforms, targetPlatform)) {
					validVersions.push(version);
				}
			} catch (error) { /* Ignore error and skip version */ }
		}));

		const result: IGalleryExtensionVersion[] = [];
		const seen = new Set<string>();
		for (const version of sortExtensionVersions(validVersions, targetPlatform)) {
			if (!seen.has(version.version)) {
				seen.add(version.version);
				result.push({ version: version.version, date: version.lastUpdated, isPreReleaseVersion: isPreReleaseVersion(version) });
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
			const message = await asTextOrError(context);
			throw new Error(`Expected 200, got back ${context.res.statusCode} instead.\n\n${message}`);
		} catch (err) {
			if (isCancellationError(err)) {
				throw err;
			}

			const message = getErrorMessage(err);
			type GalleryServiceCDNFallbackClassification = {
				owner: 'sandy081';
				comment: 'Fallback request information when the primary asset request to CDN fails';
				url: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'asset url that failed' };
				message: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'error message' };
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
	// private async getLastValidExtensionVersion(extension: IRawGalleryExtension, versions: IRawGalleryExtensionVersion[]): Promise<IRawGalleryExtensionVersion | null> {
	// 	const version = this.getLastValidExtensionVersionFromProperties(extension, versions);
	// 	if (version) {
	// 		return version;
	// 	}
	// 	return this.getLastValidExtensionVersionRecursively(extension, versions);
	// }

	// private getLastValidExtensionVersionFromProperties(extension: IRawGalleryExtension, versions: IRawGalleryExtensionVersion[]): IRawGalleryExtensionVersion | null {
	// 	for (const version of versions) {
	// 		// {{SQL CARBON EDIT}}
	// 		const vsCodeEngine = getEngine(version);
	// 		const azDataEngine = getAzureDataStudioEngine(version);
	// 		// Require at least one engine version
	// 		if (!vsCodeEngine && !azDataEngine) {
	// 			return null;
	// 		}
	// 		const vsCodeEngineValid = !vsCodeEngine || (vsCodeEngine && isEngineValid(vsCodeEngine, this.productService.vscodeVersion, this.productService.date));
	// 		const azDataEngineValid = !azDataEngine || (azDataEngine && isEngineValid(azDataEngine, this.productService.version, this.productService.date));
	// 		if (vsCodeEngineValid && azDataEngineValid) {
	// 			return version;
	// 		}
	// 	}
	// 	return null;
	// }

	private async getEngine(rawExtensionVersion: IRawGalleryExtensionVersion): Promise<string> {
		let engine = getEngine(rawExtensionVersion);
		if (!engine) {
			const manifest = await this.getManifestFromRawExtensionVersion(rawExtensionVersion, CancellationToken.None);
			if (!manifest) {
				throw new Error('Manifest was not found');
			}
			engine = manifest.engines.vscode;
		}
		return engine;
	}

	// private async getLastValidExtensionVersionRecursively(extension: IRawGalleryExtension, versions: IRawGalleryExtensionVersion[]): Promise<IRawGalleryExtensionVersion | null> {
	// 	if (!versions.length) {
	// 		return null;
	// 	}

	// 	const version = versions[0];
	// 	const engine = await this.getEngine(version);
	// 	if (!isEngineValid(engine, this.productService.version, this.productService.date)) {
	// 		return this.getLastValidExtensionVersionRecursively(extension, versions.slice(1));
	// 	}

	// 	return {
	// 		...version,
	// 		properties: [...(version.properties || []), { key: PropertyType.Engine, value: engine }]
	// 	};
	// }

	async getExtensionsControlManifest(): Promise<IExtensionsControlManifest> {
		if (!this.isEnabled()) {
			throw new Error('No extension gallery service configured.');
		}

		if (!this.extensionsControlUrl) {
			return { malicious: [], deprecated: {} };
		}

		const context = await this.requestService.request({ type: 'GET', url: this.extensionsControlUrl }, CancellationToken.None);
		if (context.res.statusCode !== 200) {
			throw new Error('Could not get extensions report.');
		}

		const result = await asJson<IRawExtensionsControlManifest>(context);
		const malicious: IExtensionIdentifier[] = [];
		const deprecated: IStringDictionary<IDeprecationInfo> = {};
		if (result) {
			for (const id of result.malicious) {
				malicious.push({ id });
			}
			if (result.migrateToPreRelease) {
				for (const [unsupportedPreReleaseExtensionId, preReleaseExtensionInfo] of Object.entries(result.migrateToPreRelease)) {
					if (!preReleaseExtensionInfo.engine || isEngineValid(preReleaseExtensionInfo.engine, this.productService.version, this.productService.date)) {
						deprecated[unsupportedPreReleaseExtensionId.toLowerCase()] = {
							disallowInstall: true,
							extension: {
								id: preReleaseExtensionInfo.id,
								displayName: preReleaseExtensionInfo.displayName,
								autoMigrate: { storage: !!preReleaseExtensionInfo.migrateStorage },
								preRelease: true
							}
						};
					}
				}
			}
			if (result.deprecated) {
				for (const [deprecatedExtensionId, deprecationInfo] of Object.entries(result.deprecated)) {
					if (deprecationInfo) {
						deprecated[deprecatedExtensionId.toLowerCase()] = isBoolean(deprecationInfo) ? {} : deprecationInfo;
					}
				}
			}
		}

		return { malicious, deprecated };
	}
}

export class ExtensionGalleryService extends AbstractExtensionGalleryService {

	constructor(
		@IStorageService storageService: IStorageService,
		@IRequestService requestService: IRequestService,
		@ILogService logService: ILogService,
		@IEnvironmentService environmentService: IEnvironmentService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IFileService fileService: IFileService,
		@IProductService productService: IProductService,
		@IConfigurationService configurationService: IConfigurationService,
	) {
		super(storageService, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService);
	}
}

export class ExtensionGalleryServiceWithNoStorageService extends AbstractExtensionGalleryService {

	constructor(
		@IRequestService requestService: IRequestService,
		@ILogService logService: ILogService,
		@IEnvironmentService environmentService: IEnvironmentService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IFileService fileService: IFileService,
		@IProductService productService: IProductService,
		@IConfigurationService configurationService: IConfigurationService,
	) {
		super(undefined, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService);
	}
}
