/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as data from 'data';

/**
 * Serializer for saving results into a different format
 *
 * @export
 * @interface ISerialization
 */
export interface ISerialization {
	saveAs(saveFormat: string, savePath: string, results: string, appendToFile: boolean): Promise<data.SaveResultRequestResult>;
}
