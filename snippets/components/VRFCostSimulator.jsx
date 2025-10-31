export const VRFCostSimulator = () => {
  const [vrfps, setVrf] = useState(10);

  // Fees in SOL
  const alternativeVrfFeePerTx = 0.002; // SOL per transaction
  const magicblockVrfFeePerTx = 0.0005; // SOL per transaction

  const solPriceUSD = 200        // USD per SOL

  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const width = 600;
  const height = 300;
  const padding = 50;
  const secondsPerDay = 24 * 60 * 60;

  const alternativeVrfCosts = days.map(
    (_, i) => (i + 1) * vrfps * secondsPerDay * alternativeVrfFeePerTx * solPriceUSD
  );
  const magicblockVrfCosts = days.map(
    (_, i) => (i + 1) * vrfps * secondsPerDay * magicblockVrfFeePerTx * solPriceUSD
  );

  const totalAlternativeVrfCost = vrfps * secondsPerDay * days.length;

  const maxCost = Math.max(...alternativeVrfCosts, ...magicblockVrfCosts);
  const xStep = (width - padding * 2) / (days.length - 1);
  const yScale = (val) => height - padding - (val / maxCost) * (height - padding * 2);
  const linePath = (data) => data.map((val, i) => `${i === 0 ? "M" : "L"}${padding + i * xStep},${yScale(val)}`).join(" ");
  const lastIndex = days.length - 1;


  return (
    <div style={{ maxWidth: width }}>

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
          VRF(s) per second: {vrfps.toLocaleString()}
          <input
            type="range"
            min="1"
            max="1000"
            step="1"
            value={vrfps}
            onChange={(e) => setVrf(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </label>
      </div>

      {/* Total counts & cost */}
      <div style={{ marginTop: "1rem", lineHeight: 1.5, fontSize: "14px" }}>
        <p>
          <strong>{(totalAlternativeVrfCost / 1_000_000).toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            })}M randomness provisions</strong> over 30 days.
            </p>

          <p style={{ marginTop: "0.5rem" }}>
            {" "}You save{" "}
            <span style={{ fontWeight: "bold", color: "#aa00ff" }}>
              ${((alternativeVrfCosts[lastIndex] - magicblockVrfCosts[lastIndex]).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }))}{', or '}{(alternativeVrfCosts[lastIndex] / magicblockVrfCosts[lastIndex]).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}x cheaper
            </span>
            .
          </p>

      </div>

      {/* SVG graph */}
      <div style={{ width: "100%", maxWidth: "600px", margin: "0 auto", paddingLeft: "40px", paddingRight: "10px" }}>
        <svg width={width} height={height} 
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="auto"
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: "visible" }}
        >
          {Array.from({ length: 5 }, (_, i) => {
            const y = padding + i * ((height - 2 * padding) / 4);
            const price = ((4 - i) / 4 * maxCost).toFixed(0);
            return (
              <g key={i}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#eee" />
                <text x={padding - 5} y={y + 4} textAnchor="end" fontSize="12" fill="#555" fontWeight="bold">
                  ${Number(price).toLocaleString()}
                </text>
              </g>
            );
          })}

          {days.map((day, i) => {
            // Show dots and cost labels only for day 10, 20, and 30
            if ((i + 1) % 10 === 0) {
              const x = padding + i * xStep;
              return (
                <g key={i}>
                  <line x1={x} y1={padding} x2={x} y2={height - padding} stroke="#eee" />
                  <text x={x} y={height - padding + 15} textAnchor="middle" fontSize="12" fill="#555" fontWeight="bold">
                    {day}
                  </text>
                  <circle cx={x} cy={yScale(alternativeVrfCosts[i])} r={3} fill="#59e09d" />
                  <text x={x} y={yScale(alternativeVrfCosts[i]) - 8} fontSize="14" fill="#59e09d" textAnchor="middle" fontWeight="bold">
                    ${alternativeVrfCosts[i].toLocaleString()}
                  </text>
                  <circle cx={x} cy={yScale(magicblockVrfCosts[i])} r={3} fill="#aa00ff" />
                  <text x={x} y={yScale(magicblockVrfCosts[i]) - 8} fontSize="14" fill="#aa00ff" textAnchor="middle" fontWeight="bold">
                    ${magicblockVrfCosts[i].toLocaleString()}
                  </text>
                </g>
              );
            }
            return null;
          })}

          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#aaa" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#aaa" />

          {/* X-axis label */}
          <text
            x={width / 2}               // centered horizontally
            y={height - padding + 40}   // below X-axis
            fontSize="12"
            fill="#555"
            textAnchor="middle"
          >
            Day
          </text>
          <path d={linePath(alternativeVrfCosts)} stroke="#59e09d" strokeWidth="2" fill="none" />
          <path d={linePath(magicblockVrfCosts)} stroke="#aa00ff" strokeWidth="2" fill="none" />
        </svg>
      </div>

      {/* Legend + Price */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        {/* Legends */}
        <div style={{ display: "flex", gap:"0rem 1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: 12, height: 12, backgroundColor: "#59e09d" }} />
            <span style={{ fontSize: "14px" }}>
              Other VRFs
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: 12, height: 12, backgroundColor: "#aa00ff" }} />
            <span style={{ fontSize: "14px" }}>MagicBlock VRF</span>
          </div>
        </div>

        {/* Price */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: "14px" }}>Price: ${solPriceUSD} USD/SOL</span>
        </div>
      </div>

    </div>
  );
};