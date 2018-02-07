/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { registerDashboardWidget } from 'sql/platform/dashboard/common/widgetRegistry';

let webviewSchema: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string'
		}
	}
};

registerDashboardWidget('webview-widget', '', webviewSchema, undefined, { extensionOnly: true });
