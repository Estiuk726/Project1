export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        textAlign: 'center',
        background: 'var(--sky-light)',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: -0.8 }}>
        See who&apos;s on your flight
      </h1>
      <p style={{ margin: 0, maxWidth: 320, lineHeight: 1.5, color: 'var(--navy-700)' }}>
        FlightMates is coming soon for students flying between South Asia and Europe.
      </p>
    </main>
  );
}
