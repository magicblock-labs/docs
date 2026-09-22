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

  // The "Install AI Skill" button in the main navigation (desktop and mobile).
  function isNavigationCta(target) {
    const link = target.closest("a");
    if (!link || !link.closest('nav[aria-label="Main"]')) return false;
    const destination = new URL(link.href, window.location.href);
    return docsOrigins.includes(destination.origin) &&
      destination.pathname.replace(/\/$/, "") === "/pages/overview/additional-information/ai-dev-skill" &&
      link.textContent.trim() === "Install AI Skill";
  }

  // The copy button of the skill install command shown in the AI Dev Skill callout.
  const installCommand = "npx skills add https://github.com/magicblock-labs/magicblock-dev-skill";
  function isInstallCommandCopy(target) {
    if (!target.closest('button[data-testid="copy-code-button"]')) return false;
    const block = target.closest(".code-block");
    const code = block ? block.querySelector("pre code") : null;
    return Boolean(code) && code.textContent.replace(/\s+/g, " ").trim() === installCommand;
  }

  function trackClick(event) {
    if (event.type === "auxclick" && event.button !== 1) return;
    if (event.type === "click" && event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !(isNavigationCta(target) || isInstallCommandCopy(target))) return;

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
