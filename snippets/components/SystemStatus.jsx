export const SystemStatus = () => {
  const statusApiUrl = "https://status.magicblock.app/api/services";
  const regionLabels = {
    asia: "Asia",
    europe: "Europe",
    usa: "USA",
    tee: "TEE",
  };
  const regionOrder = ["asia", "europe", "usa", "tee"];

  const getStatus = (liveStatus) => {
    if (liveStatus === true) {
      return { label: "Operational", className: "operational" };
    }

    if (liveStatus === false) {
      return { label: "Down", className: "down" };
    }

    return { label: "N/A", className: "unknown" };
  };

  const getBarClassName = (downtime) => {
    if (downtime == null) return "unknown";
    if (downtime >= 5) return "down";
    if (downtime > 0) return "degraded";
    return "operational";
  };

  const getUptime = (metrics) => {
    const validMetrics = metrics.filter(
      (value) => typeof value === "number" && Number.isFinite(value)
    );

    if (validMetrics.length === 0) return null;

    const totalMinutes = validMetrics.length * 24 * 60;
    const downtimeMinutes = validMetrics.reduce(
      (total, value) => total + Math.max(0, value),
      0
    );
    const uptime = ((totalMinutes - downtimeMinutes) / totalMinutes) * 100;

    return Math.max(0, Math.min(100, uptime)).toFixed(2);
  };

  const sortRegions = (regions) => {
    const keys = Object.keys(regions);
    const knownRegions = regionOrder.filter((key) => keys.includes(key));
    const otherRegions = keys
      .filter((key) => !regionOrder.includes(key))
      .sort();

    return [...knownRegions, ...otherRegions];
  };

  const renderStatusCard = ({ days, liveStatus, metrics, service }) => {
    const status = getStatus(liveStatus);
    const normalizedMetrics = days.map((_, index) => {
      const value = metrics?.[index];
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    });
    const uptime = getUptime(normalizedMetrics);

    return (
      <article className="mb-status-card" key={service.id}>
        <div className="mb-status-card-header">
          <h4>{service.label || service.id}</h4>
          <div
            className={`mb-status-live mb-status-${status.className}`}
            aria-label={`${service.label || service.id} status: ${status.label}`}
          >
            <span className="mb-status-dot" aria-hidden="true" />
            <span>{status.label}</span>
          </div>
        </div>

        <div
          className="mb-status-bars"
          style={{ gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))` }}
          aria-label={`${service.label || service.id} daily downtime`}
        >
          {days.length === 0 ? (
            <span className="mb-status-bar mb-status-unknown" />
          ) : (
            normalizedMetrics.map((downtime, index) => {
              const day = days[index] || `Day ${index + 1}`;
              const downtimeLabel =
                downtime == null ? "unavailable" : `${downtime} minutes`;

              return (
                <span
                  key={`${day}-${index}`}
                  className={`mb-status-bar mb-status-${getBarClassName(downtime)}`}
                  aria-label={`${day}: ${downtimeLabel} downtime`}
                  title={`${day}: ${downtimeLabel} downtime`}
                />
              );
            })
          )}
        </div>

        <div className="mb-status-meta">
          <span>{days.length} days</span>
          <span>{uptime == null ? "N/A uptime" : `${uptime}% uptime`}</span>
          <span>Today</span>
        </div>
      </article>
    );
  };

  const [network, setNetwork] = useState("mainnet");
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setData(null);
    setError(false);

    fetch(statusApiUrl, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Status API returned ${response.status}`);
        }

        return response.json();
      })
      .then(setData)
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") {
          setError(true);
        }
      });

    return () => controller.abort();
  }, [requestVersion]);

  const services = Array.isArray(data?.meta?.services)
    ? data.meta.services.filter((service) => service?.id)
    : [];
  const days = Array.isArray(data?.meta?.days) ? data.meta.days : [];
  const regions = data?.environments?.[network]?.regions || {};
  const regionKeys = sortRegions(regions);

  return (
    <div className="mb-status-widget">
      <style>{`
        .mb-status-widget {
          --mb-status-border: #e5e7eb;
          --mb-status-card: #ffffff;
          --mb-status-muted: #6b7280;
          --mb-status-text: #111827;
          --mb-status-track: #f3f4f6;
          color: var(--mb-status-text);
          font-size: 14px;
          line-height: 1.5;
        }

        .dark .mb-status-widget {
          --mb-status-border: #374151;
          --mb-status-card: #1f2937;
          --mb-status-muted: #9ca3af;
          --mb-status-text: #f9fafb;
          --mb-status-track: #374151;
        }

        .mb-status-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          margin-bottom: 24px;
          padding: 4px;
          border: 1px solid var(--mb-status-border);
          border-radius: 10px;
          background: var(--mb-status-track);
        }

        .mb-status-tab {
          padding: 10px 16px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: var(--mb-status-muted);
          cursor: pointer;
          font: inherit;
          font-weight: 600;
        }

        .mb-status-tab[aria-pressed="true"] {
          background: #aa00ff;
          color: #ffffff;
          box-shadow: 0 1px 3px rgba(170, 0, 255, 0.3);
        }

        .mb-status-tab:focus-visible,
        .mb-status-retry:focus-visible {
          outline: 2px solid #aa00ff;
          outline-offset: 2px;
        }

        .mb-status-region {
          margin-top: 28px;
        }

        .mb-status-region h2 {
          margin: 0 0 4px;
          color: #aa00ff;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .dark .mb-status-region h2 {
          color: #c084fc;
        }

        .mb-status-server + .mb-status-server {
          margin-top: 28px;
        }

        .mb-status-endpoint {
          margin: 0 0 12px;
          color: var(--mb-status-muted);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .mb-status-card {
          margin: 14px 0;
          padding: 16px 20px;
          border: 1px solid var(--mb-status-border);
          border-radius: 12px;
          background: var(--mb-status-card);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .mb-status-card-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .mb-status-card h4 {
          margin: 0;
          color: var(--mb-status-text);
          font-size: 14px;
          font-weight: 600;
        }

        .mb-status-live {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          border-radius: 6px;
          background: var(--mb-status-track);
          font-size: 13px;
          font-weight: 600;
        }

        .mb-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: currentColor;
        }

        .mb-status-operational { color: #16a34a; }
        .mb-status-degraded { color: #ea580c; }
        .mb-status-down { color: #dc2626; }
        .mb-status-unknown { color: #9ca3af; }

        .mb-status-bars {
          display: grid;
          gap: 2px;
          margin: 12px 0;
          overflow: hidden;
          border-radius: 6px;
        }

        .mb-status-bar {
          height: 28px;
          background: currentColor;
        }

        .mb-status-meta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 12px;
          color: var(--mb-status-muted);
          font-size: 12px;
          font-weight: 500;
        }

        .mb-status-state {
          padding: 32px 16px;
          border: 1px solid var(--mb-status-border);
          border-radius: 12px;
          color: var(--mb-status-muted);
          text-align: center;
        }

        .mb-status-state-error {
          color: #dc2626;
        }

        .mb-status-retry {
          display: block;
          margin: 16px auto 0;
          padding: 8px 14px;
          border: 1px solid currentColor;
          border-radius: 7px;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font: inherit;
          font-weight: 600;
        }

        @media (max-width: 480px) {
          .mb-status-card {
            padding: 14px;
          }

          .mb-status-meta {
            flex-direction: column;
            gap: 2px;
          }
        }
      `}</style>

      <div className="mb-status-tabs" role="group" aria-label="Network">
        {["mainnet", "devnet"].map((networkName) => (
          <button
            key={networkName}
            className="mb-status-tab"
            type="button"
            aria-pressed={network === networkName}
            onClick={() => setNetwork(networkName)}
          >
            {networkName === "mainnet" ? "Mainnet" : "Devnet"}
          </button>
        ))}
      </div>

      {!data && !error && (
        <div className="mb-status-state" role="status">
          Fetching status...
        </div>
      )}

      {error && (
        <div className="mb-status-state mb-status-state-error" role="alert">
          Status data is temporarily unavailable.
          <button
            className="mb-status-retry"
            type="button"
            onClick={() => setRequestVersion((version) => version + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {data && regionKeys.length === 0 && (
        <div className="mb-status-state" role="status">
          No status data is available for this network.
        </div>
      )}

      {data && regionKeys.length > 0 && services.length === 0 && (
        <div className="mb-status-state" role="status">
          No services are currently reported.
        </div>
      )}

      {data && services.length > 0 &&
        regionKeys.map((regionKey) => {
          const servers = Object.entries(regions[regionKey]?.servers || {});

          return (
            <section className="mb-status-region" key={regionKey}>
              <h2>{regionLabels[regionKey] || regionKey}</h2>

              {servers.length === 0 ? (
                <div className="mb-status-state">No servers reported.</div>
              ) : (
                servers.map(([fqdn, server]) => (
                  <div className="mb-status-server" key={fqdn}>
                    <p className="mb-status-endpoint">
                      {server?.serverFqdn || fqdn}
                    </p>

                    {services.map((service) =>
                      renderStatusCard({
                        days,
                        liveStatus: server?.live_status?.[service.id],
                        metrics: server?.metrics?.[service.id],
                        service,
                      })
                    )}
                  </div>
                ))
              )}
            </section>
          );
        })}
    </div>
  );
};
