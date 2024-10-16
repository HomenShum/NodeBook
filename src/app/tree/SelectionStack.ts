export class SelectionStack {
  private stack: { dir: string; headId: string }[] = [];
  public push(dir: string, headId: string) {
    this.stack.push({ dir, headId });
  }

  /**
   * If the direction at the top of stack matches the direction provided in the param,
   * return the headId.
   * @param dir The required direction at the top of stack.
   */
  public popBy(dir: string): { dir: string; headId: string } | null {
    if (this.stack.length <= 0) return null;
    if (this.stack[this.stack.length - 1].dir === dir) {
      return this.stack.pop() || null;
    }
    return null;
  }

  public reset(): void {
    this.stack = [];
  }

  public toArray() {
    return this.stack;
  }
}
