'use client';

import styles from './InicioAtmosphere.module.css';

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

const shootingStars = Array.from({ length: 7 }, (_, index) => ({
  id: `shoot-${index}`,
  left: -18 + ((index * 19) % 58),
  top: 4 + ((index * 23) % 46),
  length: 72 + ((index * 17) % 62),
  angle: 22 + (index % 4) * 2.5,
  cycle: 6.8 + (index % 5) * 1.35,
  delay: -((index * 2.17) % 9.6),
  dx: 88 + ((index * 11) % 26),
  dy: 42 + ((index * 9) % 24),
  opacity: 0.5 + (index % 3) * 0.12,
}));

const flowParticles = Array.from({ length: 22 }, (_, index) => ({
  id: `flow-${index}`,
  left: 3 + ((index * 47) % 94),
  top: 7 + ((index * 31) % 86),
  size: index % 5 === 0 ? 2 : 1,
  opacity: 0.16 + ((index % 4) * 0.07),
  dx: 26 + ((index * 13) % 54),
  dy: -(32 + ((index * 17) % 62)),
  duration: 18 + (index % 7) * 2.8,
  delay: -((index % 13) * 2.1),
}));

export function InicioAtmosphere() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={`${styles.nebula} ${styles.nebulaOne}`} />
      <div className={`${styles.nebula} ${styles.nebulaTwo}`} />
      <div className={`${styles.nebula} ${styles.nebulaThree}`} />

      <div className={styles.deepStars}>
        {deepStars.map((star) => (
          <span
            key={star.id}
            className={styles.deepStar}
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

      <div className={styles.dust}>
        {dust.map((particle) => (
          <span
            key={particle.id}
            className={styles.dustParticle}
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

      <div className={styles.shootingStars}>
        {shootingStars.map((star) => (
          <span
            key={star.id}
            className={styles.shootingStar}
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.length,
              opacity: star.opacity,
              animationDuration: `${star.cycle}s`,
              animationDelay: `${star.delay}s`,
              ['--shoot-angle' as string]: `${star.angle}deg`,
              ['--shoot-dx' as string]: `${star.dx}vw`,
              ['--shoot-dy' as string]: `${star.dy}vh`,
            }}
          />
        ))}
      </div>

      <div className={styles.flowParticles}>
        {flowParticles.map((particle) => (
          <span
            key={particle.id}
            className={styles.flowParticle}
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: particle.size,
              height: particle.size,
              opacity: particle.opacity,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
              ['--particle-dx' as string]: `${particle.dx}px`,
              ['--particle-dy' as string]: `${particle.dy}px`,
            }}
          />
        ))}
      </div>

      <div className={`${styles.arc} ${styles.arcOne}`} />
      <div className={`${styles.arc} ${styles.arcTwo}`} />
      <div className={styles.horizon} />
      <div className={styles.scan} />
      <div className={styles.vignette} />
    </div>
  );
}
