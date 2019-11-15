/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerInsight } from 'sql/platform/dashboard/browser/insightRegistry';

import ImageInsight from './imageInsight.component';

import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

const imageInsightSchema: IJSONSchema = {
	type: 'object',
	description: nls.localize('imageInsightDescription', "Displays an image, for example one returned by an R query using ggplot2"),
	properties: {
		imageFormat: {
			type: 'string',
			description: nls.localize('imageFormatDescription', "What format is expected - is this a JPEG, PNG or other format?"),
			default: 'jpeg',
			enum: ['jpeg', 'png']
		},
		encoding: {
			type: 'string',
			description: nls.localize('encodingDescription', "Is this encoded as hex, base64 or some other format?"),
			default: 'hex',
			enum: ['hex', 'base64']
		},
	}
};

registerInsight('image', '', imageInsightSchema, ImageInsight);
