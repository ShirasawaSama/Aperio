import type { SlotBinding } from "@aperio/ast";

export interface AliasEntry {
  name: string;
  slot: string;
}

export type AliasScope = "file" | "signature" | "body";

// Three-layer alias model:
// file-level -> signature-level -> body-level
export class ScopedAliasTable {
  private readonly fileSlotToName = new Map<string, string>();
  private readonly fileNameToSlot = new Map<string, string>();
  private readonly sigSlotToName = new Map<string, string>();
  private readonly sigNameToSlot = new Map<string, string>();
  private readonly bodySlotToName = new Map<string, string>();
  private readonly bodyNameToSlot = new Map<string, string>();

  public addFile(binding: SlotBinding): void {
    this.addInternal(binding, this.fileSlotToName, this.fileNameToSlot);
  }

  public addSignature(binding: SlotBinding): void {
    this.addInternal(binding, this.sigSlotToName, this.sigNameToSlot);
  }

  public addBody(binding: SlotBinding): void {
    this.addInternal(binding, this.bodySlotToName, this.bodyNameToSlot);
  }

  public add(scope: AliasScope, binding: SlotBinding): void {
    if (scope === "file") {
      this.addFile(binding);
      return;
    }
    if (scope === "signature") {
      this.addSignature(binding);
      return;
    }
    this.addBody(binding);
  }

  public lookupName(slot: string): string | undefined {
    return (
      this.bodySlotToName.get(slot) ?? this.sigSlotToName.get(slot) ?? this.fileSlotToName.get(slot)
    );
  }

  public lookupSlot(name: string): string | undefined {
    return (
      this.bodyNameToSlot.get(name) ?? this.sigNameToSlot.get(name) ?? this.fileNameToSlot.get(name)
    );
  }

  public hasSlotInAnyScope(slot: string): boolean {
    return (
      this.bodySlotToName.has(slot) || this.sigSlotToName.has(slot) || this.fileSlotToName.has(slot)
    );
  }

  public fileEntries(): AliasEntry[] {
    return [...this.fileNameToSlot.entries()].map(([name, slot]) => ({ name, slot }));
  }

  private addInternal(
    binding: SlotBinding,
    slotToName: Map<string, string>,
    nameToSlot: Map<string, string>,
  ): void {
    slotToName.set(binding.slot.name, binding.alias.text);
    nameToSlot.set(binding.alias.text, binding.slot.name);
  }
}
