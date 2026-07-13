"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, ImagePlus, Power, Save, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/ui/toast";
import { createBanner, deleteBanner, listBanners, setBannerStatus, updateBanner, type BannerDto } from "@/lib/admin-api";

const schema = z.object({
  title: z.string().min(3, "Titulo requerido"),
  subtitle: z.string().optional().default(""),
  imageUrl: z.string().min(1, "Selecciona una imagen o pega una URL"),
  linkUrl: z.string().optional(),
  placement: z.string().min(2).default("home"),
  sortOrder: z.coerce.number().int().min(0),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  isActive: z.boolean().default(true)
});

type FormValues = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;
const defaults: FormValues = { title: "", subtitle: "", imageUrl: "", linkUrl: "#productos", placement: "home", sortOrder: 0, startsAt: "", endsAt: "", isActive: true };
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const REQUIRED_BANNER_WIDTH = 1717;
const REQUIRED_BANNER_HEIGHT = 916;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      reject(new Error("No se pudo leer la resolucion de la imagen."));
      URL.revokeObjectURL(objectUrl);
    };

    image.src = objectUrl;
  });
}

const toDateInput = (value?: string) => value ? new Date(value).toISOString().slice(0, 10) : "";
const toApiDate = (value?: string) => value ? new Date(value).toISOString() : undefined;

export default function AdminBannersPage() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState<BannerDto | null>(null);
  const [apiError, setApiError] = useState("");
  const { data: banners = [], isLoading } = useQuery({ queryKey: ["banners"], queryFn: listBanners });
  const form = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const imageUrl = form.watch("imageUrl");
  const hasActiveHomeDefault = banners.some((banner) => banner.isActive && banner.placement === "home-default");

  const resetForm = () => {
    setEditing(null);
    setApiError("");
    form.reset(defaults);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const createMutation = useMutation({ mutationFn: createBanner, onSuccess: async () => { resetForm(); await queryClient.invalidateQueries({ queryKey: ["banners"] }); toast.success("Banner registrado correctamente."); }, onError: (error: Error) => { setApiError(error.message); toast.error(error.message); } });
  const updateMutation = useMutation({ mutationFn: updateBanner, onSuccess: async () => { resetForm(); await queryClient.invalidateQueries({ queryKey: ["banners"] }); toast.success("Banner actualizado correctamente."); }, onError: (error: Error) => { setApiError(error.message); toast.error(error.message); } });

  const submit: SubmitHandler<FormValues> = (values) => {
    const payload = { ...values, subtitle: values.subtitle || "", linkUrl: values.linkUrl || undefined, startsAt: toApiDate(values.startsAt), endsAt: toApiDate(values.endsAt) };
    if (editing) updateMutation.mutate({ ...payload, id: editing.id });
    else createMutation.mutate(payload);
  };

  const startEdit = (banner: BannerDto) => {
    setEditing(banner);
    setApiError("");
    form.reset({ title: banner.title, subtitle: banner.subtitle, imageUrl: banner.imageUrl, linkUrl: banner.linkUrl ?? "", placement: banner.placement, sortOrder: banner.sortOrder, startsAt: toDateInput(banner.startsAt), endsAt: toDateInput(banner.endsAt), isActive: banner.isActive });
  };

  const loadImage = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE_BYTES)
    {
      setApiError("La imagen supera 2 MB. Comprime la imagen o usa una URL externa.");
      return;
    }

    // try {
    //   const { width, height } = await getImageDimensions(file);
    //   if (width !== REQUIRED_BANNER_WIDTH || height !== REQUIRED_BANNER_HEIGHT)
    //   {
    //     setApiError(`La imagen debe ser exactamente de ${REQUIRED_BANNER_WIDTH}x${REQUIRED_BANNER_HEIGHT}px. Imagen actual: ${width}x${height}px.`);
    //     return;
    //   }
    // } catch (error) {
    //   setApiError(error instanceof Error ? error.message : "No se pudo validar la imagen.");
    //   return;
    // }

    setApiError("");
    form.setValue("imageUrl", await fileToDataUrl(file), { shouldValidate: true });
  };

  return (
    <AdminShell title="Banners" description="Campañas visuales para home, temporada y ropa reciente.">
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form onSubmit={form.handleSubmit(submit)} className="rounded-md border border-border p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="font-bold">{editing ? "Editar banner" : "Crear banner"}</h2><div className="flex gap-2"><Button disabled={createMutation.isPending || updateMutation.isPending}><Save size={18} /> {editing ? "Actualizar" : "Guardar"}</Button>{editing && <Button type="button" variant="secondary" onClick={resetForm}><X size={18} /> Cancelar</Button>}</div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <input className="rounded-md border border-border bg-background p-3" placeholder="Titulo" {...form.register("title")} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="Link destino" {...form.register("linkUrl")} />
            <input className="rounded-md border border-border bg-background p-3" placeholder="Ubicacion" list="banner-placement-options" {...form.register("placement")} />
            <datalist id="banner-placement-options">
              <option value="home" />
              <option value="home-default" />
              <option value="recientes" />
            </datalist>
            <input className="rounded-md border border-border bg-background p-3" placeholder="Orden" type="number" {...form.register("sortOrder")} />
            <input className="rounded-md border border-border bg-background p-3" type="date" {...form.register("startsAt")} />
            <input className="rounded-md border border-border bg-background p-3" type="date" {...form.register("endsAt")} />
            <input className="rounded-md border border-border bg-background p-3 sm:col-span-2" placeholder="Imagen URL" {...form.register("imageUrl")} />
            <textarea className="min-h-24 rounded-md border border-border bg-background p-3 sm:col-span-2" placeholder="Texto del banner" {...form.register("subtitle")} />
          </div>
          {Object.values(form.formState.errors)[0]?.message && <p className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-600">{Object.values(form.formState.errors)[0]?.message}</p>}
          {apiError && <p className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-600">{apiError}</p>}
          {!hasActiveHomeDefault && <p className="mt-4 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700">No hay banner activo con ubicacion home-default. Crea uno para el respaldo fijo de la home.</p>}
        </form>
        <aside className="rounded-md border border-border p-5">
          <h2 className="font-bold">Imagen</h2>
          <p className="mt-2 text-xs text-foreground/60">Medida exacta requerida: 1717 x 916 px (16:9). Tamano maximo: 2 MB.</p>
          <p className="mt-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700">
            Recomendacion: sube una imagen limpia, sin texto incrustado ni etiquetas promocionales, para mantener un resultado visual profesional en home.
          </p>
          <label className="relative mt-4 flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-md border border-dashed border-border bg-muted text-center text-foreground/60">
            {imageUrl ? <ProductImage src={imageUrl} alt="Preview banner" fill className="object-contain" /> : <><ImagePlus size={34} /><span className="text-sm font-medium">Seleccionar imagen</span></>}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => loadImage(event.target.files?.[0])} />
          </label>
        </aside>
      </section>
      <section className="mt-8 overflow-hidden rounded-md border border-border"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr><th className="p-3">Banner</th><th className="p-3">Ubicacion</th><th className="p-3">Orden</th><th className="p-3">Estado</th><th className="p-3">Acciones</th></tr></thead><tbody>{isLoading && <tr><td className="p-3" colSpan={5}>Cargando banners...</td></tr>}{!isLoading && banners.length === 0 && <tr><td className="p-3" colSpan={5}>No hay banners registrados.</td></tr>}{banners.map((banner) => <tr key={banner.id} className="border-t border-border"><td className="p-3 font-semibold">{banner.title}</td><td className="p-3">{banner.placement}</td><td className="p-3">{banner.sortOrder}</td><td className="p-3">{banner.isActive ? "Activo" : "Inactivo"}</td><td className="flex gap-2 p-3"><Button variant="ghost" onClick={() => startEdit(banner)} aria-label="Editar banner"><Edit3 size={16} /></Button><Button variant="ghost" onClick={() => setBannerStatus(banner.id, !banner.isActive).then(() => { queryClient.invalidateQueries({ queryKey: ["banners"] }); toast.success(`Banner ${banner.isActive ? "desactivado" : "activado"} correctamente.`); }).catch((error: Error) => { setApiError(error.message); toast.error(error.message); })}><Power size={16} /></Button><Button variant="ghost" onClick={() => confirm("Eliminar banner?") && deleteBanner(banner.id).then(() => { queryClient.invalidateQueries({ queryKey: ["banners"] }); toast.success("Banner eliminado correctamente."); }).catch((error: Error) => { setApiError(error.message); toast.error(error.message); })}><Trash2 size={16} /></Button></td></tr>)}</tbody></table></section>
    </AdminShell>
  );
}