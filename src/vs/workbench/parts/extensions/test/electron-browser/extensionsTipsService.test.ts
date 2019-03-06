/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as sinon from 'sinon';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as uuid from 'vs/base/common/uuid';
import {
	IExtensionGalleryService, IGalleryExtensionAssets, IGalleryExtension, IExtensionManagementService, LocalExtensionType,
	IExtensionEnablementService, DidInstallExtensionEvent, DidUninstallExtensionEvent, InstallExtensionEvent, IExtensionIdentifier
} from 'vs/platform/extensionManagement/common/extensionManagement';
import { ExtensionTipsService } from 'vs/workbench/parts/extensions/electron-browser/extensionTipsService';
import { ExtensionGalleryService } from 'vs/platform/extensionManagement/node/extensionGalleryService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { Emitter } from 'vs/base/common/event';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { TestTextResourceConfigurationService, TestContextService, TestLifecycleService, TestEnvironmentService, TestStorageService } from 'vs/workbench/test/workbenchTestServices';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { URI } from 'vs/base/common/uri';
import { testWorkspace } from 'vs/platform/workspace/test/common/testWorkspace';
import { IFileService } from 'vs/platform/files/common/files';
import { FileService } from 'vs/workbench/services/files/electron-browser/fileService';
import * as extfs from 'vs/base/node/extfs';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { IPager } from 'vs/base/common/paging';
import { assign } from 'vs/base/common/objects';
import { getGalleryExtensionId } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { ConfigurationKey } from 'vs/workbench/parts/extensions/common/extensions';
import { ExtensionManagementService } from 'vs/platform/extensionManagement/node/extensionManagementService';
import { TestExtensionEnablementService } from 'vs/platform/extensionManagement/test/electron-browser/extensionEnablementService.test';
import { IURLService } from 'vs/platform/url/common/url';
import product from 'vs/platform/node/product';
import { ITextModel } from 'vs/editor/common/model';
import { IModelService } from 'vs/editor/common/services/modelService';
import { ILifecycleService } from 'vs/platform/lifecycle/common/lifecycle';
import { INotificationService, Severity, IPromptChoice, IPromptOptions } from 'vs/platform/notification/common/notification';
import { URLService } from 'vs/platform/url/common/urlService';
import { IExperimentService } from 'vs/workbench/parts/experiments/node/experimentService';
import { TestExperimentService } from 'vs/workbench/parts/experiments/test/electron-browser/experimentService.test';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';

const mockExtensionGallery: IGalleryExtension[] = [
	aGalleryExtension('MockExtension1', {
		displayName: 'Mock Extension 1',
		version: '1.5',
		publisherId: 'mockPublisher1Id',
		publisher: 'mockPublisher1',
		publisherDisplayName: 'Mock Publisher 1',
		description: 'Mock Description',
		installCount: 1000,
		rating: 4,
		ratingCount: 100
	}, {
			dependencies: ['pub.1'],
		}, {
			manifest: { uri: 'uri:manifest', fallbackUri: 'fallback:manifest' },
			readme: { uri: 'uri:readme', fallbackUri: 'fallback:readme' },
			changelog: { uri: 'uri:changelog', fallbackUri: 'fallback:changlog' },
			download: { uri: 'uri:download', fallbackUri: 'fallback:download' },
			icon: { uri: 'uri:icon', fallbackUri: 'fallback:icon' },
			license: { uri: 'uri:license', fallbackUri: 'fallback:license' },
			repository: { uri: 'uri:repository', fallbackUri: 'fallback:repository' },
			coreTranslations: {}
		}),
	aGalleryExtension('MockExtension2', {
		displayName: 'Mock Extension 2',
		version: '1.5',
		publisherId: 'mockPublisher2Id',
		publisher: 'mockPublisher2',
		publisherDisplayName: 'Mock Publisher 2',
		description: 'Mock Description',
		installCount: 1000,
		rating: 4,
		ratingCount: 100
	}, {
			dependencies: ['pub.1', 'pub.2'],
		}, {
			manifest: { uri: 'uri:manifest', fallbackUri: 'fallback:manifest' },
			readme: { uri: 'uri:readme', fallbackUri: 'fallback:readme' },
			changelog: { uri: 'uri:changelog', fallbackUri: 'fallback:changlog' },
			download: { uri: 'uri:download', fallbackUri: 'fallback:download' },
			icon: { uri: 'uri:icon', fallbackUri: 'fallback:icon' },
			license: { uri: 'uri:license', fallbackUri: 'fallback:license' },
			repository: { uri: 'uri:repository', fallbackUri: 'fallback:repository' },
			coreTranslations: {}
		})
];

const mockExtensionLocal = [
	{
		type: LocalExtensionType.User,
		identifier: mockExtensionGallery[0].identifier,
		manifest: {
			name: mockExtensionGallery[0].name,
			publisher: mockExtensionGallery[0].publisher,
			version: mockExtensionGallery[0].version
		},
		metadata: null,
		path: 'somepath',
		readmeUrl: 'some readmeUrl',
		changelogUrl: 'some changelogUrl'
	},
	{
		type: LocalExtensionType.User,
		identifier: mockExtensionGallery[1].identifier,
		manifest: {
			name: mockExtensionGallery[1].name,
			publisher: mockExtensionGallery[1].publisher,
			version: mockExtensionGallery[1].version
		},
		metadata: null,
		path: 'somepath',
		readmeUrl: 'some readmeUrl',
		changelogUrl: 'some changelogUrl'
	}
];

const mockTestData = {
	recommendedExtensions: [
		'mockPublisher1.mockExtension1',
		'MOCKPUBLISHER2.mockextension2',
		'badlyformattedextension',
		'MOCKPUBLISHER2.mockextension2',
		'unknown.extension'
	],
	validRecommendedExtensions: [
		'mockPublisher1.mockExtension1',
		'MOCKPUBLISHER2.mockextension2'
	]
};

function aPage<T>(...objects: T[]): IPager<T> {
	return { firstPage: objects, total: objects.length, pageSize: objects.length, getPage: () => null };
}

const noAssets: IGalleryExtensionAssets = {
	changelog: null,
	download: null,
	icon: null,
	license: null,
	manifest: null,
	readme: null,
	repository: null,
	coreTranslations: null
};

function aGalleryExtension(name: string, properties: any = {}, galleryExtensionProperties: any = {}, assets: IGalleryExtensionAssets = noAssets): IGalleryExtension {
	const galleryExtension = <IGalleryExtension>Object.create({});
	assign(galleryExtension, { name, publisher: 'pub', version: '1.0.0', properties: {}, assets: {} }, properties);
	assign(galleryExtension.properties, { dependencies: [] }, galleryExtensionProperties);
	assign(galleryExtension.assets, assets);
	galleryExtension.identifier = { id: getGalleryExtensionId(galleryExtension.publisher, galleryExtension.name), uuid: uuid.generateUuid() };
	return <IGalleryExtension>galleryExtension;
}

// {{SQ|L CARBON EDIT}} disable broken tests
suite('ExtensionsTipsService Test', () => {
	test('ExtensionTipsService: No Prompt for valid workspace recommendations when galleryService is absent', () => {
	});
});
