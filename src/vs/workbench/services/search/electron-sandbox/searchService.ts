/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { ISearchService } from 'vs/workbench/services/search/common/search';
import { SearchService } from 'vs/workbench/services/search/common/searchService';

registerSingleton(ISearchService, SearchService, true);
