/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Extensions, IConfigurationRegistry, IConfigurationNode } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import * as nls from 'vs/nls';
import * as editorOptions from 'vs/editor/common/config/editorOptions';
import { RESULTS_GRID_DEFAULTS } from 'sql/workbench/common/constants';
import EDITOR_FONT_DEFAULTS = editorOptions.EDITOR_FONT_DEFAULTS;

const configurationRegistry = <IConfigurationRegistry>Registry.as(Extensions.Configuration);

const resultsGridConfiguration: IConfigurationNode = {
	id: 'resultsGrid',
	type: 'object',
	title: nls.localize('resultsGridConfigurationTitle', "Results Grid and Messages"),
	properties: {
		'resultsGrid.fontFamily': {
			type: 'string',
			default: EDITOR_FONT_DEFAULTS.fontFamily,
			description: nls.localize('fontFamily', "Controls the font family.")
		},
		'resultsGrid.fontWeight': {
			type: 'string',
			enum: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
			default: EDITOR_FONT_DEFAULTS.fontWeight,
			description: nls.localize('fontWeight', "Controls the font weight.")
		},
		'resultsGrid.fontSize': {
			type: 'number',
			default: EDITOR_FONT_DEFAULTS.fontSize,
			description: nls.localize('fontSize', "Controls the font size in pixels.")
		},
		'resultsGrid.letterSpacing': {
			type: 'number',
			default: EDITOR_FONT_DEFAULTS.letterSpacing,
			description: nls.localize('letterSpacing', "Controls the letter spacing in pixels.")
		},
		'resultsGrid.rowHeight': {
			type: 'number',
			default: RESULTS_GRID_DEFAULTS.rowHeight,
			description: nls.localize('rowHeight', "Controls the row height in pixels")
		},
		'resultsGrid.cellPadding': {
			oneOf: [
				{
					type: 'number'
				},
				{
					type: 'array',
					items: {
						type: 'number'
					}
				}
			],
			default: RESULTS_GRID_DEFAULTS.cellPadding,
			description: nls.localize('cellPadding', "Controls the cell padding in pixels")
		},
		'resultsGrid.autoSizeColumns': {
			type: 'boolean',
			default: true,
			description: nls.localize('autoSizeColumns', "Auto size the columns width on inital results. Could have performance problems with large number of columns or large cells")
		},
		'resultsGrid.maxColumnWidth': {
			type: 'number',
			default: 400,
			description: nls.localize('maxColumnWidth', "The maximum width in pixels for auto-sized columns")
		},
		'resultsGrid.showJsonAsLink': {
			'type': 'boolean',
			'description': nls.localize('resultsGrid.showJsonAsLink', "Whether to show cells with JSON formatted string as hyperlink. When enabled, upon click the JSON value will be opened in another tab. The default value is true."),
			'default': true
		}
	}
};

configurationRegistry.registerConfiguration(resultsGridConfiguration);
