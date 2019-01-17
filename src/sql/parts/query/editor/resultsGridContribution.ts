/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { Extensions, IConfigurationRegistry, IConfigurationNode, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import * as nls from 'vs/nls';
import * as editorOptions from 'vs/editor/common/config/editorOptions';
import EDITOR_DEFAULTS = editorOptions.EDITOR_DEFAULTS;
import EDITOR_FONT_DEFAULTS = editorOptions.EDITOR_FONT_DEFAULTS;
import EDITOR_MODEL_DEFAULTS = editorOptions.EDITOR_MODEL_DEFAULTS;

import { RESULTS_GRID_DEFAULTS } from 'sql/parts/query/editor/queryResultsEditor';

const configurationRegistry = <IConfigurationRegistry>Registry.as(Extensions.Configuration);

const resultsGridConfiguration: IConfigurationNode = {
	id: 'resultsGrid',
	type: 'object',
	title: nls.localize('resultsGridConfigurationTitle', "Results Grid"),
	overridable: true,
	properties: {
		'resultsGrid.fontFamily': {
			type: 'string',
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
			default: false,
			description: nls.localize('autoSizeColumns', "Auto size the columns width on inital results. Could have performance problems with large number of columns or large cells")
		}
	}
};

configurationRegistry.registerConfiguration(resultsGridConfiguration);
