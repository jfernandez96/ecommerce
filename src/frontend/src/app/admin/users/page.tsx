"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, KeyRound, Power, Save, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/ui/toast";
import {
  createUser,
  listUserAudits,
  listUsers,
  resetUserPassword,
  setUserRole,
  setUserStatus,
  updateUserProfile,
  type AdminUserAuditLogDto,
  type AdminUserDto,
} from "@/lib/admin-api";

const createSchema = z.object({
  email: z.string().email("Correo invalido"),
  fullName: z.string().min(3, "Nombre requerido"),
  password: z.string().min(8, "Password minimo 8 caracteres"),
  role: z.enum(["Administrator", "Employee", "Customer"]),
  isActive: z.boolean(),
});

type CreateFormValues = z.infer<typeof createSchema>;

function roleLabel(role: AdminUserDto["role"]) {
  switch (role) {
    case "Administrator":
      return "Administrador";
    case "Employee":
      return "Empleado";
    default:
      return "Cliente";
  }
}

function auditActionLabel(action: AdminUserAuditLogDto["action"]) {
  switch (action) {
    case "users.created":
      return "Usuario creado";
    case "users.profile-updated":
      return "Perfil actualizado";
    case "users.role-changed":
      return "Rol actualizado";
    case "users.status-changed":
      return "Estado actualizado";
    case "users.password-reset":
      return "Password restablecido";
    default:
      return action;
  }
}

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [apiError, setApiError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AdminUserDto["role"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState<"all" | "users.created" | "users.profile-updated" | "users.role-changed" | "users.status-changed" | "users.password-reset">("all");
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [editUser, setEditUser] = useState<{ id: string; email: string; fullName: string } | null>(null);
  const [mobileListQuery, setMobileListQuery] = useState("");

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter, statusFilter]);

  const {
    data: usersPage,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["users", query, roleFilter, statusFilter, page],
    queryFn: () =>
      listUsers({
        query: query || undefined,
        role: roleFilter === "all" ? undefined : roleFilter,
        isActive: statusFilter === "all" ? undefined : statusFilter === "active",
        page,
        pageSize: 20,
      }),
  });

  const users = usersPage?.items ?? [];
  const mobileFilteredUsers = users.filter((user) => {
    const term = mobileListQuery.trim().toLowerCase();
    if (!term) return true;
    return (`${user.fullName} ${user.email}`).toLowerCase().includes(term);
  });
  const usersTotalItems = usersPage?.totalItems ?? 0;
  const usersTotalPages = usersPage?.totalPages ?? 1;

  const { data: auditPage, isLoading: isAuditLoading } = useQuery({
    queryKey: ["user-audits", auditActionFilter],
    queryFn: () =>
      listUserAudits({
        action: auditActionFilter === "all" ? undefined : auditActionFilter,
        page: 1,
        pageSize: 12,
      }),
  });

  const audits = auditPage?.items ?? [];

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: "Employee", isActive: true },
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      setApiError("");
      form.reset({ role: "Employee", isActive: true });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["user-audits"] });
      toast.success("Usuario creado y con acceso al sistema.");
    },
    onError: (mutationError: Error) => {
      setApiError(mutationError.message);
      toast.error(mutationError.message);
    },
  });

  const submit = (values: CreateFormValues) => {
    createMutation.mutate(values);
  };

  return (
    <AdminShell title="Usuarios" description="Gestiona todos los usuarios y asigna acceso al sistema como Administrador o Empleado.">
      <form onSubmit={form.handleSubmit(submit)} className="rounded-md border border-border p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <input className="rounded-md border border-border bg-background p-3" placeholder="Correo" {...form.register("email")} />
          <input className="rounded-md border border-border bg-background p-3" placeholder="Nombre completo" {...form.register("fullName")} />
          <input className="rounded-md border border-border bg-background p-3" placeholder="Password temporal" type="password" {...form.register("password")} />
          <select className="rounded-md border border-border bg-background p-3" {...form.register("role")}>
            <option value="Administrator">Administrador</option>
            <option value="Employee">Empleado</option>
            <option value="Customer">Cliente</option>
          </select>
          <Button disabled={createMutation.isPending}><Save size={16} /> Crear usuario</Button>
        </div>
        {Object.values(form.formState.errors)[0]?.message && <p className="mt-3 text-sm text-red-600">{Object.values(form.formState.errors)[0]?.message}</p>}
        {(apiError || error) && <p className="mt-3 rounded-md bg-red-500/10 p-3 text-sm text-red-600">{apiError || "No se pudo cargar usuarios."}</p>}
      </form>

      <section className="mt-4 rounded-md border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="rounded-md border border-border bg-background p-3"
            placeholder="Buscar por correo o nombre"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="rounded-md border border-border bg-background p-3"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as "all" | AdminUserDto["role"])}
          >
            <option value="all">Todos los roles</option>
            <option value="Administrator">Administrador</option>
            <option value="Employee">Empleado</option>
            <option value="Customer">Cliente</option>
          </select>
          <select
            className="rounded-md border border-border bg-background p-3"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
          <div className="flex items-center justify-start text-sm text-foreground/70 lg:justify-end">
            {usersTotalItems} usuarios encontrados
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-border">
        <div className="space-y-3 p-4 md:hidden">
          <div className="sticky top-2 z-10 rounded-xl border border-border bg-background/95 p-2 backdrop-blur">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/45" />
              <input
                value={mobileListQuery}
                onChange={(event) => setMobileListQuery(event.target.value)}
                className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-xs"
                placeholder="Buscar usuario o correo"
              />
            </div>
          </div>
          {isLoading && <p className="text-sm text-foreground/70">Cargando usuarios...</p>}
          {!isLoading && users.length === 0 && <p className="text-sm text-foreground/70">No hay usuarios para los filtros seleccionados.</p>}
          {!isLoading && users.length > 0 && mobileFilteredUsers.length === 0 && <p className="text-sm text-foreground/70">Sin coincidencias para la busqueda.</p>}
          {mobileFilteredUsers.map((user) => (
            <article key={user.id} className="rounded-xl border border-border bg-background p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{user.fullName}</p>
                  <p className="mt-1 text-xs text-foreground/60">{user.email}</p>
                </div>
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${user.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                  {user.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <label className="block text-xs font-semibold text-foreground/60">Rol</label>
                <select
                  className="w-full rounded-md border border-border bg-background p-2"
                  value={user.role}
                  onChange={(event) => {
                    const nextRole = event.target.value as AdminUserDto["role"];
                    setUserRole(user.id, nextRole)
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ["users"] });
                        queryClient.invalidateQueries({ queryKey: ["user-audits"] });
                        toast.success("Rol actualizado correctamente.");
                      })
                      .catch((requestError: Error) => {
                        setApiError(requestError.message);
                        toast.error(requestError.message);
                      });
                  }}
                >
                  <option value="Administrator">Administrador</option>
                  <option value="Employee">Empleado</option>
                  <option value="Customer">Cliente</option>
                </select>
                <p className="text-xs text-foreground/60">Creado: {formatDateTime(user.createdAt)}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setEditUser({ id: user.id, email: user.email, fullName: user.fullName })}
                >
                  <Edit3 size={16} />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setUserStatus(user.id, !user.isActive)
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ["users"] });
                        queryClient.invalidateQueries({ queryKey: ["user-audits"] });
                        toast.success(`Usuario ${user.isActive ? "desactivado" : "activado"}.`);
                      })
                      .catch((requestError: Error) => {
                        setApiError(requestError.message);
                        toast.error(requestError.message);
                      })
                  }
                >
                  <Power size={16} />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPasswordUserId(user.id);
                    setPasswordValue("");
                  }}
                >
                  <KeyRound size={16} />
                </Button>
                {user.role !== "Customer" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#E8F4FF] px-2 py-1 text-xs font-semibold text-[#1D9BF0]">
                    <Shield size={12} /> Acceso al sistema
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>

        <table className="hidden w-full text-sm md:table">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Usuario</th>
              <th className="p-3">Rol</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Creado</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="p-3" colSpan={5}>Cargando usuarios...</td>
              </tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr>
                <td className="p-3" colSpan={5}>No hay usuarios para los filtros seleccionados.</td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="border-t border-border">
                <td className="p-3">
                  <p className="font-semibold">{user.fullName}</p>
                  <p className="text-xs text-foreground/60">{user.email}</p>
                </td>
                <td className="p-3">
                  <select
                    className="rounded-md border border-border bg-background p-2"
                    value={user.role}
                    onChange={(event) => {
                      const nextRole = event.target.value as AdminUserDto["role"];
                      setUserRole(user.id, nextRole)
                        .then(() => {
                          queryClient.invalidateQueries({ queryKey: ["users"] });
                          queryClient.invalidateQueries({ queryKey: ["user-audits"] });
                          toast.success("Rol actualizado correctamente.");
                        })
                        .catch((requestError: Error) => {
                          setApiError(requestError.message);
                          toast.error(requestError.message);
                        });
                    }}
                  >
                    <option value="Administrator">Administrador</option>
                    <option value="Employee">Empleado</option>
                    <option value="Customer">Cliente</option>
                  </select>
                  <p className="mt-1 text-xs text-foreground/60">Actual: {roleLabel(user.role)}</p>
                </td>
                <td className="p-3">{user.isActive ? "Activo" : "Inactivo"}</td>
                <td className="p-3 text-xs text-foreground/70">{formatDateTime(user.createdAt)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setEditUser({ id: user.id, email: user.email, fullName: user.fullName })}
                    >
                      <Edit3 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setUserStatus(user.id, !user.isActive)
                          .then(() => {
                            queryClient.invalidateQueries({ queryKey: ["users"] });
                            queryClient.invalidateQueries({ queryKey: ["user-audits"] });
                            toast.success(`Usuario ${user.isActive ? "desactivado" : "activado"}.`);
                          })
                          .catch((requestError: Error) => {
                            setApiError(requestError.message);
                            toast.error(requestError.message);
                          })
                      }
                    >
                      <Power size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setPasswordUserId(user.id);
                        setPasswordValue("");
                      }}
                    >
                      <KeyRound size={16} />
                    </Button>
                    {user.role !== "Customer" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#E8F4FF] px-2 py-1 text-xs font-semibold text-[#1D9BF0]">
                        <Shield size={12} /> Acceso al sistema
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {passwordUserId && (
        <div className="mt-5 rounded-md border border-border p-4">
          <p className="text-sm font-semibold">Resetear password</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className="rounded-md border border-border bg-background p-3"
              placeholder="Nuevo password (min 8)"
              type="password"
              value={passwordValue}
              onChange={(event) => setPasswordValue(event.target.value)}
            />
            <Button
              type="button"
              onClick={() => {
                if (passwordValue.length < 8) {
                  toast.error("El password debe tener al menos 8 caracteres.");
                  return;
                }

                resetUserPassword(passwordUserId, passwordValue)
                  .then(() => {
                    queryClient.invalidateQueries({ queryKey: ["user-audits"] });
                    toast.success("Password actualizado correctamente.");
                    setPasswordUserId(null);
                    setPasswordValue("");
                  })
                  .catch((requestError: Error) => {
                    setApiError(requestError.message);
                    toast.error(requestError.message);
                  });
              }}
            >
              Guardar password
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPasswordUserId(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {editUser && (
        <div className="mt-5 rounded-md border border-border p-4">
          <p className="text-sm font-semibold">Editar usuario</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-md border border-border bg-background p-3"
              placeholder="Nombre completo"
              value={editUser.fullName}
              onChange={(event) => setEditUser((current) => current ? { ...current, fullName: event.target.value } : current)}
            />
            <input
              className="rounded-md border border-border bg-background p-3"
              placeholder="Correo"
              value={editUser.email}
              onChange={(event) => setEditUser((current) => current ? { ...current, email: event.target.value } : current)}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                if (!editUser.fullName.trim()) {
                  toast.error("El nombre es obligatorio.");
                  return;
                }

                if (!editUser.email.trim()) {
                  toast.error("El correo es obligatorio.");
                  return;
                }

                updateUserProfile(editUser.id, {
                  fullName: editUser.fullName.trim(),
                  email: editUser.email.trim(),
                })
                  .then(() => {
                    queryClient.invalidateQueries({ queryKey: ["users"] });
                    queryClient.invalidateQueries({ queryKey: ["user-audits"] });
                    toast.success("Perfil de usuario actualizado.");
                    setEditUser(null);
                  })
                  .catch((requestError: Error) => {
                    setApiError(requestError.message);
                    toast.error(requestError.message);
                  });
              }}
            >
              Guardar cambios
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditUser(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-foreground/70">
          Pagina {usersPage?.page ?? 1} de {usersTotalPages}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= usersTotalPages}
            onClick={() => setPage((current) => Math.min(usersTotalPages, current + 1))}
          >
            Siguiente
          </Button>
        </div>
      </div>

      <section className="mt-8 rounded-md border border-border p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold">Auditoria de cambios</h2>
          <select
            className="rounded-md border border-border bg-background p-2 text-sm"
            value={auditActionFilter}
            onChange={(event) => setAuditActionFilter(event.target.value as "all" | "users.created" | "users.profile-updated" | "users.role-changed" | "users.status-changed" | "users.password-reset")}
          >
            <option value="all">Todas las acciones</option>
            <option value="users.created">Usuarios creados</option>
            <option value="users.profile-updated">Perfil actualizado</option>
            <option value="users.role-changed">Roles actualizados</option>
            <option value="users.status-changed">Estados actualizados</option>
            <option value="users.password-reset">Passwords restablecidos</option>
          </select>
        </div>

        {isAuditLoading && <p className="text-sm text-foreground/70">Cargando auditoria...</p>}
        {!isAuditLoading && audits.length === 0 && <p className="text-sm text-foreground/70">Sin registros para este filtro.</p>}

        {!isAuditLoading && audits.length > 0 && (
          <div className="space-y-2">
            {audits.map((audit) => (
              <div key={audit.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-medium">{auditActionLabel(audit.action)}</p>
                  <p className="text-xs text-foreground/60">{formatDateTime(audit.createdAt)}</p>
                </div>
                <p className="text-xs text-foreground/70">
                  Actor: {audit.actorFullName} ({audit.actorEmail}) - {audit.actorRole}
                </p>
                <p className="text-xs text-foreground/70">
                  Objetivo: {audit.targetFullName} ({audit.targetEmail})
                </p>
                {audit.details && <p className="mt-1 text-xs text-foreground/80">{audit.details}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
