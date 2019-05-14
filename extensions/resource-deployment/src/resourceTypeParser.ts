/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ResourceType } from './interfaces';

export class ResourceTypeParser {
	public static getResourceTypes(): ResourceType[] {
		let pkgJson = require('../package.json') as { resourceTypes: ResourceType[] };
		return pkgJson.resourceTypes;
	}
}
