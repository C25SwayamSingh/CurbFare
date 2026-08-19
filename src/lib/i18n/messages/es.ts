import type { Messages } from "./en";

/** Spanish (neutral Latin American, Mexican-leaning). Curbfare stays Curbfare. */
export const es: Messages = {
  common: {
    appName: "Curbfare",
    motto: "Encuentra carritos. Gana recompensas.",
    forVendors: "Para vendedores",
    signIn: "Iniciar sesión",
    signUp: "Crear cuenta",
    back: "Atrás",
    language: "Idioma",
  },
  landing: {
    eyebrow: "Carritos, troques y puestos de comida",
    heroTitleLead: "La mejor comida",
    heroTitleAccent: "se estaciona en la banqueta.",
    beatFind: "Encuentra carritos en el mapa en vivo.",
    beatEarn: "Gana puntos para recompensas cada vez que regresas.",
    startEarning: "Empieza a ganar puntos",
    exploreMap: "Explora el mapa",
    myRewards: "Mis recompensas",
    myDashboard: "Mi panel",
    hiName: "Hola, {name}",
    vendorsHeading: "¿Tienes un troque o carrito de comida?",
    vendorsSub:
      "Esta parte es para ti, el dueño. Dale a tus clientes de siempre una forma de encontrarte.",
    createVendorProfile: "Crea tu perfil de vendedor",
    cardLiveTitle: "Ponte en vivo con un toque",
    cardLiveBody: "Comparte tu ubicación de hoy al instante.",
    cardWeekTitle: "Publica tu semana",
    cardWeekBody: "Configúralo una vez y tus clientes llegan solos.",
    cardPointsTitle: "Puntos, no tarjetas de sellos",
    cardPointsBody: "Lealtad de cadena grande, a la medida de un carrito.",
    footerLine: "Curbfare. Comida callejera, encontrada.",
    footerAbout: "Nosotros",
    footerPrivacy: "Privacidad",
    footerTerms: "Términos",
  },
  vendorsPage: {
    title: "Usted maneja el carrito. Curbfare hace que regresen.",
    subtitle:
      "Si Swayam le mandó un correo o dejó una tarjeta en su ventanilla, es esto. Curbfare es un sitio web, no una app para descargar: su página, un pin en un mapa en vivo y un programa de puntos para sus clientes de siempre, todo con un código QR impreso.",
    howHeading: "Cómo funciona, en tres pasos",
    step1:
      "Configuramos su página juntos. Toma unos diez minutos, y cada negocio se revisa antes de hacerse público.",
    step2:
      "Pegue el código QR donde ordenan sus clientes. Ellos lo escanean y se registran gratis en el navegador de su teléfono.",
    step3:
      "Cuando alguien compra, usted teclea cuánto gastó. Cinco segundos. En ese momento el cliente gana sus puntos.",
    dealHeading: "El trato",
    deal1:
      "Gratis para los primeros 30 negocios fundadores por seis meses, posiblemente un año completo. Después, usted verá los precios antes de pagar un solo dólar.",
    deal2: "Usted elige las recompensas y lo que le cuestan.",
    deal3:
      "Sin comisión sobre sus ventas, sin tocar su efectivo ni sus precios.",
    deal4:
      "Sin contrato. Su negocio, su menú y sus clientes siguen siendo suyos, y puede parar cuando quiera.",
    readyHeading: "¿Listo, o tiene preguntas?",
    readySub:
      "El botón naranja crea su cuenta de vendedor. O simplemente responda al correo de Swayam y él lo deja todo listo con usted en persona.",
    startCta: "Crear su perfil de vendedor",
    emailCta: "Escribir a swayam@curbfare.app",
    hungryLead: "¿No es vendedor, solo tiene hambre?",
    hungryLink: "Vaya a la página principal",
    hungryTail: "para encontrar carritos cerca de usted.",
  },
  about: {
    title: "Por qué existe Curbfare",
    subtitle: "La mejor comida de la ciudad nunca ha tenido puerta.",
    curbHeading: "La banqueta llegó primero",
    curbBody:
      "Antes de los food halls y las apps de entrega, había un carrito en una esquina. Los vendedores ambulantes son los negocios más pequeños de una ciudad y de los más listos: una persona, una ventanilla, afuera con cualquier clima, recordando su orden antes de que termine de decirla. Nueva York nos enseñó cuánto puede vivir una ciudad de eso. Es una ciudad especial entre muchas que comen así.",
    loyaltyHeading: "La lealtad se volvió corporativa",
    loyaltyBody:
      "Las cadenas grandes resolvieron las recompensas hace décadas. Compre diez cafés en cualquier parte del país y una app recuerda cada uno. Mientras tanto, el carrito que de verdad lo conoce no tiene forma de premiarlo por regresar, ni de avisarle dónde estará mañana. Las relaciones más leales de la comida eran las únicas sin recompensa.",
    builtHeading: "Así que construimos la mitad que faltaba",
    builtBody:
      "Curbfare es un mapa en vivo y un programa de puntos a la medida de un carrito. El vendedor publica su ubicación con un toque y maneja lealtad de cadena grande con un solo código QR impreso: sin equipo, sin tableta, sin comisión por venta. Los clientes encuentran los carritos que aman mientras la comida sigue caliente, y ganan puntos en la ventanilla como en cualquier otro lugar. La relación entre un carrito y sus clientes va en ambas direcciones, así que las recompensas también deberían.",
    holdHeading: "A qué nos comprometemos",
    hold1:
      "Un pin solo dice En vivo cuando el vendedor lo dice. Nunca adivinamos ni presentamos una suposición como un hecho.",
    hold2:
      "Los vendedores conservan su marca, su menú, sus precios y sus clientes. Nosotros somos el mapa y los puntos, nada más.",
    hold3Lead:
      "No vendemos datos personales, y las cámaras y ubicaciones se quedan en su dispositivo. Los detalles están en nuestra",
    hold3Link: "política de privacidad",
    closing:
      "Construido en la banqueta de Nueva York por Swayam Singh. Rumbo a cada ciudad que come en la calle.",
    questionsLead: "¿Preguntas? Escriba a",
  },
  discover: {
    pageTitle: "Encuentra vendedores cerca de ti",
    yourLocation: "tu ubicación actual",
    privacyLine:
      "Tu ubicación solo se usa cuando la pides, solo para esta búsqueda, y nunca se guarda.",
    useMyLocation: "Usar mi ubicación actual",
    findingYou: "Buscándote…",
    geoUnsupported:
      "Tu navegador no permite usar la ubicación. Busca una zona abajo.",
    geoDenied:
      "Se negó el permiso de ubicación. No hay problema, busca una zona abajo.",
    geoFailed:
      "No pudimos obtener tu ubicación. Intenta de nuevo o busca una zona abajo.",
    searchLabel: "O busca una zona o un carrito",
    searchPlaceholder: "p. ej. Astoria, Roosevelt Ave, Birria-Landia",
    areaUnavailable:
      "La búsqueda por zona no está disponible ahora. Usa tu ubicación actual.",
    areaNotFound: "No encontramos esa zona. Prueba otra búsqueda.",
    within: "A",
    miles: "{count} mi",
    mileChipOne: "1 mi",
    ofPlace: "de {place}",
    refresh: "Actualizar",
    statusFilterLabel: "Filtrar por estado de ubicación",
    filterAll: "Todo",
    filterLive: "En vivo",
    filterScheduled: "Programado",
    filterRecurring: "Suele estar aquí",
    filterHotspots: "Puntos conocidos",
    nameFilterLabel: "Filtrar resultados por nombre o comida",
    nameFilterPlaceholder: "Filtra por nombre o comida, p. ej. birria",
    showingCount: "Mostrando {shown} de {total} cercanos",
    legendConfirmed: "Vendedores confirmados de Curbfare, con puntos y todo",
    legendPicks:
      "Selecciones de Curbfare: esquinas que exploramos buscando comida callejera",
    viewLabel: "Vista de resultados",
    listView: "Lista",
    mapView: "Mapa",
    loadFailed: "No pudimos cargar los vendedores cercanos. Intenta de nuevo.",
    looking: "Buscando vendedores cerca de ti…",
    noMatchTitle: "Nada cercano coincide con “{query}”.",
    noMatchBody:
      "{count} lugares cercanos no coincidieron. Prueba otro antojo o limpia el filtro.",
    noMatchBodyOne:
      "1 lugar cercano no coincidió. Prueba otro antojo o limpia el filtro.",
    clearFilter: "Limpiar filtro",
    emptyTitle: "No hay {noun} a menos de {radius} ahora mismo.",
    nounVendors: "vendedores",
    nounHotspots: "puntos conocidos de comida",
    mileOne: "milla",
    mileMany: "millas",
    emptyBody: "Prueba un radio más grande, otra zona, o vuelve más tarde.",
  },
};
