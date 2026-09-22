// X conversion tracking base code
!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');

twq('config','p9ilu');

(() => {
  if (window.__xSkillTracking) return;
  window.__xSkillTracking = true;

  const endpoint = "https://tracking.magicblock.app";
  const docsOrigins = ["https://docs.magicblock.xyz", "https://docs.magicblock.gg", "https://docs.magicblock.app"];
  if (!docsOrigins.includes(window.location.origin)) return;

  let clickId;
  function captureClickId() {
    const incoming = new URL(window.location.href).searchParams.get("twclid");
    if (incoming && /^[a-zA-Z0-9_-]{1,512}$/.test(incoming)) {
      clickId = incoming;
      try { sessionStorage.setItem("x_twclid", incoming); } catch { /* Storage can be disabled. */ }
    }
    if (!clickId) {
      try { clickId = sessionStorage.getItem("x_twclid") || undefined; } catch { /* Use request identifiers. */ }
    }
  }
  captureClickId();

  const config = fetch(`${endpoint}/config`, { credentials: "omit" })
    .then((result) => result.ok ? result.json() : null)
    .catch(() => null);

  function trackClick(event) {
    if (event.type === "auxclick" && event.button !== 1) return;
    if (event.type === "click" && event.button !== 0) return;
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    if (!link || !link.closest('nav[aria-label="Main"]')) return;
    const destination = new URL(link.href, window.location.href);
    if (!docsOrigins.includes(destination.origin) ||
        destination.pathname.replace(/\/$/, "") !== "/pages/overview/additional-information/ai-dev-skill" ||
        link.textContent.trim() !== "Install AI Skill") return;

    captureClickId();
    const conversionId = crypto.randomUUID();
    const payload = {
      event: "ai_skill_cta_clicked",
      conversion_id: conversionId,
      conversion_time: new Date().toISOString(),
      event_source_url: window.location.origin + window.location.pathname,
      ...(clickId ? { twclid: clickId } : {}),
    };
    // text/plain avoids a CORS preflight; keepalive allows navigation to proceed.
    fetch(`${endpoint}/events`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload),
      credentials: "omit",
      keepalive: true,
    }).catch(() => {});

    config.then((value) => {
      if (!/^tw-p9ilu-[a-zA-Z0-9]+$/.test(value?.event_id ?? "")) return;
      window.twq("event", value.event_id, {
        conversion_id: conversionId,
        ...(payload.twclid ? { twclid: payload.twclid } : {}),
      });
    }).catch(() => {});
  }

  document.addEventListener("click", trackClick, true);
  document.addEventListener("auxclick", trackClick, true);
})();
