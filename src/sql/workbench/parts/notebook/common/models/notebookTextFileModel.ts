/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Range, IRange } from 'vs/editor/common/core/range';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { TextFileEditorModel } from 'vs/workbench/services/textfile/common/textFileEditorModel';

import * as jsonc from 'jsonc-parser';

export class NotebookTextFileModel {
	private sourceMap: Map<string, jsonc.Node[]>;

	constructor() {
		this.sourceMap = new Map<string, jsonc.Node[]>();
	}

	public updateSourceMap(textEditorModel: TextFileEditorModel | UntitledEditorModel) {
		let lastNode: jsonc.Node[] = [];
		let lastPropertySource = false;
		let lastPropertyGuid = false;
		let content = textEditorModel.textEditorModel.getValue();
		jsonc.visit(content, {
			onObjectProperty: (property, offset, length, startLine, startChracter) => {
				lastPropertyGuid = false;
				lastPropertySource = false;

				if (property === 'source') {
					lastPropertySource = true;
				} else if (property === 'cellGuid') {
					lastPropertyGuid = true;
				}
			},
			onLiteralValue: (value, offset, length) => {
				if (lastPropertySource) {
					lastNode.push(jsonc.getLocation(content, offset).previousNode);
				} else if (lastPropertyGuid) {
					this.sourceMap.set(value, lastNode);
					lastNode = [];
				}
			}
		});
	}

	public getCellNodeByGuid(guid: string) {
		return this.sourceMap.get(guid);
	}
}
