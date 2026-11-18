(function() {
  "use strict";
  const trains = Array.from(document.querySelectorAll(".hero__train"));
  const signals = Array.from(document.querySelectorAll(".signal"));
  if (!trains.length || !signals.length) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const setAspect = (signal, aspect) => {
    if (signal.dataset.aspect !== aspect) signal.dataset.aspect = aspect;
  };
  signals.forEach(s => setAspect(s, "green"));
  if (reduced) return;
  let running = true;
  let current = null;
  function activeTrain() {
    for (const t of trains) {
      const b = t.getBoundingClientRect();
      if (b.right > -20 && b.left < window.innerWidth + 20) return {
        el: t,
        box: b
      };
    }
    return null;
  }
  function tick() {
    if (running) {
      const active = activeTrain();
      if (!active) {
        requestAnimationFrame(tick);
        return;
      }
      if (active.el !== current) {
        current = active.el;
        signals.forEach(s => setAspect(s, "green"));
      }
      const head = active.box.right;
      const tail = active.box.left;
      signals.forEach(s => {
        const x = s.getBoundingClientRect().left + 6;
        if (tail < x) return;
        const ahead = tail - x;
        setAspect(s, ahead < window.innerWidth * .3 ? "red" : "yellow");
      });
    }
    requestAnimationFrame(tick);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting;
    }).observe(document.querySelector(".hero"));
  }
  requestAnimationFrame(tick);
})();