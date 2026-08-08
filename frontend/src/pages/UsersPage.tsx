import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { Navigation } from '../components/Navigation';
import { roleLabels } from '../components/role-navigation';
import { UserCreationForm } from '../components/UserCreationForm';
import { UserRole } from '../types/auth';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string | null;
}

interface UsersResponse {
  users: ManagedUser[];
}

const roleOptions = Object.entries(roleLabels) as [UserRole, string][];

export function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let requestWasCancelled = false;
    const query = roleFilter ? `?role=${roleFilter}` : '';

    setIsLoading(true);
    setError('');
    apiRequest<UsersResponse>(`/users${query}`)
      .then((response) => {
        if (!requestWasCancelled) {
          setUsers(response.users);
        }
      })
      .catch((requestError) => {
        if (!requestWasCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load users',
          );
        }
      })
      .finally(() => {
        if (!requestWasCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      requestWasCancelled = true;
    };
  }, [refreshVersion, roleFilter]);

  return (
    <div className="app-shell">
      <Navigation />
      <main className="users-page">
        <header className="page-heading">
          <div>
            <p className="eyebrow">Company access</p>
            <h1>User accounts</h1>
            <p>
              Create company users before assigning employees and team leads to
              teams.
            </p>
          </div>
        </header>

        <div className="users-layout">
          <UserCreationForm
            onCreated={() => setRefreshVersion((version) => version + 1)}
          />

          <section
            className="panel users-list-panel"
            aria-labelledby="users-list-title"
          >
            <div className="list-heading">
              <div>
                <p className="eyebrow">Directory</p>
                <h2 id="users-list-title">Users</h2>
              </div>

              <div className="role-filter">
                <label htmlFor="role-filter">Filter by role</label>
                <select
                  id="role-filter"
                  value={roleFilter}
                  onChange={(event) =>
                    setRoleFilter(event.target.value as UserRole | '')
                  }
                >
                  <option value="">All roles</option>
                  {roleOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isLoading && <p className="list-message">Loading users…</p>}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {!isLoading && !error && users.length === 0 && (
              <p className="list-message">No users match this role.</p>
            )}
            {!isLoading && !error && users.length > 0 && (
              <div className="table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Team</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>
                          <span className="role-badge">
                            {roleLabels[user.role]}
                          </span>
                        </td>
                        <td>{user.teamId ? 'Assigned' : 'Unassigned'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
