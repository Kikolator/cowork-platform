export function RogueOpsLogo({ className }: { className?: string }) {
  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 411.52 100"
        className={`dark:hidden ${className ?? ""}`}
        role="img"
        aria-label="RogueOps"
      >
        <g fill="#111">
          <polygon points="56.32 11.24 11.56 88.76 37.24 88.74 50.64 65.52 50.64 48.59 62 48.59 62 65.52 75.4 88.74 101.08 88.76 56.32 11.24" />
          <polygon
            points="62 65.52 62 65.69 50.64 65.69 50.64 65.52 37.24 88.74 75.4 88.74 62 65.52"
            opacity={0.9}
          />
        </g>
        <g fill="#111">
          <text
            fontFamily="var(--font-display)"
            fontWeight={800}
            fontSize={72}
            transform="translate(103.79 70.98)"
          >
            <tspan x="0" y="0" letterSpacing="-0.11em">R</tspan>
            <tspan x="39.96" y="0" letterSpacing="-0.08em">ogue</tspan>
          </text>
          <text
            fontFamily="var(--font-display)"
            fontWeight={400}
            fontSize={72}
            transform="translate(284.81 71.62)"
            opacity={0.5}
            letterSpacing="-0.08em"
          >
            <tspan x="0" y="0">Ops</tspan>
          </text>
        </g>
      </svg>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 411.52 100"
        className={`hidden dark:block ${className ?? ""}`}
        role="img"
        aria-label="RogueOps"
      >
        <g fill="#f1f0ef">
          <polygon points="56.32 11.24 11.56 88.76 37.24 88.74 50.64 65.52 50.64 48.59 62 48.59 62 65.52 75.4 88.74 101.08 88.76 56.32 11.24" />
          <polygon
            points="62 65.52 62 65.69 50.64 65.69 50.64 65.52 37.24 88.74 75.4 88.74 62 65.52"
            opacity={0.93}
          />
          <polygon
            points="62 65.52 62 65.69 50.64 65.69 50.64 65.52 37.24 88.74 75.4 88.74 62 65.52"
            fill="#111"
            opacity={0.96}
          />
        </g>
        <g fill="#f1f0ef">
          <text
            fontFamily="var(--font-display)"
            fontWeight={800}
            fontSize={72}
            transform="translate(103.29 71)"
          >
            <tspan x="0" y="0" letterSpacing="-0.11em">R</tspan>
            <tspan x="39.96" y="0" letterSpacing="-0.08em">ogue</tspan>
          </text>
          <text
            fontFamily="var(--font-display)"
            fontWeight={400}
            fontSize={72}
            transform="translate(285.3 71.65)"
            opacity={0.5}
            letterSpacing="-0.08em"
          >
            <tspan x="0" y="0">Ops</tspan>
          </text>
        </g>
      </svg>
    </>
  );
}
