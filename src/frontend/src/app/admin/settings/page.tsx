"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FileText, Mail, MessageCircleMore, Percent, Save, Send, Settings, Truck } from "lucide-react";
import { type ChangeEvent, useEffect, useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/ui/toast";
import {
  getStoreSettings,
  sendTestEmail,
  sendTestWhatsApp,
  updateCompanySettings,
  updatePaymentSettings,
  updateShippingSettings,
  updateTaxSettings,
  updateSunatSettings,
  updateWhatsAppSettings,
  type CompanySettingsDto,
  type PaymentSettingsDto,
  type ShippingSettingsDto,
  type TaxSettingsDto,
  type UpdateSunatSettingsPayload,
  type WhatsAppSettingsDto,
} from "@/lib/admin-api";

const companySchema = z.object({
  companyRuc: z.string().min(1, "RUC requerido").max(20, "Maximo 20 caracteres"),
  companyBusinessName: z.string().min(2, "Razon social requerida").max(180, "Maximo 180 caracteres"),
  storeName: z.string().min(1, "Nombre de tienda requerido").max(50, "Maximo 50 caracteres"),
  companyAddress: z.string().min(5, "Direccion requerida").max(280, "Maximo 280 caracteres"),
  companyPhone: z.string().min(6, "Telefono requerido").max(40, "Maximo 40 caracteres"),
  companyEmail: z.string().email("Correo invalido").min(1, "Correo requerido"),
});

type CompanyFormValues = z.infer<typeof companySchema>;

// ─── Shipping schema ────────────────────────────────────────────────────────

const shippingSchema = z.object({
  freeShippingLima: z.boolean(),
  provinceShippingCost: z.coerce.number().min(0, "El costo debe ser 0 o mayor"),
});

type ShippingFormValues = z.infer<typeof shippingSchema>;

const taxSchema = z.object({
  activeTaxType: z.enum(["IGV", "IVA"]),
  igvRate: z.coerce.number().min(0, "IGV debe ser 0 o mayor").max(100, "IGV no puede superar 100"),
  ivaRate: z.coerce.number().min(0, "IVA debe ser 0 o mayor").max(100, "IVA no puede superar 100"),
  taxIncludedInPrice: z.boolean(),
});

type TaxFormValues = z.infer<typeof taxSchema>;

// ─── Payment schema ─────────────────────────────────────────────────────────

const paymentSchema = z.object({
  paymentGatewayEnabled: z.boolean(),
  orderNotificationEmail: z.string().email("Correo invalido").min(1, "Correo requerido"),
  smtpHost: z.string().min(1, "Host SMTP requerido"),
  smtpPort: z.coerce.number().int().min(1, "Puerto invalido").max(65535, "Puerto invalido"),
  smtpUser: z.string(),
  smtpPassword: z.string(),
  smtpUseSsl: z.boolean(),
  smtpFromEmail: z.string().email("Correo remitente invalido").min(1, "Correo remitente requerido"),
  smtpFromName: z.string().max(120, "Maximo 120 caracteres"),
  yapeApiKey: z.string(),
  yapeSecretKey: z.string(),
  yapeMerchantId: z.string(),
  yapeWebhookSecret: z.string(),
  cardPublicKey: z.string(),
  cardSecretKey: z.string(),
  cardWebhookSecret: z.string(),
  cardProvider: z.enum(["stripe", "mercadopago", ""]),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

const sunatSchema = z.object({
  sunatSolUser: z.string().max(120, "Maximo 120 caracteres"),
  sunatSolPassword: z.string().max(120, "Maximo 120 caracteres"),
  sunatCertificateFileName: z.string().max(260, "Maximo 260 caracteres"),
  sunatCertificatePassword: z.string().max(120, "Maximo 120 caracteres"),
  sunatCertificateBase64: z.string(),
  sunatServiceEndpoint: z.string().max(400, "Maximo 400 caracteres"),
  sunatEnvironment: z.enum(["development", "production"]),
  sunatEstablishmentCode: z.string().regex(/^[0-9]{4}$/, "Debe tener 4 digitos (ej. 0000)"),
  sunatReceiptSeries: z.string().min(1, "Serie requerida").max(10, "Maximo 10 caracteres").regex(/^[A-Za-z0-9-]+$/, "Solo letras, numeros y guion"),
  sunatInvoiceSeries: z.string().min(1, "Serie requerida").max(10, "Maximo 10 caracteres").regex(/^[A-Za-z0-9-]+$/, "Solo letras, numeros y guion"),
  sunatReceiptNextCorrelative: z.coerce.number().int().min(1, "Debe ser 1 o mayor"),
  sunatInvoiceNextCorrelative: z.coerce.number().int().min(1, "Debe ser 1 o mayor"),
  removeCertificate: z.boolean(),
});

type SunatFormValues = z.infer<typeof sunatSchema>;

const whatsAppTokenHelpText = "{{customerName}}, {{orderNumber}}, {{total}}, {{storeName}}, {{paymentStatus}}";

const whatsAppSchema = z.object({
  whatsAppEnabled: z.boolean(),
  whatsAppApiUrl: z.string(),
  whatsAppApiVersion: z.string(),
  whatsAppApiKey: z.string(),
  whatsAppSecretKey: z.string(),
  whatsAppPhoneNumberId: z.string(),
  whatsAppDefaultCountryCode: z.string().max(6, "Maximo 6 caracteres"),
  whatsAppConfirmTemplate: z.string().max(1200, "Maximo 1200 caracteres"),
  whatsAppRejectTemplate: z.string().max(1200, "Maximo 1200 caracteres"),
  testPhone: z.string().max(30, "Maximo 30 caracteres"),
  testMessage: z.string().max(1200, "Maximo 1200 caracteres"),
});

type WhatsAppFormValues = z.infer<typeof whatsAppSchema>;

async function readFileAsBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const [companyMessage, setCompanyMessage] = useState("");
  const [shippingMessage, setShippingMessage] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [smtpTestMessage, setSmtpTestMessage] = useState("");
  const [companyError, setCompanyError] = useState(false);
  const [shippingError, setShippingError] = useState(false);
  const [taxMessage, setTaxMessage] = useState("");
  const [taxError, setTaxError] = useState(false);
  const [paymentError, setPaymentError] = useState(false);
  const [smtpTestError, setSmtpTestError] = useState(false);
  const [sunatMessage, setSunatMessage] = useState("");
  const [sunatError, setSunatError] = useState(false);
  const [savedSunatCertificateName, setSavedSunatCertificateName] = useState("");
  const [whatsAppMessage, setWhatsAppMessage] = useState("");
  const [whatsAppError, setWhatsAppError] = useState(false);
  const [whatsAppTestMessage, setWhatsAppTestMessage] = useState("");
  const [whatsAppTestError, setWhatsAppTestError] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["store-settings"],
    queryFn: getStoreSettings,
  });

  // ── Company form ──────────────────────────────────────────────────────────

  const companyForm = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      companyRuc: "",
      companyBusinessName: "",
      storeName: "",
      companyAddress: "",
      companyPhone: "",
      companyEmail: "",
    },
  });

  const companyMutation = useMutation({
    mutationFn: (payload: CompanySettingsDto) => updateCompanySettings(payload),
    onSuccess: async (updatedSettings) => {
      setCompanyError(false);
      setCompanyMessage("Informacion de empresa guardada correctamente.");
      queryClient.setQueryData(["store-config"], {
        companyRuc: updatedSettings.company.companyRuc,
        companyBusinessName: updatedSettings.company.companyBusinessName,
        storeName: updatedSettings.company.storeName,
        companyAddress: updatedSettings.company.companyAddress,
        companyPhone: updatedSettings.company.companyPhone,
        companyEmail: updatedSettings.company.companyEmail,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["store-config"] }),
      ]);
      toast.success("Informacion de empresa actualizada.");
    },
    onError: (error: Error) => {
      setCompanyError(true);
      setCompanyMessage(error.message || "Error al guardar informacion de empresa.");
      toast.error(error.message || "Error al guardar informacion de empresa.");
    },
  });

  const submitCompany: SubmitHandler<CompanyFormValues> = (values) => {
    setCompanyMessage("");
    companyMutation.mutate(values);
  };

  // ── Shipping form ──────────────────────────────────────────────────────────

  const shippingForm = useForm<ShippingFormValues>({
    resolver: zodResolver(shippingSchema),
    defaultValues: { freeShippingLima: true, provinceShippingCost: 15 },
  });

  const shippingMutation = useMutation({
    mutationFn: (payload: ShippingSettingsDto) => updateShippingSettings(payload),
    onSuccess: async () => {
      setShippingError(false);
      setShippingMessage("Configuracion de envio guardada correctamente.");
      await queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("Configuracion de envio actualizada.");
    },
    onError: (error: Error) => {
      setShippingError(true);
      setShippingMessage(error.message || "Error al guardar configuracion de envio.");
      toast.error(error.message || "Error al guardar configuracion de envio.");
    },
  });

  const submitShipping: SubmitHandler<ShippingFormValues> = (values) => {
    setShippingMessage("");
    shippingMutation.mutate(values);
  };

  // ── Tax form ─────────────────────────────────────────────────────────────

  const taxForm = useForm<TaxFormValues>({
    resolver: zodResolver(taxSchema),
    defaultValues: {
      activeTaxType: "IGV",
      igvRate: 18,
      ivaRate: 12,
      taxIncludedInPrice: true,
    },
  });

  const taxMutation = useMutation({
    mutationFn: (payload: TaxSettingsDto) => updateTaxSettings(payload),
    onSuccess: async () => {
      setTaxError(false);
      setTaxMessage("Configuracion de impuestos guardada correctamente.");
      await queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("Configuracion de impuestos actualizada.");
    },
    onError: (error: Error) => {
      setTaxError(true);
      setTaxMessage(error.message || "Error al guardar configuracion de impuestos.");
      toast.error(error.message || "Error al guardar configuracion de impuestos.");
    },
  });

  const submitTax: SubmitHandler<TaxFormValues> = (values) => {
    setTaxMessage("");
    taxMutation.mutate(values);
  };

  // ── Payment form ────────────────────────────────────────────────────────────

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentGatewayEnabled: false,
      orderNotificationEmail: "jfernandez-20@hotmail.com",
      smtpHost: "",
      smtpPort: 587,
      smtpUser: "",
      smtpPassword: "",
      smtpUseSsl: true,
      smtpFromEmail: "",
      smtpFromName: "",
      yapeApiKey: "",
      yapeSecretKey: "",
      yapeMerchantId: "",
      yapeWebhookSecret: "",
      cardPublicKey: "",
      cardSecretKey: "",
      cardWebhookSecret: "",
      cardProvider: "",
    },
  });

  const gatewayEnabled = paymentForm.watch("paymentGatewayEnabled");

  const sunatForm = useForm<SunatFormValues>({
    resolver: zodResolver(sunatSchema),
    defaultValues: {
      sunatSolUser: "",
      sunatSolPassword: "",
      sunatCertificateFileName: "",
      sunatCertificatePassword: "",
      sunatCertificateBase64: "",
      sunatServiceEndpoint: "",
      sunatEnvironment: "development",
      sunatEstablishmentCode: "0000",
      sunatReceiptSeries: "B001",
      sunatInvoiceSeries: "F001",
      sunatReceiptNextCorrelative: 1,
      sunatInvoiceNextCorrelative: 1,
      removeCertificate: false,
    },
  });

  const whatsAppForm = useForm<WhatsAppFormValues>({
    resolver: zodResolver(whatsAppSchema),
    defaultValues: {
      whatsAppEnabled: false,
      whatsAppApiUrl: "https://graph.facebook.com",
      whatsAppApiVersion: "v21.0",
      whatsAppApiKey: "",
      whatsAppSecretKey: "",
      whatsAppPhoneNumberId: "",
      whatsAppDefaultCountryCode: "51",
      whatsAppConfirmTemplate: "Hola {{customerName}}, tu pedido {{orderNumber}} ya esta en marcha. Total: S/ {{total}}. Gracias por comprar en {{storeName}}. Te escribimos por aqui cuando haya una nueva novedad.",
      whatsAppRejectTemplate: "Hola {{customerName}}, no pudimos validar el pago de tu pedido {{orderNumber}}. Si deseas, responde a este mensaje y lo resolvemos contigo lo antes posible.",
      testPhone: "",
      testMessage: "Hola, esta es una prueba de integracion de WhatsApp desde el panel admin.",
    },
  });

  const whatsAppEnabled = whatsAppForm.watch("whatsAppEnabled");

  const paymentMutation = useMutation({
    mutationFn: (payload: PaymentSettingsDto) => updatePaymentSettings(payload),
    onSuccess: async () => {
      setPaymentError(false);
      setPaymentMessage("Configuracion de pago guardada correctamente.");
      await queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("Configuracion de pago actualizada.");
    },
    onError: (error: Error) => {
      setPaymentError(true);
      setPaymentMessage(error.message || "Error al guardar configuracion de pago.");
      toast.error(error.message || "Error al guardar configuracion de pago.");
    },
  });

  const submitPayment: SubmitHandler<PaymentFormValues> = (values) => {
    setPaymentMessage("");
    paymentMutation.mutate({
      ...values,
      smtpHost: values.smtpHost || undefined,
      smtpUser: values.smtpUser || undefined,
      smtpPassword: values.smtpPassword || undefined,
      smtpFromEmail: values.smtpFromEmail || undefined,
      smtpFromName: values.smtpFromName || undefined,
      cardProvider: values.cardProvider || undefined,
    });
  };

  const sendTestEmailMutation = useMutation({
    mutationFn: (toEmail: string) => sendTestEmail({ toEmail }),
    onSuccess: (result) => {
      setSmtpTestError(false);
      setSmtpTestMessage(result.message || "Correo de prueba enviado correctamente.");
      toast.success(result.message || "Correo de prueba enviado correctamente.");
    },
    onError: (error: Error) => {
      setSmtpTestError(true);
      setSmtpTestMessage(error.message || "No se pudo enviar el correo de prueba.");
      toast.error(error.message || "No se pudo enviar el correo de prueba.");
    },
  });

  const handleSendTestEmail = async () => {
    const isValid = await paymentForm.trigger(["orderNotificationEmail", "smtpHost", "smtpPort", "smtpFromEmail"]);
    if (!isValid) return;

    setSmtpTestMessage("");
    const toEmail = paymentForm.getValues("orderNotificationEmail");
    sendTestEmailMutation.mutate(toEmail);
  };

  const sunatMutation = useMutation({
    mutationFn: (payload: UpdateSunatSettingsPayload) => updateSunatSettings(payload),
    onSuccess: async () => {
      setSunatError(false);
      setSunatMessage("Configuracion SUNAT guardada correctamente.");
      await queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("Configuracion SUNAT actualizada.");
    },
    onError: (error: Error) => {
      setSunatError(true);
      setSunatMessage(error.message || "Error al guardar configuracion SUNAT.");
      toast.error(error.message || "Error al guardar configuracion SUNAT.");
    },
  });

  const submitSunat: SubmitHandler<SunatFormValues> = (values) => {
    setSunatMessage("");

    sunatMutation.mutate({
      sunatSolUser: values.sunatSolUser || undefined,
      sunatSolPassword: values.sunatSolPassword || undefined,
      sunatCertificateFileName: values.sunatCertificateBase64 ? values.sunatCertificateFileName || undefined : undefined,
      sunatCertificatePassword: values.sunatCertificatePassword || undefined,
      sunatCertificateBase64: values.sunatCertificateBase64 || undefined,
      sunatServiceEndpoint: values.sunatServiceEndpoint || undefined,
      sunatEnvironment: values.sunatEnvironment,
      sunatEstablishmentCode: values.sunatEstablishmentCode,
      sunatReceiptSeries: values.sunatReceiptSeries,
      sunatInvoiceSeries: values.sunatInvoiceSeries,
      sunatReceiptNextCorrelative: values.sunatReceiptNextCorrelative,
      sunatInvoiceNextCorrelative: values.sunatInvoiceNextCorrelative,
      removeCertificate: values.removeCertificate,
    });
  };

  const handleSunatCertificateChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await readFileAsBase64(file);
      sunatForm.setValue("sunatCertificateFileName", file.name, { shouldDirty: true });
      sunatForm.setValue("sunatCertificateBase64", base64, { shouldDirty: true });
      sunatForm.setValue("removeCertificate", false, { shouldDirty: true });
      setSavedSunatCertificateName(file.name);
    } catch {
      toast.error("No se pudo leer el certificado seleccionado.");
    } finally {
      event.target.value = "";
    }
  };

  const clearSunatCertificate = () => {
    sunatForm.setValue("sunatCertificateFileName", "", { shouldDirty: true });
    sunatForm.setValue("sunatCertificateBase64", "", { shouldDirty: true });
    sunatForm.setValue("removeCertificate", true, { shouldDirty: true });
    setSavedSunatCertificateName("");
  };

  const whatsAppMutation = useMutation({
    mutationFn: (payload: WhatsAppSettingsDto) => updateWhatsAppSettings(payload),
    onSuccess: async () => {
      setWhatsAppError(false);
      setWhatsAppMessage("Configuracion de WhatsApp guardada correctamente.");
      await queryClient.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("Configuracion de WhatsApp actualizada.");
    },
    onError: (error: Error) => {
      setWhatsAppError(true);
      setWhatsAppMessage(error.message || "Error al guardar configuracion de WhatsApp.");
      toast.error(error.message || "Error al guardar configuracion de WhatsApp.");
    },
  });

  const submitWhatsApp: SubmitHandler<WhatsAppFormValues> = (values) => {
    setWhatsAppMessage("");
    const { testPhone, testMessage, ...payload } = values;
    void testPhone;
    void testMessage;
    whatsAppMutation.mutate({
      ...payload,
      whatsAppApiUrl: payload.whatsAppApiUrl || undefined,
      whatsAppApiVersion: payload.whatsAppApiVersion || undefined,
      whatsAppApiKey: payload.whatsAppApiKey || undefined,
      whatsAppSecretKey: payload.whatsAppSecretKey || undefined,
      whatsAppPhoneNumberId: payload.whatsAppPhoneNumberId || undefined,
      whatsAppDefaultCountryCode: payload.whatsAppDefaultCountryCode || undefined,
      whatsAppConfirmTemplate: payload.whatsAppConfirmTemplate || undefined,
      whatsAppRejectTemplate: payload.whatsAppRejectTemplate || undefined,
    });
  };

  const sendTestWhatsAppMutation = useMutation({
    mutationFn: sendTestWhatsApp,
    onSuccess: (result) => {
      setWhatsAppTestError(false);
      setWhatsAppTestMessage(result.message || "Mensaje de prueba enviado correctamente.");
      toast.success(result.message || "Mensaje de prueba enviado correctamente.");
    },
    onError: (error: Error) => {
      setWhatsAppTestError(true);
      setWhatsAppTestMessage(error.message || "No se pudo enviar el mensaje de prueba.");
      toast.error(error.message || "No se pudo enviar el mensaje de prueba.");
    },
  });

  const handleSendTestWhatsApp = async () => {
    const isValid = await whatsAppForm.trigger(["whatsAppApiUrl", "whatsAppApiVersion", "whatsAppApiKey", "whatsAppPhoneNumberId", "whatsAppDefaultCountryCode", "testPhone", "testMessage"]);
    if (!isValid) return;

    setWhatsAppTestMessage("");
    sendTestWhatsAppMutation.mutate({
      toPhone: whatsAppForm.getValues("testPhone"),
      message: whatsAppForm.getValues("testMessage"),
    });
  };

  // ── Sync from API ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!settings) return;

    companyForm.reset({
      companyRuc: settings.company.companyRuc,
      companyBusinessName: settings.company.companyBusinessName,
      storeName: settings.company.storeName,
      companyAddress: settings.company.companyAddress,
      companyPhone: settings.company.companyPhone,
      companyEmail: settings.company.companyEmail,
    });

    shippingForm.reset({
      freeShippingLima: settings.shipping.freeShippingLima,
      provinceShippingCost: settings.shipping.provinceShippingCost,
    });

    taxForm.reset({
      activeTaxType: settings.tax.activeTaxType,
      igvRate: settings.tax.igvRate,
      ivaRate: settings.tax.ivaRate,
      taxIncludedInPrice: settings.tax.taxIncludedInPrice,
    });

    paymentForm.reset({
      paymentGatewayEnabled: settings.payment.paymentGatewayEnabled,
      orderNotificationEmail: settings.payment.orderNotificationEmail,
      smtpHost: settings.payment.smtpHost ?? "",
      smtpPort: settings.payment.smtpPort,
      smtpUser: settings.payment.smtpUser ?? "",
      smtpPassword: settings.payment.smtpPassword ?? "",
      smtpUseSsl: settings.payment.smtpUseSsl,
      smtpFromEmail: settings.payment.smtpFromEmail ?? "",
      smtpFromName: settings.payment.smtpFromName ?? "",
      yapeApiKey: settings.payment.yapeApiKey ?? "",
      yapeSecretKey: settings.payment.yapeSecretKey ?? "",
      yapeMerchantId: settings.payment.yapeMerchantId ?? "",
      yapeWebhookSecret: settings.payment.yapeWebhookSecret ?? "",
      cardPublicKey: settings.payment.cardPublicKey ?? "",
      cardSecretKey: settings.payment.cardSecretKey ?? "",
      cardWebhookSecret: settings.payment.cardWebhookSecret ?? "",
      cardProvider: (settings.payment.cardProvider as "" | "stripe" | "mercadopago") ?? "",
    });

    sunatForm.reset({
      sunatSolUser: settings.sunat.sunatSolUser ?? "",
      sunatSolPassword: settings.sunat.sunatSolPassword ?? "",
      sunatCertificateFileName: "",
      sunatCertificatePassword: "",
      sunatCertificateBase64: "",
      sunatServiceEndpoint: settings.sunat.sunatServiceEndpoint ?? "",
      sunatEnvironment: settings.sunat.sunatEnvironment ?? "development",
      sunatEstablishmentCode: settings.sunat.sunatEstablishmentCode ?? "0000",
      sunatReceiptSeries: settings.sunat.sunatReceiptSeries,
      sunatInvoiceSeries: settings.sunat.sunatInvoiceSeries,
      sunatReceiptNextCorrelative: settings.sunat.sunatReceiptNextCorrelative,
      sunatInvoiceNextCorrelative: settings.sunat.sunatInvoiceNextCorrelative,
      removeCertificate: false,
    });
    setSavedSunatCertificateName(settings.sunat.sunatCertificateFileName ?? "");

    whatsAppForm.reset({
      whatsAppEnabled: settings.whatsApp.whatsAppEnabled,
      whatsAppApiUrl: settings.whatsApp.whatsAppApiUrl ?? "https://graph.facebook.com",
      whatsAppApiVersion: settings.whatsApp.whatsAppApiVersion ?? "v21.0",
      whatsAppApiKey: settings.whatsApp.whatsAppApiKey ?? "",
      whatsAppSecretKey: settings.whatsApp.whatsAppSecretKey ?? "",
      whatsAppPhoneNumberId: settings.whatsApp.whatsAppPhoneNumberId ?? "",
      whatsAppDefaultCountryCode: settings.whatsApp.whatsAppDefaultCountryCode ?? "51",
      whatsAppConfirmTemplate: settings.whatsApp.whatsAppConfirmTemplate ?? "Hola {{customerName}}, tu pedido {{orderNumber}} ya esta en marcha. Total: S/ {{total}}. Gracias por comprar en {{storeName}}. Te escribimos por aqui cuando haya una nueva novedad.",
      whatsAppRejectTemplate: settings.whatsApp.whatsAppRejectTemplate ?? "Hola {{customerName}}, no pudimos validar el pago de tu pedido {{orderNumber}}. Si deseas, responde a este mensaje y lo resolvemos contigo lo antes posible.",
      testPhone: whatsAppForm.getValues("testPhone"),
      testMessage: whatsAppForm.getValues("testMessage"),
    });
  }, [settings, companyForm, shippingForm, taxForm, paymentForm, sunatForm, whatsAppForm]);

  if (isLoading) {
    return (
      <AdminShell title="Configuracion" description="Envios, pagos y preferencias generales de la tienda.">
        <p className="text-sm text-foreground/60">Cargando configuracion...</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Configuracion" description="Envios, pagos y preferencias generales de la tienda.">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* ── Company ─────────────────────────────────────────────────── */}
        <details open className="group rounded-lg border border-border bg-background [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-4 hover:bg-muted/40 transition">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Settings size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm">Informacion de Empresa</p>
                <p className="text-xs text-foreground/55">Datos publicos del pie de pagina y libro de reclamaciones</p>
              </div>
            </div>
            <ChevronDown size={18} className="text-foreground/40 transition-transform group-open:rotate-180" />
          </summary>

          <form onSubmit={companyForm.handleSubmit(submitCompany)} className="border-t border-border px-5 pb-5 pt-4 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">RUC</label>
                <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...companyForm.register("companyRuc")} />
                {companyForm.formState.errors.companyRuc && <p className="text-xs text-red-600">{companyForm.formState.errors.companyRuc.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Correo</label>
                <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...companyForm.register("companyEmail")} />
                {companyForm.formState.errors.companyEmail && <p className="text-xs text-red-600">{companyForm.formState.errors.companyEmail.message}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-semibold">Razon social</label>
                <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...companyForm.register("companyBusinessName")} />
                {companyForm.formState.errors.companyBusinessName && <p className="text-xs text-red-600">{companyForm.formState.errors.companyBusinessName.message}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-semibold">Nombre de la tienda (visible para clientes)</label>
                <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...companyForm.register("storeName")} />
                {companyForm.formState.errors.storeName && <p className="text-xs text-red-600">{companyForm.formState.errors.storeName.message}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-semibold">Direccion</label>
                <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...companyForm.register("companyAddress")} />
                {companyForm.formState.errors.companyAddress && <p className="text-xs text-red-600">{companyForm.formState.errors.companyAddress.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Telefono</label>
                <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...companyForm.register("companyPhone")} />
                {companyForm.formState.errors.companyPhone && <p className="text-xs text-red-600">{companyForm.formState.errors.companyPhone.message}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button disabled={companyMutation.isPending}>
                <Save size={16} /> {companyMutation.isPending ? "Guardando..." : "Guardar empresa"}
              </Button>
              {companyMessage && (
                <p className={`text-sm ${companyError ? "text-red-600" : "text-green-600"}`}>{companyMessage}</p>
              )}
            </div>
          </form>
        </details>

        {/* ── Shipping ─────────────────────────────────────────────────── */}
        <details open className="group rounded-lg border border-border bg-background [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-4 hover:bg-muted/40 transition">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Truck size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm">Configuracion de Envio</p>
                <p className="text-xs text-foreground/55">Costos y cobertura de despacho</p>
              </div>
            </div>
            <ChevronDown size={18} className="text-foreground/40 transition-transform group-open:rotate-180" />
          </summary>

          <form onSubmit={shippingForm.handleSubmit(submitShipping)} className="border-t border-border px-5 pb-5 pt-4 space-y-5">
            {/* Lima (always free, just a visual toggle) */}
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Envio dentro de Lima</p>
                <p className="text-xs text-foreground/55 mt-0.5">Activa o desactiva el envio gratis para Lima Metropolitana</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="peer sr-only" {...shippingForm.register("freeShippingLima")} />
                <div className="h-6 w-11 rounded-full bg-border transition peer-checked:bg-accent after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
                <span className="text-sm font-medium">{shippingForm.watch("freeShippingLima") ? "Gratis" : "Con costo"}</span>
              </label>
            </div>

            {/* Province cost */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Costo de envio a Provincias (S/)</label>
              <p className="text-xs text-foreground/55">Aplica cuando el destinatario esta fuera de Lima Metropolitana</p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-foreground/60">S/</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-36 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="15.00"
                  {...shippingForm.register("provinceShippingCost")}
                />
              </div>
              {shippingForm.formState.errors.provinceShippingCost && (
                <p className="text-xs text-red-600">{shippingForm.formState.errors.provinceShippingCost.message}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button disabled={shippingMutation.isPending}>
                <Save size={16} /> {shippingMutation.isPending ? "Guardando..." : "Guardar envio"}
              </Button>
              {shippingMessage && (
                <p className={`text-sm ${shippingError ? "text-red-600" : "text-green-600"}`}>{shippingMessage}</p>
              )}
            </div>
          </form>
        </details>

        {/* ── Tax ──────────────────────────────────────────────────────── */}
        <details open className="group rounded-lg border border-border bg-background [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-4 hover:bg-muted/40 transition">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Percent size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm">Configuracion de Impuestos</p>
                <p className="text-xs text-foreground/55">Activa solo un impuesto (IGV o IVA) y define si el precio ya lo incluye</p>
              </div>
            </div>
            <ChevronDown size={18} className="text-foreground/40 transition-transform group-open:rotate-180" />
          </summary>

          <form onSubmit={taxForm.handleSubmit(submitTax)} className="border-t border-border px-5 pb-5 pt-4 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Impuesto activo</label>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...taxForm.register("activeTaxType")}>
                  <option value="IGV">IGV</option>
                  <option value="IVA">IVA</option>
                </select>
                <p className="text-xs text-foreground/55">Solo uno puede estar activo a la vez.</p>
              </div>

              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Impuesto incluido en precio</p>
                  <p className="text-xs text-foreground/55 mt-0.5">Recomendado en ecommerce: el cliente ya ve precio final.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="peer sr-only" {...taxForm.register("taxIncludedInPrice")} />
                  <div className="h-6 w-11 rounded-full bg-border transition peer-checked:bg-accent after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Tasa IGV (%)</label>
                <input type="number" min={0} max={100} step="0.01" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...taxForm.register("igvRate")} />
                {taxForm.formState.errors.igvRate && <p className="text-xs text-red-600">{taxForm.formState.errors.igvRate.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Tasa IVA (%)</label>
                <input type="number" min={0} max={100} step="0.01" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...taxForm.register("ivaRate")} />
                {taxForm.formState.errors.ivaRate && <p className="text-xs text-red-600">{taxForm.formState.errors.ivaRate.message}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button disabled={taxMutation.isPending}>
                <Save size={16} /> {taxMutation.isPending ? "Guardando..." : "Guardar impuestos"}
              </Button>
              {taxMessage && (
                <p className={`text-sm ${taxError ? "text-red-600" : "text-green-600"}`}>{taxMessage}</p>
              )}
            </div>
          </form>
        </details>

        {/* ── Payment ──────────────────────────────────────────────────── */}
        <details open className="group rounded-lg border border-border bg-background [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-4 hover:bg-muted/40 transition">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Settings size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm">Metodos de Pago</p>
                <p className="text-xs text-foreground/55">Pasarela de pago, Yape, tarjeta y notificaciones</p>
              </div>
            </div>
            <ChevronDown size={18} className="text-foreground/40 transition-transform group-open:rotate-180" />
          </summary>

          <form onSubmit={paymentForm.handleSubmit(submitPayment)} className="border-t border-border px-5 pb-5 pt-4 space-y-6">

            {/* Gateway toggle */}
            <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Activar pasarela de pago</p>
                <p className="text-xs text-foreground/55 mt-0.5">
                  Si esta desactivado, el pedido llega por correo sin cobro en linea.
                  Si esta activado, el cliente paga con Yape o tarjeta directamente en el checkout.
                </p>
              </div>
              <label className="relative mt-0.5 inline-flex shrink-0 cursor-pointer items-center gap-2">
                <input type="checkbox" className="peer sr-only" {...paymentForm.register("paymentGatewayEnabled")} />
                <div className="h-6 w-11 rounded-full bg-border transition peer-checked:bg-accent after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
              </label>
            </div>

            {/* Notification email (always visible) */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Correo de notificacion de pedidos</label>
              <p className="text-xs text-foreground/55">
                Cuando la pasarela esta desactivada, cada pedido llega a este correo con todos los detalles.
              </p>
              <input
                type="email"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="admin@tienda.com"
                {...paymentForm.register("orderNotificationEmail")}
              />
              {paymentForm.formState.errors.orderNotificationEmail && (
                <p className="text-xs text-red-600">{paymentForm.formState.errors.orderNotificationEmail.message}</p>
              )}
            </div>

            {/* SMTP config */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
                  <Mail size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Infraestructura SMTP</p>
                  <p className="text-xs text-foreground/55 mt-0.5">
                    Configura el servidor de correo para que el sistema envie automaticamente el detalle del pedido cuando la pasarela este desactivada.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-foreground/60">SMTP Host</label>
                  <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="smtp.gmail.com" {...paymentForm.register("smtpHost")} />
                  {paymentForm.formState.errors.smtpHost && <p className="mt-1 text-xs text-red-600">{paymentForm.formState.errors.smtpHost.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-foreground/60">Puerto</label>
                  <input type="number" min={1} max={65535} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="587" {...paymentForm.register("smtpPort")} />
                  {paymentForm.formState.errors.smtpPort && <p className="mt-1 text-xs text-red-600">{paymentForm.formState.errors.smtpPort.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-foreground/60">Usuario (opcional)</label>
                  <input type="text" autoComplete="off" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="usuario@dominio.com" {...paymentForm.register("smtpUser")} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-foreground/60">Password (opcional)</label>
                  <input type="password" autoComplete="new-password" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="••••••••" {...paymentForm.register("smtpPassword")} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-foreground/60">Correo remitente</label>
                  <input type="email" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="ventas@tu-tienda.com" {...paymentForm.register("smtpFromEmail")} />
                  {paymentForm.formState.errors.smtpFromEmail && <p className="mt-1 text-xs text-red-600">{paymentForm.formState.errors.smtpFromEmail.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-foreground/60">Nombre remitente (opcional)</label>
                  <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Nombre de tu tienda" {...paymentForm.register("smtpFromName")} />
                  {paymentForm.formState.errors.smtpFromName && <p className="mt-1 text-xs text-red-600">{paymentForm.formState.errors.smtpFromName.message}</p>}
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4 rounded border-border" {...paymentForm.register("smtpUseSsl")} />
                Usar SSL/TLS
              </label>

              <div className="rounded-md border border-dashed border-border bg-background px-3 py-3">
                <p className="text-xs text-foreground/60">
                  Verifica tu configuracion SMTP enviando un correo de prueba al correo de notificacion configurado.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Button type="button" variant="secondary" onClick={handleSendTestEmail} disabled={sendTestEmailMutation.isPending}>
                    {sendTestEmailMutation.isPending ? "Enviando prueba..." : "Enviar correo de prueba"}
                  </Button>
                  <span className="text-xs text-foreground/55">Destino: {paymentForm.watch("orderNotificationEmail") || "No definido"}</span>
                </div>
                {smtpTestMessage && (
                  <p className={`mt-2 text-xs ${smtpTestError ? "text-red-600" : "text-green-600"}`}>{smtpTestMessage}</p>
                )}
              </div>
            </div>

            {/* Gateway config — only visible when enabled */}
            {gatewayEnabled && (
              <div className="space-y-6 rounded-md border border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Configuracion de pasarela</p>

                {/* Yape */}
                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-white text-[10px] font-black">Y</span>
                    Yape
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-foreground/60">API Key</label>
                      <input type="password" autoComplete="off" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="yape_api_key_..." {...paymentForm.register("yapeApiKey")} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-foreground/60">Secret Key</label>
                      <input type="password" autoComplete="off" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="yape_secret_..." {...paymentForm.register("yapeSecretKey")} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-foreground/60">Merchant ID</label>
                      <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="merchant_id" {...paymentForm.register("yapeMerchantId")} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-foreground/60">Webhook Secret</label>
                      <input type="password" autoComplete="off" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="whsec_..." {...paymentForm.register("yapeWebhookSecret")} />
                    </div>
                  </div>
                </fieldset>

                {/* Card */}
                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white text-[10px] font-black">$</span>
                    Tarjeta de credito / debito
                  </legend>
                  <div className="space-y-2">
                    <label className="text-xs text-foreground/60">Proveedor</label>
                    <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...paymentForm.register("cardProvider")}>
                      <option value="">Selecciona proveedor</option>
                      <option value="stripe">Stripe</option>
                      <option value="mercadopago">Mercado Pago</option>
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-foreground/60">Public Key</label>
                      <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="pk_live_..." {...paymentForm.register("cardPublicKey")} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-foreground/60">Secret Key</label>
                      <input type="password" autoComplete="off" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="sk_live_..." {...paymentForm.register("cardSecretKey")} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs text-foreground/60">Webhook Secret</label>
                      <input type="password" autoComplete="off" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="whsec_..." {...paymentForm.register("cardWebhookSecret")} />
                    </div>
                  </div>
                </fieldset>
              </div>
            )}

            {!gatewayEnabled && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <p className="font-semibold">Modo sin pasarela activo</p>
                <p className="mt-0.5 text-xs">
                  Cada pedido enviara un correo con todos los detalles a <strong>{paymentForm.watch("orderNotificationEmail") || "el correo configurado"}</strong>. Podras activar la pasarela cuando tengas las credenciales listas.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button disabled={paymentMutation.isPending}>
                <Save size={16} /> {paymentMutation.isPending ? "Guardando..." : "Guardar pagos"}
              </Button>
              {paymentMessage && (
                <p className={`text-sm ${paymentError ? "text-red-600" : "text-green-600"}`}>{paymentMessage}</p>
              )}
            </div>
          </form>
        </details>

        <details open className="group rounded-lg border border-border bg-background [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-4 hover:bg-muted/40 transition">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">
                <FileText size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm">Configuracion SUNAT</p>
                <p className="text-xs text-foreground/55">Credenciales SOL, certificado digital y numeracion para boletas y facturas</p>
              </div>
            </div>
            <ChevronDown size={18} className="text-foreground/40 transition-transform group-open:rotate-180" />
          </summary>

          <form onSubmit={sunatForm.handleSubmit(submitSunat)} className="border-t border-border px-5 pb-5 pt-4 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-foreground/60">Usuario SOL</label>
                <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="MODDATOS" {...sunatForm.register("sunatSolUser")} />
                {sunatForm.formState.errors.sunatSolUser && <p className="mt-1 text-xs text-red-600">{sunatForm.formState.errors.sunatSolUser.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs text-foreground/60">Clave SOL</label>
                <input type="password" autoComplete="new-password" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="••••••••" {...sunatForm.register("sunatSolPassword")} />
                {sunatForm.formState.errors.sunatSolPassword && <p className="mt-1 text-xs text-red-600">{sunatForm.formState.errors.sunatSolPassword.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-foreground/60">Endpoint del servicio SUNAT</label>
                <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="https://api.sunat.gob.pe" {...sunatForm.register("sunatServiceEndpoint")} />
                {sunatForm.formState.errors.sunatServiceEndpoint && <p className="mt-1 text-xs text-red-600">{sunatForm.formState.errors.sunatServiceEndpoint.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs text-foreground/60">Entorno SUNAT</label>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...sunatForm.register("sunatEnvironment")}>
                  <option value="development">Desarrollo</option>
                  <option value="production">Produccion</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-foreground/60">Codigo local anexo</label>
                <input type="text" maxLength={4} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="0000" {...sunatForm.register("sunatEstablishmentCode")} />
                {sunatForm.formState.errors.sunatEstablishmentCode && <p className="mt-1 text-xs text-red-600">{sunatForm.formState.errors.sunatEstablishmentCode.message}</p>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Certificado digital</p>
                  <p className="mt-1 text-xs text-foreground/55">Sube el certificado que usara la integracion de comprobantes electronicos.</p>
                </div>
                {savedSunatCertificateName && (
                  <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground/65">{savedSunatCertificateName}</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium">
                  <input type="file" accept=".pfx,.p12,.cer,.pem" className="hidden" onChange={handleSunatCertificateChange} />
                  Subir certificado
                </label>
                <Button type="button" variant="secondary" onClick={clearSunatCertificate} disabled={!savedSunatCertificateName && !sunatForm.watch("sunatCertificateBase64")}>
                  Quitar certificado
                </Button>
              </div>

              <div>
                <label className="mb-1 block text-xs text-foreground/60">Clave del certificado</label>
                <input type="password" autoComplete="new-password" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Clave del .pfx/.p12" {...sunatForm.register("sunatCertificatePassword")} />
                {sunatForm.formState.errors.sunatCertificatePassword && <p className="mt-1 text-xs text-red-600">{sunatForm.formState.errors.sunatCertificatePassword.message}</p>}
              </div>

              {sunatForm.formState.errors.sunatCertificateFileName && <p className="text-xs text-red-600">{sunatForm.formState.errors.sunatCertificateFileName.message}</p>}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold">Boleta</p>
                  <p className="mt-1 text-xs text-foreground/55">Serie y siguiente correlativo para comprobantes tipo boleta.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-foreground/60">Serie de boleta</label>
                    <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm uppercase" placeholder="B001" {...sunatForm.register("sunatReceiptSeries")} />
                    {sunatForm.formState.errors.sunatReceiptSeries && <p className="mt-1 text-xs text-red-600">{sunatForm.formState.errors.sunatReceiptSeries.message}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-foreground/60">Correlativo inicial</label>
                    <input type="number" min={1} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...sunatForm.register("sunatReceiptNextCorrelative")} />
                    {sunatForm.formState.errors.sunatReceiptNextCorrelative && <p className="mt-1 text-xs text-red-600">{sunatForm.formState.errors.sunatReceiptNextCorrelative.message}</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold">Factura</p>
                  <p className="mt-1 text-xs text-foreground/55">Serie y siguiente correlativo para comprobantes tipo factura.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-foreground/60">Serie de factura</label>
                    <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm uppercase" placeholder="F001" {...sunatForm.register("sunatInvoiceSeries")} />
                    {sunatForm.formState.errors.sunatInvoiceSeries && <p className="mt-1 text-xs text-red-600">{sunatForm.formState.errors.sunatInvoiceSeries.message}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-foreground/60">Correlativo inicial</label>
                    <input type="number" min={1} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...sunatForm.register("sunatInvoiceNextCorrelative")} />
                    {sunatForm.formState.errors.sunatInvoiceNextCorrelative && <p className="mt-1 text-xs text-red-600">{sunatForm.formState.errors.sunatInvoiceNextCorrelative.message}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button disabled={sunatMutation.isPending}>
                <Save size={16} /> {sunatMutation.isPending ? "Guardando..." : "Guardar SUNAT"}
              </Button>
              {sunatMessage && <p className={`text-sm ${sunatError ? "text-red-600" : "text-green-600"}`}>{sunatMessage}</p>}
            </div>
          </form>
        </details>

        <details open className="group rounded-lg border border-border bg-background [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-4 hover:bg-muted/40 transition">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">
                <MessageCircleMore size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm">WhatsApp Business</p>
                <p className="text-xs text-foreground/55">Credenciales, plantillas y prueba directa de integracion</p>
              </div>
            </div>
            <ChevronDown size={18} className="text-foreground/40 transition-transform group-open:rotate-180" />
          </summary>

          <form onSubmit={whatsAppForm.handleSubmit(submitWhatsApp)} className="border-t border-border px-5 pb-5 pt-4 space-y-6">
            <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Activar envio de WhatsApp</p>
                <p className="text-xs text-foreground/55 mt-0.5">
                  Usa la API oficial para enviar mensajes de pedido aprobado o pago en revision desde la pantalla de ordenes.
                </p>
              </div>
              <label className="relative mt-0.5 inline-flex shrink-0 cursor-pointer items-center gap-2">
                <input type="checkbox" className="peer sr-only" {...whatsAppForm.register("whatsAppEnabled")} />
                <div className="h-6 w-11 rounded-full bg-border transition peer-checked:bg-accent after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-foreground/60">API base URL</label>
                <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="https://graph.facebook.com" {...whatsAppForm.register("whatsAppApiUrl")} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-foreground/60">Version API</label>
                <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="v21.0" {...whatsAppForm.register("whatsAppApiVersion")} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-foreground/60">API key / access token</label>
                <input type="password" autoComplete="off" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="EAAG..." {...whatsAppForm.register("whatsAppApiKey")} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-foreground/60">Clave secreta (opcional)</label>
                <input type="password" autoComplete="off" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="App secret o clave interna" {...whatsAppForm.register("whatsAppSecretKey")} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-foreground/60">Phone Number ID</label>
                <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="123456789012345" {...whatsAppForm.register("whatsAppPhoneNumberId")} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-foreground/60">Codigo de pais por defecto</label>
                <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="51" {...whatsAppForm.register("whatsAppDefaultCountryCode")} />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold">Plantillas operativas</p>
                <p className="mt-1 text-xs text-foreground/55">Tokens disponibles: {whatsAppTokenHelpText}</p>
              </div>
              <div className="grid gap-3">
                <div>
                  <label className="mb-1 block text-xs text-foreground/60">Mensaje cuando el pedido queda aprobado</label>
                  <textarea className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...whatsAppForm.register("whatsAppConfirmTemplate")} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-foreground/60">Mensaje cuando el pago queda en revision</label>
                  <textarea className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...whatsAppForm.register("whatsAppRejectTemplate")} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-border bg-background p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
                  <Send size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Prueba de integracion</p>
                  <p className="text-xs text-foreground/55 mt-0.5">Guarda credenciales y luego dispara un mensaje real al numero que indiques.</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-foreground/60">Telefono destino</label>
                  <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="987654321" {...whatsAppForm.register("testPhone")} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-foreground/60">Mensaje de prueba</label>
                  <textarea className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...whatsAppForm.register("testMessage")} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="secondary" onClick={handleSendTestWhatsApp} disabled={sendTestWhatsAppMutation.isPending || !whatsAppEnabled}>
                  {sendTestWhatsAppMutation.isPending ? "Enviando prueba..." : "Enviar WhatsApp de prueba"}
                </Button>
                {!whatsAppEnabled && <span className="text-xs text-amber-700">Activa WhatsApp para poder enviar pruebas.</span>}
              </div>
              {whatsAppTestMessage && <p className={`text-xs ${whatsAppTestError ? "text-red-600" : "text-green-600"}`}>{whatsAppTestMessage}</p>}
            </div>

            <div className="flex items-center gap-3">
              <Button disabled={whatsAppMutation.isPending}>
                <Save size={16} /> {whatsAppMutation.isPending ? "Guardando..." : "Guardar WhatsApp"}
              </Button>
              {whatsAppMessage && <p className={`text-sm ${whatsAppError ? "text-red-600" : "text-green-600"}`}>{whatsAppMessage}</p>}
            </div>
          </form>
        </details>

      </div>
    </AdminShell>
  );
}
