import NormalisationRuleStore from './normalisation-rule-store';
import SelectionInfoRegistry from './selection-info-registry';
import TextTitleBuilder from './text-title-builder';

const DiffModeSymbols = {
    NORMALISED: '\u007e',
    AS_IS: '\u2194'
};

export default class DiffTitleBuilder {
    private readonly normalisationRuleStore: NormalisationRuleStore;
    private selectionInfoRegistry: SelectionInfoRegistry;
    private textTitleBuilder: TextTitleBuilder;

    constructor(normalisationRuleStore: NormalisationRuleStore,
                selectionInfoRegistry: SelectionInfoRegistry) {
        this.normalisationRuleStore = normalisationRuleStore;
        this.selectionInfoRegistry = selectionInfoRegistry;
        this.textTitleBuilder = new TextTitleBuilder();
    }

    build(textKey1: string, textKey2: string): string {
        const title1 = this.buildTextTitle(textKey1);
        const title2 = this.buildTextTitle(textKey2);
        const comparisonSymbol = this.normalisationRuleStore.hasActiveRules
            ? DiffModeSymbols.NORMALISED
            : DiffModeSymbols.AS_IS;
        return `${title1} ${comparisonSymbol} ${title2}`;
    }

    private buildTextTitle(textKey: string): string {
        const textInfo = this.selectionInfoRegistry.get(textKey);
        return this.textTitleBuilder.build(textInfo);
    }
}
