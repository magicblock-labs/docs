export const ERCostSimulator = () => {
  const [transactionCount, setTransactionCount] = useState(1_000_000);
  const [transactionInput, setTransactionInput] = useState("1,000,000");
  const [paidCommitCount, setPaidCommitCount] = useState(0);
  const [paidCommitInput, setPaidCommitInput] = useState("0");
  const [delegationCount, setDelegationCount] = useState(1);
  const [delegationInput, setDelegationInput] = useState("1");
  const [isDedicated, setIsDedicated] = useState(false);
  const chartRef = useRef(null);
  const breakEvenChartRef = useRef(null);
  const chartContainerRef = useRef(null);
  const width = 600;
  const [chartWidth, setChartWidth] = useState(width);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    const updateWidth = () => {
      setChartWidth(Math.min(width, Math.max(280, container.clientWidth)));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const solanaFeePerTx = 0.000005;
  const erFeePerCommit = 0.001;
  const erFeePerSession = 0.003;
  const dedicatedBaseFee = 0.00000005;
  const solPriceUSD = 200;
  const maxTransactions = 10_000_000;
  const daysPerYear = 365;

  const height = 250;
  const plotTop = 35;
  const plotBottom = 180;
  const barWidth = Math.min(140, chartWidth * 0.34);
  const solanaBarCenter = chartWidth / 4;
  const erBarCenter = (chartWidth * 3) / 4;

  const solanaCost = transactionCount * daysPerYear * solanaFeePerTx * solPriceUSD;
  const solanaCostSOL = transactionCount * daysPerYear * solanaFeePerTx;
  const dedicatedTransactionCost = isDedicated ? transactionCount * daysPerYear * dedicatedBaseFee * solPriceUSD : 0;
  const dedicatedTransactionCostSOL = isDedicated ? transactionCount * daysPerYear * dedicatedBaseFee : 0;
  const delegationCostSOL = delegationCount * erFeePerSession;
  const commitCostSOL = paidCommitCount * erFeePerCommit;
  const erCostSOL = delegationCostSOL + commitCostSOL + dedicatedTransactionCostSOL;
  const fixedErCost =
    paidCommitCount * erFeePerCommit * solPriceUSD +
    delegationCount * erFeePerSession * solPriceUSD;
  const solanaCostPerDailyTransaction = daysPerYear * solanaFeePerTx * solPriceUSD;
  const erCostPerDailyTransaction = isDedicated ? daysPerYear * dedicatedBaseFee * solPriceUSD : 0;
  const erCost =
    fixedErCost +
    dedicatedTransactionCost;
  const breakEvenTxPerDay = solanaCostPerDailyTransaction > erCostPerDailyTransaction
    ? fixedErCost / (solanaCostPerDailyTransaction - erCostPerDailyTransaction)
    : null;
  const breakEvenXMax = breakEvenTxPerDay == null
    ? Math.max(transactionCount, 10)
    : Math.max(Math.ceil(breakEvenTxPerDay * 1.5), transactionCount, 10);
  const breakEvenXMin = 1;
  const breakEvenSavingsAtMax =
    breakEvenXMax * solanaCostPerDailyTransaction -
    (fixedErCost + breakEvenXMax * erCostPerDailyTransaction);
  const breakEvenSavingsMin = -fixedErCost * 1.15;
  const breakEvenSavingsMax = Math.max(breakEvenSavingsAtMax, 0, 1) * 1.15;
  const breakEvenChartHeight = 310;
  const breakEvenPlot = { left: 0, right: chartWidth - 8, top: 42, bottom: 236 };
  const xForTransactions = (transactions) =>
    breakEvenPlot.left +
    ((Math.log10(Math.max(transactions, breakEvenXMin)) - Math.log10(breakEvenXMin)) /
      (Math.log10(breakEvenXMax) - Math.log10(breakEvenXMin))) *
      (breakEvenPlot.right - breakEvenPlot.left);
  const yForSavings = (savings) =>
    breakEvenPlot.bottom - ((savings - breakEvenSavingsMin) / (breakEvenSavingsMax - breakEvenSavingsMin)) * (breakEvenPlot.bottom - breakEvenPlot.top);
  const breakEvenSavingsPath = Array.from({ length: 64 }, (_, index) => {
    const progress = index / 63;
    const transactions = breakEvenXMin * (breakEvenXMax / breakEvenXMin) ** progress;
    const savings = transactions * (solanaCostPerDailyTransaction - erCostPerDailyTransaction) - fixedErCost;
    return `${index === 0 ? "M" : "L"}${xForTransactions(transactions)},${yForSavings(savings)}`;
  }).join(" ");
  const breakEvenXTicks = [];
  for (let exponent = 0; 10 ** exponent <= breakEvenXMax; exponent += 1) {
    const tick = 10 ** exponent;
    if (tick >= breakEvenXMin && tick <= breakEvenXMax) breakEvenXTicks.push(tick);
  }
  const chartMax = Math.max(solanaCost, erCost, 1) * 1.25;
  const barHeightForCost = (cost) => cost === 0 ? 0 : Math.max(4, (cost / chartMax) * (plotBottom - plotTop));
  const solanaBarHeight = barHeightForCost(solanaCost);
  const erBarHeight = barHeightForCost(erCost);
  const formatUSD = (amount) => amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const formatCount = (amount) => amount.toLocaleString();
  const formatTransactionTick = (amount) => amount >= 1_000_000
    ? `${amount / 1_000_000}M`
    : amount >= 1000
      ? `${amount / 1000}K`
      : formatCount(amount);
  const maxRelatedCount = transactionCount * daysPerYear - 1;
  const formatSOL = (amount) => `${amount.toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL`;

  const copySvg = async (svg, exportWidth, exportHeight) => {
    if (!svg) return;
    const exportScale = 3;
    const exportSvg = svg.cloneNode(true);
    exportSvg.setAttribute("width", String(exportWidth * exportScale));
    exportSvg.setAttribute("height", String(exportHeight * exportScale));
    exportSvg.setAttribute("viewBox", `0 0 ${exportWidth} ${exportHeight}`);
    const source = new XMLSerializer().serializeToString(exportSvg);
    const svgText = source.includes("xmlns=")
      ? source
      : source.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');

    try {
      if (!navigator.clipboard?.write || !window.ClipboardItem) {
        throw new Error("Image clipboard access is unavailable");
      }

      const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
      const pngPromise = (async () => {
        const svgUrl = URL.createObjectURL(svgBlob);
        try {
          const image = new Image();
          image.src = svgUrl;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = exportWidth * exportScale;
          canvas.height = exportHeight * exportScale;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas is unavailable");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          return await new Promise((resolve, reject) => {
            canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not render chart")), "image/png");
          });
        } finally {
          URL.revokeObjectURL(svgUrl);
        }
      })();

      const clipboardData = { "image/png": pngPromise };
      if (window.ClipboardItem.supports?.("image/svg+xml")) {
        clipboardData["image/svg+xml"] = svgBlob;
      }
      await navigator.clipboard.write([new window.ClipboardItem(clipboardData)]);
    } catch (error) {
      console.error("Could not copy chart", error);
    }
  };
  const copyChart = () => copySvg(chartRef.current, chartWidth, height);

  const handleTransactionChange = (event) => {
    const value = Number(event.target.value);
    const nextCount = Number.isFinite(value) ? Math.min(maxTransactions, Math.max(2, Math.floor(value))) : 2;
    setTransactionCount(nextCount);
    setTransactionInput(formatCount(nextCount));
    const relatedLimit = nextCount * daysPerYear - 1;
    if (paidCommitCount > relatedLimit) {
      setPaidCommitCount(relatedLimit);
      setPaidCommitInput(formatCount(relatedLimit));
    }
    if (delegationCount > relatedLimit) {
      setDelegationCount(relatedLimit);
      setDelegationInput(formatCount(relatedLimit));
    }
  };

  const handleTransactionInputChange = (event) => {
    const input = event.target.value;
    setTransactionInput(input);
    const digits = input.replace(/\D/g, "");
    if (!digits) return;
    const value = Number(digits);
    const nextCount = Number.isFinite(value) ? Math.min(maxTransactions, Math.max(2, Math.floor(value))) : 2;
    setTransactionCount(nextCount);
    const relatedLimit = nextCount * daysPerYear - 1;
    if (paidCommitCount > relatedLimit) {
      setPaidCommitCount(relatedLimit);
      setPaidCommitInput(formatCount(relatedLimit));
    }
    if (delegationCount > relatedLimit) {
      setDelegationCount(relatedLimit);
      setDelegationInput(formatCount(relatedLimit));
    }
  };

  const handleRelatedCountChange = (setter, setInput, minimum = 0) => (event) => {
    const input = event.target.value;
    setInput(input);
    const digits = input.replace(/\D/g, "");
    if (!digits) return;
    const value = Number(digits);
    const nextCount = Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : minimum;
    setter(Math.min(nextCount, Math.max(minimum, maxRelatedCount)));
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0 }}>ER Cost Simulator</h3>
      </div>

      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "14px" }}>Public Node</span>
        <label style={{ position: "relative", display: "inline-block", width: "36px", height: "20px", marginBottom: 0 }}>
          <input
            type="checkbox"
            checked={isDedicated}
            onChange={() => setIsDedicated(!isDedicated)}
            aria-label="Use dedicated node pricing"
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{ position: "absolute", cursor: "pointer", inset: 0, backgroundColor: "#2545f6", borderRadius: "24px" }} />
          <span style={{ position: "absolute", height: "18px", width: "18px", left: isDedicated ? "calc(100% - 19px)" : "1px", top: 1, backgroundColor: "white", borderRadius: "50%", pointerEvents: "none" }} />
        </label>
        <span style={{ fontSize: "14px" }}>Dedicated Node</span>
      </div>

      <div style={{ marginBottom: "0.5rem" }}>
        <label style={{ display: "block", fontSize: "14px", fontWeight: 400, color: "#fff" }}>
          Transactions per day
          <span style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.35rem" }}>
            <input
              type="text"
              inputMode="numeric"
              value={transactionInput}
              onChange={handleTransactionInputChange}
              onBlur={() => setTransactionInput(formatCount(transactionCount))}
              style={{ width: "10rem", flex: "0 0 10rem", boxSizing: "border-box", padding: "0.35rem 0.5rem", border: "1px solid #888", borderRadius: "4px", backgroundColor: "transparent", color: "inherit", fontSize: "14px" }}
            />
            <input
              type="range"
              min="2"
              max={maxTransactions}
              step="1"
              value={transactionCount}
              onChange={handleTransactionChange}
              aria-label="Adjust transactions per day"
              style={{ width: "100%", margin: 0 }}
            />
          </span>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
        <label style={{ fontSize: "14px", fontWeight: 400, color: "#fff" }}>
          Delegation sessions
          <input
            type="text"
            inputMode="numeric"
            value={delegationInput}
            onChange={handleRelatedCountChange(setDelegationCount, setDelegationInput, 1)}
            onBlur={() => setDelegationInput(formatCount(delegationCount))}
            style={{ display: "block", boxSizing: "border-box", width: "100%", marginTop: "0.35rem", padding: "0.35rem 0.5rem", border: "1px solid #888", borderRadius: "4px", backgroundColor: "transparent", color: "inherit", fontSize: "14px" }}
          />
        </label>
        <label style={{ fontSize: "14px", fontWeight: 400, color: "#fff" }}>
          Paid commits
          <input
            type="text"
            inputMode="numeric"
            value={paidCommitInput}
            onChange={handleRelatedCountChange(setPaidCommitCount, setPaidCommitInput)}
            onBlur={() => setPaidCommitInput(formatCount(paidCommitCount))}
            style={{ display: "block", boxSizing: "border-box", width: "100%", marginTop: "0.35rem", padding: "0.35rem 0.5rem", border: "1px solid #888", borderRadius: "4px", backgroundColor: "transparent", color: "inherit", fontSize: "14px" }}
          />
        </label>
      </div>

      <div ref={chartContainerRef} style={{ width: "100%", margin: 0, position: "relative" }}>
        <button
          type="button"
          onClick={copyChart}
          title="Copy chart as SVG"
          aria-label="Copy chart as SVG"
          style={{ position: "absolute", top: "4px", right: "4px", zIndex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "2px", border: 0, borderRadius: "4px", background: "transparent", color: "currentColor", opacity: 0.45, cursor: "pointer" }}
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
          </svg>
        </button>
        <svg
          ref={chartRef}
          viewBox={`0 0 ${chartWidth} ${height}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ height: "auto", overflow: "visible", fontFamily: "'IBM Plex Mono', monospace" }}
          role="img"
          aria-label="Estimated costs for Solana transactions compared with Ephemeral Rollup"
        >
          <rect x={solanaBarCenter - barWidth / 2} y={plotBottom - solanaBarHeight} width={barWidth} height={solanaBarHeight} rx="4" fill="#59e09d" />
          <text x={solanaBarCenter} y={plotBottom - solanaBarHeight - 10} textAnchor="middle" fontSize="16" fill="#168a55" fontWeight="700">{formatUSD(solanaCost)}</text>
          <text x={solanaBarCenter} y={plotBottom + 28} textAnchor="middle" fontSize="13" fill="#59e09d">Solana Only</text>

          <rect x={erBarCenter - barWidth / 2} y={plotBottom - erBarHeight} width={barWidth} height={erBarHeight} rx="4" fill="#2545F6" />
          <text x={erBarCenter} y={plotBottom - erBarHeight - 10} textAnchor="middle" fontSize="16" fill="#2545F6" fontWeight="700">{formatUSD(erCost)}</text>
          <text x={erBarCenter} y={plotBottom + 28} textAnchor="middle" fontSize="13" fill="#2545F6">{isDedicated ? "Dedicated ER" : "Public ER"}</text>

        </svg>
      </div>
      <p style={{ width: "100%", margin: "0.25rem 0 0.75rem", textAlign: "right", fontSize: "12px", color: "#666" }}>
        Price: {solPriceUSD} USD/SOL
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "0.75rem", fontSize: "13px", lineHeight: 1.5 }}>
        <div style={{ flex: "1 1 220px", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px" }}>
          <strong>Solana Only — annual estimate</strong>
          <div>{formatCount(transactionCount)} transactions/day × {daysPerYear} days × {formatSOL(solanaFeePerTx)} each = {formatSOL(solanaCostSOL)}</div>
          <div><strong>Transaction cost: {formatSOL(solanaCostSOL)} → {formatUSD(solanaCost)}</strong></div>
        </div>
        <div style={{ flex: "1 1 220px", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px" }}>
          <strong>{isDedicated ? "Dedicated ER" : "Public ER"} — annual estimate</strong>
          <div>{formatCount(delegationCount)} delegation sessions × {formatSOL(erFeePerSession)} = {formatSOL(delegationCostSOL)}</div>
          <div>{formatCount(paidCommitCount)} paid commits × {formatSOL(erFeePerCommit)} = {formatSOL(commitCostSOL)}</div>
          {isDedicated && (
            <div>{formatCount(transactionCount)} transactions/day × {daysPerYear} days × {formatSOL(dedicatedBaseFee)} dedicated fee = {formatSOL(dedicatedTransactionCostSOL)}</div>
          )}
          <div><strong>Total ER cost: {formatSOL(erCostSOL)} → {formatUSD(erCost)}</strong></div>
        </div>
      </div>

      <div style={{ margin: "1rem 0", fontSize: "14px", lineHeight: 1.5 }}>
        {solanaCost > erCost ? (
          <p style={{ margin: "0.5rem 0 0" }}>
            You <strong style={{ color: "#fff" }}>save</strong> <strong style={{ color: "#fff" }}>{formatUSD(solanaCost - erCost)}</strong>{" "}<span style={{ color: "#666" }}>per year{erCost > 0 ? ", or" : ""}</span>{erCost > 0 && <> <strong style={{ color: "#fff" }}>{(solanaCost / erCost).toLocaleString(undefined, { maximumFractionDigits: 2 })}× cheaper</strong></>}.
          </p>
        ) : solanaCost < erCost ? (
          <p style={{ margin: "0.5rem 0 0" }}>
            {isDedicated ? "Dedicated ER" : "Public ER"} is estimated to cost <strong>{formatUSD(erCost - solanaCost)} more</strong> for this workload.
          </p>
        ) : (
          <p style={{ margin: "0.5rem 0 0" }}>The estimated costs are equal for this workload.</p>
        )}
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <h4 style={{ margin: "0 0 0.5rem" }}>Exponential savings</h4>
        <p style={{ margin: "0 0 0.75rem", fontSize: "14px" }}>
          {breakEvenTxPerDay == null
            ? "No break-even point at the current per-transaction rates."
            : <>Break-even at <strong>{breakEvenTxPerDay.toLocaleString(undefined, { maximumFractionDigits: 1 })} transactions per day</strong> with the selected delegation and commit counts.</>}
        </p>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => copySvg(breakEvenChartRef.current, chartWidth, breakEvenChartHeight)}
            title="Copy graph as SVG"
            aria-label="Copy graph as SVG"
            style={{ position: "absolute", top: "4px", right: "4px", zIndex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "2px", border: 0, borderRadius: "4px", background: "transparent", color: "currentColor", opacity: 0.45, cursor: "pointer" }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
            </svg>
          </button>
        <svg
          ref={breakEvenChartRef}
          viewBox={`0 0 ${chartWidth} ${breakEvenChartHeight}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ height: "auto", display: "block", overflow: "visible", fontFamily: "'IBM Plex Mono', monospace" }}
          role="img"
          aria-label={`Annual savings versus transactions per day on a logarithmic scale. Break-even: ${breakEvenTxPerDay?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? "unavailable"} transactions per day.`}
        >
          <text x={breakEvenPlot.right} y="39" textAnchor="end" fontSize="11" fill="#2545F6">━ Annual savings with {isDedicated ? "Dedicated ER" : "Public ER"}</text>
          <path d={breakEvenSavingsPath} fill="none" stroke="#2545F6" strokeWidth="2.5" />
          {breakEvenXTicks.map((tick) => {
            const x = xForTransactions(tick);
            return (
              <g key={tick}>
                <text
                  x={x}
                  y={breakEvenPlot.bottom + 18}
                  textAnchor={x < breakEvenPlot.left + 35 ? "start" : x > breakEvenPlot.right - 35 ? "end" : "middle"}
                  fontSize="13"
                  fontWeight="700"
                  fill="#555"
                >
                  {formatTransactionTick(tick)}
                </text>
                {tick >= 10 && (() => {
                  const savings = tick * (solanaCostPerDailyTransaction - erCostPerDailyTransaction) - fixedErCost;
                  const y = yForSavings(savings);
                  return (
                    <g>
                      <circle cx={x} cy={y} r="3" fill="#fff" stroke="#2545F6" strokeWidth="1.5" />
                      <text
                        x={x}
                        y={y < breakEvenPlot.top + 32 ? y + 25 : y - 16}
                        textAnchor={x < breakEvenPlot.left + 60 ? "start" : x > breakEvenPlot.right - 60 ? "end" : "middle"}
                        fontSize="13"
                        fontWeight="700"
                        fill="#fff"
                      >
                        {formatUSD(savings)}
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}

          {breakEvenTxPerDay != null && (
            <circle cx={xForTransactions(breakEvenTxPerDay)} cy={yForSavings(0)} r="5" fill="#2545F6" stroke="#2545F6" strokeWidth="2" />
          )}
          {breakEvenTxPerDay != null && (
            <text
              x={xForTransactions(breakEvenTxPerDay) + (xForTransactions(breakEvenTxPerDay) > breakEvenPlot.right - 90 ? -9 : 9)}
              y={yForSavings(0) - 13}
              textAnchor={xForTransactions(breakEvenTxPerDay) > breakEvenPlot.right - 90 ? "end" : "start"}
              fontSize="13"
              fontWeight="700"
              fill="#2545F6"
            >
              {breakEvenTxPerDay.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </text>
          )}

          <line x1={breakEvenPlot.left} y1={breakEvenPlot.bottom} x2={breakEvenPlot.right} y2={breakEvenPlot.bottom} stroke="#888" />
          <text x={(breakEvenPlot.left + breakEvenPlot.right) / 2} y={breakEvenPlot.bottom + 42} textAnchor="middle" fontSize="12" fill="#555">Transactions per day (log scale)</text>
        </svg>
        </div>
        <p style={{ margin: "0.25rem 0 0", textAlign: "right", fontSize: "12px", color: "#666" }}>
          Price: {solPriceUSD} USD/SOL
        </p>
      </div>

    </div>
  );
};
