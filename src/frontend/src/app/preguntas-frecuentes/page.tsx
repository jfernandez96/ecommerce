export default function FaqPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-black">Preguntas frecuentes</h1>
      </header>

      <section className="space-y-8 text-foreground/90">
        <article>
          <h2 className="text-3xl font-black">1. ¿Que es?</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">Es una plataforma en linea dedicada a ofrecer prendas de vestir importadas, con enfoque en calidad y buen precio para nuestros clientes.</p>
        </article>

        <article>
          <h2 className="text-3xl font-black">2. ¿Como hago un pedido?</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">Elige los productos, agregalos al carrito, completa tus datos de entrega y confirma la compra.</p>
        </article>

        <article>
          <h2 className="text-3xl font-black">3. ¿Realizan envios a todo el Peru y el extranjero?</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">Actualmente realizamos envios a nivel nacional con operadores logisticos aliados.</p>
        </article>

        <article>
          <h2 className="text-3xl font-black">4. ¿Que metodos de pago aceptan?</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">Aceptamos tarjeta, transferencias y billeteras digitales segun configuracion vigente de la tienda.</p>
        </article>

        <article>
          <h2 className="text-3xl font-black">5. ¿Cuanto tarda en llegar mi pedido?</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">El tiempo de entrega depende de la ciudad destino. Normalmente varia entre 1 y 4 dias habiles.</p>
        </article>

        <article>
          <h2 className="text-3xl font-black">6. ¿Mis datos personales estan seguros?</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">Si. Aplicamos medidas de seguridad para proteger la informacion de nuestros clientes.</p>
        </article>

        <article id="terminos" className="scroll-mt-24">
          <h2 className="text-3xl font-black">Terminos y condiciones</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">Al comprar aceptas nuestras politicas comerciales, tiempos de entrega, validacion de stock y condiciones de postventa.</p>
        </article>

        <article id="cambios" className="scroll-mt-24">
          <h2 className="text-3xl font-black">Cambios y devoluciones</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">Puedes solicitar cambios segun politicas vigentes del producto. Revisa condiciones aplicables antes de confirmar tu compra.</p>
        </article>
      </section>
    </main>
  );
}
