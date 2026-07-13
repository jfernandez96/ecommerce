"use client";

import { useEffect, useState } from "react";
import { Bot, CircleCheck, Sparkles } from "lucide-react";

type AssistantStatusDetail = {
  active: boolean;
  listening: boolean;
  speaking: boolean;
};

export function AssistantHeroBanner() {
  const [status, setStatus] = useState<AssistantStatusDetail>({ active: false, listening: false, speaking: false });

  const activateAssistant = () => {
    window.dispatchEvent(new Event("nova:activate-assistant"));
  };

  useEffect(() => {
    const onAssistantStatus = (event: Event) => {
      const customEvent = event as CustomEvent<AssistantStatusDetail>;
      if (!customEvent.detail) return;
      setStatus(customEvent.detail);
    };

    window.addEventListener("nova:assistant-status", onAssistantStatus as EventListener);
    return () => {
      window.removeEventListener("nova:assistant-status", onAssistantStatus as EventListener);
    };
  }, []);

  const buttonLabel = status.listening ? "Escuchando..." : status.speaking ? "Respondiendo..." : status.active ? "Asistente activo" : "Probar ahora";

  return (
    <aside className="absolute right-6 bottom-3 z-20 hidden w-[352px] overflow-hidden bg-white/96 p-5 text-[#1F2A37] shadow-[0_20px_45px_rgba(15,23,42,0.18)] lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.2),transparent_42%)]" />

      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white shadow-lg">
              <Bot size={21} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5A6574]">Nuevo <Sparkles size={12} className="inline-block text-fuchsia-500" /></p>
              <p className="text-[38px] font-black leading-none text-[#111827]">Nova IA <span className="text-indigo-600">Stylist</span></p>
              <p className="mt-1 text-sm font-medium text-[#4F5E72]">Tu asesora de moda inteligente</p>
            </div>
          </div>
        </div>

        <ul className="space-y-1.5 text-sm font-medium text-[#3F4D61]">
          <li className="flex items-center gap-2"><CircleCheck size={14} className="text-indigo-500" /> Recomendaciones personalizadas</li>
          <li className="flex items-center gap-2"><CircleCheck size={14} className="text-indigo-500" /> Encuentra tu look ideal</li>
          <li className="flex items-center gap-2"><CircleCheck size={14} className="text-indigo-500" /> Respuestas por voz o chat</li>
        </ul>

        <button
          type="button"
          onClick={activateAssistant}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-indigo-500 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:brightness-110"
        >
          {(status.active || status.listening || status.speaking) && (
            <span className="flex items-center gap-0.5">
              <span className="h-2 w-1 rounded-full bg-white animate-[pulse_1.1s_ease-in-out_infinite]" />
              <span className="h-3 w-1 rounded-full bg-white/90 animate-[pulse_1.1s_ease-in-out_0.15s_infinite]" />
              <span className="h-2 w-1 rounded-full bg-white/75 animate-[pulse_1.1s_ease-in-out_0.3s_infinite]" />
            </span>
          )}
          {buttonLabel}
        </button>
      </div>
    </aside>
  );
}
