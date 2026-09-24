import { useState } from "react";
import {
  Heart,
  BriefcaseBusiness,
  Users,
  MapPin,
  Utensils,
  Sparkles,
  Pause,
  Play,
} from "lucide-react";
import "./dining-moments.css";

const icons = [Heart, BriefcaseBusiness, Users, MapPin, Utensils, Sparkles];
export default function DiningMomentsMarquee({
  title,
  moments,
  english = false,
}: {
  title: string;
  moments: readonly { label: string; question: string }[];
  english?: boolean;
}) {
  const [paused, setPaused] = useState(false);
  return (
    <section className="dining-moments" aria-labelledby="home-dining-moments">
      <div className="dining-moments-heading">
        <h2 id="home-dining-moments">{title}</h2>
        <button
          type="button"
          className="dining-moments-pause"
          aria-pressed={paused}
          aria-label={
            english
              ? paused
                ? "Play cards"
                : "Pause cards"
              : paused
                ? "상황 카드 재생"
                : "상황 카드 일시정지"
          }
          onClick={() => setPaused(value => !value)}
        >
          {paused ? <Play size={13} /> : <Pause size={13} />}
        </button>
      </div>
      <div className="dining-moments-window">
        <div className="dining-moments-track" data-paused={paused}>
          {[0, 1].map(copy => (
            <ul
              key={copy}
              aria-hidden={copy === 1 || undefined}
              className="dining-moments-group"
            >
              {moments.map((moment, i) => {
                const Icon = icons[i % icons.length];
                return (
                  <li
                    key={moment.label}
                    className={`dining-moment tone-${i % 6}`}
                  >
                    <span className="dining-moment-icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <span>{moment.label}</span>
                      <p>{moment.question}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
