import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireAuth, RedirectIfAuth, RequirePermission } from "./PrivateRoute";
import AdminLayout from "../layouts/AdminLayout";
import Login from "../pages/Login";
import Welcome from "../pages/Welcome";
import PerfStats from "../pages/PerfStats";
import LessonCancelReport from "../pages/LessonCancelReport";
import LessonHourStats from "../pages/LessonHourStats";
import CampusManage from "../pages/CampusManage";
import EmployeeManage from "../pages/EmployeeManage";
import StudentManage from "../pages/StudentManage";
import ClassroomManage from "../pages/ClassroomManage";
import ScheduleManage from "../pages/ScheduleManage";

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
        {
          path: "campus",
          element: (
            <RequirePermission permission="basic-data">
              <CampusManage />
            </RequirePermission>
          ),
        },
        {
          path: "employee",
          element: (
            <RequirePermission permission="basic-data">
              <EmployeeManage />
            </RequirePermission>
          ),
        },
        {
          path: "student",
          element: (
            <RequirePermission permission="basic-data">
              <StudentManage />
            </RequirePermission>
          ),
        },
        {
          path: "classroom",
          element: (
            <RequirePermission permission="basic-data">
              <ClassroomManage />
            </RequirePermission>
          ),
        },
        {
          path: "schedule",
          element: <ScheduleManage />,
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
