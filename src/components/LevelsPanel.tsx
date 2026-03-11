import type { Levels } from "@/types";

interface Props {
  levels: Levels;
  spot: number;
}

export default function LevelsPanel({ levels, spot }: Props) {
  const items = [
    {
      label: "CALL WALL",
      value: levels.callWall,
      color: "text-danger",
      borderColor: "border-t-danger",
      desc: "Max call open interest",
    },
    {
      label: "RESISTANCE",
      value: levels.resistance,
      color: "text-orange-400",
      borderColor: "border-t-orange-500",
      desc: "Most negative GEX strike",
    },
    {
      label: "GAMMA FLIP",
      value: levels.gammaFlip,
      color: "text-warning",
      borderColor: "border-t-warning",
      desc: "Cumulative GEX = 0",
    },
    {
      label: "SUPPORT",
      value: levels.support,
      color: "text-accent",
      borderColor: "border-t-accent",
      desc: "Max positive GEX strike",
    },
    {
      label: "PUT WALL",
      value: levels.putWall,
      color: "text-info",
      borderColor: "border-t-info",
      desc: "Max put open interest",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => {
        const pct = ((item.value - spot) / spot) * 100;
        return (
          <div
            key={item.label}
            className={`bg-card border border-border border-t-2 ${item.borderColor} p-4`}
          >
            <div className="text-xs text-muted tracking-widest mb-2">{item.label}</div>
            <div className={`text-2xl font-bold ${item.color}`}>
              ${item.value.toFixed(2)}
            </div>
            <div className="text-xs text-subtle mt-1">
              {pct >= 0 ? "+" : ""}
              {pct.toFixed(2)}% vs spot
            </div>
            <div className="text-xs text-muted mt-2 opacity-60">{item.desc}</div>
          </div>
        );
      })}
    </div>
  );
}
