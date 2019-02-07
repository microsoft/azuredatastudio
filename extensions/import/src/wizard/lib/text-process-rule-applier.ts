import NormalisationRuleStore from './normalisation-rule-store';
import {LoadedNormalisationRule} from './types/normalisation-rule';

export default class TextProcessRuleApplier {
    private readonly normalisationRuleStore: NormalisationRuleStore;

    constructor(normalisationRuleStore: NormalisationRuleStore) {
        this.normalisationRuleStore = normalisationRuleStore;
    }

    applyTo(text: string): string {
        const rules = this.normalisationRuleStore.activeRules;
        return rules.length !== 0 ? this.applyRulesToText(rules, text) : text;
    }

    private applyRulesToText(rules: LoadedNormalisationRule[], text: string): string {
        return rules.reduce(
            (newText, rule) => this.applyRuleToText(rule, newText),
            text
        );
    }

    private applyRuleToText(rule: LoadedNormalisationRule, text: string): string {
        const pattern = new RegExp(rule.match, 'g');

        if (typeof rule.replaceWith === 'string') {
            return text.replace(pattern, rule.replaceWith);
        }

        return text.replace(pattern, matched => {
            // Type guard above is not working, so even though this `if` is
            // unnecessary logic, I need it to make typescript happy
            if (typeof rule.replaceWith === 'string') return matched;

            switch (rule.replaceWith.letterCase) {
                case 'lower':
                    return matched.toLowerCase();
                case 'upper':
                    return matched.toUpperCase();
                default:
                    return matched;
            }
        });
    }
}
