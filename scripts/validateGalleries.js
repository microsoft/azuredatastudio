/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import got from 'got';
import * as stream from 'stream';
import { promisify } from 'util';
const pipeline = promisify(stream.pipeline);
import { mkdir, rm, rmdir } from 'fs/promises';
import yauzl from 'yauzl-promise';

const ROOT_DIR = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const DOWNLOADED_EXT_DIR = path.join(ROOT_DIR, '.downloaded-extensions');

const MICROSOFT_SQLOPS_DOWNLOADPAGE = 'Microsoft.SQLOps.DownloadPage';
const MICROSOFT_VISUALSTUDIO_SERVICES_VSIXPACKAGE = 'Microsoft.VisualStudio.Services.VSIXPackage';
const MICROSOFT_VISUALSTUDIO_CODE_ENGINE = 'Microsoft.VisualStudio.Code.Engine';
const MICROSOFT_AZDATAENGINE = 'Microsoft.AzDataEngine';

const STABLE = 'extensionsGallery';
const STABLE_DOWNLOADED_EXT_DIR = path.join(DOWNLOADED_EXT_DIR, STABLE);
const INSIDERS = 'extensionsGallery-insider';
const INSIDERS_DOWNLOADED_EXT_DIR = path.join(DOWNLOADED_EXT_DIR, INSIDERS);

/**
 * This file is for validating the extension gallery files to ensure that they adhere to the expected schema defined in
 * https://github.com/microsoft/azuredatastudio/blob/main/src/vs/platform/extensionManagement/common/extensionGalleryService.ts#L64
 *
 * It would be ideal to use the actual parsing logic ADS uses for more thorough validation and automatic updates if the schema ever
 * changes, but given how unlikely that is this is fine for now.
 *
 * Note that while most checks are falsy checks some specifically check for undefined when an empty string or 0 is
 * an expected value.
 *
 * You can run this manually from the command line with :
 *      node scripts/validateGalleries.js
 */

/**
 * Validate the extension gallery json according to
 * interface IRawGalleryQueryResult {
 *    results: {
 *        extensions: IRawGalleryExtension[];
 *        resultMetadata: {
 *            metadataType: string;
 *            metadataItems: {
 *                name: string;
 *                count: number;
 *            }[];
 *        }[]
 *    }[];
 * }
 */
async function validateExtensionGallery(galleryFilePath) {
    let galleryJson;
    try {
        galleryJson = JSON.parse(fs.readFileSync(galleryFilePath).toString());
    } catch (err) {
        throw new Error(`Unable to parse extension gallery file ${galleryFilePath} : ${err}`);
    }
    if (!galleryJson.results || !galleryJson.results[0]) {
        throw new Error(`${galleryFilePath} - results invalid`);
    }
    await validateResults(galleryFilePath, galleryJson.results[0]);
}

/**
 * Validate results blob according to
 * {
 *     extensions: IRawGalleryExtension[];
 *     resultMetadata: {
 *         metadataType: string;
 *         metadataItems: {
 *             name: string;
 *             count: number;
 *         }[];
 *     }[]
 * }
 */
async function validateResults(galleryFilePath, resultsJson) {
    if (!resultsJson.extensions || !resultsJson.extensions.length) {
        throw new Error(`${galleryFilePath} - No extensions\n${JSON.stringify(resultsJson)}`)
    }
    await Promise.all(resultsJson.extensions.map(e => validateExtension(galleryFilePath, e)));

    if (!resultsJson.resultMetadata || !resultsJson.resultMetadata.length) {
        throw new Error(`${galleryFilePath} - No resultMetadata\n${JSON.stringify(resultsJson)}`)
    }
    resultsJson.resultMetadata.forEach(resultMetadata => validateResultMetadata(galleryFilePath, resultsJson.extensions.length, resultMetadata));
}

/**
 * Validate extension blob according to
 * interface IRawGalleryExtension {
 * 	extensionId: string;
 * 	extensionName: string;
 * 	displayName: string;
 * 	shortDescription: string;
 * 	publisher: { displayName: string, publisherId: string, publisherName: string; };
 * 	versions: IRawGalleryExtensionVersion[];
 * 	statistics: IRawGalleryExtensionStatistics[];
 * 	flags: string;
 * }
 */
async function validateExtension(galleryFilePath, extensionJson) {
    if (!extensionJson.extensionId) {
        throw new Error(`${galleryFilePath} - No extensionId\n${JSON.stringify(extensionJson)}`)
    }
    let extensionName = extensionJson.extensionName;
    if (!extensionName) {
        throw new Error(`${galleryFilePath} - No extensionName\n${JSON.stringify(extensionJson)}`)
    }
    if (!extensionJson.displayName) {
        throw new Error(`${galleryFilePath} - No displayName\n${JSON.stringify(extensionJson)}`)
    }
    if (!extensionJson.shortDescription) {
        throw new Error(`${galleryFilePath} - No shortDescription\n${JSON.stringify(extensionJson)}`)
    }
    if (!extensionJson.publisher || !extensionJson.publisher.displayName || !extensionJson.publisher.publisherId || !extensionJson.publisher.publisherName) {
        throw new Error(`${galleryFilePath} - Invalid publisher\n${JSON.stringify(extensionJson)}`)
    }

    if (!extensionJson.versions || !extensionJson.versions.length) {
        throw new Error(`${galleryFilePath} - Invalid versions\n${JSON.stringify(extensionJson)}`)
    }
    if (extensionJson.versions.length !== 1) {
        throw new Error(`${galleryFilePath} - Only one version is currently supported\n${JSON.stringify(extensionJson)}`)
    }
    for (const version of extensionJson.versions) {
        await validateVersion(galleryFilePath, extensionName, extensionJson, version);
    }

    if (!extensionJson.statistics || extensionJson.statistics.length === undefined) {
        throw new Error(`${galleryFilePath} - Invalid statistics\n${JSON.stringify(extensionJson)}`)
    }
    extensionJson.statistics.forEach(statistics => validateExtensionStatistics(galleryFilePath, extensionName, statistics));

    if (extensionJson.flags === undefined) {
        throw new Error(`${galleryFilePath} - No flags\n${JSON.stringify(extensionJson)}`)
    }
}

/**
 * Validate an extension statistics blob according to
 *
 * interface IRawGalleryExtensionStatistics {
 *      statisticName: string;
 *      value: number;
 *  }
 */
function validateExtensionStatistics(galleryFilePath, extensionName, extensionStatisticsJson) {
    if (!extensionStatisticsJson.statisticName) {
        throw new Error(`${galleryFilePath} - ${extensionName} - Invalid statisticName\n${JSON.stringify(extensionStatisticsJson)}`)
    }
    if (extensionStatisticsJson.value === undefined) {
        throw new Error(`${galleryFilePath} - ${extensionName} - Invalid value\n${JSON.stringify(extensionStatisticsJson)}`)
    }
}

/**
 * Validate an extension version blob according to
 * interface IRawGalleryExtensionVersion {
 *     version: string;
 *     lastUpdated: string;
 *     assetUri: string;
 *     fallbackAssetUri: string;
 *     files: IRawGalleryExtensionFile[];
 *     properties?: IRawGalleryExtensionProperty[];
 * }
 */
async function validateVersion(galleryFilePath, extensionName, extensionJson, extensionVersionJson) {
    if (!extensionVersionJson.version) {
        throw new Error(`${galleryFilePath} - ${extensionName} - No version\n${JSON.stringify(extensionVersionJson)}`)
    }
    if (extensionVersionJson.lastUpdated === undefined) {
        throw new Error(`${galleryFilePath} - ${extensionName} - No last updated\n${JSON.stringify(extensionVersionJson)}`)
    }
    if ((new Date(extensionVersionJson.lastUpdated)).toString() === 'Invalid Date') {
        throw new Error(`${galleryFilePath} - ${extensionName} - Last updated value '${extensionVersionJson.lastUpdated}' is invalid. It must be in the format MM/DD/YYYY\n${JSON.stringify(extensionVersionJson)}`)
    }
    if (extensionVersionJson.assetUri === undefined) {
        throw new Error(`${galleryFilePath} - ${extensionName} - No asset URI\n${JSON.stringify(extensionVersionJson)}`)
    }
    if (!extensionVersionJson.fallbackAssetUri) {
        throw new Error(`${galleryFilePath} - ${extensionName} - No fallbackAssetUri\n${JSON.stringify(extensionVersionJson)}`)
    }
    if (!extensionVersionJson.files || !extensionVersionJson.files[0]) {
        throw new Error(`${galleryFilePath} - ${extensionName} - Invalid version files\n${JSON.stringify(extensionVersionJson)}`)
    }

    validateHasRequiredAssets(galleryFilePath, extensionName, extensionVersionJson.files);

    for (const file of extensionVersionJson.files) {
        await validateExtensionFile(galleryFilePath, extensionName, extensionJson, file);
    }
    if (extensionVersionJson.properties && extensionVersionJson.properties.length) {
        extensionVersionJson.properties.forEach(property => validateExtensionProperty(galleryFilePath, extensionName, property));
        const azdataEngineVersion = extensionVersionJson.properties.find(property => property.key === MICROSOFT_AZDATAENGINE && (property.value.startsWith('>=') || property.value === '*'))
        if (!azdataEngineVersion) {
            throw new Error(`${galleryFilePath} - ${extensionName} - No valid Microsoft.AzdataEngine property found. Value must be either * or >=x.x.x where x.x.x is the minimum Azure Data Studio version the extension requires\n${JSON.stringify(extensionVersionJson.properties)}`)
        }
    } else {
        throw new Error(`${galleryFilePath} - ${extensionName} - No properties, extensions must have an AzDataEngine version defined`)
    }
}

/**
 * Validates that an extension version has the expected files for displaying in the gallery.
 * There are some existing 3rd party extensions that don't have all the files, but that's ok for now.
 * Going forward all new extensions should provide these files.
 */
function validateHasRequiredAssets(galleryFilePath, extensionName, filesJson) {
    // VSIXPackage or DownloadPage
    const vsixFile = filesJson.find(file => file.assetType === MICROSOFT_VISUALSTUDIO_SERVICES_VSIXPACKAGE);
    const downloadPageFile = filesJson.find(file => file.assetType === MICROSOFT_SQLOPS_DOWNLOADPAGE);
    if (vsixFile && downloadPageFile) {
        throw new Error(`${galleryFilePath} - ${extensionName} - Can not have both VSIXPackage and DownloadPage file`);
    } else if (!vsixFile && !downloadPageFile) {
        throw new Error(`${galleryFilePath} - ${extensionName} - Must have file with either VSIXPackage or DownloadPage assetType`);
    }

    // Icon
    const iconFile = filesJson.find(file => file.assetType === 'Microsoft.VisualStudio.Services.Icons.Default');
    const noIconExtensions = ['poor-sql-formatter', 'qpi']; // Not all 3rd party extensions have icons so allow existing ones to pass for now
    if (!iconFile && noIconExtensions.find(ext => ext === extensionName) === undefined) {
        throw new Error(`${galleryFilePath} - ${extensionName} - Must have an icon file`);
    }

    // Details
    const detailsFile = filesJson.find(file => file.assetType === 'Microsoft.VisualStudio.Services.Content.Details');
    if (!detailsFile) {
        throw new Error(`${galleryFilePath} - ${extensionName} - Must have a details file (README)`);
    }

    // Manifest
    const noManifestExtensions = ['plan-explorer', 'sql-prompt']; // Not all 3rd party extensions have manifests so allow existing ones to pass for now
    const manifestFile = filesJson.find(file => file.assetType === 'Microsoft.VisualStudio.Code.Manifest');
    if (!manifestFile && noManifestExtensions.find(ext => ext === extensionName) === undefined) {
        throw new Error(`${galleryFilePath} - ${extensionName} - Must have a manifest file (package.json)`);
    }

    // License
    const noLicenseExtensions = ['sp_executesqlToSQL', 'simple-data-scripter', 'db-snapshot-creator']; // Not all 3rd party extensions have license files to link to so allow existing ones to pass for now
    const licenseFile = filesJson.find(file => file.assetType === 'Microsoft.VisualStudio.Services.Content.License');
    if (!licenseFile && noLicenseExtensions.find(ext => ext === extensionName) === undefined) {
        throw new Error(`${galleryFilePath} - ${extensionName} - Must have a license file`);
    }
}

/**
 * Validate an extension property blob according to
 * interface IRawGalleryExtensionProperty {
 *     key: string;
 *     value: string;
 * }
 */
function validateExtensionProperty(galleryFilePath, extensionName, extensionPropertyJson) {
    if (!extensionPropertyJson.key) {
        throw new Error(`${galleryFilePath} - ${extensionName} - No key\n${JSON.stringify(extensionPropertyJson)}`)
    }
    if (extensionPropertyJson.value === undefined) {
        throw new Error(`${galleryFilePath} - ${extensionName} - No value\n${JSON.stringify(extensionPropertyJson)}`)
    }
}

// The set of asset types that are required to be hosted by either us or Github due to potential CORS issues loading
// content in ADS from other sources.
const hostedAssetTypes = new Set([
    MICROSOFT_VISUALSTUDIO_SERVICES_VSIXPACKAGE,
    'Microsoft.VisualStudio.Services.Icons.Default',
    'Microsoft.VisualStudio.Services.Content.Details',
    'Microsoft.VisualStudio.Services.Content.Changelog',
    'Microsoft.VisualStudio.Code.Manifest']);

const allowedHosts = [
    'https://sqlopsextensions.blob.core.windows.net/',
    'https://dsct.blob.core.windows.net/',
    'https://raw.githubusercontent.com/'
];

/**
 * Validate an extension file blob according to
 * interface IRawGalleryExtensionFile {
 *     assetType: string;
 *     source: string;
 * }
 * Will also validate that the source URL provided is valid, and if it's a direct VSIX link that the
 * package metadata matches what's in the gallery.
 */
async function validateExtensionFile(galleryFilePath, extensionName, extensionJson, extensionFileJson) {
    if (!extensionFileJson.assetType) {
        throw new Error(`${galleryFilePath} - ${extensionName} - No assetType\n${JSON.stringify(extensionFileJson)}`)
    }
    if (!extensionFileJson.source) {
        throw new Error(`${galleryFilePath} - ${extensionName} - No source\n${JSON.stringify(extensionFileJson)}`)
    }
    // Waka-time link is hitting rate limit for the download link so just ignore this one for now.
    if (extensionName === 'vscode-wakatime' && extensionFileJson.assetType === MICROSOFT_SQLOPS_DOWNLOADPAGE) {
        return;
    }
    if (hostedAssetTypes.has(extensionFileJson.assetType) && !allowedHosts.find(host => extensionFileJson.source.startsWith(host))) {
        throw new Error(`${galleryFilePath} - ${extensionName} - The asset ${extensionFileJson.source} (${extensionFileJson.assetType}) is required to be hosted either on Github or by the Azure Data Studio team. If the asset is hosted on Github it must use a https://raw.githubusercontent.com/ URL. If the asset cannot be hosted on Github then please reply in the PR with links to the assets and a team member will handle moving them.`);
    }

    // Validate the source URL
    if (extensionFileJson.assetType === MICROSOFT_VISUALSTUDIO_SERVICES_VSIXPACKAGE) {
        const downloadVsixPath = path.join(DOWNLOADED_EXT_DIR, path.basename(galleryFilePath, '.json'), `${extensionName}.vsix`);
        // Download VSIX into temp download location
        try {
            const vsixDownloadStream = got.stream(extensionFileJson.source);
            const vsixWriteStream = fs.createWriteStream(downloadVsixPath);
            await pipeline(vsixDownloadStream, vsixWriteStream);
            vsixWriteStream.close();
        } catch (err) {
            throw new Error(`${galleryFilePath} - ${extensionName} - Error downloading ${extensionFileJson.assetType} with URL ${extensionFileJson.source}. ${err}`);
        }

        const vsixUnzipDir = path.join(DOWNLOADED_EXT_DIR, path.basename(galleryFilePath, '.json'), extensionName);
        const packageJsonWritePath = path.join(vsixUnzipDir, 'package.json');
        // Extract the package.json from the downloaded VSIX
        try {
            const vsix = await yauzl.open(downloadVsixPath, { autoClose: true });
            await mkdir(vsixUnzipDir);
            await vsix.walkEntries(async (entry) => {
                // We only care about the root package.json for right now
                if (entry.fileName == 'extension/package.json') {
                    await mkdir(path.dirname(packageJsonWritePath), { recursive: true });
                    const entryWriteStream = fs.createWriteStream(packageJsonWritePath);
                    const entryReadStream = await entry.openReadStream({ autoClose: true });
                    await pipeline(entryReadStream, entryWriteStream);
                    entryWriteStream.close();
                }
            });
        } catch (err) {
            throw new Error(`${galleryFilePath} - ${extensionName} - Error extracting package.json from ${downloadVsixPath}. ${err}`);
        }

        // Validate that the package.json metadata matches the gallery metadata
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonWritePath));
            validatePackageJson(extensionJson, packageJson);
        } catch (err) {
            throw new Error(`${galleryFilePath} - ${extensionName} - Error validating package.json. ${err}`);
        }
    } else {
        try {
            const response = await got(extensionFileJson.source);
            if (response.statusCode !== 200) {
                throw new Error(`${response.statusCode}: ${response.statusMessage}`);
            }
        } catch (err) {
            throw new Error(`${galleryFilePath} - ${extensionName} - Error fetching ${extensionFileJson.assetType} with URL ${extensionFileJson.source}. ${err}`);
        }
    }
}

/**
 * Mappings of publisher IDs in the extension gallery to the list of valid aliases for that publisher in the package.json
 */
const publisherMappings = {
    'Microsoft': ['ms-vscode', 'VisualStudioExptTeam']
}

/**
 * Validates that the entries in the package.json for the given extension matches those specified in the extension gallery.
 *
 * @param extensionJson The JSON object for this extension from the gallery
 * @param packageJson The JSON object for this extension from the package.json of the extension
 */
function validatePackageJson(extensionJson, packageJson) {
    // Check names match
    if (extensionJson.extensionName !== packageJson.name) {
        throw new Error(`Extension name in gallery (${extensionJson.extensionName}) does not match extension name in package.json (${packageJson.name})`);
    }

    // Check publishers match
    if (extensionJson.publisher.publisherId !== packageJson.publisher && publisherMappings[extensionJson.publisher.publisherId]?.find(m => m === packageJson.publisher) === undefined) {
        throw new Error(`Publisher in gallery (${extensionJson.publisher.publisherId}) does not match publisher in package.json (${packageJson.publisher})`);
    }

    // Check versions match
    const extensionJsonVersion = extensionJson.versions[0].version;
    if (extensionJsonVersion !== packageJson.version) {
        throw new Error(`Version in gallery (${extensionJsonVersion}) does not match version in package.json (${packageJson.version})`);
    }

    // Check vs code engine matches
    const extensionVsCodeEngine = extensionJson.versions[0].properties.find(p => p.key === MICROSOFT_VISUALSTUDIO_CODE_ENGINE)?.value;
    const packageVsCodeEngine = packageJson.engines?.vscode;
    validateEngineVersionMatches(MICROSOFT_VISUALSTUDIO_CODE_ENGINE, 'vscode', extensionVsCodeEngine, packageVsCodeEngine);

    // Check azdata engine matches
    const extensionAzdataEngine = extensionJson.versions[0].properties.find(p => p.key === MICROSOFT_AZDATAENGINE)?.value;
    const packageAzdataEngine = packageJson.engines?.azdata;
    validateEngineVersionMatches(MICROSOFT_AZDATAENGINE, 'azdata', extensionAzdataEngine, packageAzdataEngine);

    // Check that if gallery has preview flag the package.json does as well
    // (note that currently multiple flags aren't supported by ADS so we can just check for strict equals on the gallery)
    if (extensionJson.flags === 'preview' && packageJson.preview != true) {
        throw new Error(`Gallery has preview flag but package.json does not have preview property set to true`);
    }

    // Check that if the gallery doesn't have the preview flag the package.json doesn't either
    // (note that currently multiple flags aren't supported by ADS so we can just check for strict equals on the gallery)
    if (extensionJson.flags !== 'preview' && packageJson.preview === true) {
        throw new Error(`Gallery does not have preview flag but package.json has preview property set to true`);
    }
}

function validateEngineVersionMatches(extensionGalleryEngineName, packageEngineName, extensionGalleryVersion, packageVersion) {
    // Normalize the engine versions since both ^ and >= are supported
    const normalizedExtensionGalleryVersion = extensionGalleryVersion?.replace(">=", "^");
    const normalizedPackageVersion = packageVersion?.replace(">=", "^");

    // Treat * and undefined as equal
    if (normalizedExtensionGalleryVersion === '*' && normalizedPackageVersion === undefined) {
        return;
    }

    if (normalizedExtensionGalleryVersion === undefined && normalizedPackageVersion === '*') {
        return;
    }

    // Package.json has non-* version but gallery doesn't
    if (normalizedExtensionGalleryVersion === undefined && normalizedPackageVersion !== undefined) {
        throw new Error(`Extension gallery does not have engine version specified (${extensionGalleryEngineName}) but package.json has ${packageVersion} (${packageEngineName})`);
    }

    // Gallery has non-* version but package.json doesn't
    if (normalizedExtensionGalleryVersion !== undefined && normalizedPackageVersion === undefined) {
        throw new Error(`package.json does not have engine version specified (${packageEngineName}) but extension gallery has ${extensionGalleryVersion} (${extensionGalleryEngineName})`);
    }

    if (normalizedExtensionGalleryVersion !== normalizedPackageVersion) {
        throw new Error(`package.json version ${packageVersion} (${packageEngineName}) does not match extension gallery version ${extensionGalleryVersion} (${extensionGalleryEngineName})`);
    }
}

/**
 * Validate a result metadata blob according to
 * {
 *     metadataType: string;
 *     metadataItems: {
 *         name: string;
 *         count: number;
 * }
 */
function validateResultMetadata(galleryFilePath, extensionCount, resultMetadataJson) {
    if (!resultMetadataJson.metadataType) {
        throw new Error(`${galleryFilePath} - No metadataType\n${JSON.stringify(resultMetadataJson)}`)
    }
    if (!resultMetadataJson.metadataItems || !resultMetadataJson.metadataItems.length) {
        throw new Error(`${galleryFilePath} - Invalid metadataItems\n${JSON.stringify(resultMetadataJson)}`)
    }
    resultMetadataJson.metadataItems.forEach(metadataItem => {
        if (!metadataItem.name) {
            throw new Error(`${galleryFilePath} - No name\n${JSON.stringify(metadataItem)}`)
        }
        if (metadataItem.count === undefined) {
            throw new Error(`${galleryFilePath} - No count\n${JSON.stringify(metadataItem)}`)
        }
        // Extra check here for validating that the total count of extensions is correct
        if (metadataItem.name === 'TotalCount' && metadataItem.count !== extensionCount) {
            throw new Error(`${galleryFilePath} - Invalid TotalCount, this needs to be updated if adding/removing a new extension. Actual count : ${extensionCount}\n${JSON.stringify(metadataItem)}`)
        }
    })
}

async function cleanDownloadedExtensionFolder(downloadedExtDir) {
    // Delete folder if it exists
    try {
        await rm(downloadedExtDir, { recursive: true, force: true });
    } catch (err) {
        if (err.code !== 'ENOENT') {
            throw err;
        }
    }
    await mkdir(downloadedExtDir, { recursive: true });
}

await cleanDownloadedExtensionFolder(STABLE_DOWNLOADED_EXT_DIR);
await cleanDownloadedExtensionFolder(INSIDERS_DOWNLOADED_EXT_DIR);

await Promise.all([
    validateExtensionGallery(path.join(ROOT_DIR, 'extensionsGallery.json')),
    validateExtensionGallery(path.join(ROOT_DIR, 'extensionsGallery-insider.json'))
]);
