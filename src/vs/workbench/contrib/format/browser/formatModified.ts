/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNonEmptyArray } from 'vs/base/common/arrays';
import { CancellationToken } from 'vs/base/common/cancellation';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { EditorAction, registerEditorAction, ServicesAccessor } from 'vs/editor/browser/editorExtensions';
import { Range } from 'vs/editor/common/core/range';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { ITextModel, shouldSynchronizeModel } from 'vs/editor/common/model';
import { IEditorWorkerService } from 'vs/editor/common/services/editorWorker';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { formatDocumentRangesWithSelectedProvider, FormattingMode } from 'vs/editor/contrib/format/browser/format';
import * as nls from 'vs/nls';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Progress } from 'vs/platform/progress/common/progress';
import { getOriginalResource } from 'vs/workbench/contrib/scm/browser/dirtydiffDecorator';
import { IQuickDiffService } from 'vs/workbench/contrib/scm/common/quickDiff';

registerEditorAction(class FormatModifiedAction extends EditorAction {

	constructor() {
		super({
			id: 'editor.action.formatChanges',
			label: nls.localize('formatChanges', "Format Modified Lines"),
			alias: 'Format Modified Lines',
			precondition: ContextKeyExpr.and(EditorContextKeys.writable, EditorContextKeys.hasDocumentSelectionFormattingProvider),
		});
	}

	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		const instaService = accessor.get(IInstantiationService);

		if (!editor.hasModel()) {
			return;
		}

		const ranges = await instaService.invokeFunction(getModifiedRanges, editor.getModel());
		if (isNonEmptyArray(ranges)) {
			return instaService.invokeFunction(
				formatDocumentRangesWithSelectedProvider, editor, ranges,
				FormattingMode.Explicit, Progress.None, CancellationToken.None
			);
		}
	}
});


export async function getModifiedRanges(accessor: ServicesAccessor, modified: ITextModel): Promise<Range[] | undefined | null> {
	const quickDiffService = accessor.get(IQuickDiffService);
	const workerService = accessor.get(IEditorWorkerService);
	const modelService = accessor.get(ITextModelService);

	const original = await getOriginalResource(quickDiffService, modified.uri, modified.getLanguageId(), shouldSynchronizeModel(modified));
	if (!original) {
		return null; // let undefined signify no changes, null represents no source control (there's probably a better way, but I can't think of one rn)
	}

	const ranges: Range[] = [];
	const ref = await modelService.createModelReference(original);
	try {
		if (!workerService.canComputeDirtyDiff(original, modified.uri)) {
			return undefined;
		}
		const changes = await workerService.computeDirtyDiff(original, modified.uri, false);
		if (!isNonEmptyArray(changes)) {
			return undefined;
		}
		for (const change of changes) {
			ranges.push(modified.validateRange(new Range(
				change.modifiedStartLineNumber, 1,
				change.modifiedEndLineNumber || change.modifiedStartLineNumber /*endLineNumber is 0 when things got deleted*/, Number.MAX_SAFE_INTEGER)
			));
		}
	} finally {
		ref.dispose();
	}

	return ranges;
}
