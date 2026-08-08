import { Navigation } from '../components/Navigation';
import { useAuth } from '../auth/AuthContext';

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <Navigation />
      <main className="home-page">
        <p className="eyebrow">Your workspace</p>
        <h1>Hello, {user?.name}</h1>
        <p>Your role-specific TrackIt features will appear in the navigation as they are added.</p>
      </main>
    </div>
  );
}
