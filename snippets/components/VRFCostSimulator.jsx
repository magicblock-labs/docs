export const VRFCostSimulator = () => {
  const [vrfpm, setVrf] = useState(5);
  const [isER, setIsER] = useState(false);
  const chartRef = useRef(null);
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

  // Fees in SOL
  const alternativeVrfFeePerTx = 0.002; // SOL per transaction
  const magicblockVrfFeePerTx = 0.0005; // SOL per transaction for VRF without ER
  const magicblockVrfFeePerTxDiscounted = 0.0; // SOL per transaction for VRF with ER
  const erDelegationFeePerSession = 0.003; // SOL per ER delegation session

  const solPriceUSD = 200;
  const daysPerYear = 365;
  const height = 250;
  const plotTop = 35;
  const plotBottom = 180;
  const barWidth = Math.min(140, chartWidth * 0.34);
  const otherVrfBarCenter = chartWidth / 4;
  const magicblockBarCenter = (chartWidth * 3) / 4;
  const minutesPerDay = 24 * 60;
  const totalRequests = vrfpm * minutesPerDay * daysPerYear;
  const alternativeVrfCost = totalRequests * alternativeVrfFeePerTx * solPriceUSD;
  const erDelegationCost = isER ? erDelegationFeePerSession * solPriceUSD : 0;
  const magicblockVrfCost = totalRequests * (isER ? magicblockVrfFeePerTxDiscounted : magicblockVrfFeePerTx) * solPriceUSD + erDelegationCost;
  const chartMax = Math.max(alternativeVrfCost, magicblockVrfCost, 1) * 1.25;
  const barHeightForCost = (cost) => cost === 0 ? 0 : Math.max(4, (cost / chartMax) * (plotBottom - plotTop));
  const otherVrfBarHeight = barHeightForCost(alternativeVrfCost);
  const magicblockBarHeight = barHeightForCost(magicblockVrfCost);
  const formatCost = (amount) => `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const copyChart = async () => {
    const svg = chartRef.current;
    if (!svg) return;
    const exportScale = 2;
    const exportSvg = svg.cloneNode(true);
    exportSvg.setAttribute("width", String(chartWidth * exportScale));
    exportSvg.setAttribute("height", String(height * exportScale));
    exportSvg.setAttribute("viewBox", `0 0 ${chartWidth} ${height}`);
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
          canvas.width = chartWidth * exportScale;
          canvas.height = height * exportScale;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas is unavailable");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const pngBlob = await new Promise((resolve, reject) => {
            canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not render chart")), "image/png");
          });
          return pngBlob;
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


  return (
    <div style={{ width: "100%" }}>

            {/* Toggle switch */}
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "14px" }}>Solana</span>
        <label style={{
          position: "relative",
          display: "inline-block",
          width: "36px",
          height: "20px",
          marginBottom: 0, 
          verticalAlign: "middle"
        }}>
          <input 
            type="checkbox" 
            checked={isER} 
            onChange={() => setIsER(!isER)}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          {/* Track */}
          <span style={{
            position: "absolute",
            cursor: "pointer",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: isER ? "#2545f6" : "#2545f6",
            transition: ".4s",
            borderRadius: "24px",
          }} />

          {/* Knob */}
          <span style={{
            position: "absolute",
            height: "18px",
            width: "18px",
            left: isER ? "calc(100% - 19px)" : "1px",
            top: 1,
            bottom: "3px",
            backgroundColor: "white",
            transition: ".4s",
            borderRadius: "50%",
          }} />
        </label>
        <span style={{ fontSize: "14px" }}>With ER</span>
      </div>

      {/* Sliders */}
      <div style={
        {   
          display: "flex", 
          flexDirection: "column", 
          gap: "1rem", 
          marginTop: "1rem",    // space above
          marginBottom: "1rem" }
      }>
        {/* Transaction slider */}
        <label style={{ fontSize: "14px" }}>
          VRF request(s) per minute: {vrfpm.toLocaleString()}
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={vrfpm}
            onChange={(e) => setVrf(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </label>
      </div>

      {/* Total counts & cost */}
      <div style={{ marginTop: "1rem", lineHeight: 1.5, fontSize: "14px" }}>
        <p>
          <strong>{(totalRequests / 1_000_000).toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            })}M randomness provisions</strong> per year{isER ? ", plus one ER delegation session" : ""}.
            </p>

          <p style={{ marginTop: "0.5rem" }}>
            {" "}You <span style={{ fontWeight: "bold", color: "#fff" }}>save</span>{" "}
            <span style={{ fontWeight: "bold", color: "#fff" }}>{formatCost(alternativeVrfCost - magicblockVrfCost)}</span>{" "}
            <span style={{ color: "#666" }}>per year{magicblockVrfCost > 0 ? ", or" : ""}</span>
            {magicblockVrfCost > 0 ? (
              <> <span style={{ fontWeight: "bold", color: "#fff" }}>{(alternativeVrfCost / magicblockVrfCost).toLocaleString(undefined, { maximumFractionDigits: 2 })}× cheaper</span></>
            ) : (
              <span> because MagicBlock VRF with ER has no request fee</span>
            )}
            .
          </p>
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
          aria-label="Annual cost comparison between other VRFs and MagicBlock VRF"
        >
          <rect x={otherVrfBarCenter - barWidth / 2} y={plotBottom - otherVrfBarHeight} width={barWidth} height={otherVrfBarHeight} rx="4" fill="#59e09d" />
          <text x={otherVrfBarCenter} y={plotBottom - otherVrfBarHeight - 10} textAnchor="middle" fontSize="16" fill="#168a55" fontWeight="700">{formatCost(alternativeVrfCost)}</text>
          <text x={otherVrfBarCenter} y={plotBottom + 28} textAnchor="middle" fontSize="13" fill="#59e09d">Other VRFs</text>

          <rect x={magicblockBarCenter - barWidth / 2} y={plotBottom - magicblockBarHeight} width={barWidth} height={magicblockBarHeight} rx="4" fill="#2545F6" />
          <text x={magicblockBarCenter} y={plotBottom - magicblockBarHeight - 10} textAnchor="middle" fontSize="16" fill="#2545F6" fontWeight="700">{formatCost(magicblockVrfCost)}</text>
          <text x={magicblockBarCenter} y={plotBottom + 28} textAnchor="middle" fontSize="13" fill="#2545F6">MagicBlock VRF</text>
        </svg>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <span style={{ fontSize: "12px" }}>Price: {solPriceUSD} USD/SOL</span>
      </div>

    </div>
  );
};
