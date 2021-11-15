/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';

export const TablePropertyDescriptions = {
	NAME: localize('designer.table.description.name', "The name of the table object."),
	DESCRIPTION: localize('designer.table.description.description', "Description for the table."),
	SCHEMA: localize('designer.table.description.schema', "The schema that contains the table.")
};

export const ColumnPropertyDescriptions = {
	NAME: localize('designer.column.description.name', "The name of the column object."),
	ALLOW_NULLS: localize('designer.column.description.allowNulls', "Specifies whether the column may have a NULL value."),
	DATA_TYPE: localize('designer.column.description.dataType', "Displays the data type name for the column"),
	DEFAULT_VALUE_OR_BINDING: localize('designer.column.description.defaultValueBinding', "A predefined global default value for the column or binding."),
	DESCRIPTION: localize('designer.column.description.description', "Description for the column."),
	LENGTH: localize('designer.column.description.length', "The maximum length (in characters) that can be stored in this database object."),
	PRECISION: localize('designer.column.description.precision', "For numeric data, the maximum number of decimal digits that can be stored in this database object."),
	PRIMARY_KEY: localize('designer.column.description.primaryKey', "Specifies whether the column is included in the primary key for the table.")
};
