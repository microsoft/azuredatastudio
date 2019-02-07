import DiffPresenter from '../diff-presenter';
import SelectionInfoRegistry from '../selection-info-registry';
import Clipboard from '../adaptors/clipboard';
import {TextKey} from '../const';
import {Command} from './command';
import TextEditor from '../adaptors/text-editor';

export default class CompareSelectionWithClipboardCommand implements Command {
    private readonly diffPresenter: DiffPresenter;
    private readonly selectionInfoRegistry: SelectionInfoRegistry;
    private readonly clipboard: Clipboard;

    constructor(diffPresenter: DiffPresenter,
                selectionInfoRegistry: SelectionInfoRegistry,
                clipboard: Clipboard) {
        this.diffPresenter = diffPresenter;
        this.selectionInfoRegistry = selectionInfoRegistry;
        this.clipboard = clipboard;
    }

    async execute(editor: TextEditor) {
        const text = await this.clipboard.read();
        this.selectionInfoRegistry.set(TextKey.CLIPBOARD, {
            text,
            fileName: 'Clipboard',
            lineRanges: []
        });
        this.selectionInfoRegistry.set(TextKey.REGISTER2, {
            text: editor.selectedText,
            fileName: editor.fileName,
            lineRanges: editor.selectedLineRanges
        });

        await this.diffPresenter.takeDiff(TextKey.CLIPBOARD, TextKey.REGISTER2);
    }

}
