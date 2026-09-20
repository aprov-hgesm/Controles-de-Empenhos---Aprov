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

      <div className={`${styles.arc} ${styles.arcOne}`} />
      <div className={`${styles.arc} ${styles.arcTwo}`} />
      <div className={styles.horizon} />
      <div className={styles.scan} />
      <div className={styles.vignette} />
    </div>
  );
}
