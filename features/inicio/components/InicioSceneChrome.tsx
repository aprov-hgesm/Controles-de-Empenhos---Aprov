'use client';

import styles from './InicioSceneChrome.module.css';

export function InicioSceneChrome() {
  return (
    <div
      className={styles.root}
      data-testid="inicio-scene-chrome"
      aria-hidden="true"
    >
      <span className={`${styles.corner} ${styles.cornerTopLeft}`} />
      <span className={`${styles.corner} ${styles.cornerTopRight}`} />
      <span className={`${styles.corner} ${styles.cornerBottomLeft}`} />
      <span className={`${styles.corner} ${styles.cornerBottomRight}`} />

      <div className={styles.topRail}>
        <span>EMPROVEX</span>
        <i />
        <span>OPERATIONAL SPACE</span>
      </div>

      <div className={styles.sideScale}>
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>

      <div className={styles.bottomRail}>
        <span>SYS</span>
        <i />
        <span>HOME / LIVE MAP</span>
      </div>
    </div>
  );
}
