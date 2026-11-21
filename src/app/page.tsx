import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="page-title">
        <p className={styles.eyebrow}>
          Progressive web app foundation
        </p>
        
        <h1 id="page-title">
          Password Generator
        </h1>
        
        <p className={styles.description}>
          The application shell is ready for offline use after its first successful load.
        </p>
      </section>
    </main>
  );
}
