/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import got from 'got';

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
async function validateExtensionGallery(path) {
    let galleryJson;
    try {
        galleryJson = JSON.parse(fs.readFileSync(path).toString());
    } catch (err) {
        throw new Error(`Unable to parse extension gallery file ${path} : ${err}`);
    }
    if (!galleryJson.results || !galleryJson.results[0]) {
        throw new Error(`${path} - results invalid`);
    }
    await validateResults(path, galleryJson.results[0]);
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
async function validateResults(path, resultsJson) {
    if (!resultsJson.extensions || !resultsJson.extensions.length) {
        throw new Error(`${path} - No extensions\n${JSON.stringify(resultsJson)}`)
    }
    for (const extension of resultsJson.extensions) {
        await validateExtension(path, extension);
    }

    if (!resultsJson.resultMetadata || !resultsJson.resultMetadata.length) {
        throw new Error(`${path} - No resultMetadata\n${JSON.stringify(resultsJson)}`)
    }
    resultsJson.resultMetadata.forEach(resultMetadata => validateResultMetadata(path, resultsJson.extensions.length, resultMetadata));
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
async function validateExtension(path, extensionJson) {
    if (!extensionJson.extensionId) {
        throw new Error(`${path} - No extensionId\n${JSON.stringify(extensionJson)}`)
    }
    let extensionName = extensionJson.extensionName;
    if (!extensionName) {
        throw new Error(`${path} - No extensionName\n${JSON.stringify(extensionJson)}`)
    }
    if (!extensionJson.displayName) {
        throw new Error(`${path} - No displayName\n${JSON.stringify(extensionJson)}`)
    }
    if (!extensionJson.shortDescription) {
        throw new Error(`${path} - No shortDescription\n${JSON.stringify(extensionJson)}`)
    }
    if (!extensionJson.publisher || !extensionJson.publisher.displayName || !extensionJson.publisher.publisherId || !extensionJson.publisher.publisherName) {
        throw new Error(`${path} - Invalid publisher\n${JSON.stringify(extensionJson)}`)
    }

    if (!extensionJson.versions || !extensionJson.versions.length) {
        throw new Error(`${path} - Invalid versions\n${JSON.stringify(extensionJson)}`)
    }
    for (const version of extensionJson.versions) {
        await validateVersion(path, extensionName, version);
    }

    if (!extensionJson.statistics || extensionJson.statistics.length === undefined) {
        throw new Error(`${path} - Invalid statistics\n${JSON.stringify(extensionJson)}`)
    }
    extensionJson.statistics.forEach(statistics => validateExtensionStatistics(path, extensionName, statistics));

    if (extensionJson.flags === undefined) {
        throw new Error(`${path} - No flags\n${JSON.stringify(extensionJson)}`)
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
function validateExtensionStatistics(path, extensionName, extensionStatisticsJson) {
    if (!extensionStatisticsJson.statisticName) {
        throw new Error(`${path} - ${extensionName} - Invalid statisticName\n${JSON.stringify(extensionStatisticsJson)}`)
    }
    if (extensionStatisticsJson.value === undefined) {
        throw new Error(`${path} - ${extensionName} - Invalid value\n${JSON.stringify(extensionStatisticsJson)}`)
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
async function validateVersion(path, extensionName, extensionVersionJson) {
    if (!extensionVersionJson.version) {
        throw new Error(`${path} - ${extensionName} - No version\n${JSON.stringify(extensionVersionJson)}`)
    }
    if (extensionVersionJson.lastUpdated === undefined) {
        throw new Error(`${path} - ${extensionName} - No last updated\n${JSON.stringify(extensionVersionJson)}`)
    }
    if (extensionVersionJson.assetUri === undefined) {
        throw new Error(`${path} - ${extensionName} - No asset URI\n${JSON.stringify(extensionVersionJson)}`)
    }
    if (!extensionVersionJson.fallbackAssetUri) {
        throw new Error(`${path} - ${extensionName} - No fallbackAssetUri\n${JSON.stringify(extensionVersionJson)}`)
    }
    if (!extensionVersionJson.files || !extensionVersionJson.files[0]) {
        throw new Error(`${path} - ${extensionName} - Invalid version files\n${JSON.stringify(extensionVersionJson)}`)
    }

    validateHasRequiredAssets(path, extensionName, extensionVersionJson.files);

    for (const file of extensionVersionJson.files) {
        await validateExtensionFile(path, extensionName, file);
    }
    if (extensionVersionJson.properties && extensionVersionJson.properties.length) {
        extensionVersionJson.properties.forEach(property => validateExtensionProperty(path, extensionName, property));
        const azdataEngineVersion = extensionVersionJson.properties.find(property => property.key === 'Microsoft.AzDataEngine' && (property.value.startsWith('>=') || property.value === '*'))
        if (!azdataEngineVersion) {
            throw new Error(`${path} - ${extensionName} - No valid Microsoft.AzdataEngine property found. Value must be either * or >=x.x.x where x.x.x is the minimum Azure Data Studio version the extension requires\n${JSON.stringify(extensionVersionJson.properties)}`)
        }
        const vscodeEngineVersion = extensionVersionJson.properties.find(property => property.key === 'Microsoft.VisualStudio.Code.Engine');
        if (vscodeEngineVersion && vscodeEngineVersion.value.startsWith('>=') && azdataEngineVersion.value.startsWith('>=')) {
            throw new Error(`${path} - ${extensionName} - Both Microsoft.AzDataEngine and Microsoft.VisualStudio.Code.Engine should not have minimum versions. Each Azure Data Studio version is tied to a specific VS Code version and so having both is redundant.`)
        }
    } else {
        throw new Error(`${path} - ${extensionName} - No properties, extensions must have an AzDataEngine version defined`)
    }
}

/**
 * Validates that an extension version has the expected files for displaying in the gallery.
 * There are some existing 3rd party extensions that don't have all the files, but that's ok for now.
 * Going forward all new extensions should provide these files.
 */
function validateHasRequiredAssets(path, extensionName, filesJson) {
    // VSIXPackage or DownloadPage
    const vsixFile = filesJson.find(file => file.assetType === 'Microsoft.VisualStudio.Services.VSIXPackage');
    const downloadPageFile = filesJson.find(file => file.assetType === 'Microsoft.SQLOps.DownloadPage');
    if (vsixFile && downloadPageFile) {
        throw new Error(`${path} - ${extensionName} - Can not have both VSIXPackage and DownloadPage file`);
    } else if (!vsixFile && !downloadPageFile) {
        throw new Error(`${path} - ${extensionName} - Must have file with either VSIXPackage or DownloadPage assetType`);
    }

    // Icon
    const iconFile = filesJson.find(file => file.assetType === 'Microsoft.VisualStudio.Services.Icons.Default');
    const noIconExtensions = ['poor-sql-formatter', 'qpi']; // Not all 3rd party extensions have icons so allow existing ones to pass for now
    if (!iconFile && noIconExtensions.find(ext => ext === extensionName) === undefined) {
        throw new Error(`${path} - ${extensionName} - Must have an icon file`);
    }

    // Details
    const detailsFile = filesJson.find(file => file.assetType === 'Microsoft.VisualStudio.Services.Content.Details');
    if (!detailsFile) {
        throw new Error(`${path} - ${extensionName} - Must have a details file (README)`);
    }

    // Manifest
    const noManifestExtensions = ['plan-explorer', 'sql-prompt']; // Not all 3rd party extensions have manifests so allow existing ones to pass for now
    const manifestFile = filesJson.find(file => file.assetType === 'Microsoft.VisualStudio.Code.Manifest');
    if (!manifestFile && noManifestExtensions.find(ext => ext === extensionName) === undefined) {
        throw new Error(`${path} - ${extensionName} - Must have a manifest file (package.json)`);
    }

    // License
    const noLicenseExtensions = ['sp_executesqlToSQL', 'simple-data-scripter', 'db-snapshot-creator']; // Not all 3rd party extensions have license files to link to so allow existing ones to pass for now
    const licenseFile = filesJson.find(file => file.assetType === 'Microsoft.VisualStudio.Services.Content.License');
    if (!licenseFile && noLicenseExtensions.find(ext => ext === extensionName) === undefined) {
        throw new Error(`${path} - ${extensionName} - Must have a license file`);
    }
}

/**
 * Validate an extension property blob according to
 * interface IRawGalleryExtensionProperty {
 *     key: string;
 *     value: string;
 * }
 */
function validateExtensionProperty(path, extensionName, extensionPropertyJson) {
    if (!extensionPropertyJson.key) {
        throw new Error(`${path} - ${extensionName} - No key\n${JSON.stringify(extensionPropertyJson)}`)
    }
    if (extensionPropertyJson.value === undefined) {
        throw new Error(`${path} - ${extensionName} - No value\n${JSON.stringify(extensionPropertyJson)}`)
    }
}

/**
 * Validate an extension file blob according to
 * interface IRawGalleryExtensionFile {
 *     assetType: string;
 *     source: string;
 * }
 * Will also validate that the source URL provided is valid.
 */
async function validateExtensionFile(path, extensionName, extensionFileJson) {
    if (!extensionFileJson.assetType) {
        throw new Error(`${path} - ${extensionName} - No assetType\n${JSON.stringify(extensionFileJson)}`)
    }
    if (!extensionFileJson.source) {
        throw new Error(`${path} - ${extensionName} - No source\n${JSON.stringify(extensionFileJson)}`)
    }
    // Waka-time link is hitting rate limit for the download link so just ignore this one for now. 
    if (extensionName === 'vscode-wakatime' && extensionFileJson.assetType === 'Microsoft.SQLOps.DownloadPage') {
        return;
    }
    // Validate the source URL
    try {
        const response = await got(extensionFileJson.source);
        if (response.statusCode !== 200) {
            throw new Error(`${response.statusCode}: ${response.statusMessage}`);
        }
    } catch (err) {
        throw new Error(`${path} - ${extensionName} - Error fetching ${extensionFileJson.assetType} with URL ${extensionFileJson.source}. ${err}`);
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
function validateResultMetadata(path, extensionCount, resultMetadataJson) {
    if (!resultMetadataJson.metadataType) {
        throw new Error(`${path} - No metadataType\n${JSON.stringify(resultMetadataJson)}`)
    }
    if (!resultMetadataJson.metadataItems || !resultMetadataJson.metadataItems.length) {
        throw new Error(`${path} - Invalid metadataItems\n${JSON.stringify(resultMetadataJson)}`)
    }
    resultMetadataJson.metadataItems.forEach(metadataItem => {
        if (!metadataItem.name) {
            throw new Error(`${path} - No name\n${JSON.stringify(metadataItem)}`)
        }
        if (metadataItem.count === undefined) {
            throw new Error(`${path} - No count\n${JSON.stringify(metadataItem)}`)
        }
        // Extra check here for validating that the total count of extensions is correct
        if (metadataItem.name === 'TotalCount' && metadataItem.count !== extensionCount) {
            throw new Error(`${path} - Invalid TotalCount, this needs to be updated if adding/removing a new extension. Actual count : ${extensionCount}\n${JSON.stringify(metadataItem)}`)
        }
    })
}

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
await Promise.all([
    validateExtensionGallery(path.join(dirname, '..', 'extensionsGallery.json')),
    validateExtensionGallery(path.join(dirname, '..', 'extensionsGallery-insider.json'))
]);
