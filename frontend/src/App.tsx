import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { HomePage } from "./pages/HomePage";
import { GoalDetailsPage } from "./pages/GoalDetailsPage";
import { LoginPage } from "./pages/LoginPage";
import { MyTasksPage } from "./pages/MyTasksPage";
import { TeamDetailsPage } from "./pages/TeamDetailsPage";
import { TeamDashboardPage } from "./pages/TeamDashboardPage";
import { TeamGoalsPage } from "./pages/TeamGoalsPage";
import { TeamTimesheetsPage } from "./pages/TeamTimesheetsPage";
import { TaskDetailsPage } from "./pages/TaskDetailsPage";
import { TeamsPage } from "./pages/TeamsPage";
import { UsersPage } from "./pages/UsersPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/goals" element={<TeamGoalsPage />} />
        <Route path="/goals/:id" element={<GoalDetailsPage />} />
        <Route path="/tasks" element={<MyTasksPage />} />
        <Route path="/tasks/:id" element={<TaskDetailsPage />} />
        <Route element={<ProtectedRoute allowedRoles={["SUPER_ADMIN"]} />}>
          <Route path="/users" element={<UsersPage />} />
        </Route>
        <Route
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN", "TEAM_LEAD"]} />
          }
        >
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:id" element={<TeamDetailsPage />} />
          <Route path="/teams/:id/dashboard" element={<TeamDashboardPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={["TEAM_LEAD"]} />}>
          <Route
            path="/teams/:id/timesheets"
            element={<TeamTimesheetsPage />}
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
