'use client';

const deepStars = Array.from({ length: 34 }, (_, index) => ({
  id: `deep-${index}`,
  left: 4 + ((index * 37) % 92),
  top: 3 + ((index * 53) % 90),
  size: 1 + (index % 2),
  opacity: 0.12 + ((index % 5) * 0.055),
  delay: -((index % 11) * 0.63),
}));

const dust = Array.from({ length: 18 }, (_, index) => ({
  id: `dust-${index}`,
  left: 8 + ((index * 41) % 84),
  top: 10 + ((index * 29) % 78),
  size: 1 + (index % 3),
  delay: -((index % 9) * 0.81),
}));

export function InicioAtmosphere() {
  return (
    <div className="inicio-cinematic-atmosphere" aria-hidden="true">
      <div className="inicio-cinematic-atmosphere__nebula inicio-cinematic-atmosphere__nebula--one" />
      <div className="inicio-cinematic-atmosphere__nebula inicio-cinematic-atmosphere__nebula--two" />
      <div className="inicio-cinematic-atmosphere__nebula inicio-cinematic-atmosphere__nebula--three" />

      <div className="inicio-cinematic-atmosphere__deep-stars">
        {deepStars.map((star) => (
          <span
            key={star.id}
            className="inicio-cinematic-atmosphere__deep-star"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="inicio-cinematic-atmosphere__dust">
        {dust.map((particle) => (
          <span
            key={particle.id}
            className="inicio-cinematic-atmosphere__dust-particle"
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: particle.size,
              height: particle.size,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="inicio-cinematic-atmosphere__arc inicio-cinematic-atmosphere__arc--one" />
      <div className="inicio-cinematic-atmosphere__arc inicio-cinematic-atmosphere__arc--two" />
      <div className="inicio-cinematic-atmosphere__horizon" />
      <div className="inicio-cinematic-atmosphere__scan" />
      <div className="inicio-cinematic-atmosphere__vignette" />
    </div>
  );
}
