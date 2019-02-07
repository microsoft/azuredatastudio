import {QuickPickItem} from 'vscode';
import {LoadedNormalisationRule} from './types/normalisation-rule';
import WindowAdaptor from './adaptors/window';

interface NormalisationRuleQuickPickItem extends QuickPickItem {
    picked: boolean;
    ruleIndex: number;
}

export default class NormalisationRulePicker {
    private windowAdaptor: WindowAdaptor;

    constructor(windowAdaptor: WindowAdaptor) {
        this.windowAdaptor = windowAdaptor;
    }

    async show(rules: LoadedNormalisationRule[]): Promise<number[]> {
        const items = this.convertToQuickPickItems(rules);
        const userSelection = await this.windowAdaptor.showQuickPick(items);
        const activeItems = userSelection || items.filter(item => item.picked);
        return this.convertToRules(activeItems);
    }

    private convertToQuickPickItems(rules: LoadedNormalisationRule[]): NormalisationRuleQuickPickItem[] {
        return rules.map((rule, index) => ({
            label: rule.name || '(no "name" set for this rule)',
            picked: rule.active,
            ruleIndex: index,
            description: ''
        }));
    }

    private convertToRules(pickedItems: NormalisationRuleQuickPickItem[]) {
        return pickedItems.map(pickedItem => pickedItem.ruleIndex);
    }
}
