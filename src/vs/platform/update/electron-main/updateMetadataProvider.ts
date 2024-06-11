/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// {{SQL CARBON EDIT}} - This file contains interfaces, util functions and url definitions
// to support Download Center based update.
import { IProductService } from 'vs/platform/product/common/productService';
import { IUpdate } from 'vs/platform/update/common/update';

export interface Asset {
	platform: string;
	type: string;
	url: string;
	mooncakeUrl: string;
	hash: string;
	sha256hash?: string;
	packageCatalog?: string;
	repoDefinition?: string;
	repoDataFiles?: string[];
}

export interface Build {
	id: string;
	version: string;
	isFrozen?: boolean;
	assets: Asset[];
	updates: { [platform: string]: string; };
}

export function getUpdateFromBuild(build: Build | null, productService: IProductService, platform: string): IUpdate | undefined {
	if (!build) {
		return undefined;
	}

	if (build.id === productService.commit) {
		return undefined;
	}

	const assetType = build.updates[platform];
	const asset = build.assets.filter(a => a.platform === platform && a.type === assetType)[0];

	if (!asset) {
		return undefined;
	}

	const url = asset.url;
	return {
		url: url,
		version: build.id,
		productVersion: build.version,
		hash: asset.hash,
	};
}
