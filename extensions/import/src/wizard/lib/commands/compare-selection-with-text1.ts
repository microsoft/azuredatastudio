import DiffPresenter from '../diff-presenter';
import SelectionInfoRegistry from '../selection-info-registry';
import {TextKey} from '../const';
import {Command} from './command';
import TextEditor from '../adaptors/text-editor';

export default class CompareSelectionWithText1Command implements Command {
    private readonly diffPresenter: DiffPresenter;
    private readonly selectionInfoRegistry: SelectionInfoRegistry;

    constructor(diffPresenter: DiffPresenter,
                selectionInfoRegistry: SelectionInfoRegistry) {
        this.diffPresenter = diffPresenter;
        this.selectionInfoRegistry = selectionInfoRegistry;
    }

    async execute(editor: TextEditor) {
        const textInfo = {
            text: editor.selectedText,
            fileName: editor.fileName,
            lineRanges: editor.selectedLineRanges
        };
        this.selectionInfoRegistry.set(TextKey.REGISTER2, textInfo);

        await 'HACK'; // HACK: To avoid TextEditor has been disposed error
        await this.diffPresenter.takeDiff(TextKey.REGISTER1, TextKey.REGISTER2);
    }

}
