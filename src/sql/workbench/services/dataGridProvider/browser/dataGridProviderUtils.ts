/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { textFormatter, hyperLinkFormatter, imageFormatter } from 'sql/base/browser/ui/table/formatters';

export function getDataGridFormatter(formatterType: azdata.DataGridColumnType): Slick.Formatter<any> {
	switch (formatterType) {
		case 'text':
			return textFormatter;
		case 'hyperlink':
			return hyperLinkFormatter;
		case 'image':
			return imageFormatter;
	}
}
