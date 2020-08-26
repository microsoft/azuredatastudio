import MarkJS from './markjs';

export class Mark {
  private instance: MarkJS;

  constructor(ctx: HTMLElement | HTMLElement[] | NodeList | string) {
    this.instance = new MarkJS(ctx);
  }

  public mark(sv, opt?) {
    this.instance.mark(sv, opt);
  }
  public getElementsAndRanges(sv, opt?) {
    this.instance.mark(sv, opt, false);
    return this.instance.elementsAndRanges;
  }
  public markRegExp(sv, opt) {
    this.instance.markRegExp(sv, opt);
  }
  public markRanges(sv, opt) {
    this.instance.markRanges(sv, opt);
  }
  public unmark(opt?) {
    this.instance.unmark(opt);
  }
}
