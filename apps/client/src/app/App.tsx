import { AppRouter } from "./router/AppRouter";
import { AppShell } from "./shell/AppShell";

export default function App() {
  return (
    <AppShell>
      <AppRouter />
    </AppShell>
  );
}
