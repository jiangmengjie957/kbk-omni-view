import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireAuth, RedirectIfAuth } from "./PrivateRoute";
import AdminLayout from "../layouts/AdminLayout";
import Login from "../pages/Login";
import Welcome from "../pages/Welcome";
import PerfStats from "../pages/PerfStats";
import LessonCancelReport from "../pages/LessonCancelReport";
import LessonHourStats from "../pages/LessonHourStats";

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Navigate to="/admin" replace />,
    },
    {
      path: "/login",
      element: (
        <RedirectIfAuth>
          <Login />
        </RedirectIfAuth>
      ),
    },
    {
      path: "/admin",
      element: (
        <RequireAuth>
          <AdminLayout />
        </RequireAuth>
      ),
      children: [
        {
          index: true,
          element: <Welcome />,
        },
        {
          path: "perf-stats",
          element: <PerfStats />,
        },
        {
          path: "lesson-cancel-report",
          element: <LessonCancelReport />,
        },
        {
          path: "lesson-hour-stats",
          element: <LessonHourStats />,
        },
      ],
    },
    {
      path: "*",
      element: <Navigate to="/admin" replace />,
    },
  ],
  { basename: "/kbk-management" },
);

export default router;
