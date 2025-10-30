export const CostSimulator = () => {
  const [tps, setTps] = useState(50);
  const [cpm, setCpm] = useState(30); // commits/sec
  const [dpm, setDpm] = useState(1); // delegations/sec

  // Fees in SOL
  const solanaFeePerTx = 0.000005; // SOL per transaction
  const erFeePerCommit = 0.0001;   // SOL per commit
  const erFeePerSession = 0.0003;  // SOL per session
  
  const solPriceUSD = 200        // USD per SOL

  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const width = 600;
  const height = 300;
  const padding = 50;
  const secondsPerDay = 24 * 60 * 60;

  const commitFeesPerDay = cpm / 60 * secondsPerDay * erFeePerCommit * solPriceUSD;
  const sessionFeesPerDay = dpm / 60 * secondsPerDay * erFeePerSession * solPriceUSD;

  const solanaCosts = days.map(
    (_, i) => (i + 1) * tps * secondsPerDay * solanaFeePerTx * solPriceUSD
  );
  const erCosts = days.map(
    (_, i) => (i + 1) * (commitFeesPerDay + sessionFeesPerDay)
  );

  const totalSolanaTx = tps * secondsPerDay * days.length;
  const totalERCommits = cpm * secondsPerDay * days.length;
  const totalERSessions = dpm * secondsPerDay * days.length;

  const maxCost = Math.max(...solanaCosts, ...erCosts);
  const xStep = (width - padding * 2) / (days.length - 1);
  const yScale = (val) => height - padding - (val / maxCost) * (height - padding * 2);

  const linePath = (data) =>
    data.map((val, i) => `${i === 0 ? "M" : "L"}${padding + i * xStep},${yScale(val)}`).join(" ");

  const lastIndex = days.length - 1;

  const handleTpsChange = (newTps) => {
    setTps(newTps);
    // enforce ratio limit
    const maxCpm = newTps * 20;
    if (cpm > maxCpm) {
      setCpm(maxCpm);
    }
    const maxDpm = newTps * 20;
    if (dpm > maxDpm) {
      setDpm(maxDpm);
    }
  };

  const handleCpmChange = (newCpm) => {
    const requiredTps = Math.ceil(newCpm / 2);
    if (requiredTps > tps) setTps(requiredTps);
      setCpm(newCpm);
  };

  const handleDpmChange = (newDpm) => {
    const requiredTps = Math.ceil(newDpm / 2);
    if (requiredTps > tps) setTps(requiredTps);
    setDpm(newDpm);
};

  return (
    <div style={{ maxWidth: width }}>
      {/* Summary */}
      {/* <div style={{ marginTop: "1rem" }}>
        <ul>
          <li><strong>Total Transactions: {totalSolanaTx.toLocaleString()}</strong></li>
          <li><strong>Solana Fees: ${solanaCosts[lastIndex].toLocaleString()}</strong></li>
          <li>
            <strong>ER Fees: ${erCosts[lastIndex].toLocaleString()}</strong>
            <ul>
              <li>Commits: {totalERCommits.toLocaleString()}</li>
              <li>Sessions: {totalERSessions.toLocaleString()}</li>
            </ul>
          </li>
        </ul>
      </div> */}

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
        <label>
          Transaction(s) per second: {tps}
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={tps}
            onChange={(e) => handleTpsChange(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </label>

        {/* Commits and Delegations in one row */}
        <div style={{ display: "flex", gap: "1rem" }}>
          <label style={{ flex: 1 }}>
            Commit(s) per minute: {cpm}
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={cpm}
              onChange={(e) => handleCpmChange(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ flex: 1 }}>
            Delegation(s) per minute: {dpm}
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={dpm}
              onChange={(e) => handleDpmChange(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>
        </div>
      </div>

      {/* Total counts & cost */}
      <div style={{ marginTop: "1rem" }}>

        <p> With <strong>{(totalSolanaTx / 1_000_000).toFixed(2)}M transactions</strong>, </p>
        <p style={{ marginTop: "0.5rem", fontWeight: "bold", color: "#aa00ff" }}>
          {erCosts[lastIndex] > solanaCosts[lastIndex]
            ? `ER is ${(erCosts[lastIndex]/solanaCosts[lastIndex]).toFixed(2).toLocaleString()}x more expensive.`
            : `ER is ${(solanaCosts[lastIndex]/erCosts[lastIndex]).toFixed(2).toLocaleString()}x cheaper.`}
        </p>
      </div>

      {/* SVG graph */}
      <div style={{ width: "100%", maxWidth: "600px", margin: "0 auto" }}>
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
                <text x={padding - 5} y={y + 4} textAnchor="end" fontSize="12" fill="#555">
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
                  <text x={x} y={height - padding + 15} textAnchor="middle" fontSize="12" fill="#555">
                    {day}
                  </text>
                  <circle cx={x} cy={yScale(solanaCosts[i])} r={3} fill="#59e09d" />
                  <text x={x} y={yScale(solanaCosts[i]) - 5} fontSize="14" fill="#59e09d" textAnchor="middle">
                    ${solanaCosts[i].toLocaleString()}
                  </text>
                  <circle cx={x} cy={yScale(erCosts[i])} r={3} fill="#f2805a" />
                  <text x={x} y={yScale(erCosts[i]) - 5} fontSize="14" fill="#f2805a" textAnchor="middle">
                    ${erCosts[i].toLocaleString()}
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
          <path d={linePath(solanaCosts)} stroke="#59e09d" strokeWidth="2" fill="none" />
          <path d={linePath(erCosts)} stroke="#f2805a" strokeWidth="2" fill="none" />
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "2rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: 12, height: 12, backgroundColor: "#59e09d" }} />
          <span>Solana</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: 12, height: 12, backgroundColor: "#f2805a" }} />
          <span>ER (Commits + Delegations)</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.6rem" }}>Price: ${solPriceUSD} USD/SOL</span>
      </div>

    </div>
  );
};