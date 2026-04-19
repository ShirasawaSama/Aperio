import type { LintRule } from "./rule.js";
import { L1001UnusedRegisterRule } from "./rules/L1001_unused_register.js";
import { L1002PreferAliasRule } from "./rules/L1002_prefer_alias.js";

export class LintRegistry {
  private readonly rules = new Map<string, LintRule>();

  public constructor() {
    this.register(L1001UnusedRegisterRule);
    this.register(L1002PreferAliasRule);
  }

  public register(rule: LintRule): void {
    this.rules.set(rule.id, rule);
  }

  public list(): LintRule[] {
    return [...this.rules.values()];
  }
}
