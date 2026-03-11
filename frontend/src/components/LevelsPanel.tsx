import { Levels } from "@/types";

interface Props {
  levels: Levels;
  spot: number;
}

interface LevelCard {
  label: string;
  value: number;
  color: string;
  description: string;
}

export default function LevelsPanel({ levels, spot }: Props) {
  const cards: LevelCard[] = [
    { label: "CALL WALL", value: levels.call_wall, color: "border-t-danger text-danger", description: "Resistance — max call OI" },
    { label: "RESISTANCE", value: levels.resistance, color: "border-t-orange-500 text-orange-400", description: "Max negative GEX" },
    { label: "GAMMA FLIP", value: levels.gamma_flip, color: "border-t-yellow-400 text-yellow-400", description: "Zero gamma — vol zone" },
    { label: "SUPPORT", value: levels.support, color: "border-t-accent text-accent", description: "Max positive GEX" },
    { label: "PUT WALL", value: levels.put_wall, color: "border-t-blue-400 text-blue-400", description: "Floor — max put OI" },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {cards.map((card) => {
        const distance = ((card.value - spot) / spot) * 100;
        return (
          <div
            key={card.label}
            className={`bg-surface border border-border border-t-2 ${card.color} p-4`}
          >
            <div className="text-xs text-muted tracking-widest mb-1">{card.label}</div>
            <div className={`text-2xl font-bold ${card.color.split(" ")[1]}`}>
              ${card.value.toFixed(2)}
            </div>
            <div className="text-xs text-muted mt-1">
              {distance > 0 ? "+" : ""}{distance.toFixed(2)}% from spot
            </div>
            <div className="text-xs text-muted mt-1 opacity-60">{card.description}</div>
          </div>
        );
      })}
    </div>
  );
}
