import SaveText1Command from './commands/save-text-1';
import CompareSelectionWithText1Command from './commands/compare-selection-with-text1';
import CompareSelectionWithClipboardCommand from './commands/compare-selection-with-clipboard';
import CompareVisibleEditorsCommand from './commands/compare-visible-editors';
import Clipboard from './adaptors/clipboard';
import DiffPresenter from './diff-presenter';
import ToggleNormalisationRulesCommand from './commands/toggle-normalisation-rules';
import NormalisationRuleStore from './normalisation-rule-store';
import SelectionInfoRegistry from './selection-info-registry';
import CommandAdaptor from './adaptors/command';
import WindowAdaptor from './adaptors/window';
import {Command} from './commands/command';

export default class CommandFactory {
    private readonly normalisationRuleStore: NormalisationRuleStore;
    private readonly selectionInfoRegistry: SelectionInfoRegistry;
    private readonly commandAdaptor: CommandAdaptor;
    private readonly windowAdaptor: WindowAdaptor;
    private readonly getCurrentDate: () => Date;
    private readonly clipboard: Clipboard;
    private diffPresenter?: DiffPresenter;

    constructor(selectionInfoRegistry: SelectionInfoRegistry,
                normalisationRuleStore: NormalisationRuleStore,
                commandAdaptor: CommandAdaptor,
                windowAdaptor: WindowAdaptor,
                clipboard: Clipboard,
                getCurrentDate: () => Date) {
        this.normalisationRuleStore = normalisationRuleStore;
        this.selectionInfoRegistry = selectionInfoRegistry;
        this.commandAdaptor = commandAdaptor;
        this.windowAdaptor = windowAdaptor;
        this.clipboard = clipboard;
        this.getCurrentDate = getCurrentDate;
    }

    crateSaveText1Command(): Command {
        return new SaveText1Command(this.selectionInfoRegistry);
    }

    createCompareSelectionWithText1Command(): Command {
        return new CompareSelectionWithText1Command(
            this.getDiffPresenter(),
            this.selectionInfoRegistry
        );
    }

    createCompareSelectionWithClipboardCommand(): Command {
        return new CompareSelectionWithClipboardCommand(
            this.getDiffPresenter(),
            this.selectionInfoRegistry,
            this.clipboard
        );
    }

    createCompareVisibleEditorsCommand(): Command {
        return new CompareVisibleEditorsCommand(
            this.getDiffPresenter(),
            this.selectionInfoRegistry,
            this.windowAdaptor
        );
    }

    createToggleNormalisationRulesCommand(): Command {
        return new ToggleNormalisationRulesCommand(
            this.normalisationRuleStore,
            this.windowAdaptor
        );
    }

    private getDiffPresenter(): DiffPresenter {
        this.diffPresenter = this.diffPresenter || this.createDiffPresenter();
        return this.diffPresenter;
    }

    private createDiffPresenter(): DiffPresenter {
        return new DiffPresenter(
            this.selectionInfoRegistry,
            this.normalisationRuleStore,
            this.commandAdaptor,
            this.getCurrentDate
        );
    }
}
