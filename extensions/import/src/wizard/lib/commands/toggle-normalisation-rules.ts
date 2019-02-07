import NormalisationRulePicker from '../normalisation-rule-picker';
import NormalisationRuleStore from '../normalisation-rule-store';
import {Command} from './command';
import WindowAdaptor from '../adaptors/window';

export default class ToggleNormalisationRulesCommand implements Command {
    private readonly windowAdaptor: WindowAdaptor;
    private readonly normalisationRulePicker: NormalisationRulePicker;
    private readonly normalisationRuleStore: NormalisationRuleStore;

    constructor(normalisationRuleStore: NormalisationRuleStore,
                windowAdaptor: WindowAdaptor) {
        this.windowAdaptor = windowAdaptor;
        this.normalisationRulePicker = new NormalisationRulePicker(windowAdaptor);
        this.normalisationRuleStore = normalisationRuleStore;
    }

    async execute() {
        const rules = this.normalisationRuleStore.getAllRules();
        if (rules.length > 0) {
            const newRules = await this.normalisationRulePicker.show(rules);
            this.normalisationRuleStore.specifyActiveRules(newRules);
        } else {
            await this.windowAdaptor.showInformationMessage(
                'Please set `partialDiff.preComparisonTextNormalizationRules` first'
            );
        }
    }

}
