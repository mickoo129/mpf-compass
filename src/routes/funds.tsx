import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/funds")({ component: FundsLayout });

function FundsLayout() {
  return <Outlet />;
}
