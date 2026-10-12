// page-flip is pinned to 2.0.7. Its destructor removes the DOM but leaves its
// animation loop running, and reduced-motion readers also retain resize handlers.
// Patch only those lifecycle omissions; keep the upstream rendering behavior.
export function patchPageFlip(source) {
  const replacements = [
    [
      'start(){this.update();const t=e=>{this.render(e),requestAnimationFrame(t)};requestAnimationFrame(t)}',
      'start(){this.update();const t=e=>{this.render(e),this.animationFrame=requestAnimationFrame(t)};this.animationFrame=requestAnimationFrame(t)}stop(){cancelAnimationFrame(this.animationFrame)}',
    ],
    [
      'destroy(){this.ui.destroy(),this.block.remove()}',
      'destroy(){this.render.stop(),this.ui.destroy(),this.block.remove()}',
    ],
    [
      'destroy(){this.app.getSettings().useMouseEvents&&this.removeHandlers(),this.distElement.remove(),this.wrapper.remove()}',
      'destroy(){this.removeHandlers(),this.distElement.remove(),this.wrapper.remove()}',
    ],
  ];
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) {
      throw new Error(
        'page-flip lifecycle patch no longer matches. Review it before upgrading page-flip.',
      );
    }
    source = source.replace(before, after);
  }
  return source;
}

export function pageFlipLifecycle() {
  return {
    name: 'tempest-page-flip-lifecycle',
    enforce: 'pre',
    transform(source, id) {
      if (!id.split('?')[0].endsWith('/page-flip/dist/js/page-flip.module.js')) return null;
      return { code: patchPageFlip(source), map: null };
    },
  };
}
