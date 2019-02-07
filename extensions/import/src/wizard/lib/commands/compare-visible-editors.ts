import DiffPresenter from '../diff-presenter';
import SelectionInfoRegistry from '../selection-info-registry';
import {TextKey} from '../const';
import {SelectionInfo} from '../types/selection-info';
import {Command} from './command';
import WindowAdaptor from '../adaptors/window';

export default class CompareVisibleEditorsCommand implements Command {
    private readonly windowAdaptor: WindowAdaptor;
    private readonly diffPresenter: DiffPresenter;
    private readonly selectionInfoRegistry: SelectionInfoRegistry;

    constructor(diffPresenter: DiffPresenter,
                selectionInfoRegistry: SelectionInfoRegistry,
                windowAdaptor: WindowAdaptor) {
        this.windowAdaptor = windowAdaptor;
        this.diffPresenter = diffPresenter;
        this.selectionInfoRegistry = selectionInfoRegistry;
    }

    async execute() {
        const editors = this.windowAdaptor.visibleTextEditors;
        if (editors.length !== 2) {
            this.windowAdaptor.showInformationMessage('Please first open 2 documents to compare.');
            return;
        }

        const textInfos = editors.map(editor => ({
            text: editor.selectedText,
            fileName: editor.fileName,
            lineRanges: editor.selectedLineRanges
        }));
        this.registerTextInfo(
            textInfos,
            editors[0].viewColumn > editors[1].viewColumn
        );

        await 'HACK'; // HACK: Avoid "TextEditor has been disposed" error
        await this.diffPresenter.takeDiff(TextKey.VISIBLE_EDITOR1, TextKey.VISIBLE_EDITOR2);
    }

    private registerTextInfo(textInfos: SelectionInfo[], isReverseOrder: boolean) {
        const textInfo1 = textInfos[isReverseOrder ? 1 : 0];
        const textInfo2 = textInfos[isReverseOrder ? 0 : 1];
        this.selectionInfoRegistry.set(TextKey.VISIBLE_EDITOR1, textInfo1);
        this.selectionInfoRegistry.set(TextKey.VISIBLE_EDITOR2, textInfo2);
    }

}
