type AppProps = { connected: boolean };

export function App({ connected }: AppProps) {
  return (
    <main className="app-shell">
      <p className="eyebrow">Local configuration workspace</p>
      <h1>GSD Config Manager</h1>
      <p className="tagline">Understand and safely manage GSD configuration files.</p>
      <p className={connected ? 'status status--ready' : 'status status--warning'} role="status">
        {connected
          ? 'Ready to connect to the local helper.'
          : 'No launch token found. Open the URL printed by the CLI to connect.'}
      </p>
    </main>
  );
}